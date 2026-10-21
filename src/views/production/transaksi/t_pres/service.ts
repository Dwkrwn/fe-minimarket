import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PresDetailItem {
  id?: string
  t_pres_id?: string
  sequence?: number
  t_wo_d_item_id?: string
  item_type_id?: string
  m_item_id?: string
  batch?: string
  qty?: number | string
  qty_confirm?: number | string
  unit_id?: string
  notes?: string
  m_item?: any
  m_general_unit?: any
  m_general_item_type?: any
}

export interface PresDetailProblem {
  id?: string
  t_pres_id?: string
  sequence?: number
  start?: string
  end?: string
  is_running?: boolean
  total_time?: string
  problem_reason_id?: string
  notes?: string
  m_general?: any
}

export interface PresDetailUsage {
  id?: string
  t_pres_id?: string
  sequence?: number
  t_mtf_d_id?: string
  m_item_id?: string
  qty?: number | string
  unit_id?: string
  waste_pct?: number | string
  waste_qty?: number | string
  notes?: string
  m_item?: any
  m_general_unit?: any
}

export interface PresItem {
  id: string
  m_unit_bussiness_id?: string
  no?: string
  date?: string
  flag?: string
  t_wo_id?: string
  t_wo_d_item_id?: string
  t_wo_sd_routing_id?: string
  machine_id?: number | string
  to_warehouse_id?: string
  shift?: string
  date_start?: string
  date_end?: string
  problem_run?: string
  problem_norun?: string
  total_time?: string
  is_overtime?: boolean
  overtime_reason?: string
  notes?: string
  status?: string
  t_pres_d_items?: PresDetailItem[]
  t_pres_d_problems?: PresDetailProblem[]
  t_pres_d_usages?: PresDetailUsage[]
  m_unit_bisni?: any
  t_wo?: any
  t_wo_d_item?: any
  t_wo_sd_routing?: any
  m_mesin?: any
  m_gudang?: any
  createdAt?: string
  updatedAt?: string
  warehouse?: string
  value2?: string
  catatan?: string
  value3?: string
  group?: string
  code?: string
  is_active?: boolean
  value1?: string
  key1?: string
  durasi?: string
  no_spk?: string
  routing?: string
}

export interface Pagination {
  total: number
  page: number
  totalPages: number
  limit: number
  currentRowsCount: number
  next_page: number | null
  prev_page: number | null
}

export interface PresListResponse {
  status: string
  data: PresItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_pres data for FG flag
 */
export async function getPresList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<PresListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true',
    include: 't_wo_sd_routing,t_wo,m_gudang',
    filter_column_flag: 'FG'
  })

  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }

  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });
  }

  if (where) {
    queryParams.append('where', where);
  }

  if (filterCreatedBy) {
    queryParams.append('filter_column_created_by', filterCreatedBy)
  }

  return apiCall<PresListResponse>(`/dynamic/t_pres?${queryParams}`, {
    method: 'GET'
  })
}

export async function getPresById(id: string): Promise<{ status: string; data: PresItem }> {
  return apiCall(`/dynamic/t_pres/${id}?join=true&include=t_wo_sd_routing,t_wo,m_gudang`, {
    method: 'GET'
  })
}

/**
 * Create new Pres using standard dynamic with-details endpoint (flag: FG)
 */
export async function createPres(data: Partial<PresItem>): Promise<{ status: string; data: PresItem }> {
  const payload = {
    ...data,
    flag: 'FG',
    total_time: data.total_time && data.total_time !== '' ? data.total_time : (data.durasi && data.durasi !== '' ? data.durasi : null),
    problem_run: data.problem_run && data.problem_run !== '' ? data.problem_run : null,
    problem_norun: data.problem_norun && data.problem_norun !== '' ? data.problem_norun : null,
    t_pres_d_items: (data.t_pres_d_items || (data as any).Result || []).map((item: any, idx: number) => ({
      id: item.id && !item.id.startsWith('temp-') ? item.id : undefined,
      sequence: item.sequence || (idx + 1),
      t_wo_d_item_id: item.t_wo_d_item_id || null,
      item_type_id: item.item_type_id || item.tipe_item || null,
      m_item_id: item.m_item_id || item.no_wip_fg || null,
      batch: item.batch || null,
      qty: item.qty !== undefined && item.qty !== '' ? Number(item.qty) : 0,
      qty_confirm: item.qty_confirm !== undefined && item.qty_confirm !== '' ? Number(item.qty_confirm) : 0,
      unit_id: item.unit_id || item.uom || null,
      notes: item.notes || item.catatan || null
    })),
    t_pres_d_usages: (data.t_pres_d_usages || (data as any).PemakaianBahan || []).map((usg: any, idx: number) => ({
      id: usg.id && !usg.id.startsWith('temp-') ? usg.id : undefined,
      sequence: usg.sequence || (idx + 1),
      t_mtf_d_id: usg.t_mtf_d_id || usg.no_material_transfer || null,
      m_item_id: usg.m_item_id || usg.nama_material || null,
      qty: usg.qty !== undefined && usg.qty !== '' ? Number(usg.qty) : 0,
      unit_id: usg.unit_id || usg.uom || null,
      waste_pct: usg.waste_pct !== undefined && usg.waste_pct !== '' ? Number(usg.waste_pct) : (usg.waste_persen !== undefined && usg.waste_persen !== '' ? Number(usg.waste_persen) : 0),
      waste_qty: usg.waste_qty !== undefined && usg.waste_qty !== '' ? Number(usg.waste_qty) : (usg.waste !== undefined && usg.waste !== '' ? Number(usg.waste) : 0),
      notes: usg.notes || usg.catatan || null
    })),
    t_pres_d_problems: (data.t_pres_d_problems || (data as any).Problem || []).map((prob: any, idx: number) => ({
      id: prob.id && !prob.id.startsWith('temp-') ? prob.id : undefined,
      sequence: prob.sequence || (idx + 1),
      start: prob.start || prob.problem_start || null,
      end: prob.end || prob.problem_end || null,
      is_running: prob.is_running !== undefined ? (prob.is_running === true || prob.is_running === 'true' || prob.is_running === 1) : (prob.mesin_running === true || prob.mesin_running === 'true' || prob.mesin_running === 1),
      total_time: prob.total_time || prob.total_problem_menit || null,
      problem_reason_id: prob.problem_reason_id || prob.kategori_problem || null,
      notes: prob.notes || prob.catatan || null
    }))
  }
  delete (payload as any).Result
  delete (payload as any).PemakaianBahan
  delete (payload as any).Problem

  if (!payload.id || payload.id === '') {
    delete payload.id
  }
  delete (payload as any).durasi

  return apiCall('/dynamic/t_pres/with-details', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/**
 * Update Pres using standard dynamic with-details endpoint
 */
export async function updatePres(id: string, data: Partial<PresItem>): Promise<{ status: string; data: PresItem }> {
  const payload = {
    ...data,
    flag: 'FG',
    total_time: data.total_time && data.total_time !== '' ? data.total_time : (data.durasi && data.durasi !== '' ? data.durasi : null),
    problem_run: data.problem_run && data.problem_run !== '' ? data.problem_run : null,
    problem_norun: data.problem_norun && data.problem_norun !== '' ? data.problem_norun : null,
    t_pres_d_items: (data.t_pres_d_items || (data as any).Result || []).map((item: any, idx: number) => ({
      id: item.id && !item.id.startsWith('temp-') ? item.id : undefined,
      sequence: item.sequence || (idx + 1),
      t_wo_d_item_id: item.t_wo_d_item_id || null,
      item_type_id: item.item_type_id || item.tipe_item || null,
      m_item_id: item.m_item_id || item.no_wip_fg || null,
      batch: item.batch || null,
      qty: item.qty !== undefined && item.qty !== '' ? Number(item.qty) : 0,
      qty_confirm: item.qty_confirm !== undefined && item.qty_confirm !== '' ? Number(item.qty_confirm) : 0,
      unit_id: item.unit_id || item.uom || null,
      notes: item.notes || item.catatan || null
    })),
    t_pres_d_usages: (data.t_pres_d_usages || (data as any).PemakaianBahan || []).map((usg: any, idx: number) => ({
      id: usg.id && !usg.id.startsWith('temp-') ? usg.id : undefined,
      sequence: usg.sequence || (idx + 1),
      t_mtf_d_id: usg.t_mtf_d_id || usg.no_material_transfer || null,
      m_item_id: usg.m_item_id || usg.nama_material || null,
      qty: usg.qty !== undefined && usg.qty !== '' ? Number(usg.qty) : 0,
      unit_id: usg.unit_id || usg.uom || null,
      waste_pct: usg.waste_pct !== undefined && usg.waste_pct !== '' ? Number(usg.waste_pct) : (usg.waste_persen !== undefined && usg.waste_persen !== '' ? Number(usg.waste_persen) : 0),
      waste_qty: usg.waste_qty !== undefined && usg.waste_qty !== '' ? Number(usg.waste_qty) : (usg.waste !== undefined && usg.waste !== '' ? Number(usg.waste) : 0),
      notes: usg.notes || usg.catatan || null
    })),
    t_pres_d_problems: (data.t_pres_d_problems || (data as any).Problem || []).map((prob: any, idx: number) => ({
      id: prob.id && !prob.id.startsWith('temp-') ? prob.id : undefined,
      sequence: prob.sequence || (idx + 1),
      start: prob.start || prob.problem_start || null,
      end: prob.end || prob.problem_end || null,
      is_running: prob.is_running !== undefined ? (prob.is_running === true || prob.is_running === 'true' || prob.is_running === 1) : (prob.mesin_running === true || prob.mesin_running === 'true' || prob.mesin_running === 1),
      total_time: prob.total_time || prob.total_problem_menit || null,
      problem_reason_id: prob.problem_reason_id || prob.kategori_problem || null,
      notes: prob.notes || prob.catatan || null
    }))
  }
  delete (payload as any).Result
  delete (payload as any).PemakaianBahan
  delete (payload as any).Problem

  if (!payload.id || payload.id === '') {
    delete payload.id
  }
  delete (payload as any).durasi

  return apiCall(`/dynamic/t_pres/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

/**
 * Delete Pres
 */
export async function deletePres(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_pres/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_pres data (FG) without pagination
 */
export async function getPresListNoPagination(): Promise<PresListResponse> {
  return apiCall<PresListResponse>('/dynamic/t_pres?no_pagination=true&filter_column_flag=FG&join=true', {
    method: 'GET'
  })
}

export async function postPres(id: string): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_pres/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST' })
  })
}
