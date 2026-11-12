import { apiCall, apiPath } from "@/lib/api";

const INVOICE_PATH = apiPath("/v1/purchasing/invoices");

export type PurchaseInvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

export interface ThreeWayLine {
  item_id: string;
  nama_barang?: string | null;
  barcode?: string | null;
  harga_satuan: number;
  bukti_1_pesanan: {
    qty_pcs: number;
    subtotal: number;
  };
  bukti_2_terima_gudang: {
    qty_bagus_pcs: number;
    qty_reject_pcs: number;
    subtotal: number;
  };
  bukti_3_retur_gudang: {
    qty_retur_pcs: number;
    subtotal_potongan: number;
  };
  kalkulasi_bersih: {
    qty_bersih_pcs: number;
    nominal_bersih_bayar: number;
  };
}

export interface MatchingPreview {
  po_id: string;
  no_po: string;
  supplier: {
    id: string;
    nama_supplier: string;
    term_of_payment: number;
  } | null;
  matching_lines: ThreeWayLine[];
  summary_verifikasi: {
    jumlah_goods_receipt: number;
    jumlah_retur: number;
    total_pesanan_awal_po: number;
    total_bukti_masuk_bagus_gr: number;
    total_potongan_nota_retur: number;
    total_bersih_dikunci: number;
  };
  gr_ids: string[];
  return_ids: string[];
  return_ids_issued: string[];
  has_receipts: boolean;
  unmatched_receipt_item_ids: string[];
  unmatched_return_item_ids: string[];
  keterangan_sistem: string;
}

export interface InvoiceReturn {
  id: string;
  no_retur: string;
  status: string;
  total_potongan?: number | string;
}

export interface InvoicePayment {
  id: string;
  no_payment: string;
  jumlah_bayar: number | string;
  metode_bayar: string;
  tgl_bayar: string;
}

export interface PurchaseInvoice {
  id: string;
  no_invoice: string;
  po_id: string;
  tgl_invoice: string;
  tgl_jatuh_tempo: string;
  gross_amount: number | string;
  return_deduction: number | string;
  net_payable: number | string;
  status: PurchaseInvoiceStatus;
  catatan?: string | null;
  po?: {
    id: string;
    no_po: string;
    supplier?: { id: string; nama_supplier: string };
  };
  returns?: InvoiceReturn[];
  payments?: InvoicePayment[];
}

export interface CreatePurchaseInvoicePayload {
  po_id: string;
  no_invoice_supplier?: string;
  catatan?: string;
}

export interface PurchaseInvoiceQuery {
  status?: PurchaseInvoiceStatus | "";
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getMatchingPreview(poId: string): Promise<MatchingPreview> {
  const res = await apiCall<ApiResponse<MatchingPreview>>(
    `${INVOICE_PATH}/preview/${poId}`,
    { method: "GET" },
  );
  return res.data;
}

export async function createPurchaseInvoice(
  payload: CreatePurchaseInvoicePayload,
): Promise<PurchaseInvoice> {
  const res = await apiCall<ApiResponse<PurchaseInvoice>>(INVOICE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getPurchaseInvoices(
  query: PurchaseInvoiceQuery = {},
): Promise<PurchaseInvoice[]> {
  const params = new URLSearchParams();
  if (query.status) params.append("status", query.status);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<PurchaseInvoice[]>>(`${INVOICE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}
