import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/inventory/category-racks");

export type ZoneType = "GUDANG" | "RAK";

export interface CategoryRack {
  id: string;
  kode: string;
  nama: string;
  tipe_zona: ZoneType;
  lokasi?: string | null;
  catatan?: string | null;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryRackPayload {
  kode: string;
  nama: string;
  tipe_zona: ZoneType;
  lokasi?: string | null;
  catatan?: string | null;
  is_active?: boolean;
}

export interface CategoryRackQuery {
  tipe_zona?: ZoneType;
  is_active?: boolean;
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getCategoryRacks(query: CategoryRackQuery = {}): Promise<CategoryRack[]> {
  const params = new URLSearchParams();
  if (query.tipe_zona) params.append("tipe_zona", query.tipe_zona);
  if (query.is_active !== undefined) params.append("is_active", String(query.is_active));
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<CategoryRack[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}

export async function createCategoryRack(payload: CategoryRackPayload): Promise<CategoryRack> {
  const res = await apiCall<ApiResponse<CategoryRack>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCategoryRack(
  id: string,
  payload: Partial<CategoryRackPayload>,
): Promise<CategoryRack> {
  const res = await apiCall<ApiResponse<CategoryRack>>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteCategoryRack(id: string): Promise<void> {
  await apiCall(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
