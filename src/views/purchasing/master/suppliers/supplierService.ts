import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/suppliers");

export interface Supplier {
  id: string;
  kode_supplier: string;
  nama_supplier: string;
  kontak_sales?: string | null;
  no_telp?: string | null;
  no_wa?: string | null;
  alamat?: string | null;
  term_of_payment: number;
  is_active: boolean;
  catatan?: string | null;
  createdAt?: string;
  updatedAt?: string;
  catalogs?: Array<{
    id: string;
    harga_modal: number | string;
    item?: { id: string; nama_barang: string; barcode?: string };
  }>;
  _count?: { purchase_orders?: number; purchase_returns?: number };
}

export interface SupplierPayload {
  kode_supplier: string;
  nama_supplier: string;
  kontak_sales?: string | null;
  no_telp?: string | null;
  no_wa?: string | null;
  alamat?: string | null;
  term_of_payment?: number;
  is_active?: boolean;
  catatan?: string | null;
}

export interface SupplierQuery {
  search?: string;
  is_active?: boolean;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getNextSupplierCode(): Promise<string> {
  const res = await apiCall<ApiResponse<{ kode: string }>>(`${BASE_PATH}/next-code`, { method: "GET" });
  return res.data?.kode || "SUP-001";
}

export async function getSuppliers(query: SupplierQuery = {}): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.append("search", query.search.trim());
  if (query.is_active !== undefined) params.append("is_active", String(query.is_active));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<Supplier[]>>(`${BASE_PATH}${suffix}`, { method: "GET" });
  return res.data || [];
}

export async function getSupplierDetail(id: string): Promise<Supplier> {
  const res = await apiCall<ApiResponse<Supplier>>(`${BASE_PATH}/${id}`, { method: "GET" });
  return res.data;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const res = await apiCall<ApiResponse<Supplier>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateSupplier(id: string, payload: Partial<SupplierPayload>): Promise<Supplier> {
  const res = await apiCall<ApiResponse<Supplier>>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiCall(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
