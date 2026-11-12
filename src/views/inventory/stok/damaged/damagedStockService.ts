import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/inventory/damaged");
const PURCHASE_ORDER_PATH = apiPath("/v1/purchasing/purchase-orders");

export type DamagedCategory = "INTERNAL_LOSS" | "SUPPLIER_RETURN";
export type DamagedStatus = "RECORDED" | "WRITTEN_OFF" | "RETURNED_TO_SUPPLIER";
export type DamagedReason = "RUSAK_KEMASAN" | "CACAT_PABRIK" | "HILANG";
export type DamagedLocation = "GUDANG" | "RAK";

export interface DamagedStockItem {
  id: string;
  barcode: string;
  nama_barang: string;
  uom?: {
    id: string;
    kode_uom?: string;
    nama_uom?: string;
    satuan_dasar?: string;
  } | null;
}

export interface DamagedStockRow {
  id: string;
  no_damaged: string;
  item_id: string;
  category_rack_id?: string | null;
  location: DamagedLocation;
  qty_pcs: number;
  kategori: DamagedCategory;
  alasan: string;
  status: DamagedStatus;
  user_id?: string | null;
  catatan?: string | null;
  createdAt: string;
  updatedAt?: string;
  item?: DamagedStockItem;
  category_rack?: {
    id: string;
    kode: string;
    nama: string;
    tipe_zona: string;
  } | null;
  user?: { id: string; name: string } | null;
}

export interface DamagedStockQuery {
  kategori?: DamagedCategory;
  status?: DamagedStatus;
  search?: string;
}

export interface CreateDamagedReportPayload {
  item_id: string;
  location: DamagedLocation;
  qty_pcs: number;
  kategori: DamagedCategory;
  alasan: DamagedReason;
  catatan?: string;
  po_id?: string;
}

export interface PurchaseReturnResult {
  id: string;
  no_retur: string;
  status: string;
  total_potongan?: number | string;
}

export interface DamagedReportResult {
  damaged: DamagedStockRow;
  purchaseReturn: PurchaseReturnResult | null;
  purchase_return_error: string | null;
}

export interface PurchaseOrderOption {
  id: string;
  no_po: string;
  status: string;
  supplier_id?: string;
  createdAt?: string;
  supplier?: { id?: string; nama_supplier?: string } | null;
  details?: Array<{ id?: string; item_id?: string; qty_po?: number | string }>;
  goods_receipts?: Array<{ id: string; no_penerimaan?: string }>;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getDamagedStocks(
  query: DamagedStockQuery = {},
): Promise<DamagedStockRow[]> {
  const params = new URLSearchParams();
  if (query.kategori) params.append("kategori", query.kategori);
  if (query.status) params.append("status", query.status);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<DamagedStockRow[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}

export async function createDamagedReport(
  payload: CreateDamagedReportPayload,
): Promise<DamagedReportResult> {
  const res = await apiCall<ApiResponse<DamagedReportResult>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

/**
 * PO yang bisa dipakai untuk retur pemasok. Filter detail per barang
 * dilakukan di halaman agar satu permintaan cukup untuk semua barang.
 */
export async function getReturnablePurchaseOrders(
  search?: string,
): Promise<PurchaseOrderOption[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.append("search", search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<PurchaseOrderOption[]>>(
    `${PURCHASE_ORDER_PATH}${suffix}`,
    { method: "GET" },
  );
  return res.data || [];
}
