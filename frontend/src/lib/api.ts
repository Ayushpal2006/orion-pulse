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

export function buildImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `${API_BASE_URL}${trimmed}`;
}

export const API_BASE_URL = getApiBaseUrl();

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

/** Log action to the database audit_logs. */
export async function logSaleAudit(invoiceNumber: string, action: string, details: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(invoiceNumber)}/audit`, {
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
    console.error("Failed to call audit endpoint:", error);
  }
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

    const res = await fetch(`${API_BASE_URL}/sales?${q.toString()}`, {
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

