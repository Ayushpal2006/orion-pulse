// Template Pre-compilation & Static Asset Cache for High-Performance Printing

import { ReceiptTemplateConfig, getActiveTemplateConfig } from "./receipt-template";
import { UniversalReceiptModel } from "./receipt-model";

interface CachedAsset {
  data: any;
  timestamp: number;
}

class ReceiptCacheManager {
  private static instance: ReceiptCacheManager;
  private templateCache: Map<string, ReceiptTemplateConfig> = new Map();
  private compiledHtmlCache: Map<string, string> = new Map();
  private assetCache: Map<string, CachedAsset> = new Map();

  public static getInstance(): ReceiptCacheManager {
    if (!ReceiptCacheManager.instance) {
      ReceiptCacheManager.instance = new ReceiptCacheManager();
    }
    return ReceiptCacheManager.instance;
  }

  getCompiledTemplate(presetName: string = "Classic"): ReceiptTemplateConfig {
    if (this.templateCache.has(presetName)) {
      return this.templateCache.get(presetName)!;
    }
    const tpl = getActiveTemplateConfig();
    this.templateCache.set(presetName, tpl);
    return tpl;
  }

  getCachedHtml(key: string): string | null {
    return this.compiledHtmlCache.get(key) || null;
  }

  setCachedHtml(key: string, html: string): void {
    this.compiledHtmlCache.set(key, html);
  }

  clearCache(): void {
    this.templateCache.clear();
    this.compiledHtmlCache.clear();
    this.assetCache.clear();
  }
}

export const receiptCache = ReceiptCacheManager.getInstance();
