import { apiCall, apiPath } from "@/lib/api";

const REPORT_PATH = apiPath("/v1/purchasing/reports/purchase-history");

export interface PurchaseHistoryRow {
  no_invoice: string;
  no_po: string;
  supplier: string;
  tgl_invoice: string;
  gross_amount: number;
  return_deduction: number;
  net_payable: number;
  total_paid: number;
  remaining: number;
  status: string;
  status_label: string;
}

export interface PurchaseHistorySummary {
  total_invoices: number;
  total_belanja_kotor: number;
  total_potongan_retur: number;
  total_tagihan_bersih: number;
  total_uang_modal_terbayar: number;
  sisa_hutang_modal: number;
}

export interface PurchaseHistoryReport {
  summary: PurchaseHistorySummary;
  data: PurchaseHistoryRow[];
}

export interface PurchaseHistoryQuery {
  startDate?: string;
  endDate?: string;
  supplier_id?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getPurchaseHistoryReport(
  query: PurchaseHistoryQuery = {},
): Promise<PurchaseHistoryReport> {
  const params = new URLSearchParams();
  if (query.startDate) params.append("startDate", query.startDate);
  if (query.endDate) params.append("endDate", query.endDate);
  if (query.supplier_id) params.append("supplier_id", query.supplier_id);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<PurchaseHistoryReport>>(`${REPORT_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || { summary: emptySummary(), data: [] };
}

export function emptySummary(): PurchaseHistorySummary {
  return {
    total_invoices: 0,
    total_belanja_kotor: 0,
    total_potongan_retur: 0,
    total_tagihan_bersih: 0,
    total_uang_modal_terbayar: 0,
    sisa_hutang_modal: 0,
  };
}
