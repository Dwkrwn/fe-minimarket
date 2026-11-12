import { apiCall, apiPath } from "@/lib/api";

const OPNAME_PATH = apiPath("/v1/inventory/opnames");
const ADJUSTMENT_PATH = apiPath("/v1/inventory/adjustments");

export type OpnameStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type OpnameLocation = "GUDANG" | "RAK";

export interface OpnameItemRef {
  id: string;
  barcode: string;
  nama_barang: string;
  harga_jual?: number | string;
  uom?: {
    id: string;
    kode_uom?: string;
    nama_uom?: string;
    satuan_dasar?: string;
  } | null;
  category_rack?: {
    id: string;
    kode: string;
    nama: string;
    tipe_zona?: string;
  } | null;
}

export interface OpnameHeader {
  id: string;
  no_opname: string;
  status: OpnameStatus;
  tgl_opname: string;
  catatan?: string | null;
  user_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  createdAt: string;
  updatedAt?: string;
  user?: { id: string; name: string; username?: string } | null;
  approver?: { id: string; name: string; username?: string } | null;
  total_item: number;
  total_adjustment: number;
  item_selisih: number;
  qty_selisih: number;
  qty_fisik: number;
  locations?: string[];
}

export interface OpnameDetailRow {
  id: string;
  opname_id: string;
  item_id: string;
  category_rack_id?: string | null;
  location: OpnameLocation;
  qty_sistem: number;
  qty_fisik: number;
  selisih: number;
  catatan?: string | null;
  item?: OpnameItemRef;
  category_rack?: {
    id: string;
    kode: string;
    nama: string;
  } | null;
}

export interface AdjustmentDetailRow {
  id: string;
  adjustment_id: string;
  item_id: string;
  location: OpnameLocation;
  qty_adjustment: number;
  direction: "IN" | "OUT";
  item?: OpnameItemRef;
}

export interface AdjustmentRow {
  id: string;
  no_adjustment: string;
  opname_id?: string | null;
  status: string;
  tgl_adjustment: string;
  catatan?: string | null;
  createdAt: string;
  opname?: { id: string; no_opname: string } | null;
  user?: { id: string; name: string; username?: string } | null;
  details: AdjustmentDetailRow[];
}

export interface OpnameDetail extends OpnameHeader {
  details: OpnameDetailRow[];
  adjustments: AdjustmentRow[];
}

export interface OpnameListQuery {
  status?: OpnameStatus;
  location?: OpnameLocation;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PagedResult<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

export interface CreateOpnamePayload {
  location: OpnameLocation;
  category_rack_id?: string;
  catatan?: string;
}

export interface OpnameCountPayload {
  detail_id: string;
  qty_fisik: number;
  catatan?: string;
}

export interface AdjustmentResult {
  adjustment: AdjustmentRow | null;
  no_adjustment: string | null;
  total_selisih: number;
  details: AdjustmentDetailRow[];
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getStockOpnames(
  query: OpnameListQuery = {},
): Promise<PagedResult<OpnameHeader>> {
  const params = new URLSearchParams();
  if (query.status) params.append("status", query.status);
  if (query.location) params.append("location", query.location);
  if (query.search?.trim()) params.append("search", query.search.trim());
  if (query.page) params.append("page", String(query.page));
  if (query.limit) params.append("limit", String(query.limit));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<PagedResult<OpnameHeader> & { status: string }>(
    `${OPNAME_PATH}${suffix}`,
    { method: "GET" },
  );

  return {
    total: res.total ?? 0,
    page: res.page ?? 1,
    limit: res.limit ?? 50,
    data: res.data || [],
  };
}

export async function getStockOpnameDetail(id: string): Promise<OpnameDetail> {
  const res = await apiCall<ApiResponse<OpnameDetail>>(`${OPNAME_PATH}/${id}`, {
    method: "GET",
  });
  return res.data;
}

export async function createStockOpnameDraft(
  payload: CreateOpnamePayload,
): Promise<OpnameHeader> {
  const res = await apiCall<ApiResponse<OpnameHeader>>(OPNAME_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function submitStockOpnameCounts(
  id: string,
  counts: OpnameCountPayload[],
): Promise<OpnameDetail> {
  const res = await apiCall<ApiResponse<OpnameDetail>>(`${OPNAME_PATH}/${id}/counts`, {
    method: "PUT",
    body: JSON.stringify({ counts }),
  });
  return res.data;
}

export async function deleteStockOpnameDraft(
  id: string,
): Promise<{ id: string; no_opname: string }> {
  const res = await apiCall<ApiResponse<{ id: string; no_opname: string }>>(
    `${OPNAME_PATH}/${id}`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function applyStockAdjustment(
  id: string,
  catatan?: string,
): Promise<AdjustmentResult> {
  const res = await apiCall<ApiResponse<AdjustmentResult>>(`${OPNAME_PATH}/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify({ catatan }),
  });
  return res.data;
}

export async function getStockAdjustments(
  query: { opname_id?: string; page?: number; limit?: number } = {},
): Promise<PagedResult<AdjustmentRow>> {
  const params = new URLSearchParams();
  if (query.opname_id) params.append("opname_id", query.opname_id);
  if (query.page) params.append("page", String(query.page));
  if (query.limit) params.append("limit", String(query.limit));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<PagedResult<AdjustmentRow> & { status: string }>(
    `${ADJUSTMENT_PATH}${suffix}`,
    { method: "GET" },
  );


  return {
    total: res.total ?? 0,
    page: res.page ?? 1,
    limit: res.limit ?? 50,
    data: res.data || [],
  };
}
