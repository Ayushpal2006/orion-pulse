# APKA BILL V2: HARDWARE ADAPTER IMPLEMENTATION GUIDE

---

## 1. IMPLEMENTING A NEW HARDWARE ADAPTER

To support new POS hardware manufacturers (e.g. PAX, Telpo, Wiseasy), implement `PrintAdapter` & `IHardwareAdapter`:

```ts
import { PrintAdapter } from "./print-adapter";
import { IHardwareAdapter, HardwareDeviceStatus } from "./hardware-abstraction";

export class CustomPosAdapter implements PrintAdapter, IHardwareAdapter {
  async connect(): Promise<boolean> {
    return typeof (window as any).CustomPrinterSDK !== "undefined";
  }

  async disconnect(): Promise<void> {}

  async getStatus(): Promise<HardwareDeviceStatus> {
    return {
      deviceType: "printer",
      manufacturer: "CustomSDK" as any,
      isConnected: await this.connect(),
      isBusy: false,
      firmwareVersion: "v1.0",
      driverVersion: "v1.0",
    };
  }

  async print(receipt: any): Promise<void> {
    // Invoke native SDK print command
  }
}
```
