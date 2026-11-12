import { apiCall, apiPath } from "@/lib/api";
import type { Uom } from "../../master/uoms/uomService";

const BASE_PATH = apiPath("/v1/inventory/stock-cards");

export type StockCardLocation = "GUDANG" | "RAK";

export interface StockCardItem {
  id: string;
  barcode: string;
  nama_barang: string;
  uom?: Uom | null;
}

export interface StockCardUser {
  id: string;
  name?: string;
  username?: string;
}

export interface StockCardRow {
  id: string;
  item_id: string;
  tanggal: string;
  no_dokumen: string;
  jenis_mutasi: string;
  qty_in: number;
  qty_out: number;
  saldo_akhir: number;
  location: StockCardLocation;
  user_id?: string | null;
  keterangan?: string | null;
  item?: StockCardItem;
  user?: StockCardUser | null;
}

export interface StockCardQuery {
  item_id: string;
  location?: StockCardLocation;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockCardResult {
  total: number;
  page: number;
  limit: number;
  data: StockCardRow[];
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getStockCards(query: StockCardQuery): Promise<StockCardResult> {
  const params = new URLSearchParams();
  params.append("item_id", query.item_id);
  if (query.location) params.append("location", query.location);
  if (query.startDate) params.append("startDate", query.startDate);
  if (query.endDate) params.append("endDate", query.endDate);
  params.append("page", String(query.page || 1));
  params.append("limit", String(query.limit || 50));

  const res = await apiCall<ApiResponse<StockCardResult>>(`${BASE_PATH}?${params.toString()}`, {
    method: "GET",
  });

  return (
    res.data || {
      total: 0,
      page: query.page || 1,
      limit: query.limit || 50,
      data: [],
    }
  );
}
