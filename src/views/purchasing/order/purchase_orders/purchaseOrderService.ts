import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/purchase-orders");

export type PurchaseOrderStatus = "ORDERED" | "PARTIAL_RECEIVED" | "COMPLETED" | "CANCELLED";

export interface PurchaseOrderItem {
  id?: string;
  item_id: string;
  uom_id?: string | null;
  qty_order_beli: number;
  conversion_ratio: number;
  qty_order_pcs: number;
  harga_satuan: number | string;
  subtotal: number | string;
  item?: {
    id: string;
    barcode: string;
    nama_barang: string;
    uom?: { id: string; satuan_beli: string; rasio_konversi: number } | null;
  };
  uom?: { id: string; satuan_beli: string; rasio_konversi: number } | null;
}

export interface PurchaseOrderReceipt {
  id: string;
  no_gr: string;
  no_surat_jalan?: string | null;
  tgl_gr: string;
  status: string;
  details?: Array<{ item_id: string; qty_bagus_pcs: number; qty_ditolak_pcs: number }>;
}

export interface PurchaseOrderReturn {
  id: string;
  no_retur: string;
  tgl_retur: string;
  status: string;
  total_potongan: number | string;
  details?: Array<{ item_id: string; qty_pcs: number; subtotal: number | string }>;
}

export interface PurchaseOrder {
  id: string;
  no_po: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  status_label: string;
  tgl_po: string;
  tgl_estimasi_tiba?: string | null;
  total_amount: number | string;
  catatan?: string | null;
  supplier?: { id: string; kode_supplier: string; nama_supplier: string; no_wa?: string | null; no_telp?: string | null; alamat?: string | null; kontak_sales?: string | null; term_of_payment?: number };
  details?: PurchaseOrderItem[];
  goods_receipts?: PurchaseOrderReceipt[];
  purchase_returns?: PurchaseOrderReturn[];
  invoices?: Array<{ id: string; no_invoice: string; status: string; net_payable?: number | string }>;
  user?: { id: string; name: string } | null;
}

export interface CreatePurchaseOrderPayload {
  supplier_id: string;
  tgl_estimasi_tiba?: string | null;
  catatan?: string | null;
  items: Array<{ item_id: string; qty_order_beli: number; uom_id?: string | null }>;
}

export interface SendPurchaseOrderResult {
  po_id: string;
  no_po: string;
  supplier_name: string;
  target_wa?: string | null;
  target_email?: string | null;
  delivery_channel: string;
  message_draft: string;
  pdf_download_url: string;
  status_pengiriman: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export interface PurchaseOrderQuery {
  status?: PurchaseOrderStatus | "";
  supplier_id?: string;
  search?: string;
}

export async function getPurchaseOrders(query: PurchaseOrderQuery = {}): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();
  if (query.status) params.append("status", query.status);
  if (query.supplier_id) params.append("supplier_id", query.supplier_id);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<PurchaseOrder[]>>(`${BASE_PATH}${suffix}`, { method: "GET" });
  return res.data || [];
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await apiCall<ApiResponse<PurchaseOrder>>(`${BASE_PATH}/${id}`, { method: "GET" });
  return res.data;
}

export async function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
  const res = await apiCall<ApiResponse<PurchaseOrder>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function sendPurchaseOrder(id: string): Promise<SendPurchaseOrderResult> {
  const res = await apiCall<ApiResponse<SendPurchaseOrderResult>>(`${BASE_PATH}/${id}/send`, {
    method: "POST",
    body: JSON.stringify({ method: "WA" }),
  });
  return res.data;
}
