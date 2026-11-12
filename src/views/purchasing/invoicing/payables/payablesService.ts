import { apiCall, apiPath } from "@/lib/api";

const PURCHASING_PATH = apiPath("/v1/purchasing");

export type PayableAlarmStatus =
  | "AMAN"
  | "SEGERA_JATUH_TEMPO"
  | "JATUH_TEMPO_HARI_INI"
  | "TERLAMBAT_OVERDUE";

export type PayableStatus = "UNPAID" | "PARTIAL" | "OVERDUE";

export type PaymentMethod = "TRANSFER" | "GIRO" | "KAS";

export interface Payable {
  invoice_id: string;
  no_invoice: string;
  supplier_name: string;
  no_wa_supplier?: string | null;
  top_days: number;
  tgl_invoice: string;
  tgl_jatuh_tempo: string;
  days_remaining: number;
  alarm_status: PayableAlarmStatus;
  alarm_message: string;
  gross_amount: number;
  return_deduction: number;
  net_payable: number;
  total_paid: number;
  remaining_payable: number;
  status: PayableStatus;
}

export interface CreatePaymentPayload {
  invoice_id: string;
  jumlah_bayar?: number;
  metode_bayar?: PaymentMethod;
  no_referensi?: string;
  catatan?: string;
}

export interface PaymentResult {
  payment: {
    id: string;
    no_payment: string;
    jumlah_bayar: number | string;
    metode_bayar: string;
    tgl_bayar: string;
  };
  invoice_status: "PARTIAL" | "PAID";
  status_label: string;
  remaining_payable: number;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getPayables(): Promise<Payable[]> {
  const res = await apiCall<ApiResponse<Payable[]>>(`${PURCHASING_PATH}/payables`, {
    method: "GET",
  });
  return res.data || [];
}

export async function createPurchasePayment(
  payload: CreatePaymentPayload,
): Promise<PaymentResult> {
  const res = await apiCall<ApiResponse<PaymentResult>>(`${PURCHASING_PATH}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function markInvoicePaid(invoiceId: string): Promise<PaymentResult> {
  const res = await apiCall<ApiResponse<PaymentResult>>(
    `${PURCHASING_PATH}/invoices/${invoiceId}/mark-paid`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  return res.data;
}
