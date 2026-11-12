import { apiCall, apiPath } from "@/lib/api";
import type { MinimarketItem } from "../../master/m_items/minimarketItemService";
import type { CategoryRack } from "../../master/category_racks/categoryRackService";

const BASE_PATH = apiPath("/v1/inventory/stocks");

export type StockLocation = "GUDANG" | "RAK";

export interface StockRow {
  id: string;
  item_id: string;
  category_rack_id?: string | null;
  location: StockLocation;
  qty: number;
  createdAt?: string;
  updatedAt?: string;
  item?: MinimarketItem;
  category_rack?: CategoryRack | null;
}

export interface StockPositionQuery {
  location?: StockLocation;
  category_rack_id?: string;
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getStockPositions(query: StockPositionQuery = {}): Promise<StockRow[]> {
  const params = new URLSearchParams();
  if (query.location) params.append("location", query.location);
  if (query.category_rack_id) params.append("category_rack_id", query.category_rack_id);
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<StockRow[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}
