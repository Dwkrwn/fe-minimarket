import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/goods-receipts");

export interface GoodsReceiptItem {
  id?: string;
  item_id: string;
  uom_id?: string | null;
  qty_diterima_beli: number;
  qty_bagus_pcs: number;
  qty_ditolak_pcs: number;
  harga_satuan_pcs: number | string;
  subtotal: number | string;
  item?: {
    id: string;
    barcode: string;
    nama_barang: string;
    uom?: { satuan_beli: string; rasio_konversi: number } | null;
  };
  uom?: { satuan_beli: string; rasio_konversi: number } | null;
}

export interface GoodsReceipt {
  id: string;
  no_gr: string;
  po_id: string;
  no_surat_jalan?: string | null;
  status: string;
  status_label?: string;
  tgl_gr: string;
  catatan?: string | null;
  total_item?: number;
  total_qty_bagus_pcs?: number;
  total_qty_ditolak_pcs?: number;
  po?: {
    id: string;
    no_po: string;
    supplier?: { id: string; nama_supplier: string };
  };
  details?: GoodsReceiptItem[];
  invoices?: Array<{ id: string; no_invoice: string; status: string }>;
  user?: { id: string; name: string } | null;
}

export interface CreateGoodsReceiptPayload {
  no_gr?: string | null;
  po_id: string;
  no_surat_jalan?: string | null;
  catatan?: string | null;
  items: Array<{
    item_id: string;
    uom_id?: string | null;
    qty_diterima_beli: number;
    qty_bagus_pcs: number;
    qty_ditolak_pcs: number;
  }>;
}

export interface GoodsReceiptQuery {
  po_id?: string;
  supplier_id?: string;
  status?: string;
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getNextGoodsReceiptNumber(): Promise<string> {
  const res = await apiCall<ApiResponse<{ no_gr: string }>>(`${BASE_PATH}/next-number`, { method: "GET" });
  return res.data?.no_gr || "GR-001";
}

export async function getGoodsReceipts(query: GoodsReceiptQuery = {}): Promise<GoodsReceipt[]> {
  const params = new URLSearchParams();
  if (query.po_id) params.append("po_id", query.po_id);
  if (query.supplier_id) params.append("supplier_id", query.supplier_id);
  if (query.status) params.append("status", query.status);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<GoodsReceipt[]>>(`${BASE_PATH}${suffix}`, { method: "GET" });
  return res.data || [];
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceipt> {
  const res = await apiCall<ApiResponse<GoodsReceipt>>(`${BASE_PATH}/${id}`, { method: "GET" });
  return res.data;
}

export async function createGoodsReceipt(payload: CreateGoodsReceiptPayload): Promise<GoodsReceipt> {
  const res = await apiCall<ApiResponse<GoodsReceipt>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}
