// Module 11, 12, 13: Notification Engine, REST API Key Manager & Plugin System for Apka Bill V2

export type NotificationType = "low_stock" | "expired_product" | "pending_purchase" | "transfer_request" | "payment_due" | "system";

export interface SystemNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface PluginExtension {
  id: string;
  name: string;
  category: "payment" | "shipping" | "whatsapp" | "sms" | "crm" | "erp" | "marketplace";
  enabled: boolean;
  config: Record<string, any>;
}

export class NotificationsAndPluginsService {
  private static instance: NotificationsAndPluginsService;
  private notifications: SystemNotification[] = [];
  private plugins: Map<string, PluginExtension> = new Map();

  public static getInstance(): NotificationsAndPluginsService {
    if (!NotificationsAndPluginsService.instance) {
      NotificationsAndPluginsService.instance = new NotificationsAndPluginsService();
      NotificationsAndPluginsService.instance.registerDefaultPlugins();
    }
    return NotificationsAndPluginsService.instance;
  }

  private registerDefaultPlugins(): void {
    const defaults: PluginExtension[] = [
      { id: "plg_razorpay", name: "Razorpay / UPI Payment Gateway", category: "payment", enabled: true, config: {} },
      { id: "plg_shiprocket", name: "Shiprocket Logistics & Shipping", category: "shipping", enabled: false, config: {} },
      { id: "plg_whatsapp", name: "Meta WhatsApp Business API", category: "whatsapp", enabled: true, config: {} },
      { id: "plg_tally", name: "Tally Prime Auto Sync Plugin", category: "erp", enabled: true, config: {} },
    ];
    for (const p of defaults) {
      this.plugins.set(p.id, p);
    }
  }

  notify(type: NotificationType, title: string, message: string): SystemNotification {
    const notification: SystemNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      title,
      message,
      read: false,
      timestamp: new Date().toISOString(),
    };
    this.notifications.unshift(notification);
    return notification;
  }

  getNotifications(): SystemNotification[] {
    return this.notifications;
  }

  getUnreadNotifications(): SystemNotification[] {
    return this.notifications.filter((n) => !n.read);
  }

  getPlugins(): PluginExtension[] {
    return Array.from(this.plugins.values());
  }

  togglePlugin(pluginId: string, enabled: boolean): PluginExtension {
    const plg = this.plugins.get(pluginId);
    if (!plg) throw new Error("Plugin not found");
    plg.enabled = enabled;
    return plg;
  }
}

export const notificationsAndPluginsService = NotificationsAndPluginsService.getInstance();
