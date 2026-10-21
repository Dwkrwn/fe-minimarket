import { apiCall } from '@/lib/api'

export interface PurchaseReturnSubconItem {
  id: string
  tipe_retur?: 'SJ' | 'PB' | 'PI'
  no_retur_subcon?: string
  tgl_retur?: string
  no_t_purchase_return_subcon: string
  tgl_t_purchase_return_subcon: string
  m_unit_bisnis_id?: string
  m_unit_bisni?: any
  m_unit_bisnis?: any
  m_supplier_id?: string
  m_supplier?: any
  t_surat_jalan_subcon_id?: string
  t_surat_jalan_subcon?: any
  t_penerimaan_subcon_id?: string
  t_penerimaan_subcon?: any
  t_purchase_invoice_subcon_id?: string
  t_purchase_invoice_subcon?: any
  tipe_ppn?: string
  persen_ppn?: number
  nilai_ppn?: number
  tipe_pph?: string
  persen_pph?: number
  nilai_pph?: number
  catatan?: string
  dpp?: number
  grand_total?: number
  status?: string
  createdAt: string
  updatedAt: string
  createdBy?: any
  t_purchase_return_subcon_jadis?: any[]
  t_purchase_return_subcon_jasas?: any[]
  t_purchase_return_subcon_details?: any[]   // legacy
  t_purchase_return_subcon_details2?: any[]  // legacy
  t_purchase_return_subcon_details3?: any[]  // legacy
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

export interface PurchaseReturnSubconListResponse {
  status: string
  data: PurchaseReturnSubconItem[]
  pagination: Pagination
  message?: string
}

export async function getPurchaseReturnSubconList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filter_created_by?: string
): Promise<PurchaseReturnSubconListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis,m_supplier,m_currency,m_general,t_penerimaan_barang_subcon,t_purchase_invoice_subcon'
  })
  if (search?.trim()) queryParams.append('search', search.trim())
  if (searchfield) queryParams.append('searchfield', searchfield)
  if (filter_created_by) queryParams.append('filter_column_created_by', filter_created_by)
  return apiCall<PurchaseReturnSubconListResponse>(`/dynamic/t_purchase_return_subcon?${queryParams}`, { method: 'GET' })
}

export async function getPurchaseReturnSubconById(id: string): Promise<{ status: string; data: PurchaseReturnSubconItem }> {
  return apiCall(
    `/dynamic/t_purchase_return_subcon/${id}?include=m_unit_bisnis,m_supplier,m_currency,m_general,t_penerimaan_barang_subcon,t_purchase_invoice_subcon,t_purchase_return_subcon_jadi,t_purchase_return_subcon_jasa`,
    { method: 'GET' }
  )
}

export async function createPurchaseReturnSubcon(data: Partial<PurchaseReturnSubconItem>): Promise<{ status: string; data: PurchaseReturnSubconItem }> {
  return apiCall('/dynamic/t_purchase_return_subcon/with-details', { method: 'POST', body: JSON.stringify(data) })
}

export async function updatePurchaseReturnSubcon(id: string, data: Partial<PurchaseReturnSubconItem>): Promise<{ status: string; data: PurchaseReturnSubconItem }> {
  return apiCall(`/dynamic/t_purchase_return_subcon/with-details/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deletePurchaseReturnSubcon(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_purchase_return_subcon/with-details/${id}`, { method: 'DELETE' })
}

export async function getPurchaseReturnSubconListNoPagination(): Promise<PurchaseReturnSubconListResponse> {
  return apiCall<PurchaseReturnSubconListResponse>('/dynamic/t_purchase_return_subcon?no_pagination=true', { method: 'GET' })
}
