package com.apkabill.pos.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
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
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.HashMap;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN }, name = "bluetooth"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }, name = "bluetoothConnect")
    }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "ThermalPrinterPlugin";

    /**
     * List all paired Bluetooth thermal printers
     */
    @PluginMethod
    public void listBluetoothDevices(PluginCall call) {
        JSArray deviceList = new JSArray();
        try {
            BluetoothPrintersConnections[] connections = BluetoothPrintersConnections.getList();
            if (connections != null) {
                for (BluetoothPrintersConnections conn : connections) {
                    BluetoothDevice device = conn.getDevice();
                    if (device != null) {
                        JSObject obj = new JSObject();
                        obj.put("name", device.getName() != null ? device.getName() : "Unknown Printer");
                        obj.put("address", device.getAddress());
                        deviceList.put(obj);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", deviceList);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error listing Bluetooth devices", e);
            call.reject("Failed to list Bluetooth devices: " + e.getLocalizedMessage(), e);
        }
    }

    /**
     * List connected USB thermal printers
     */
    @PluginMethod
    public void listUsbDevices(PluginCall call) {
        JSArray deviceList = new JSArray();
        try {
            UsbPrintersConnections[] connections = UsbPrintersConnections.getList(getContext());
            if (connections != null) {
                for (UsbPrintersConnections conn : connections) {
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
            call.reject("Failed to list USB devices: " + e.getLocalizedMessage(), e);
        }
    }

    /**
     * Test connection to specified printer
     */
    @PluginMethod
    public void testConnection(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase();
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
            res.put("message", isConnected ? "Connection established successfully!" : "Failed to connect to printer.");
            call.resolve(res);
        } catch (EscPosConnectionException e) {
            Log.e(TAG, "Connection test failed", e);
            call.reject("Printer connection test failed: " + e.getMessage(), e);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error testing connection", e);
            call.reject("Unexpected connection error: " + e.getMessage(), e);
        }
    }

    /**
     * Print formatted receipt text to KP307 or compatible ESC/POS thermal printer
     */
    @PluginMethod
    public void printReceipt(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase();
        String formattedText = call.getString("formattedText", "");
        int printerDpi = call.getInt("printerDpi", 203);
        float printableWidthMm = call.getFloat("printableWidthMm", 72.0f);
        int charsPerLine = call.getInt("charsPerLine", 48);
        boolean autoCut = call.getBoolean("autoCut", true);

        if (formattedText == null || formattedText.trim().isEmpty()) {
            call.reject("Formatted text payload cannot be empty.");
            return;
        }

        // Add paper cut tag if enabled and not present
        if (autoCut && !formattedText.contains("[C]<cut/>")) {
            formattedText = formattedText + "\n[C]<cut/>\n";
        }

        DeviceConnection connection = null;
        try {
            connection = createConnection(call, connectionType);
            if (connection == null) {
                call.reject("Failed to create connection instance for: " + connectionType);
                return;
            }

            EscPosPrinter printer = new EscPosPrinter(connection, printerDpi, printableWidthMm, charsPerLine);
            printer.printFormattedText(formattedText);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("message", "Receipt printed successfully to KP307 printer");
            call.resolve(res);
        } catch (EscPosConnectionException e) {
            Log.e(TAG, "EscPos Connection Exception", e);
            call.reject("Printer connection error: " + e.getMessage(), e);
        } catch (EscPosParserException e) {
            Log.e(TAG, "EscPos Parser Exception", e);
            call.reject("Printer format parser error: " + e.getMessage(), e);
        } catch (EscPosEncodingException e) {
            Log.e(TAG, "EscPos Encoding Exception", e);
            call.reject("Printer character encoding error: " + e.getMessage(), e);
        } catch (EscPosBarcodeException e) {
            Log.e(TAG, "EscPos Barcode Exception", e);
            call.reject("Printer barcode generation error: " + e.getMessage(), e);
        } catch (Exception e) {
            Log.e(TAG, "General printer exception", e);
            call.reject("Printing failed: " + e.getLocalizedMessage(), e);
        } finally {
            if (connection != null) {
                try {
                    connection.disconnect();
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Execute physical test print on KP307 printer
     */
    @PluginMethod
    public void testPrint(PluginCall call) {
        String connectionType = call.getString("connectionType", "bluetooth").toLowerCase();
        int charsPerLine = call.getInt("charsPerLine", 48);

        StringBuilder sb = new StringBuilder();
        sb.append("[C]<b><font size='big'>KP307 TEST PRINT</font></b>\n");
        sb.append("[C]================================\n");
        sb.append("[C]Orion POS Native ESC/POS Bridge\n");
        sb.append("[L]Connection: [R]").append(connectionType.toUpperCase()).append("\n");
        sb.append("[L]Width: [R]80mm / 72mm (576 dots)\n");
        sb.append("[L]DPI: [R]203 DPI\n");
        sb.append("[L]Chars/Line: [R]").append(charsPerLine).append("\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[L]Left Alignment[R]Right Alignment\n");
        sb.append("[C]Center Text Alignment Test\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[C]<b><font size='tall'>PHYSICAL TEST SUCCESS</font></b>\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[C]<cut/>\n");

        call.put("formattedText", sb.toString());
        printReceipt(call);
    }

    /**
     * Helper to instantiate connection based on parameters
     */
    private DeviceConnection createConnection(PluginCall call, String connectionType) throws Exception {
        if ("bluetooth".equals(connectionType)) {
            String macAddress = call.getString("macAddress", call.getString("bluetoothMac", ""));
            if (macAddress != null && !macAddress.trim().isEmpty()) {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    throw new Exception("Bluetooth adapter is not available on this Android device.");
                }
                BluetoothDevice device = adapter.getRemoteDevice(macAddress.trim());
                return new BluetoothConnection(device);
            }
            // Fallback: pick first paired printer connection if no MAC provided
            BluetoothPrintersConnections first = BluetoothPrintersConnections.selectFirstPaired();
            if (first != null) {
                return first;
            }
            throw new Exception("No Bluetooth printer selected and no paired printer found.");
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
            UsbPrintersConnections firstUsb = UsbPrintersConnections.selectFirstConnected(getContext());
            if (firstUsb != null) {
                return firstUsb;
            }
            throw new Exception("No USB thermal printer detected on USB Host interface.");
        }
        throw new Exception("Unsupported printer connection type: " + connectionType);
    }
}
