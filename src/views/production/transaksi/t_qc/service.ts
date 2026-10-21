import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface MGeneralRef {
  id?: string
  value1?: string
  value2?: string
  group?: string
}

export interface MItemRef {
  id?: string
  kode_item?: string
  nama_item?: string
  qc_tipe?: string
  uom_id?: string
  mi_uom?: MGeneralRef
}

export interface GudangRef {
  id?: string
  nama_gudang?: string
  nama?: string
}

export interface UnitBisnisRef {
  id?: string
  nama_comp?: string
  m_company?: { nama?: string; kode?: string; logo_img?: string }
}

export interface KaryawanRef {
  id?: string
  nama_kary?: string
  no_ktp?: string
  kode_kary?: string
  no_tlp?: string
}

export interface UserRef {
  id?: string
  nama?: string
}

export interface RoutingNode {
  code?: string
  name?: string
  nama?: string
  nama_routing?: string
  wo_sd_routing?: RoutingNode
  m_routing?: RoutingNode
}

// Baris sumber yang bisa dipilih ke detail QC (INCOMING dari
// t_penerimaan_barang_d, INLINE/FINAL dari t_pres_d_item)
export interface SourceRow {
  id: string
  m_item?: MItemRef
  m_items?: MItemRef
  m_items_id?: string
  m_item_id?: string
  qc_tipe?: string
  qty_ref?: number | string
  qty?: number | string
  qty_result?: number | string
  qty_diterima?: number | string
  qty_confirm?: number | string
  qty_transfer?: number | string
  uom_name?: string
  unit_id?: string
  uom_id?: string
  kode_item?: string
  nama_item?: string
  m_general?: MGeneralRef
}

// Opsi referensi header (pemilih dokumen sumber)
export interface PenerimaanRef {
  id: string
  no_penerimaan?: string
  m_gudang_id?: string
  m_gudang?: GudangRef
  m_supplier?: { nama?: string }
  no_sj_supp?: string
}

export interface PresRef {
  id: string
  no?: string
  to_warehouse_id?: string
  m_warehouse_id?: string
  m_gudang?: GudangRef
  t_wo?: { no?: string }
  t_wo_d_item?: { m_items?: MItemRef; m_item?: MItemRef }
  t_wo_sd_routing?: RoutingNode
}

// Gabungan opsi referensi header (INCOMING vs INLINE vs FINAL-ke-WO)
export type RefOption = PenerimaanRef & PresRef & WoRef;

// State form QC (nilai + relasi display opsional)
export interface QcFormValues {
  id: string
  m_unit_bisnis_id: string
  no: string
  date: string
  flag: 'INCOMING' | 'INLINE' | 'FINAL'
  ref_table: string
  ref_id: string
  m_warehouse_id: string
  pic_id: string
  notes: string
  status: 'DRAFT' | 'POST'
  sample_pct?: string | number | null
  m_unit_bisnis?: UnitBisnisRef
}

// Respons generik endpoint /dynamic
export interface DynamicResponse<TData> {
  status: string
  message?: string
  data?: TData
}

export interface PenerimaanDetailData {
  m_supplier?: { nama?: string }
  m_gudang?: GudangRef
  m_gudang_id?: string
  no_penerimaan?: string
  no_sj_supp?: string
  t_penerimaan_barang_ds?: { t_purchase_order?: { no_po?: string; no?: string } }[]
}

export interface PresDetailData {
  no?: string
  flag?: string
  to_warehouse_id?: string
  m_warehouse_id?: string
  m_gudang?: GudangRef
  t_wo?: { no?: string }
  t_wo_d_item?: { m_items?: MItemRef; m_item?: MItemRef }
  t_wo_sd_routing?: RoutingNode
}

// Baris routing detail Work Order (sumber label routing FINAL QC)
export interface WoRoutingRow {
  m_routing?: RoutingNode
  to_routing?: RoutingNode
  wo_sd_routing?: RoutingNode
  wo_sd_to_routing?: RoutingNode | null
}

export interface WoDetailRow {
  id?: string
  m_items?: MItemRef
  m_item?: MItemRef
  qty?: number | string
  qty_result?: number | string
  t_wo_sd_routings?: WoRoutingRow[]
  t_wo_sd_routing?: WoRoutingRow[]
}

// Header Work Order (referensi FINAL QC)
export interface WoRef {
  id: string
  no?: string
  date?: string
  status?: string
  m_warehouse_id?: string
  to_warehouse_id?: string
  m_gudang?: GudangRef
  t_wo_d_items?: WoDetailRow[]
  t_wo_ds?: WoDetailRow[]
  t_wo_d_item?: WoDetailRow[]
}

export interface WoDetailData {
  no?: string
  date?: string
  status?: string
  flag?: string
  m_warehouse_id?: string
  to_warehouse_id?: string
  m_gudang?: GudangRef
  t_wo_d_items?: WoDetailRow[]
  t_wo_ds?: WoDetailRow[]
  t_wo_d_item?: WoDetailRow[]
}

// Payload simpan QC (header + detail + kriteria)
export interface SaveQcCritPayload {
  id?: string
  seq?: number
  date?: string
  m_qc_d_crit_id?: string | null
  m_qc_d_opt_id?: string | null
  qty_qc?: number
  qty_pass?: number
  qty_nopass?: number
  note?: string
}

export interface SaveQcDetailPayload {
  id?: string
  sequence?: number
  ref_table?: string
  ref_id?: string
  m_item_id?: string
  qty?: number
  qty_pass?: number
  qty_reject?: number
  unit_id?: string | null
  notes?: string
  sample_pct?: number | null
  t_qc_sd_crits?: SaveQcCritPayload[]
}

export interface SaveQcPayload {
  id?: string
  no?: string
  m_unit_bisnis_id?: string
  date?: string
  flag?: string
  ref_table?: string
  ref_id?: string
  m_warehouse_id?: string
  pic_id?: string
  notes?: string
  status?: string
  sample_pct?: number | string | null
  t_qc_d_items?: SaveQcDetailPayload[]
}

export interface QcSubDetailCrit {
  id?: string
  t_qc_id?: string
  t_qc_d_item_id?: string
  seq?: number
  date?: string
  m_qc_d_crit_id?: string
  m_qc_d_opt_id?: string
  qty_qc?: number | string
  qty_pass?: number | string
  qty_nopass?: number | string
  note?: string
  qc_criteria?: MGeneralRef
  qc_value?: MGeneralRef
  m_general_criteria?: MGeneralRef
  m_general_value?: MGeneralRef
}

export interface QcSampleItem {
  id?: string
  sample_no: number
  notes?: string
  t_qc_sd_crits: QcSubDetailCrit[]
}

export interface QcDetailItem {
  id?: string
  t_qc_id?: string
  sequence?: number
  ref_table?: 't_penerimaan_barang_d' | 't_mtf_d' | 't_pres_d_items' | 't_wo_d_item' | string
  ref_id?: string
  m_item_id?: string
  qty?: number | string
  qty_pass?: number | string
  qty_reject?: number | string
  unit_id?: string
  notes?: string
  sample_pct?: number | string | null
  // Display/Reference extra fields
  kode_item?: string
  nama_item?: string
  qc_type?: string // 'SAMPLING' | 'FULL'
  ref_qty?: number | string
  uom_name?: string
  m_item?: MItemRef
  m_items?: MItemRef
  m_general?: MGeneralRef
  sj_no?: string
  po_no?: string
  samples?: QcSampleItem[]
  t_qc_sd_crits?: QcSubDetailCrit[]
}

export interface QcItem {
  id: string
  m_unit_bisnis_id?: string
  no?: string
  date?: string
  flag?: 'INCOMING' | 'INLINE' | 'FINAL' | string
  ref_table?: 't_penerimaan_barangs' | 't_mtf' | 't_pres' | 't_wo' | string
  ref_id?: string
  m_warehouse_id?: string
  pic_id?: string
  notes?: string
  status?: 'DRAFT' | 'POST' | string
  sample_pct?: number | string | null
  created_by?: string
  updated_by?: string
  createdAt?: string
  updatedAt?: string
  // Relations
  m_unit_bisnis?: UnitBisnisRef
  m_gudang?: GudangRef
  m_kary?: KaryawanRef
  qc_ctr?: UserRef
  qc_updt?: UserRef
  t_qc_d_items?: QcDetailItem[]
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

export interface QcListResponse {
  status: string
  data: QcItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_qc data
 */
export async function getQcList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: Record<string, string>,
  columnOperators?: Record<string, string>,
  where?: string
): Promise<QcListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis,m_gudang,m_kary'
  })

  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }

  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value)
      }
    })
  }

  if (columnOperators) {
    Object.entries(columnOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value)
      }
    })
  }

  if (where) {
    queryParams.append('where', where)
  }

  return apiCall<QcListResponse>(`/dynamic/t_qc?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Qc by ID with full nested details
 */
export async function getQcById(id: string): Promise<{ status: string; data: QcItem }> {
  return apiCall(`/fn/t_qc/getQcDetail?id=${id}`, {
    method: 'GET'
  })
}

/**
 * Create new Qc with nested details
 */
export async function createQc(data: SaveQcPayload): Promise<{ status: string; data: QcItem }> {
  return apiCall('/fn/t_qc/saveQc', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Qc with nested details
 */
export async function updateQc(id: string, data: SaveQcPayload): Promise<{ status: string; data: QcItem }> {
  return apiCall('/fn/t_qc/saveQc', {
    method: 'POST',
    body: JSON.stringify({ ...data, id })
  })
}

/**
 * Delete Qc with cascade details
 */
export async function deleteQc(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/fn/t_qc/deleteQc?id=${id}`, {
    method: 'DELETE'
  })
}

/**
 * Post QC — change status to POST
 */
export async function postQc(
  id: string,
): Promise<{ status: string; data?: QcItem; message?: string }> {
  return apiCall(`/dynamic/t_qc/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}

/**
 * Custom function to detect and consolidate duplicate items by item ID or item code.
 * Combines quantities and merges them into a single information row.
 */
export function detectAndMergeDuplicateItems<T extends Record<string, any>>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];

  const map = new Map<string, T>();

  for (const item of items) {
    const itemId = item.m_item_id || item.m_items_id || item.m_item?.id || item.m_items?.id;
    const itemCode = item.kode_item || item.m_item?.kode_item || item.m_items?.kode_item;
    const key = itemId ? String(itemId) : (itemCode ? String(itemCode) : String(item.id || Math.random()));

    if (!map.has(key)) {
      map.set(key, { ...item });
    } else {
      const existing = map.get(key)!;
      const existingQty = parseFloat(String(existing.qty_ref ?? existing.ref_qty ?? existing.qty ?? existing.qty_diterima ?? 0)) || 0;
      const incomingQty = parseFloat(String(item.qty_ref ?? item.ref_qty ?? item.qty ?? item.qty_diterima ?? 0)) || 0;
      const totalQty = Number((existingQty + incomingQty).toFixed(4));

      if ('qty_ref' in existing) (existing as any).qty_ref = totalQty;
      if ('ref_qty' in existing) (existing as any).ref_qty = totalQty;
      if ('qty' in existing) (existing as any).qty = totalQty;
      if ('qty_diterima' in existing) (existing as any).qty_diterima = totalQty;

      // Keep reference to both IDs if needed
      if (item.id && (existing as any).ref_ids) {
        (existing as any).ref_ids.push(item.id);
      } else if (item.id && existing.id && existing.id !== item.id) {
        (existing as any).ref_ids = [existing.id, item.id];
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Calculate the number of samples to check based on reference quantity and sampling percentage.
 * Example: 30 items with 10% sampling => 3 samples.
 */
export function calculateSampleCount(refQty: number | string | null | undefined, samplePct: number | string | null | undefined): number {
  const q = parseFloat(String(refQty ?? 0).replace(',', '.')) || 0;
  const p = parseFloat(String(samplePct ?? 0).replace(',', '.')) || 0;
  if (p <= 0 || q <= 0) return 1;
  const count = Math.round((q * p) / 100);
  return count >= 1 ? count : 1;
}
