/**
 * Apka Bill Mobile - Native Hardware Service Bridge
 *
 * Exposes device-level hardware capabilities without faking availability.
 */

import { NativeModules, Platform } from 'react-native';
import { HardwareCapabilities } from './types';

const { HardwareModule } = NativeModules;

export const HardwareService = {
  /**
   * Retrieves native device hardware capabilities
   */
  async getCapabilities(): Promise<HardwareCapabilities> {
    if (Platform.OS !== 'android' || !HardwareModule) {
      return {
        manufacturer: Platform.OS === 'ios' ? 'Apple' : 'Generic',
        model: Platform.OS === 'ios' ? 'iOS Device' : 'Web/Simulator',
        device: Platform.OS,
        brand: Platform.OS,
        sdkVersion: 0,
        isPOSHardware: false,
        hasCamera: false,
        hasUsbHost: false,
        hasBluetooth: false,
        printerStatus: 'UNSUPPORTED',
        scannerStatus: 'UNSUPPORTED',
      };
    }

    try {
      const caps = await HardwareModule.getHardwareCapabilities();
      return caps as HardwareCapabilities;
    } catch (err: any) {
      console.warn('[HardwareService] Failed to query native hardware:', err.message);
      return {
        manufacturer: 'Unknown',
        model: 'Unknown',
        device: 'Android',
        brand: 'Android',
        sdkVersion: Platform.Version ? Number(Platform.Version) : 0,
        isPOSHardware: false,
        hasCamera: false,
        hasUsbHost: false,
        hasBluetooth: false,
        printerStatus: 'NOT_DETECTED',
        scannerStatus: 'NOT_DETECTED',
      };
    }
  },
};

export default HardwareService;
