import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/inventory/mutations");

export interface StockMutationLinePayload {
  item_id: string;
  qty_pcs: number;
}

export interface CreateStockMutationPayload {
  items: StockMutationLinePayload[];
  keterangan?: string;
}

export interface StockMutationDetail {
  id: string;
  mutation_id: string;
  item_id: string;
  qty_pcs: number;
}

export interface StockMutationResult {
  id: string;
  no_mutasi: string;
  from_location: string;
  to_location: string;
  status: string;
  keterangan?: string | null;
  user_id?: string | null;
  createdAt?: string;
  details: StockMutationDetail[];
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

/**
 * Eksekusi mutasi stok Gudang -> Rak (atomik di backend).
 * Backend memotong stok GUDANG, menambah stok RAK, dan menulis
 * dua baris kartu stok (MUTASI_KELUAR + MUTASI_MASUK).
 */
export async function createStockMutation(
  payload: CreateStockMutationPayload,
): Promise<StockMutationResult> {
  const res = await apiCall<ApiResponse<StockMutationResult>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}
