import type { Product } from "./mock-data";

const getApiBaseUrl = (): string => {
  const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
  let cleanUrl = rawUrl.trim().replace(/['"]/g, "");
  
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    if (cleanUrl.startsWith("localhost") || cleanUrl.startsWith("127.0.0.1")) {
      cleanUrl = `http://${cleanUrl}`;
    } else {
      cleanUrl = `https://${cleanUrl}`;
    }
  }
  return cleanUrl;
};

export const API_BASE_URL = getApiBaseUrl();

export function mapBackendProductToFrontend(p: any): Product {
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
    image: p.image_url ? `${API_BASE_URL}${p.image_url}` : undefined,
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
      result.image_url = p.image.replace(API_BASE_URL, "");
    } else {
      result.image_url = null;
    }
  }
  return result;
}

export async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
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
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function searchProducts(q: string): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/search?q=${encodeURIComponent(q)}`);
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
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Server is unavailable. Please check if the backend server is running on port 8080.");
    }
    throw error;
  }
}

export async function createProduct(product: Partial<Product>): Promise<Product> {
  try {
    const backendBody = mapFrontendProductToBackend(product);
    const res = await fetch(`${API_BASE_URL}/products`, {
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
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/customers`);
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

export async function searchCustomers(q: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/search?q=${encodeURIComponent(q)}`);
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

export async function updateCustomer(id: string | number, dto: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/customers/${id}/invoices`);
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
    const res = await fetch(`${API_BASE_URL}/customers`, {
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

export async function checkout(dto: {
  customerPhone: string;
  paymentMethod: string;
  cashierName: string;
  items: { productId: number; quantity: number }[];
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/checkout`, {
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
    const res = await fetch(`${API_BASE_URL}/dashboard`);
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
  endDate?: string
): Promise<any> {
  try {
    let url = `${API_BASE_URL}/reports?filter=${encodeURIComponent(filter)}`;
    if (startDate) {
      url += `&startDate=${encodeURIComponent(startDate)}`;
    }
    if (endDate) {
      url += `&endDate=${encodeURIComponent(endDate)}`;
    }
    const res = await fetch(url);
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

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`${API_BASE_URL}/products/${productId}/image`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    const payload = await res.json();
    if (payload.success && payload.imageUrl) {
      return `${API_BASE_URL}${payload.imageUrl}`;
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
    const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/receipt`);
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

export async function printSaleReceipt(idOrInvoice: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/print`, {
      method: "POST",
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

export async function testPrinter(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/test`, {
      method: "POST",
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
    const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/share/whatsapp`);
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
    const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}/pdf`);
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
    const res = await fetch(`${API_BASE_URL}/sales?phone=${encodeURIComponent(phone)}`);
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
