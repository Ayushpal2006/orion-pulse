package com.apkabill.pos.plugins;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.connection.DeviceConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.dantsu.escposprinter.connection.tcp.TcpConnection;
import com.dantsu.escposprinter.connection.usb.UsbConnection;
import com.dantsu.escposprinter.connection.usb.UsbPrintersConnections;
import com.dantsu.escposprinter.exceptions.EscPosBarcodeException;
import com.dantsu.escposprinter.exceptions.EscPosConnectionException;
import com.dantsu.escposprinter.exceptions.EscPosEncodingException;
import com.dantsu.escposprinter.exceptions.EscPosParserException;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN }, alias = "bluetooth"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothConnect")
    }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "ThermalPrinterPlugin";
    private static final String[] INTERNAL_SERIAL_PATHS = new String[] {
        "/dev/ttyS1",
        "/dev/ttyS0",
        "/dev/ttyMT0",
        "/dev/ttyUSB0",
        "/dev/ttyACM0"
    };
    private static final String[] INTERNAL_PRINTER_NAME_HINTS = new String[] {
        "innerprinter",
        "internal",
        "z91",
        "pos-",
        "printer",
        "thermal",
        "mpt",
        "rp58",
        "rp80",
        "gp-",
        "pt-",
        "sunmi",
        "imin",
        "esc",
        "bt-58",
        "bt-80",
        "kp307"
    };

    // Single serialized worker thread so hardware I/O never blocks Android UI / Capacitor bridge
    private final ExecutorService printExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        printExecutor.shutdownNow();
    }

    private boolean isInternalType(String connectionType) {
        return "internal".equals(connectionType)
            || "z91".equals(connectionType)
            || "builtin".equals(connectionType)
            || "pos".equals(connectionType)
            || "android_pos".equals(connectionType);
    }

    private boolean requiresBluetoothPermission(String connectionType) {
        return "bluetooth".equals(connectionType) || "escpos".equals(connectionType) || isInternalType(connectionType);
    }

    /**
     * Android 12+ makes BLUETOOTH_CONNECT a runtime permission; touching paired devices or
     * opening a socket without it throws SecurityException. Returns true when the call was
     * parked on a permission prompt and will be re-dispatched by bluetoothPermsCallback.
     */
    private boolean requestBluetoothPermissionIfNeeded(PluginCall call, String connectionType) {
        if (!requiresBluetoothPermission(connectionType)
            || Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || getPermissionState("bluetoothConnect") == PermissionState.GRANTED) {
            return false;
        }
        requestPermissionForAlias("bluetoothConnect", call, "bluetoothPermsCallback");
        return true;
    }

    @PermissionCallback
    private void bluetoothPermsCallback(PluginCall call) {
        if (getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission was denied. Allow \"Nearby devices\" for Apka Bill in Android settings.");
            return;
        }
        switch (call.getMethodName()) {
            case "listBluetoothDevices": listBluetoothDevices(call); break;
            case "testConnection": testConnection(call); break;
            case "getPrinterStatus": getPrinterStatus(call); break;
            case "printReceipt": printReceipt(call); break;
            case "testPrint": testPrint(call); break;
            default: call.reject("Unknown method after permission grant: " + call.getMethodName());
        }
    }

    /**
     * List all paired Bluetooth thermal printers (DantSu Imaging devices first + all bonded devices,
     * since many Z91 / portable 58mm printers expose UNCATEGORIZED device classes).
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void listBluetoothDevices(PluginCall call) {
        if (requestBluetoothPermissionIfNeeded(call, "bluetooth")) return;
        JSArray deviceList = new JSArray();
        Set<String> seenAddresses = new HashSet<>();

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                JSObject ret = new JSObject();
                ret.put("devices", deviceList);
                call.resolve(ret);
                return;
            }

            // 1. Prioritize DantSu-detected printers
            try {
                BluetoothConnection[] connections = new BluetoothPrintersConnections().getList();
                if (connections != null) {
                    for (BluetoothConnection conn : connections) {
                        BluetoothDevice device = conn.getDevice();
                        if (device != null && device.getAddress() != null && seenAddresses.add(device.getAddress())) {
                            JSObject obj = new JSObject();
                            obj.put("name", device.getName() != null ? device.getName() : "Thermal Printer");
                            obj.put("address", device.getAddress());
                            obj.put("isLikelyPrinter", true);
                            deviceList.put(obj);
                        }
                    }
                }
            } catch (Exception ignored) {}

            // 2. Include all remaining bonded Bluetooth devices (needed for Z91 InnerPrinter / generic SPP modules)
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    if (device == null || device.getAddress() == null || !seenAddresses.add(device.getAddress())) {
                        continue;
                    }
                    String name = device.getName() != null ? device.getName() : "Paired Device";
                    boolean likelyPrinter = matchesPrinterName(name)
                        || (device.getBluetoothClass() != null
                            && device.getBluetoothClass().getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING);
                    JSObject obj = new JSObject();
                    obj.put("name", name);
                    obj.put("address", device.getAddress());
                    obj.put("isLikelyPrinter", likelyPrinter);
                    deviceList.put(obj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", deviceList);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Bluetooth permission required. Please allow Nearby Devices permission in Android Settings.", se);
        } catch (Exception e) {
            Log.e(TAG, "Error listing Bluetooth devices", e);
            call.reject("Could not read paired Bluetooth devices. Ensure Bluetooth is turned on.", e);
        }
    }

    /**
     * List connected USB thermal printers
     */
    @PluginMethod
    public void listUsbDevices(PluginCall call) {
        JSArray deviceList = new JSArray();
        try {
            UsbConnection[] connections = new UsbPrintersConnections(getContext()).getList();
            if (connections != null) {
                for (UsbConnection conn : connections) {
                    UsbDevice device = conn.getDevice();
                    if (device != null) {
                        JSObject obj = new JSObject();
                        obj.put("deviceId", device.getDeviceId());
                        obj.put("vendorId", device.getVendorId());
                        obj.put("productId", device.getProductId());
                        obj.put("deviceName", device.getDeviceName());
                        obj.put("productName", Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP ? device.getProductName() : device.getDeviceName());
                        deviceList.put(obj);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", deviceList);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error listing USB devices", e);
            call.reject("Failed to list USB printers: " + e.getLocalizedMessage(), e);
        }
    }

    /**
     * Query printer availability & connection health without blocking the UI thread.
     */
    @PluginMethod
    public void getPrinterStatus(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase(Locale.ROOT);
        if (requestBluetoothPermissionIfNeeded(call, connectionType)) return;

        printExecutor.execute(() -> {
            JSObject res = new JSObject();
            try {
                if ("browser".equals(connectionType)) {
                    res.put("success", true);
                    res.put("connected", true);
                    res.put("status", "CONNECTED");
                    res.put("message", "System print / PDF ready");
                    call.resolve(res);
                    return;
                }

                if (isInternalType(connectionType) && findWritableSerialNode() != null) {
                    File serialNode = findWritableSerialNode();
                    res.put("success", true);
                    res.put("connected", true);
                    res.put("status", "CONNECTED");
                    res.put("message", "Built-in POS printer port ready (" + serialNode.getAbsolutePath() + ")");
                    call.resolve(res);
                    return;
                }

                DeviceConnection connection = null;
                try {
                    connection = createConnection(call, connectionType);
                    if (connection != null) {
                        connection.connect();
                        boolean isConnected = connection.isConnected();
                        res.put("success", isConnected);
                        res.put("connected", isConnected);
                        res.put("status", isConnected ? "CONNECTED" : "DISCONNECTED");
                        res.put("message", isConnected ? "Printer connected and ready" : "Printer did not respond");
                        call.resolve(res);
                        return;
                    }
                } finally {
                    if (connection != null) {
                        try { connection.disconnect(); } catch (Exception ignored) {}
                    }
                }

                res.put("success", false);
                res.put("connected", false);
                res.put("status", "DISCONNECTED");
                res.put("message", "No matching printer detected");
                call.resolve(res);
            } catch (Exception e) {
                res.put("success", false);
                res.put("connected", false);
                res.put("status", "ERROR");
                res.put("message", toFriendlyPrinterError(e, connectionType));
                call.resolve(res);
            }
        });
    }

    /**
     * Test connection to specified printer asynchronously
     */
    @PluginMethod
    public void testConnection(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase(Locale.ROOT);
        if (requestBluetoothPermissionIfNeeded(call, connectionType)) return;

        printExecutor.execute(() -> {
            if (isInternalType(connectionType)) {
                File serialNode = findWritableSerialNode();
                if (serialNode != null) {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("message", "Built-in POS printer port ready (" + serialNode.getName() + ")");
                    call.resolve(res);
                    return;
                }
            }

            DeviceConnection connection = null;
            try {
                connection = createConnection(call, connectionType);
                if (connection == null) {
                    call.reject("Could not initialize connection for type: " + connectionType);
                    return;
                }

                connection.connect();
                boolean isConnected = connection.isConnected();
                connection.disconnect();

                JSObject res = new JSObject();
                res.put("success", isConnected);
                res.put("message", isConnected ? "Printer connected successfully!" : "Printer is offline or out of range.");
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "Connection test failed", e);
                call.reject(toFriendlyPrinterError(e, connectionType), e);
            } finally {
                if (connection != null) {
                    try { connection.disconnect(); } catch (Exception ignored) {}
                }
            }
        });
    }

    /**
     * Print formatted receipt text to Bluetooth, USB, Network, or Built-in Z91 POS printer
     */
    @PluginMethod
    public void printReceipt(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase(Locale.ROOT);
        if (requestBluetoothPermissionIfNeeded(call, connectionType)) return;
        String formattedText = call.getString("formattedText", "");
        printAsync(call, connectionType, formattedText);
    }

    private void printAsync(PluginCall call, String connectionType, String rawFormattedText) {
        final int printerDpi = call.getInt("printerDpi", 203);
        final float printableWidthMm = call.getFloat("printableWidthMm", 48.0f);
        final int charsPerLine = call.getInt("charsPerLine", 32);
        final boolean autoCut = call.getBoolean("autoCut", true);

        if (rawFormattedText == null || rawFormattedText.trim().isEmpty()) {
            call.reject("Formatted receipt content cannot be empty.");
            return;
        }

        final String formattedText = (autoCut && !rawFormattedText.contains("[C]<cut/>"))
            ? rawFormattedText + "\n[C]<cut/>\n"
            : rawFormattedText;

        printExecutor.execute(() -> {
            DeviceConnection connection = null;
            try {
                connection = createConnection(call, connectionType);
                EscPosPrinter printer = new EscPosPrinter(connection, printerDpi, printableWidthMm, charsPerLine);
                String printableText = resolveDantsuImages(printer, formattedText);
                printer.printFormattedText(printableText);

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("message", "Receipt printed successfully");
                call.resolve(res);
                return;
            } catch (Exception primaryErr) {
                // If built-in POS mode failed on Bluetooth/TCP, fall back to serial node (/dev/ttyS1 etc.)
                if (isInternalType(connectionType)) {
                    File serialNode = findWritableSerialNode();
                    if (serialNode != null && printToSerialDevice(serialNode, formattedText, autoCut)) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("message", "Receipt printed via built-in serial POS port (" + serialNode.getName() + ")");
                        call.resolve(res);
                        return;
                    }
                }
                Log.e(TAG, "Printing failed", primaryErr);
                call.reject(toFriendlyPrinterError(primaryErr, connectionType), primaryErr);
            } finally {
                if (connection != null) {
                    try { connection.disconnect(); } catch (Exception ignored) {}
                }
            }
        });
    }

    /**
     * Execute physical test print on selected thermal / Z91 internal printer
     */
    @PluginMethod
    public void testPrint(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase(Locale.ROOT);
        if (requestBluetoothPermissionIfNeeded(call, connectionType)) return;
        int charsPerLine = call.getInt("charsPerLine", 32);
        String paperWidth = charsPerLine <= 36 ? "58mm" : "80mm";

        StringBuilder sb = new StringBuilder();
        sb.append("[C]<b><font size='big'>APKA BILL POS</font></b>\n");
        sb.append("[C]================================\n");
        sb.append("[C]Thermal Printer Test Receipt\n");
        sb.append("[L]Connection:[R]").append(connectionType.toUpperCase(Locale.ROOT)).append("\n");
        sb.append("[L]Paper Width:[R]").append(paperWidth).append(" (").append(charsPerLine).append(" cols)\n");
        sb.append("[L]DPI:[R]203 DPI\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[L]Sample Item 1 x2[R]Rs. 100.00\n");
        sb.append("[L]Sample Item 2 x1[R]Rs.  50.00\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[L]<b>TOTAL</b>[R]<b>Rs. 150.00</b>\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[C]<b>PRINTER TEST SUCCESSFUL</b>\n");
        sb.append("[C]Thank you for using Apka Bill\n");
        sb.append("[C]<cut/>\n");

        printAsync(call, connectionType, sb.toString());
    }

    private boolean matchesPrinterName(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase(Locale.ROOT);
        for (String hint : INTERNAL_PRINTER_NAME_HINTS) {
            if (lower.contains(hint)) return true;
        }
        return false;
    }

    private boolean isLocalTcpDaemonListening(int port) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress("127.0.0.1", port), 350);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static final Pattern IMG_TAG_PATTERN = Pattern.compile("<img>(.*?)</img>", Pattern.DOTALL);

    /**
     * Converts data URLs or HTTP(S) image URLs in Dantsu <img> tags into ESC/POS hex strings
     * fitted to the thermal paper width while preserving aspect ratio and white background.
     * Drops invalid or unreadable logos gracefully instead of failing the receipt print.
     */
    private String resolveDantsuImages(EscPosPrinter printer, String formattedText) {
        if (formattedText == null || !formattedText.contains("<img>")) {
            return formattedText;
        }
        Matcher matcher = IMG_TAG_PATTERN.matcher(formattedText);
        StringBuffer out = new StringBuffer();
        int maxW = Math.max(96, Math.min(printer.getPrinterWidthPx(), 240));
        int maxH = 120;

        while (matcher.find()) {
            String src = matcher.group(1) != null ? matcher.group(1).trim() : "";
            String replacement = "";
            if (!src.isEmpty()) {
                // If caller already passed Dantsu hex string (only hex characters), preserve it directly
                if (src.matches("^[0-9a-fA-F]+$") && src.length() >= 16) {
                    replacement = "<img>" + src + "</img>";
                } else {
                    Bitmap rawBitmap = decodeLogoBitmap(src);
                    if (rawBitmap != null) {
                        Bitmap fitted = fitBitmapWhiteBackground(rawBitmap, maxW, maxH);
                        if (fitted != null) {
                            String hex = PrinterTextParserImg.bitmapToHexadecimalString(printer, fitted, false);
                            if (hex != null && !hex.isEmpty()) {
                                replacement = "<img>" + hex + "</img>";
                            }
                            if (fitted != rawBitmap) fitted.recycle();
                        }
                        rawBitmap.recycle();
                    }
                }
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        // Remove any empty alignment-only lines left behind when an invalid logo tag was stripped
        return out.toString().replaceAll("(?m)^\\[C\\]\\s*$\\n?", "");
    }

    private Bitmap decodeLogoBitmap(String src) {
        try {
            if (src.startsWith("data:image/")) {
                int commaIdx = src.indexOf(',');
                if (commaIdx > 0 && commaIdx + 1 < src.length()) {
                    String b64 = src.substring(commaIdx + 1);
                    byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                    return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                }
            } else if (src.startsWith("http://") || src.startsWith("https://")) {
                HttpURLConnection conn = (HttpURLConnection) new URL(src).openConnection();
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);
                conn.setDoInput(true);
                conn.connect();
                try (InputStream is = conn.getInputStream()) {
                    return BitmapFactory.decodeStream(is);
                } finally {
                    conn.disconnect();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to decode thermal store logo gracefully; omitting logo.", e);
        }
        return null;
    }

    private Bitmap fitBitmapWhiteBackground(Bitmap source, int maxW, int maxH) {
        int origW = source.getWidth();
        int origH = source.getHeight();
        if (origW <= 0 || origH <= 0) return null;

        float ratio = Math.min(1.0f, Math.min((float) maxW / origW, (float) maxH / origH));
        int targetW = Math.max(8, (Math.round(origW * ratio) / 8) * 8);
        int targetH = Math.max(8, Math.round(origH * (targetW / (float) origW)));

        Bitmap scaled = Bitmap.createScaledBitmap(source, targetW, targetH, true);
        Bitmap opaqueWhite = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(opaqueWhite);
        canvas.drawColor(Color.WHITE);
        canvas.drawBitmap(scaled, 0f, 0f, null);
        if (scaled != source) scaled.recycle();
        return opaqueWhite;
    }

    private File findWritableSerialNode() {
        for (String path : INTERNAL_SERIAL_PATHS) {
            try {
                File f = new File(path);
                if (f.exists() && f.canWrite()) {
                    return f;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    private boolean printToSerialDevice(File deviceFile, String formattedText, boolean autoCut) {
        try (OutputStream out = new FileOutputStream(deviceFile)) {
            // ESC @ (Initialize printer)
            out.write(new byte[] { 0x1B, 0x40 });
            String[] lines = formattedText.split("\n");
            for (String line : lines) {
                if (line.contains("<cut/>") || line.contains("<img>") || line.contains("<qrcode") || line.contains("<barcode")) continue;
                byte align = 0x00;
                if (line.startsWith("[C]")) align = 0x01;
                else if (line.startsWith("[R]")) align = 0x02;

                boolean bold = line.contains("<b>");
                String cleaned = line
                    .replace("[L]", "")
                    .replace("[C]", "")
                    .replace("[R]", "  ")
                    .replaceAll("<[^>]+>", "");

                out.write(new byte[] { 0x1B, 0x61, align });
                out.write(new byte[] { 0x1B, 0x45, (byte) (bold ? 1 : 0) });
                out.write((cleaned + "\n").getBytes(StandardCharsets.UTF_8));
            }
            out.write(new byte[] { 0x1B, 0x45, 0x00 });
            out.write("\n\n\n".getBytes(StandardCharsets.UTF_8));
            if (autoCut) {
                out.write(new byte[] { 0x1D, 0x56, 0x42, 0x00 });
            }
            out.flush();
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Serial fallback failed on " + deviceFile.getAbsolutePath(), e);
            return false;
        }
    }

    private String toFriendlyPrinterError(Exception e, String connectionType) {
        if (e instanceof EscPosConnectionException) {
            if ("bluetooth".equals(connectionType) || "escpos".equals(connectionType)) {
                return "Bluetooth printer is disconnected or turned off. Turn on the printer, check paper roll, and retry.";
            }
            if (isInternalType(connectionType)) {
                return "Built-in Z91/POS printer not ready. Check paper cover and ensure internal printer service or InnerPrinter Bluetooth is active.";
            }
            if ("lan".equals(connectionType) || "network".equals(connectionType) || "tcp".equals(connectionType)) {
                return "Network printer unreachable. Verify printer IP address, port 9100, and Wi-Fi connection.";
            }
            if ("usb".equals(connectionType)) {
                return "USB printer disconnected or permission not granted. Reconnect OTG cable and allow USB access.";
            }
        }
        if (e instanceof EscPosParserException || e instanceof EscPosEncodingException || e instanceof EscPosBarcodeException) {
            return "Receipt formatting error: " + e.getLocalizedMessage();
        }
        String msg = e != null ? e.getLocalizedMessage() : null;
        return (msg != null && !msg.trim().isEmpty())
            ? msg
            : "Printer communication error. Please check printer connection and paper.";
    }

    /**
     * Helper to instantiate connection based on parameters
     */
    @SuppressLint("MissingPermission")
    private DeviceConnection createConnection(PluginCall call, String connectionType) throws Exception {
        if ("bluetooth".equals(connectionType) || "escpos".equals(connectionType)) {
            String macAddress = call.getString("macAddress", call.getString("bluetoothMac", ""));
            if (macAddress != null && !macAddress.trim().isEmpty()) {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    throw new Exception("Bluetooth is not available on this Android device.");
                }
                if (!adapter.isEnabled()) {
                    throw new Exception("Bluetooth is turned off. Please turn on Bluetooth and try again.");
                }
                BluetoothDevice device = adapter.getRemoteDevice(macAddress.trim());
                return new BluetoothConnection(device);
            }
            BluetoothConnection first = BluetoothPrintersConnections.selectFirstPaired();
            if (first != null) {
                return first;
            }
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null && adapter.isEnabled()) {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice d : bonded) {
                        if (d != null && matchesPrinterName(d.getName())) {
                            return new BluetoothConnection(d);
                        }
                    }
                }
            }
            throw new Exception("No paired Bluetooth printer found. Pair your printer in Android Bluetooth settings first.");
        } else if (isInternalType(connectionType)) {
            // Z91 & Handheld Built-in POS Printers:
            // 1) Explicit MAC address if user bound internal Bluetooth module
            String macAddress = call.getString("macAddress", call.getString("bluetoothMac", ""));
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (macAddress != null && !macAddress.trim().isEmpty() && adapter != null && adapter.isEnabled()) {
                return new BluetoothConnection(adapter.getRemoteDevice(macAddress.trim()));
            }
            // 2) Internal Bluetooth module (Z91 / Sunmi InnerPrinter / MPT / BT-58)
            if (adapter != null && adapter.isEnabled()) {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice d : bonded) {
                        if (d != null && matchesPrinterName(d.getName())) {
                            return new BluetoothConnection(d);
                        }
                    }
                }
                BluetoothConnection first = BluetoothPrintersConnections.selectFirstPaired();
                if (first != null) {
                    return first;
                }
            }
            // 3) Loopback ESC/POS socket daemon if running locally on handheld terminal
            if (isLocalTcpDaemonListening(9100)) {
                return new TcpConnection("127.0.0.1", 9100);
            }
            throw new Exception("Built-in POS printer not detected on internal Bluetooth/loopback. Ensure InnerPrinter is enabled or select Bluetooth/USB printer.");
        } else if ("lan".equals(connectionType) || "network".equals(connectionType) || "tcp".equals(connectionType)) {
            String ip = call.getString("ip", call.getString("printerIp", ""));
            int port = call.getInt("port", call.getInt("printerPort", 9100));
            if (ip == null || ip.trim().isEmpty()) {
                throw new Exception("Network printer IP address is required (e.g. 192.168.1.150).");
            }
            return new TcpConnection(ip.trim(), port);
        } else if ("usb".equals(connectionType)) {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (usbManager == null) {
                throw new Exception("USB Service is not available on this Android device.");
            }
            UsbConnection firstUsb = UsbPrintersConnections.selectFirstConnected(getContext());
            if (firstUsb != null) {
                return firstUsb;
            }
            throw new Exception("No USB thermal printer detected. Connect printer via OTG cable and grant permission.");
        }
        throw new Exception("Unsupported printer connection type: " + connectionType);
    }
}
