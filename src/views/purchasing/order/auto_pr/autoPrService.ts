import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/auto-pr");

export interface AutoPrSupplier {
  id: string;
  nama_supplier: string;
  no_wa?: string | null;
  term_of_payment?: number;
  harga_modal_pcs?: number | string;
}

export interface AutoPrRow {
  id: string;
  no_pr: string;
  item_id: string;
  nama_barang: string;
  barcode: string;
  satuan_beli: string;
  rasio_konversi: number;
  stok_saat_ini_pcs: number;
  rop_threshold_pcs: number;
  qty_saran_pcs: number;
  qty_saran_beli: number;
  supplier_rekomendasi: AutoPrSupplier | null;
  estimasi_biaya: number | string;
  status: string;
  peringatan_merah: boolean;
  createdAt: string;
}

export interface ConvertAutoPrPayload {
  pr_ids: string[];
  tgl_estimasi_tiba?: string | null;
  catatan?: string | null;
}

export interface PurchaseOrderCreated {
  id: string;
  no_po: string;
  total_amount: number | string;
  supplier?: { nama_supplier: string };
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getAutoPrs(status = "PENDING"): Promise<AutoPrRow[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  const res = await apiCall<ApiResponse<AutoPrRow[]>>(`${BASE_PATH}?${params.toString()}`, { method: "GET" });
  return res.data || [];
}

export async function convertAutoPrToPo(payload: ConvertAutoPrPayload): Promise<PurchaseOrderCreated[]> {
  const res = await apiCall<ApiResponse<PurchaseOrderCreated[]>>(`${BASE_PATH}/convert-to-po`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data || [];
}
