package com.apkabill.mobile

import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HardwareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "HardwareModule"

    /**
     * Discovers and returns safe native device capabilities without faking hardware.
     */
    @ReactMethod
    fun getHardwareCapabilities(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val isPos = isKnownPOSHardware(Build.MANUFACTURER, Build.MODEL)

            val map = Arguments.createMap().apply {
                putString("manufacturer", Build.MANUFACTURER ?: "Unknown")
                putString("model", Build.MODEL ?: "Unknown")
                putString("device", Build.DEVICE ?: "Unknown")
                putString("brand", Build.BRAND ?: "Unknown")
                putInt("sdkVersion", Build.VERSION.SDK_INT)
                putBoolean("isPOSHardware", isPos)
                
                // Hardware availability checks
                putBoolean("hasCamera", pm?.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) ?: false)
                putBoolean("hasUsbHost", pm?.hasSystemFeature(PackageManager.FEATURE_USB_HOST) ?: false)
                putBoolean("hasBluetooth", pm?.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH) ?: false)
                
                // Thermal printer & hardware scanner detection status
                // If vendor SDK is not provided, safely reports NOT_DETECTED
                putString("printerStatus", if (isPos) "NOT_INITIALIZED" else "NOT_DETECTED")
                putString("scannerStatus", if (isPos) "NOT_INITIALIZED" else "NOT_DETECTED")
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("HARDWARE_ERROR", "Failed to retrieve hardware capabilities: ${e.message}", e)
        }
    }

    private fun isKnownPOSHardware(manufacturer: String?, model: String?): Boolean {
        val mfg = manufacturer?.lowercase() ?: ""
        val mdl = model?.lowercase() ?: ""
        val posKeywords = listOf("sunmi", "pax", "imin", "posiflex", "landi", "verifone", "telpo", "feitian", "urovo")
        return posKeywords.any { mfg.contains(it) || mdl.contains(it) }
    }
}
