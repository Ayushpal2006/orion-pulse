/**
 * Apka Bill Mobile - Native Android POS Printer Driver
 *
 * Communicates with native Kotlin PrinterModule via React Native bridge.
 * Safe fallback to mock driver if native bridge is unavailable.
 */

import { NativeModules, Platform } from 'react-native';
import { IPrinterDriver, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import { MockPrinterDriver } from '../mock/MockPrinter';
import ReceiptFormatter from '../utils/ReceiptFormatter';

const { PrinterModule } = NativeModules;

export class AndroidPrinterDriver implements IPrinterDriver {
  type = 'BUILT_IN' as const;
  name = 'Built-in Android Thermal POS Printer';
  private fallbackMock = new MockPrinterDriver();

  private isNativeModuleAvailable(): boolean {
    return Platform.OS === 'android' && !!PrinterModule;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) {
      return false;
    }
    try {
      const available = await PrinterModule.isPrinterAvailable();
      return !!available;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.isNativeModuleAvailable()) {
      return 'NOT_AVAILABLE';
    }

    try {
      const statusObj = await PrinterModule.getPrinterStatus();
      if (statusObj && statusObj.status) {
        return statusObj.status as PrinterStatus;
      }
      return statusObj?.isPOSHardware ? 'READY' : 'NOT_AVAILABLE';
    } catch (err: any) {
      console.warn('[AndroidPrinterDriver] Error checking native printer status:', err.message);
      return 'ERROR';
    }
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    // Generate 58mm text representation if not already provided
    const formattedText = payload.formattedText || ReceiptFormatter.format58mmText(payload);
    const enrichedPayload = { ...payload, formattedText };

    if (!this.isNativeModuleAvailable()) {
      console.warn('[AndroidPrinterDriver] Native PrinterModule unavailable. Falling back to virtual driver.');
      return this.fallbackMock.printReceipt(enrichedPayload);
    }

    try {
      const nativeResult = await PrinterModule.printReceipt(enrichedPayload);

      if (nativeResult && nativeResult.success) {
        return {
          success: true,
          status: 'READY',
          bytesPrinted: nativeResult.bytesPrinted || formattedText.length,
          formattedText,
        };
      }

      return {
        success: false,
        status: (nativeResult?.status as PrinterStatus) || 'ERROR',
        error: nativeResult?.error || 'Native print failed',
        formattedText,
      };
    } catch (err: any) {
      console.error('[AndroidPrinterDriver] Native print error:', err.message);
      return {
        success: false,
        status: 'ERROR',
        error: err.message || 'Android hardware printer error',
        formattedText,
      };
    }
  }
}

export default AndroidPrinterDriver;
