import { apiCall } from "@/lib/api";

export interface MrqDetailItem {
  id?: string;
  t_mrq_id?: string;
  sequence?: number;
  t_wo_sd_material_id?: string;
  m_item_id?: string;
  qty_wo?: number | string;
  qty_sdh_request?: number | string;
  qty_available?: number | string;
  qty_stock?: number | string;
  qty_request?: number | string;
  unit_id?: string;
  uom?: string;
  qty_confirm?: number | string;
  notes?: string;
  m_item?: any;
  m_items?: any;
  m_general?: any;
  t_wo?: any;
}

export interface MrqItem {
  id: string;
  m_unit_bisnis_id?: string;
  warehouse_id?: string;
  date?: string;
  tgl_t_mrq?: string;
  t_wo_id?: string;
  t_wo_d_item_id?: string;
  t_wo_sd_routing_id?: string;
  t_wo?: any;
  no?: string;
  no_t_mrq?: string;
  status?: string;
  notes?: string;
  catatan?: string;
  createdAt?: string;
  updatedAt?: string;
  m_unit_bisni?: any;
  m_gudang?: any;
  t_mrq_d?: MrqDetailItem[];
  t_mrq_ds?: MrqDetailItem[];
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentRowsCount: number;
  next_page: number | null;
  prev_page: number | null;
}

export interface MrqListResponse {
  status: string;
  data: MrqItem[];
  pagination: Pagination;
}

export async function getMrqList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  created_by?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<MrqListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: "true",
  });

  if (search?.trim()) queryParams.append("search", search.trim());
  if (searchfield) queryParams.append("searchfield", searchfield);
  if (created_by) queryParams.append("created_by", created_by);

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });
  }

  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<MrqListResponse>(`/dynamic/t_mrq?${queryParams}`, {
    method: "GET",
  });
}

export async function getMrqById(
  id: string,
): Promise<{ status: string; data: MrqItem }> {
  const include = 't_mrq_d@t_mrq_ds>t_wo_sd_material>t_wo,t_mrq_d@t_mrq_ds>m_items@m_item>m_general@mi_uom,t_mrq_d@t_mrq_ds>t_wo_sd_material>m_items@m_item>m_general@mi_uom';
  return apiCall(`/dynamic/t_mrq/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: "GET",
  });
}

export async function createMrq(
  data: Partial<MrqItem>,
): Promise<{ status: string; data: MrqItem }> {
  return apiCall("/dynamic/t_mrq/with-details", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMrq(
  id: string,
  data: Partial<MrqItem>,
): Promise<{ status: string; data: MrqItem }> {
  return apiCall(`/dynamic/t_mrq/with-details/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMrq(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_mrq/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function getMrqListNoPagination(): Promise<MrqListResponse> {
  return apiCall<MrqListResponse>("/dynamic/t_mrq?no_pagination=true&join=true", {
    method: "GET",
  });
}

export async function postMrq(
  id: string,
): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_mrq/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}

export async function updateMrqStatus(
  id: string,
  status: "DRAFT" | "POST" | "IN APPROVAL" | "APPROVED" | "REVISI" | "REJECT",
): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_mrq/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface MrqQtyOverCheckItem {
  t_mrq_d_id: string;
  t_mrq_id: string;
  t_wo_sd_material_id: string;
  m_item_id: string;
  kode_item: string;
  nama_item: string;
  qty_request_mrq: string;
  qty_wo_total: string;
  qty_wo_sdh_request: string;
  qty_wo_available: string;
  is_over_limit: boolean;
  qty_excess: string;
}

export interface MrqQtyOverCheckResponse {
  status: string;
  success: boolean;
  message: string;
  needs_approval: boolean;
  total_items: number;
  total_over_limit_items: number;
  data: MrqQtyOverCheckItem[];
}

export async function checkMrqQtyIsOver(
  t_mrq_id: string,
): Promise<MrqQtyOverCheckResponse> {
  return apiCall(`/fn/t_mrq/mrqCheckQtyIsOver?t_mrq_id=${encodeURIComponent(t_mrq_id)}`, {
    method: "GET",
  });
}

export interface SendMrqApprovalPayload {
  t_mrq_id: string;
  approval_level: number;
  sender_id: string;
  approval_message?: string | null;
}

export async function sendMrqApproval(
  payload: SendMrqApprovalPayload,
): Promise<{ status: string; message?: string }> {
  return apiCall("/dynamic/t_mrq_notifikasi", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWoMaterialsForMrq(params: {
  t_wo_id: string;
  t_wo_d_item_id: string;
  t_wo_sd_routing_id: string;
  show_all?: boolean;
}): Promise<{ status: string; data: any[] }> {
  const q = new URLSearchParams({
    t_wo_id: params.t_wo_id,
    t_wo_d_item_id: params.t_wo_d_item_id,
    t_wo_sd_routing_id: params.t_wo_sd_routing_id,
  });
  if (params.show_all) q.append("show_all", "true");
  return apiCall(`/fn/t_wo/QtyAvailableForMRQ?${q.toString()}`, {
    method: "GET",
  });
}

