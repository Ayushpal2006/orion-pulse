package com.apkabill.pos.plugins;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "InvoiceShare")
public class InvoiceSharePlugin extends Plugin {

    private static final long CACHE_TTL_MS = 24L * 60L * 60L * 1000L;
    private static final String WHATSAPP_STANDARD = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";

    private void cleanupStaleCache(File dir) {
        try {
            File[] files = dir.listFiles();
            if (files == null) return;
            long cutoff = System.currentTimeMillis() - CACHE_TTL_MS;
            for (File file : files) {
                if (file.isFile() && file.lastModified() < cutoff) {
                    file.delete();
                }
            }
        } catch (Exception ignored) {
        }
    }

    private String sanitizeFilename(String rawName, int index) {
        String base = rawName == null ? "" : rawName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (base.isEmpty()) {
            base = "invoice-" + (index + 1) + ".png";
        }
        if (!base.toLowerCase().endsWith(".png")) {
            base = base + ".png";
        }
        return System.currentTimeMillis() + "-" + index + "-" + base;
    }

    private String sanitizePhoneDigits(String rawPhone) {
        if (rawPhone == null) return null;
        String digits = rawPhone.replaceAll("\\D+", "");
        if (digits.length() < 10 || digits.length() > 15 || digits.matches("^0+$")) {
            return null;
        }
        if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (digits.length() == 10) {
            digits = "91" + digits;
        }
        return digits;
    }

    private String findInstalledWhatsAppPackage(PackageManager pm, Intent baseIntent) {
        String[] candidates = new String[] { WHATSAPP_STANDARD, WHATSAPP_BUSINESS };
        for (String pkg : candidates) {
            try {
                pm.getPackageInfo(pkg, 0);
                Intent test = new Intent(baseIntent);
                test.setPackage(pkg);
                if (test.resolveActivity(pm) != null) {
                    return pkg;
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private Intent buildBaseShareIntent(ArrayList<Uri> uris, String text, String title) {
        Intent intent;
        if (uris.size() == 1) {
            intent = new Intent(Intent.ACTION_SEND);
            intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
            intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
            intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }
        intent.setType("image/png");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        intent.putExtra(Intent.EXTRA_SUBJECT, title);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        ClipData clipData = ClipData.newUri(getContext().getContentResolver(), title, uris.get(0));
        for (int i = 1; i < uris.size(); i++) {
            clipData.addItem(new ClipData.Item(uris.get(i)));
        }
        intent.setClipData(clipData);
        return intent;
    }

    @PluginMethod
    public void shareInvoice(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "Share Invoice");
        String customerPhone = sanitizePhoneDigits(call.getString("phone", ""));
        JSArray images = call.getArray("images");

        if (images == null || images.length() == 0) {
            call.reject("At least one generated invoice image is required to share.");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is unavailable.");
            return;
        }

        try {
            File shareDir = new File(getContext().getCacheDir(), "invoices");
            if (!shareDir.exists() && !shareDir.mkdirs()) {
                call.reject("Failed to create cache directory for invoice sharing.");
                return;
            }
            cleanupStaleCache(shareDir);

            String authority = getContext().getPackageName() + ".fileprovider";
            ArrayList<Uri> uris = new ArrayList<>();

            for (int i = 0; i < images.length(); i++) {
                JSONObject item = images.getJSONObject(i);
                String rawBase64 = item.optString("base64", "");
                if (rawBase64.isEmpty()) {
                    call.reject("Invoice image data at index " + i + " is empty.");
                    return;
                }
                int commaIdx = rawBase64.indexOf(',');
                if (commaIdx >= 0) {
                    rawBase64 = rawBase64.substring(commaIdx + 1);
                }

                byte[] pngBytes = Base64.decode(rawBase64, Base64.DEFAULT);
                String filename = sanitizeFilename(item.optString("filename", "invoice.png"), i);
                File outFile = new File(shareDir, filename);

                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(pngBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(getContext(), authority, outFile);
                uris.add(contentUri);
            }

            if (uris.isEmpty()) {
                call.reject("No invoice images were prepared for sharing.");
                return;
            }

            PackageManager pm = getContext().getPackageManager();
            Intent baseIntent = buildBaseShareIntent(uris, text, title);
            String whatsappPkg = findInstalledWhatsAppPackage(pm, baseIntent);
            final int fileCount = uris.size();

            activity.runOnUiThread(() -> {
                // 1. Direct WhatsApp chat with customer phone + PNG attachment when valid customer phone & WhatsApp exist
                if (customerPhone != null && whatsappPkg != null) {
                    try {
                        Intent directWaIntent = buildBaseShareIntent(uris, text, title);
                        directWaIntent.setPackage(whatsappPkg);
                        directWaIntent.putExtra("jid", customerPhone + "@s.whatsapp.net");
                        for (Uri uri : uris) {
                            getContext().grantUriPermission(
                                whatsappPkg,
                                uri,
                                Intent.FLAG_GRANT_READ_URI_PERMISSION
                            );
                        }
                        activity.startActivity(directWaIntent);
                        JSObject res = new JSObject();
                        res.put("shared", true);
                        res.put("fileCount", fileCount);
                        res.put("mode", "whatsapp_direct");
                        res.put("whatsappInstalled", true);
                        call.resolve(res);
                        return;
                    } catch (Exception ignored) {
                        // Fall through cleanly to native chooser if direct WhatsApp target fails
                    }
                }

                // 2. Fallback: native chooser (allows WhatsApp contact picker when phone is missing, or other apps)
                try {
                    Intent chooser = Intent.createChooser(buildBaseShareIntent(uris, text, title), title);
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(chooser);
                    JSObject res = new JSObject();
                    res.put("shared", true);
                    res.put("fileCount", fileCount);
                    res.put("mode", "native_chooser");
                    res.put("whatsappInstalled", whatsappPkg != null);
                    call.resolve(res);
                } catch (Exception launchErr) {
                    call.reject("Unable to open native share sheet: " + launchErr.getMessage(), launchErr);
                }
            });
        } catch (Exception err) {
            call.reject("Failed to prepare invoice image for sharing: " + err.getMessage(), err);
        }
    }
}
