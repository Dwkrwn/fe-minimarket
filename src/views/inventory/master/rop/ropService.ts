import { apiCall, apiPath } from "@/lib/api";
import type { MinimarketItem } from "../m_items/minimarketItemService";

const BASE_PATH = apiPath("/v1/inventory/rop");

export interface RopSetting {
  id: string;
  item_id: string;
  lead_time_days: number;
  safety_stock_pcs: number;
  avg_daily_sales: number | string;
  rop_pcs: number;
  max_stock_pcs: number;
  is_auto_pr: boolean;
  last_calculated_at?: string | null;
  item?: MinimarketItem;
}

export interface RopPayload {
  lead_time_days: number;
  safety_stock_pcs: number;
  max_stock_pcs: number;
  is_auto_pr: boolean;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getRopSettings(search?: string): Promise<RopSetting[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.append("search", search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<RopSetting[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}

export async function updateRopSetting(itemId: string, payload: RopPayload): Promise<RopSetting> {
  const res = await apiCall<ApiResponse<RopSetting>>(`${BASE_PATH}/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}
