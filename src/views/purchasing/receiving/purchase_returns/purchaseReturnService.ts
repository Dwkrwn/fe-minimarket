import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/purchase-returns");

export interface PurchaseReturnItem {
  id: string;
  item_id: string;
  qty_pcs: number;
  harga_satuan_pcs: number | string;
  subtotal: number | string;
  item?: { id: string; barcode: string; nama_barang: string };
}

export interface PurchaseReturn {
  id: string;
  no_retur: string;
  po_id: string;
  supplier_id: string;
  status: string;
  total_potongan: number | string;
  tgl_retur: string;
  catatan?: string | null;
  po?: { id: string; no_po: string };
  supplier?: { id: string; nama_supplier: string };
  details?: PurchaseReturnItem[];
  user?: { id: string; name: string } | null;
}

export interface CreatePurchaseReturnPayload {
  po_id: string;
  item_id: string;
  qty_pcs: number;
  alasan?: string | null;
  catatan?: string | null;
}

export interface PurchaseReturnQuery {
  status?: string;
  supplier_id?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getPurchaseReturns(query: PurchaseReturnQuery = {}): Promise<PurchaseReturn[]> {
  const params = new URLSearchParams();
  if (query.status) params.append("status", query.status);
  if (query.supplier_id) params.append("supplier_id", query.supplier_id);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<PurchaseReturn[]>>(`${BASE_PATH}${suffix}`, { method: "GET" });
  return res.data || [];
}

export async function createPurchaseReturn(payload: CreatePurchaseReturnPayload): Promise<PurchaseReturn> {
  const res = await apiCall<ApiResponse<PurchaseReturn>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}
