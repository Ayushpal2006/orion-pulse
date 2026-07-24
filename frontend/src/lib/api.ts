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

export async function getProductMovements(productId: number): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/movements`);
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

export async function getSuppliers(q?: string, sort?: string, includeArchived?: boolean): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (sort) params.append("sort", sort);
    if (includeArchived) params.append("includeArchived", "true");

    const res = await fetch(`${API_BASE_URL}/api/suppliers?${params.toString()}`);
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
    const res = await fetch(`${API_BASE_URL}/api/suppliers`, {
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
    const res = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
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
    console.error("Failed to log audit event:", error);
  }
}

/** Edit an existing bill. */
export async function editInvoice(idOrInvoice: string | number, data: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}`, {
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
  const res = await fetch(`${API_BASE_URL}/sales/${encodeURIComponent(idOrInvoice)}`, {
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

export async function getPurchases(filters?: { q?: string; startDate?: string; endDate?: string }): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const res = await fetch(`${API_BASE_URL}/api/purchases?${params.toString()}`);
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
    const res = await fetch(`${API_BASE_URL}/api/purchases/${id}`);
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
    const res = await fetch(`${API_BASE_URL}/api/purchases`, {
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
    const res = await fetch(`${API_BASE_URL}/api/purchases/${id}`, {
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
    const res = await fetch(`${API_BASE_URL}/api/purchases/${id}`, {
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

    const res = await fetch(`${API_BASE_URL}/api/stock-adjustments?${params.toString()}`);
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
    const res = await fetch(`${API_BASE_URL}/api/stock-adjustments/${id}`);
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
    const res = await fetch(`${API_BASE_URL}/api/stock-adjustments`, {
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

    const res = await fetch(`${API_BASE_URL}/api/supplier-payments/ledger/${supplierId}?${params.toString()}`);
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

    const res = await fetch(`${API_BASE_URL}/api/supplier-payments?${params.toString()}`);
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
    const res = await fetch(`${API_BASE_URL}/api/supplier-payments`, {
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
    const res = await fetch(`${API_BASE_URL}/api/supplier-payments/reports`);
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
  const res = await fetch(url);
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

  const res = await fetch(`${API_BASE_URL}/api/expenses?${p.toString()}`);
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

  const res = await fetch(`${API_BASE_URL}/api/expenses/summary?${p.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from expenses summary API");
}

export async function getExpenseCategories(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/expenses/categories`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload.success) return payload.data;
  throw new Error("Invalid response from expense categories API");
}

export async function createExpenseCategory(name: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/expenses/categories`, {
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
  const res = await fetch(`${API_BASE_URL}/api/expenses`, {
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
  const res = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
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
  const res = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
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
