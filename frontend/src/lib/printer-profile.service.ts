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
  bluetoothMac?: string;
  charactersPerLine?: number;
  printerDpi?: number;
  printableWidthMm?: number;
}

export function validatePrinterProfile(profile: Partial<PrinterProfile>): { valid: boolean; error?: string } {
  if (!profile.name || profile.name.trim() === "") {
    return { valid: false, error: "Profile name is required." };
  }

  const paperWidthMm = profile.paperWidth === "58mm" ? 58 : profile.paperWidth === "80mm" ? 80 : 210;
  const printableWidth = profile.printableWidthMm ?? (profile.paperWidth === "58mm" ? 48 : profile.paperWidth === "80mm" ? 72 : 190);
  const charsPerLine = profile.charactersPerLine ?? (profile.paperWidth === "58mm" ? 32 : profile.paperWidth === "80mm" ? 48 : 80);
  const dpi = profile.printerDpi ?? 203;

  if (printableWidth <= 0) {
    return { valid: false, error: "Printable width must be greater than 0 mm." };
  }

  if (printableWidth > paperWidthMm) {
    return {
      valid: false,
      error: `Printable width (${printableWidth}mm) cannot exceed paper roll width (${paperWidthMm}mm).`,
    };
  }

  if (charsPerLine <= 0) {
    return { valid: false, error: "Characters per line must be greater than 0." };
  }

  if (dpi <= 0) {
    return { valid: false, error: "Printer resolution (DPI) must be greater than 0." };
  }

  return { valid: true };
}

export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "prof-counter-01",
    name: "Counter Thermal Printer",
    isDefault: true,
    connectionType: "browser",
    paperWidth: "80mm",
    printableWidthMm: 72,
    charactersPerLine: 48,
    printerDpi: 203,
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
    printableWidthMm: 190,
    charactersPerLine: 80,
    printerDpi: 300,
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
    connectionType: "bluetooth",
    paperWidth: "58mm",
    printableWidthMm: 48,
    charactersPerLine: 32,
    printerDpi: 203,
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
    const storageKey = `orion_printer_config_${cacheKey}`;
    
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
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(storageKey, JSON.stringify({ profiles: loadedProfiles, activeId }));
          }
          return { profiles: loadedProfiles, activeProfile };
        }
      }
    } catch (err) {
      console.warn("[PrinterProfileService] Error fetching store settings, returning cached/local:", err);
    }

    const cached = this.profileCache.get(cacheKey);
    if (cached) {
      const activeProf = cached.profiles.find((p) => p.id === cached.activeId) || cached.profiles[0];
      return { profiles: cached.profiles, activeProfile: activeProf };
    }

    if (typeof window !== "undefined" && window.localStorage) {
      const localData = window.localStorage.getItem(storageKey);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (parsed.profiles && parsed.activeId) {
            const activeProf = parsed.profiles.find((p: PrinterProfile) => p.id === parsed.activeId) || parsed.profiles[0];
            return { profiles: parsed.profiles, activeProfile: activeProf };
          }
        } catch (e) {}
      }
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
    const storageKey = `orion_printer_config_${cacheKey}`;
    const activeProf = profiles.find((p) => p.id === activeProfileId) || profiles[0];

    const updatedProfiles = profiles.map((p) => ({
      ...p,
      isDefault: p.id === activeProfileId,
    }));

    this.profileCache.set(cacheKey, { profiles: updatedProfiles, activeId: activeProfileId });

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify({ profiles: updatedProfiles, activeId: activeProfileId }));
    }

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
      console.error("[PrinterProfileService] Save error (saved locally):", err);
      return true; // Still return true as it's saved locally for offline operation
    }
  }

  clearCache(): void {
    this.profileCache.clear();
  }
}

export const printerProfileService = PrinterProfileService.getInstance();
