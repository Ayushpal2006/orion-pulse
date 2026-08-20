import type { Product } from "./mock-data";

const getApiBaseUrl = (): string => {
  const windowEnv = typeof window !== "undefined"
    ? ((window as any).__ENV__?.VITE_API_URL || (window as any).VITE_API_URL || (window as any).API_BASE_URL || localStorage.getItem("VITE_API_URL"))
    : undefined;

  const rawUrl = windowEnv || (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8080";
  let cleanUrl = rawUrl.trim().replace(/['"]/g, "");

  // Strip trailing /api or /api/ if provided in VITE_API_URL to prevent /api/api double prefixing
  cleanUrl = cleanUrl.replace(/\/api\/?$/i, "");
  // Strip trailing slashes
  cleanUrl = cleanUrl.replace(/\/+$/, "");

  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    if (cleanUrl.startsWith("localhost") || cleanUrl.startsWith("127.0.0.1")) {
      cleanUrl = `http://${cleanUrl}`;
    } else {
      cleanUrl = `https://${cleanUrl}`;
    }
  }

  // Force HTTPS if frontend is loaded over HTTPS and target is not localhost/127.0.0.1 (Mixed Content prevention)
  if (typeof window !== "undefined" && window.location.protocol === "https:" && cleanUrl.startsWith("http://")) {
    if (!cleanUrl.includes("localhost") && !cleanUrl.includes("127.0.0.1")) {
      cleanUrl = cleanUrl.replace(/^http:\/\//i, "https://");
    }
  }

  return cleanUrl;
};

export function buildImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `${API_BASE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export const API_BASE_URL = getApiBaseUrl();
console.log("API BASE URL:", API_BASE_URL);

export function formatHttpError(status: number, serverError?: string): string {
  if (serverError && typeof serverError === "string" && serverError.trim() !== "") {
    return serverError;
  }
  switch (status) {
    case 401: return "Authentication required. Please log in to continue.";
    case 403: return "Access forbidden. You do not have permission to perform this action.";
    case 404: return "Requested resource was not found on the server.";
    case 409: return "Conflict error. The record or invoice already exists.";
    case 422: return "Validation error. Please verify your input data.";
    case 429: return "Too many requests. Please slow down and try again shortly.";
    case 500: return "Internal server error. Please try again later.";
    case 503: return "Service temporarily unavailable. Please retry shortly.";
    default: return `Server error (HTTP ${status}). Please try again.`;
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Offline Mode: Device is currently disconnected from internet.");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const currentStoreId = typeof window !== "undefined" ? localStorage.getItem("currentStoreId") || "" : "";

  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (currentStoreId && !headers.has("X-Store-Id")) {
    headers.set("X-Store-Id", currentStoreId);
  }

  try {
    const res = await fetch(input, { ...init, headers });
    return res;
  } catch (error: any) {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    console.error(`[apiFetch Error] ${init.method || "GET"} ${urlStr} failed:`, error);
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Network error. Backend server is unreachable or offline.");
    }
    throw error;
  }
}

export function mapBackendProductToFrontend(p: any): Product {
  const mappedImage = buildImageUrl(p.image_url);
  
  console.log(`[Frontend Map] Backend image_url (Database value): ${p.image_url} -> Mapped image source (Frontend): ${mappedImage}`);

  return {
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || "",
    category: p.category || "General",
    purchase: p.purchase_price / 100, // Convert paise (integer) to Rupees (decimal)
    price: p.selling_price / 100,      // Convert paise (integer) to Rupees (decimal)
    gst: p.gst ?? 18,
    stock: p.stock ?? 0,
    reorder: p.minimum_stock ?? 0,
    emoji: "📦",
    image: mappedImage,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function mapFrontendProductToBackend(p: Partial<Product>): any {
  const result: any = {};
  if (p.name !== undefined) result.name = p.name;
  if (p.sku !== undefined) result.sku = p.sku;
  if (p.barcode !== undefined) result.barcode = p.barcode.trim() || null;
  if (p.category !== undefined) result.category = p.category || null;
  if (p.purchase !== undefined) result.purchase_price = Math.round(p.purchase * 100); // Convert Rupees to paise
  if (p.price !== undefined) result.selling_price = Math.round(p.price * 100);       // Convert Rupees to paise
  if (p.gst !== undefined) result.gst = p.gst;
  if (p.stock !== undefined) result.stock = p.stock;
  if (p.reorder !== undefined) result.minimum_stock = p.reorder;
  if (p.image !== undefined) {
    if (p.image) {
      result.image_url = p.image.startsWith(API_BASE_URL)
        ? p.image.replace(API_BASE_URL, "")
        : p.image;
    } else {
      result.image_url = null;
    }
  }
  return result;
}

import { saveProductsOffline, getProductsOffline, saveCustomersOffline, getCustomersOffline, saveSettingsOffline, getSettingsOffline } from "./offline-db";

export async function getProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/products`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      saveProductsOffline(payload.data);
      return payload.data.map(mapBackendProductToFrontend);
    }
    return [];
  } catch (error) {
    console.warn("getProducts online fetch failed, attempting IndexedDB offline cache:", error);
    const cached = await getProductsOffline();
    if (cached && cached.length > 0) {
      return cached.map(mapBackendProductToFrontend);
    }
    return [];
  }
}

export async function getProductMovements(productId: number): Promise<any[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/products/${productId}/movements`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function searchProducts(q: string): Promise<Product[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/products/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data.map(mapBackendProductToFrontend);
    }
    return [];
  } catch (error) {
    console.warn("searchProducts online fetch failed, searching IndexedDB offline cache:", error);
    const cached = await getProductsOffline();
    if (cached && cached.length > 0) {
      const lower = q.toLowerCase();
      const filtered = cached.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          (p.barcode && p.barcode.toLowerCase().includes(lower))
      );
      return filtered.map(mapBackendProductToFrontend);
    }
    return [];
  }
}

export async function createProduct(product: Partial<Product>): Promise<Product> {
  try {
    const backendBody = mapFrontendProductToBackend(product);
    const res = await apiFetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendBody),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return mapBackendProductToFrontend(payload.data);
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<Product> {
  try {
    const backendBody = mapFrontendProductToBackend(product);
    const res = await apiFetch(`${API_BASE_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendBody),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return mapBackendProductToFrontend(payload.data);
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function deleteProductApi(id: string): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/products/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getCustomers(): Promise<any[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      saveCustomersOffline(payload.data);
      return payload.data;
    }
    return [];
  } catch (error) {
    console.warn("getCustomers online fetch failed, attempting IndexedDB offline cache:", error);
    const cached = await getCustomersOffline();
    if (cached && cached.length > 0) {
      return cached;
    }
    return [];
  }
}

export async function searchCustomers(q: string): Promise<any[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    console.warn("searchCustomers online fetch failed, searching IndexedDB offline cache:", error);
    const cached = await getCustomersOffline();
    if (cached && cached.length > 0) {
      const lower = q.toLowerCase();
      return cached.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          (c.phone && c.phone.includes(lower)) ||
          (c.email && c.email.toLowerCase().includes(lower))
      );
    }
    return [];
  }
}

export async function updateCustomer(id: string | number, dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function deleteCustomerApi(id: string | number): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getCustomerInvoices(id: string | number): Promise<any[]> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers/${id}/invoices`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createCustomer(dto: {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getSuppliers(q?: string, sort?: string, includeArchived?: boolean): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (sort) params.append("sort", sort);
    if (includeArchived) params.append("includeArchived", "true");

    const res = await apiFetch(`${API_BASE_URL}/api/suppliers?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createSupplier(dto: {
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function updateSupplier(id: string | number, dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function deleteSupplierApi(id: string | number): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function checkout(dto: {
  customerPhone: string;
  paymentMethod: string;
  cashierName: string;
  items: { productId: number; quantity: number }[];
}): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    return payload;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getDashboardData(): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/dashboard`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getReportsData(
  filter: string,
  startDate?: string,
  endDate?: string,
  showVoidInvoices: boolean = false
): Promise<any> {
  try {
    let url = `${API_BASE_URL}/reports?filter=${encodeURIComponent(filter)}`;
    if (startDate) {
      url += `&startDate=${encodeURIComponent(startDate)}`;
    }
    if (endDate) {
      url += `&endDate=${encodeURIComponent(endDate)}`;
    }
    if (showVoidInvoices) {
      url += `&showVoidInvoices=true`;
    }
    const res = await apiFetch(url);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function downloadReportPdfApi(
  filter: string,
  startDate?: string,
  endDate?: string,
  showVoidInvoices: boolean = false
): Promise<Blob> {
  let url = `${API_BASE_URL}/reports/pdf?filter=${encodeURIComponent(filter)}`;
  if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
  if (showVoidInvoices) url += `&showVoidInvoices=true`;

  const res = await apiFetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `PDF export failed with status: ${res.status}`);
  }
  return res.blob();
}

export async function downloadReportExcelApi(
  filter: string,
  startDate?: string,
  endDate?: string,
  showVoidInvoices: boolean = false
): Promise<Blob> {
  let url = `${API_BASE_URL}/reports/excel?filter=${encodeURIComponent(filter)}`;
  if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
  if (showVoidInvoices) url += `&showVoidInvoices=true`;

  const res = await apiFetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Excel export failed with status: ${res.status}`);
  }
  return res.blob();
}

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const res = await apiFetch(`${API_BASE_URL}/products/${productId}/image`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    const payload = await res.json();
    if (payload.success && payload.imageUrl) {
      const finalUrl = buildImageUrl(payload.imageUrl) || payload.imageUrl;
      console.log(`[Upload Image API] Response secure_url: ${payload.imageUrl} -> Resolved URL: ${finalUrl}`);
      return finalUrl;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getSaleReceipt(idOrInvoice: string): Promise<any> {
  try {
    let res = await apiFetch(`${API_BASE_URL}/api/sales/${encodeURIComponent(idOrInvoice)}/receipt`, {
      headers: getStoreHeaders(),
    });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/receipt`, {
        headers: getStoreHeaders(),
      });
    }
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) {
        return payload.data;
      }
    }
  } catch (error) {
    console.warn(`[getSaleReceipt] Server fetch failed for "${idOrInvoice}", attempting offline IndexedDB lookup...`);
  }

  // Offline Fallback: Retrieve sale from local IndexedDB queue
  try {
    const { getPendingSalesOffline } = await import("./offline-db");
    const offlineSales = await getPendingSalesOffline();
    const found = offlineSales.find(
      (s) => s.invoice_number === idOrInvoice || s.offlineId === idOrInvoice
    );

    if (found) {
      const shopName = typeof window !== "undefined" ? localStorage.getItem("orion_shop_name") || "Store" : "Store";
      const shopGstin = typeof window !== "undefined" ? localStorage.getItem("orion_gstin") || "" : "";
      const shopAddress = typeof window !== "undefined" ? localStorage.getItem("orion_address") || "" : "";
      const shopPhone = typeof window !== "undefined" ? localStorage.getItem("orion_phone") || "" : "";
      const shopUpi = typeof window !== "undefined" ? localStorage.getItem("orion_upi_id") || "" : "";

      return {
        invoiceNumber: found.invoice_number,
        date: new Date(found.created_at).toLocaleDateString("en-IN"),
        time: new Date(found.created_at).toLocaleTimeString("en-IN"),
        shop: {
          name: shopName,
          gstin: shopGstin,
          phone: shopPhone,
          address: shopAddress,
          upiId: shopUpi,
        },
        customer: {
          name: found.customer_name || "Walk-in Customer",
          phone: "",
        },
        items: found.items.map((i: any) => ({
          productId: i.product_id,
          name: i.name,
          qty: i.quantity,
          price: i.unit_price,
          lineTotal: i.subtotal,
          gst: 0,
        })),
        subtotal: found.subtotal,
        discount: found.discount,
        gst: found.tax,
        grandTotal: found.total_amount,
        paymentMethod: found.payment_method,
        cashier: "Admin",
        thankYouMessage: "Thank you for shopping with us (Offline Receipt)",
        publicToken: found.offlineId,
        offline: true,
      };
    }
  } catch (dbErr) {
    console.warn("Failed local offline receipt lookup:", dbErr);
  }

  throw new Error(`Receipt for "${idOrInvoice}" not found locally or on server.`);
}

export async function printSaleReceipt(idOrInvoice: string): Promise<any> {
  try {
    let res = await apiFetch(`${API_BASE_URL}/api/sales/${encodeURIComponent(idOrInvoice)}/print`, {
      method: "POST",
      headers: getStoreHeaders(),
    });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/print`, {
        method: "POST",
        headers: getStoreHeaders(),
      });
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    return payload;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function testPrinter(): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/printer/test`, {
      method: "POST",
      headers: getStoreHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    return payload;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getWhatsAppShareLink(idOrInvoice: string): Promise<string> {
  try {
    let res = await apiFetch(`${API_BASE_URL}/api/sales/${encodeURIComponent(idOrInvoice)}/share/whatsapp`, {
      headers: getStoreHeaders(),
    });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/share/whatsapp`, {
        headers: getStoreHeaders(),
      });
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.url) {
      return payload.url;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

/** Download PDF receipt as a Blob so the browser can force-download it. */
export async function downloadSalePdf(idOrInvoice: string): Promise<Blob> {
  try {
    let res = await apiFetch(`${API_BASE_URL}/api/sales/${encodeURIComponent(idOrInvoice)}/pdf`, {
      headers: getStoreHeaders(),
    });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/pdf`, {
        headers: getStoreHeaders(),
      });
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    return res.blob();
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

/** Returns the full public HTML invoice view URL (uses public_token, not DB id). */
export function getSalePublicLink(publicToken: string): string {
  return `${API_BASE_URL}/invoice/v/${publicToken}`;
}

/** Fetch all sales for a given customer phone number. */
export async function getCustomerSales(phone: string): Promise<any[]> {
  try {
    let res = await apiFetch(`${API_BASE_URL}/api/sales?phone=${encodeURIComponent(phone)}`, {
      headers: getStoreHeaders(),
    });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`${API_BASE_URL}/sales?phone=${encodeURIComponent(phone)}`, {
        headers: getStoreHeaders(),
      });
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

/** Log action to the database audit_logs. */
export async function logSaleAudit(invoiceNumber: string, action: string, details: string): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(invoiceNumber)}/audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ action, details }),
    });
    if (!res.ok) {
      console.error("Failed to log audit event:", res.statusText);
    }
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

/** Edit an existing bill. */
export async function editInvoice(idOrInvoice: string | number, data: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || "Failed to edit invoice");
  }
  return json.data;
}

/** Soft delete an invoice (Admin only). */
export async function deleteInvoice(idOrInvoice: string | number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || "Failed to delete invoice");
  }
  return json.data;
}

export async function getSalesPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
  invoiceNumber?: string;
  customerName?: string;
  phone?: string;
  customerId?: number;
  paymentMethod?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  dateFilter?: string;
  sort?: string;
}): Promise<{ data: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  try {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.append("page", String(params.page));
    if (params.limit !== undefined) q.append("limit", String(params.limit));
    if (params.search !== undefined) q.append("search", params.search);
    if (params.invoiceNumber !== undefined) q.append("invoice", params.invoiceNumber);
    if (params.customerName !== undefined) q.append("customer", params.customerName);
    if (params.phone !== undefined) q.append("phone", params.phone);
    if (params.customerId !== undefined) q.append("customerId", String(params.customerId));
    if (params.paymentMethod !== undefined) q.append("payment", params.paymentMethod);
    if (params.status !== undefined) q.append("status", params.status);
    if (params.startDate !== undefined) q.append("startDate", params.startDate);
    if (params.endDate !== undefined) q.append("endDate", params.endDate);
    if (params.dateFilter !== undefined) q.append("dateFilter", params.dateFilter);
    if (params.sort !== undefined) q.append("sort", params.sort);

    const res = await apiFetch(`${API_BASE_URL}/sales?${q.toString()}`, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
      }
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    return {
      data: payload.data || [],
      pagination: payload.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 0 }
    };
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getPurchases(filters?: { q?: string; startDate?: string; endDate?: string }): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const res = await apiFetch(`${API_BASE_URL}/api/purchases?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getPurchaseById(id: string | number): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createPurchase(dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function updatePurchase(id: string | number, dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function deletePurchase(id: string | number): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getStockAdjustments(filters?: {
  q?: string;
  startDate?: string;
  endDate?: string;
  product_id?: number;
  adjustment_type?: string;
}): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.product_id) params.append("product_id", String(filters.product_id));
    if (filters?.adjustment_type) params.append("adjustment_type", filters.adjustment_type);

    const res = await apiFetch(`${API_BASE_URL}/api/stock-adjustments?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getStockAdjustmentById(id: string | number): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/stock-adjustments/${id}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createStockAdjustment(dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/stock-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getSupplierLedger(
  supplierId: number | string,
  filters?: { startDate?: string; endDate?: string; transaction_type?: string }
): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.transaction_type) params.append("transaction_type", filters.transaction_type);

    const res = await apiFetch(`${API_BASE_URL}/api/supplier-payments/ledger/${supplierId}?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getSupplierPayments(filters?: {
  q?: string;
  startDate?: string;
  endDate?: string;
  supplier_id?: number;
}): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.supplier_id) params.append("supplier_id", String(filters.supplier_id));

    const res = await apiFetch(`${API_BASE_URL}/api/supplier-payments?${params.toString()}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createSupplierPayment(dto: any): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/supplier-payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function getSupplierReports(): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/supplier-payments/reports`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      return payload.data;
    }
    throw new Error("Invalid response format from server");
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profit & Margin Engine API
// ─────────────────────────────────────────────────────────────────────────────

export type ProfitFilters = {
  filter?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  productId?: number;
  limit?: number;
  offset?: number;
};

function buildProfitParams(filters: ProfitFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.filter) p.set("filter", filters.filter);
  if (filters.startDate) p.set("startDate", filters.startDate);
  if (filters.endDate) p.set("endDate", filters.endDate);
  if (filters.category) p.set("category", filters.category);
  if (filters.productId) p.set("productId", String(filters.productId));
  if (filters.limit) p.set("limit", String(filters.limit));
  if (filters.offset) p.set("offset", String(filters.offset));
  return p.toString();
}

async function profitFetch(url: string): Promise<any> {
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from profit API");
}

export async function getProfitSummary(filters: ProfitFilters = {}): Promise<any> {
  return profitFetch(`${API_BASE_URL}/api/profit/summary?${buildProfitParams(filters)}`);
}

export async function getProfitDashboard(): Promise<any> {
  return profitFetch(`${API_BASE_URL}/api/profit/dashboard`);
}

export async function getProfitProducts(filters: ProfitFilters = {}): Promise<any[]> {
  return profitFetch(`${API_BASE_URL}/api/profit/products?${buildProfitParams(filters)}`);
}

export async function getProfitSales(filters: ProfitFilters = {}): Promise<any[]> {
  return profitFetch(`${API_BASE_URL}/api/profit/sales?${buildProfitParams(filters)}`);
}

export async function getProfitTrends(filters: ProfitFilters = {}): Promise<{ daily: any[]; monthly: any[] }> {
  return profitFetch(`${API_BASE_URL}/api/profit/trends?${buildProfitParams(filters)}`);
}

export async function getProfitReport(filters: ProfitFilters = {}): Promise<any> {
  return profitFetch(`${API_BASE_URL}/api/profit/reports?${buildProfitParams(filters)}`);
}

export function triggerProfitExport(format: "excel" | "csv" | "pdf", filters: ProfitFilters = {}): void {
  const params = buildProfitParams(filters);
  window.open(`${API_BASE_URL}/api/profit/export/${format}?${params}`, "_blank");
}

export async function getExpenses(params?: { categoryId?: number; startDate?: string; endDate?: string }): Promise<any[]> {
  const p = new URLSearchParams();
  if (params?.categoryId) p.set("categoryId", String(params.categoryId));
  if (params?.startDate) p.set("startDate", params.startDate);
  if (params?.endDate) p.set("endDate", params.endDate);

  const res = await apiFetch(`${API_BASE_URL}/api/expenses?${p.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from expenses API");
}

export async function getExpenseSummary(params?: { filter?: string; startDate?: string; endDate?: string }): Promise<any> {
  const p = new URLSearchParams();
  if (params?.filter) p.set("filter", params.filter);
  if (params?.startDate) p.set("startDate", params.startDate);
  if (params?.endDate) p.set("endDate", params.endDate);

  const res = await apiFetch(`${API_BASE_URL}/api/expenses/summary?${p.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from expenses summary API");
}

export async function getExpenseCategories(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/expenses/categories`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from expense categories API");
}

export async function createExpenseCategory(name: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/expenses/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from create category API");
}

export async function createExpense(data: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from create expense API");
}

export async function updateExpense(id: number, data: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from update expense API");
}

export async function deleteExpense(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/expenses/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from delete expense API");
}

export async function voidPurchase(id: number, reason: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}/void`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || "Failed to void purchase");
  }
  return json.data;
}

export async function downloadPurchasePdf(id: number): Promise<Blob> {
  const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}/pdf`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download purchase PDF (HTTP ${res.status})`);
  }
  return res.blob();
}

export async function getPurchaseWhatsAppLink(id: number): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}/share/whatsapp`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to generate WhatsApp share link");
  }
  return json.url;
}

export async function printPurchaseReceipt(id: string | number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/purchases/${id}/print`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function voidSaleInvoice(invoiceNumber: string, reason: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/sales/${invoiceNumber}/void`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify({ reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const altRes = await apiFetch(`${API_BASE_URL}/invoices/${invoiceNumber}/void`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ reason }),
    });
    const altJson = await altRes.json().catch(() => ({}));
    if (!altRes.ok || !altJson.success) {
      throw new Error(altJson.error || altJson.message || json.error || "Failed to void invoice");
    }
    return altJson.data;
  }
  return json.data;
}

// ─── STORE MANAGEMENT & SWITCHING APIS ───────────────────────────────────────

export function getStoreHeaders(): Record<string, string> {
  const currentStoreId = typeof window !== "undefined" ? localStorage.getItem("currentStoreId") : null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""}`,
  };
  if (currentStoreId) {
    headers["x-store-id"] = currentStoreId;
  }
  return headers;
}

export async function getStores(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch stores");
  }
  return json.data || [];
}

export async function getCurrentStore(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores/current`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch current store");
  }
  return json.data;
}

export async function createStore(storeData: {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  gstNumber?: string;
  phone?: string;
  currency?: string;
  timezone?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(storeData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to create store");
  }
  return json.data;
}

export async function updateStore(id: number, storeData: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(storeData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update store");
  }
  return json.data;
}

export async function disableStore(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores/${id}/disable`, {
    method: "PATCH",
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to disable store");
  }
  return json.data;
}

export async function switchStore(storeId: number): Promise<{ store: any; token?: string }> {
  const res = await apiFetch(`${API_BASE_URL}/api/stores/switch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ storeId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to switch store");
  }
  if (typeof window !== "undefined") {
    localStorage.setItem("currentStoreId", String(storeId));
    if (json.data?.token) {
      localStorage.setItem("token", json.data.token);
    }
  }
  return json.data;
}

// ─── USER MANAGEMENT APIS ───────────────────────────────────────────────────

export async function getUsers(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/users`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch users");
  }
  return json.data || [];
}

export async function getUser(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/users/${id}`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch user");
  }
  return json.data;
}

export async function createUser(userData: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
  storeId?: number;
  storeIds?: number[];
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(userData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to create user");
  }
  return json.data;
}

export async function updateUser(id: number, userData: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(userData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update user");
  }
  return json.data;
}

export async function disableUser(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/users/${id}/disable`, {
    method: "PATCH",
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to disable user");
  }
  return json.data;
}

export async function assignUserStores(id: number, storeIds: number[]): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/users/${id}/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ storeIds }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to assign stores to user");
  }
  return json.data;
}

// ─── ORGANIZATION ADMINISTRATION APIS ────────────────────────────────────────

export async function getOrganizationCurrent(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/current`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch organization details");
  }
  return json.data;
}

export async function updateOrganizationCurrent(orgData: {
  name?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  logoUrl?: string;
  currency?: string;
  timezone?: string;
  invoicePrefix?: string;
  financialYear?: string;
  receiptInfo?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/current`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(orgData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update organization details");
  }
  return json.data;
}

export async function getOrganizationDashboard(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/dashboard`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch organization dashboard data");
  }
  return json.data;
}

export async function getOrganizationStats(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/stats`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch organization stats");
  }
  return json.data;
}

// ─── AUTHENTICATION V1 APIS ──────────────────────────────────────────────────

export async function loginApi(email: string, password: string): Promise<any> {
  const loginUrl = `${API_BASE_URL}/api/auth/login`;
  console.log(`[Auth] Executing POST login to: ${loginUrl}`);
  try {
    const res = await apiFetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || json.message || "Login failed");
    }
    return json.data;
  } catch (error: any) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      console.error(`[API Network Error] POST ${loginUrl} - Failed to fetch. Check backend reachability, HTTPS, and CORS configuration.`);
      throw new Error(`Unable to connect to backend server (${API_BASE_URL}). Please verify network connectivity.`);
    }
    throw error;
  }
}

export async function logoutApi(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: getStoreHeaders(),
  }).catch(() => ({}));
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("currentStoreId");
  }
  return true;
}

export async function getCurrentUserApi(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/auth/me`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to get current user session");
  }
  return json.data;
}

// ─── SUPER ADMIN PANEL APIS ──────────────────────────────────────────────────

export async function getSuperAdminDashboard(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/dashboard`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch Super Admin dashboard metrics");
  }
  return json.data;
}

export async function getSuperAdminOrganizations(params?: { q?: string; status?: string }): Promise<any[]> {
  const queryParts = [];
  if (params?.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
  if (params?.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  const queryStr = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations${queryStr}`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch organizations list");
  }
  return json.data || [];
}

export async function getSuperAdminOrganizationDetails(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch organization details");
  }
  return json.data;
}

export async function updateSuperAdminOrganizationStatus(id: number, status: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update organization status");
  }
  return json.data;
}

export async function resetSuperAdminOwnerPassword(id: number, newPassword: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ newPassword }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to reset owner password");
  }
  return json.data;
}

export async function updateSuperAdminSubscription(id: number, plan: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}/subscription`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ plan }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update subscription plan");
  }
  return json.data;
}

export async function deleteSuperAdminOrganization(id: number): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}`, {
    method: "DELETE",
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to delete organization");
  }
  return json.data;
}

export async function getSuperAdminStores(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/stores`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch stores list");
  }
  return json.data || [];
}

export async function getSuperAdminUsers(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/users`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch users list");
  }
  return json.data || [];
}

export async function updateSuperAdminUserStatus(id: number, status: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/users/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update user status");
  }
  return json.data;
}

export async function resetSuperAdminUserPassword(id: number, newPassword: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/users/${id}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ newPassword }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to reset user password");
  }
  return json.data;
}

export async function createSuperAdminStore(dto: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(dto),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to create store");
  }
  return json.data;
}

export async function editSuperAdminStore(id: number, dto: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/stores/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(dto),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update store details");
  }
  return json.data;
}

export async function updateSuperAdminStoreStatus(id: number, status: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/stores/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update store status");
  }
  return json.data;
}

export async function createSuperAdminUser(dto: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(dto),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to create user");
  }
  return json.data;
}

export async function editSuperAdminUser(id: number, dto: any): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(dto),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update user profile");
  }
  return json.data;
}

export async function getSuperAdminAuditLogs(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/audit-logs`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch audit logs");
  }
  return json.data || [];
}

export async function getSuperAdminSystemHealth(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/system-health`, {
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch system health");
  }
  return json.data;
}

// ─── FIRST-TIME ONBOARDING WIZARD APIS ───────────────────────────────────────

export async function completeOnboardingApi(data: {
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  invoicePrefix?: string;
  receiptInfo?: string;
  printBusinessName?: boolean;
  printGst?: boolean;
  printPhone?: boolean;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/onboarding/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to complete shop onboarding setup");
  }
  return json.data;
}

export async function resetOnboardingApi(): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/organizations/onboarding/reset`, {
    method: "POST",
    headers: getStoreHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to reset setup wizard");
  }
  return json.data;
}

export async function createSuperAdminOrganization(data: {
  businessName: string;
  gstNumber?: string;
  address?: string;
  phone: string;
  ownerName: string;
  email: string;
  password: string;
  storeName?: string;
  storeAddress?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to create new customer organization");
  }
  return json.data;
}

export async function editSuperAdminOrganization(
  id: number,
  data: {
    businessName?: string;
    gstNumber?: string;
    address?: string;
    phone?: string;
    email?: string;
  }
): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/super-admin/organizations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to edit organization details");
  }
  return json.data;
}

export async function changePasswordApi(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStoreHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to change password");
  }
  return json;
}

export async function getSettingsApi(): Promise<Record<string, string>> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/settings`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const payload = await res.json();
    if (payload.success && payload.data) {
      saveSettingsOffline(payload.data);
      return payload.data;
    }
    return {};
  } catch (err) {
    console.warn("getSettingsApi fetch failed, checking offline cache:", err);
    const cached = await getSettingsOffline();
    return cached || {};
  }
}

export async function updateSettingsApi(settings: Record<string, string>): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getStoreHeaders() },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update settings (HTTP ${res.status})`);
  }
}

export async function fetchAndApplyStoreSettings(): Promise<Record<string, string>> {
  const cfg = await getSettingsApi();
  if (cfg && Object.keys(cfg).length > 0) {
    const { useApp } = await import("./store");
    const s = useApp.getState();
    const shopName = cfg.shop_name || cfg.storeName || cfg.store_name || "";
    const gstin = cfg.shop_gstin || cfg.gstin || "";
    const address = cfg.shop_address || cfg.address || cfg.storeAddress || "";
    const phone = cfg.shop_phone || cfg.phone || cfg.storePhone || "";
    const email = cfg.shop_email || cfg.email || cfg.storeEmail || "";
    const logo = cfg.logo || cfg.logoUrl || cfg.logo_url || "";
    const upiId = cfg.shop_upi_id || cfg.upiId || cfg.upi_id || "";

    if (shopName) s.setShopName(shopName);
    if (gstin) s.setGstin(gstin);
    if (address) s.setStoreAddress(address);
    if (phone) s.setStorePhone(phone);
    if (email) s.setStoreEmail(email);
    if (logo) s.setLogo(logo);
    if (upiId) s.setUpiId(upiId);
    if (cfg.receipt_footer) s.setReceiptFooter(cfg.receipt_footer);
    if (cfg.theme) s.setTheme(cfg.theme as any);
    if (cfg.receipt_template) s.setReceiptTemplate(cfg.receipt_template as any);
    if (cfg.primary_color && s.setPrimaryColor) s.setPrimaryColor(cfg.primary_color);
    if (cfg.tagline && s.setTagline) s.setTagline(cfg.tagline);
    if (cfg.website && s.setWebsite) s.setWebsite(cfg.website);
    if (cfg.invoice_header && s.setInvoiceHeader) s.setInvoiceHeader(cfg.invoice_header);
    if (cfg.invoice_footer && s.setInvoiceFooter) s.setInvoiceFooter(cfg.invoice_footer);
    if (cfg.terms_and_conditions && s.setTermsAndConditions) s.setTermsAndConditions(cfg.terms_and_conditions);
    if (cfg.whatsapp_signature && s.setWhatsappSignature) s.setWhatsappSignature(cfg.whatsapp_signature);
    if (cfg.tax_rate && s.setTaxRate) s.setTaxRate(parseFloat(cfg.tax_rate) || 12);
    if (cfg.require_customer_before_checkout !== undefined && s.setRequireCustomerBeforeCheckout) {
      s.setRequireCustomerBeforeCheckout(cfg.require_customer_before_checkout === "1" || cfg.require_customer_before_checkout === "true");
    }
  }
  return cfg;
}
