import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface CompanyItem {
  id: string
  nama?: string | null
  kode?: string | null
  group_company?: string | null
  tipe_bisnis?: string | null
  kepemilikan_persen?: number | string | null
  npwp?: string | number | null
  npwp_foto?: string | null
  idtku?: string | number | null
  alamat?: string | null
  telepon?: string | number | null
  kode_pos?: string | number | null
  logo_img?: string | null
  status?: boolean | null
  catatan: string | null
  created_by?: string | null
  updated_by?: string | null
  is_intercompany?: boolean | null
  is_group?: boolean | null
  mc_ctr?: { id?: string; name?: string; username?: string } | null
  mc_updt?: { id?: string; name?: string; username?: string } | null
  mc_group_comp?: { id?: string; code?: string | null; value1?: string | null } | null
  mc_tipe_bisnis?: { id?: string; code?: string | null; value1?: string | null } | null
  kode_unit_bisnis: string | null
  code?: string | null
  kode_company?: string | null
  kode_comp?: string | null
  nama_comp: string
  name?: string | null
  nama_company?: string | null
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  kodepos: number | null
  address?: string | null
  email: string | null
  email_comp?: string | null
  pic: string | null
  nama_pic?: string | null
  contact_person?: string | null
  cp?: string | null
  cp1?: string | null
  no_telp_pic: string | null
  no_telp?: string | null
  telp?: string | null
  phone?: string | null
  no_hp?: string | null
  no_cp1?: string | null
  note?: string | null
  value1?: string | null
  value2?: string | null
  value3?: string | null
  value4?: string | null
  value5?: string | null
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_company_details?: any[]
  m_company_details2?: any[]
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

export interface CompanyListResponse {
  status: string
  data: CompanyItem[]
  pagination: Pagination
}

export interface CompanyColumnFilters {
  [key: string]: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const firstFilled = (...values: unknown[]) => {
  const value = values.find((item) => {
    if (item === undefined || item === null) return false
    return String(item).trim() !== ''
  })

  return value === undefined || value === null ? null : String(value)
}

const normalizeCompanyItem = (item: CompanyItem): CompanyItem => {
  const raw = item as any

  return {
    ...item,
    kode_unit_bisnis: firstFilled(
      raw.kode_unit_bisnis,
      raw.kode,
      raw.kode_company,
      raw.kode_comp,
      raw.code,
      raw.key1
    ),
    nama_comp: firstFilled(
      raw.nama_comp,
      raw.nama_company,
      raw.name,
      raw.nama,
      raw.value1
    ) || '',
    nama: firstFilled(raw.nama, raw.nama_comp, raw.nama_company, raw.name, raw.value1),
    kode: firstFilled(raw.kode, raw.kode_company, raw.kode_comp, raw.code),
    group_company: firstFilled(raw.group_company),
    tipe_bisnis: firstFilled(raw.tipe_bisnis),
    kepemilikan_persen: raw.kepemilikan_persen ?? null,
    npwp: firstFilled(raw.npwp),
    npwp_foto: firstFilled(raw.npwp_foto),
    idtku: firstFilled(raw.idtku),
    alamat: firstFilled(raw.alamat, raw.address),
    telepon: firstFilled(raw.telepon, raw.no_telp_pic, raw.no_telp, raw.telp, raw.phone),
    provinsi: firstFilled(raw.provinsi, raw.province),
    kota: firstFilled(raw.kota, raw.city),
    kecamatan: firstFilled(raw.kecamatan, raw.district),
    kodepos: raw.kodepos ?? raw.kode_pos ?? raw.postal_code ?? null,
    kode_pos: raw.kode_pos ?? raw.kodepos ?? raw.postal_code ?? null,
    logo_img: firstFilled(raw.logo_img),
    status: raw.status === undefined || raw.status === null ? true : raw.status === true || raw.status === 1 || raw.status === '1',
    email: firstFilled(raw.email, raw.email_comp, raw.value4),
    pic: firstFilled(
      raw.pic,
      raw.nama_pic,
      raw.contact_person,
      raw.cp,
      raw.cp1,
      raw.value2
    ),
    no_telp_pic: firstFilled(
      raw.no_telp_pic,
      raw.no_telp,
      raw.telp,
      raw.phone,
      raw.no_hp,
      raw.no_cp1,
      raw.value3
    ),
    catatan: firstFilled(raw.catatan, raw.note, raw.value5),
    created_by: firstFilled(raw.created_by),
    updated_by: firstFilled(raw.updated_by),
    is_intercompany: raw.is_intercompany === true || raw.is_intercompany === 1 || raw.is_intercompany === '1',
    is_group: raw.is_group === true || raw.is_group === 1 || raw.is_group === '1',
    mc_ctr: raw.mc_ctr ?? raw.created_user ?? raw.createdBy ?? null,
    mc_updt: raw.mc_updt ?? raw.updated_user ?? raw.updatedBy ?? null,
    mc_group_comp: raw.mc_group_comp ?? null,
    mc_tipe_bisnis: raw.mc_tipe_bisnis ?? null,
    is_active: raw.is_active === undefined ? raw.status !== false : raw.is_active
  }
}

const normalizeCompanyListResponse = (response: CompanyListResponse): CompanyListResponse => ({
  ...response,
  data: Array.isArray(response.data) ? response.data.map(normalizeCompanyItem) : []
})

export async function getCompanyList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: CompanyColumnFilters,
  where?: string
): Promise<CompanyListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true'
  })

  if (search?.trim()) {
    queryParams.append('search', search.trim())
  }

  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  if (where?.trim()) {
    queryParams.append('where', where.trim())
  }

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value?.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }

  const response = await apiCall<CompanyListResponse>(`/dynamic/m_company?${queryParams}`, {
    method: 'GET'
  })

  return normalizeCompanyListResponse(response)
}

export async function getCompanyById(id: string): Promise<{ status: string; data: CompanyItem }> {
  const response = await apiCall<{ status: string; data: CompanyItem }>(`/dynamic/m_company/${id}?join=true`, {
    method: 'GET'
  })

  return {
    ...response,
    data: normalizeCompanyItem(response.data)
  }
}

export async function createCompany(data: Partial<CompanyItem>): Promise<{ status: string; data: CompanyItem }> {
  const hasDetails = !!(data.m_company_details || data.m_company_details2)
  const endpoint = hasDetails ? '/dynamic/m_company/with-details' : '/dynamic/m_company'

  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCompany(
  id: string,
  data: Partial<CompanyItem>
): Promise<{ status: string; data: CompanyItem }> {
  const hasDetails = !!(data.m_company_details || data.m_company_details2)
  const endpoint = hasDetails ? `/dynamic/m_company/with-details/${id}` : `/dynamic/m_company/${id}`

  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCompany(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_company/${id}`, {
    method: 'DELETE'
  })
}

export async function getCompanyListNoPagination(): Promise<CompanyListResponse> {
  const response = await apiCall<CompanyListResponse>('/dynamic/m_company?no_pagination=true', {
    method: 'GET'
  })

  return normalizeCompanyListResponse(response)
}
