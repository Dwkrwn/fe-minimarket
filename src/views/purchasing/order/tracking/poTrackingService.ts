import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/purchasing/purchase-orders");

export interface TrackingItem {
  item_id: string;
  nama_barang: string;
  barcode: string;
  qty_order_pcs: number;
  received_pcs: number;
  rejected_pcs: number;
  remaining_pcs: number;
  fulfillment_rate: string;
}

export interface PoTracking {
  po_id: string;
  no_po: string;
  supplier: string;
  status_raw: string;
  status_badge: string;
  tgl_po: string;
  trackingItems: TrackingItem[];
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getPoTracking(id: string): Promise<PoTracking> {
  const res = await apiCall<ApiResponse<PoTracking>>(`${BASE_PATH}/${id}/tracking`, { method: "GET" });
  return res.data;
}
