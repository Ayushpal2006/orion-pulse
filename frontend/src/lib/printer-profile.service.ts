import { API_BASE_URL, apiFetch } from "./api";

export interface PrinterProfile {
  id: string;
  name: string;
  isDefault: boolean;
  connectionType: "browser" | "escpos" | "usb" | "bluetooth" | "lan" | "android_pos";
  paperWidth: "58mm" | "80mm" | "A4";
  receiptTemplate: "Classic" | "Compact" | "Modern" | "Retail" | "Minimal";
  autoCut: boolean;
  showLogo: boolean;
  showQr: boolean;
  showBarcode: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  footerText?: string;
  printerIp?: string;
  printerPort?: number;
  usbVendorId?: string;
  usbProductId?: string;
  bluetoothDeviceName?: string;
}

export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "prof-counter-01",
    name: "Counter Thermal Printer",
    isDefault: true,
    connectionType: "browser",
    paperWidth: "80mm",
    receiptTemplate: "Classic",
    autoCut: true,
    showLogo: true,
    showQr: true,
    showBarcode: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  {
    id: "prof-office-a4",
    name: "Office A4 Printer",
    isDefault: false,
    connectionType: "browser",
    paperWidth: "A4",
    receiptTemplate: "Modern",
    autoCut: false,
    showLogo: true,
    showQr: true,
    showBarcode: false,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
    marginRight: 10,
  },
  {
    id: "prof-compact-58",
    name: "Compact 58mm Mini Printer",
    isDefault: false,
    connectionType: "browser",
    paperWidth: "58mm",
    receiptTemplate: "Compact",
    autoCut: true,
    showLogo: false,
    showQr: true,
    showBarcode: false,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
];

export class PrinterProfileService {
  private static instance: PrinterProfileService;
  private profileCache: Map<string, { profiles: PrinterProfile[]; activeId: string }> = new Map();

  public static getInstance(): PrinterProfileService {
    if (!PrinterProfileService.instance) {
      PrinterProfileService.instance = new PrinterProfileService();
    }
    return PrinterProfileService.instance;
  }

  /**
   * Load printer settings & profiles per store context
   */
  async getStorePrinterConfig(storeId?: number): Promise<{ profiles: PrinterProfile[]; activeProfile: PrinterProfile }> {
    const cacheKey = `store_${storeId || "active"}`;
    
    try {
      const res = await apiFetch(`${API_BASE_URL}/settings`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const rawProfiles = json.data.printer_profiles;
          const rawActiveId = json.data.active_printer_profile_id;

          let loadedProfiles: PrinterProfile[] = DEFAULT_PRINTER_PROFILES;
          if (rawProfiles) {
            try {
              const parsed = typeof rawProfiles === "string" ? JSON.parse(rawProfiles) : rawProfiles;
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedProfiles = parsed;
              }
            } catch (e) {
              console.warn("[PrinterProfileService] Error parsing profiles JSON:", e);
            }
          }

          const activeId = rawActiveId || loadedProfiles.find((p) => p.isDefault)?.id || loadedProfiles[0].id;
          const activeProfile = loadedProfiles.find((p) => p.id === activeId) || loadedProfiles[0];

          this.profileCache.set(cacheKey, { profiles: loadedProfiles, activeId });
          return { profiles: loadedProfiles, activeProfile };
        }
      }
    } catch (err) {
      console.warn("[PrinterProfileService] Error fetching store settings, returning cached/default:", err);
    }

    const cached = this.profileCache.get(cacheKey);
    if (cached) {
      const activeProf = cached.profiles.find((p) => p.id === cached.activeId) || cached.profiles[0];
      return { profiles: cached.profiles, activeProfile: activeProf };
    }

    return { profiles: DEFAULT_PRINTER_PROFILES, activeProfile: DEFAULT_PRINTER_PROFILES[0] };
  }

  /**
   * Persist printer profiles for active store
   */
  async saveStorePrinterConfig(
    profiles: PrinterProfile[],
    activeProfileId: string,
    storeId?: number
  ): Promise<boolean> {
    const cacheKey = `store_${storeId || "active"}`;
    const activeProf = profiles.find((p) => p.id === activeProfileId) || profiles[0];

    const updatedProfiles = profiles.map((p) => ({
      ...p,
      isDefault: p.id === activeProfileId,
    }));

    this.profileCache.set(cacheKey, { profiles: updatedProfiles, activeId: activeProfileId });

    try {
      const payload = {
        printer_profiles: JSON.stringify(updatedProfiles),
        active_printer_profile_id: activeProfileId,
        printer_type: activeProf.connectionType,
        paper_width: activeProf.paperWidth,
        receipt_template: activeProf.receiptTemplate,
        auto_cut: activeProf.autoCut ? "1" : "0",
      };

      const res = await apiFetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (err) {
      console.error("[PrinterProfileService] Save error:", err);
      return false;
    }
  }

  clearCache(): void {
    this.profileCache.clear();
  }
}

export const printerProfileService = PrinterProfileService.getInstance();
