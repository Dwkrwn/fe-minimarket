import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/supplier-catalogs");

export interface CatalogItem {
  id: string;
  barcode: string;
  nama_barang: string;
  harga_modal: number | string;
  uom?: { satuan_beli: string; rasio_konversi: number } | null;
}

export interface CatalogSupplier {
  id: string;
  kode_supplier: string;
  nama_supplier: string;
  no_wa?: string | null;
  term_of_payment?: number;
}

export interface SupplierCatalog {
  id: string;
  supplier_id: string;
  item_id: string;
  harga_modal: number | string;
  is_active: boolean;
  supplier?: CatalogSupplier;
  item?: CatalogItem;
  is_cheapest_recommendation?: boolean;
}

export interface SupplierCatalogPayload {
  supplier_id: string;
  item_id: string;
  harga_modal: number;
}

export interface SupplierCatalogQuery {
  supplier_id?: string;
  item_id?: string;
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getSupplierCatalogs(query: SupplierCatalogQuery = {}): Promise<SupplierCatalog[]> {
  const params = new URLSearchParams();
  if (query.supplier_id) params.append("supplier_id", query.supplier_id);
  if (query.item_id) params.append("item_id", query.item_id);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<SupplierCatalog[]>>(`${BASE_PATH}${suffix}`, { method: "GET" });
  return res.data || [];
}

export async function saveSupplierCatalog(payload: SupplierCatalogPayload): Promise<SupplierCatalog> {
  const res = await apiCall<ApiResponse<SupplierCatalog>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteSupplierCatalog(id: string): Promise<void> {
  await apiCall(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
