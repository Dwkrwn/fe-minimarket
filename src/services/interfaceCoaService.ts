import { ref, type Ref } from 'vue'
import { apiCall } from '@/lib/api'

export interface LeafCoaItem {
  id: string
  kode: string
  nama: string
  level?: number
  kategori_id?: string
  tipe_id?: string
  sequence?: number
  notes?: string
}

export interface InterfaceCoaResult {
  status: string
  data: LeafCoaItem[]
  interface?: {
    id: string
    type: 'SINGLE' | 'MULTI' | string
    var_id: string
    var_name?: string | null
    m_unit_bisnis_id?: string | null
  } | null
  message?: string
}

/**
 * Helper utama: Mengambil data COA leaf berdasarkan Nama Variable Interface (m_general group 'INTERFACE VAR')
 * dan Unit Bisnis / Company.
 * Form transaksi dilarang mengambil langsung Master COA, harus melalui helper ini.
 */
export async function getDataCoaByInterface(params: {
  var_name?: string
  var_id?: string
  m_unit_bisnis_id?: string | null
  search?: string
}): Promise<InterfaceCoaResult> {
  const query = new URLSearchParams()
  if (params.var_name) query.append('var_name', params.var_name)
  if (params.var_id) query.append('var_id', params.var_id)
  if (params.m_unit_bisnis_id) query.append('m_unit_bisnis_id', params.m_unit_bisnis_id)
  if (params.search) query.append('search', params.search)

  return apiCall<InterfaceCoaResult>(`/fn/m_interface/getDataCoa?${query.toString()}`, {
    method: 'GET'
  })
}

/**
 * Helper: Mengambil daftar seluruh COA Leaf (paling anak / bukan induk dari COA lain)
 */
export async function getLeafCoaList(params?: {
  search?: string
  page?: number
  paginate?: number
  no_pagination?: boolean
}): Promise<{ status: string; data: LeafCoaItem[]; pagination?: any }> {
  const query = new URLSearchParams()
  if (params?.search) query.append('search', params.search)
  if (params?.page) query.append('page', String(params.page))
  if (params?.paginate) query.append('paginate', String(params.paginate))
  if (params?.no_pagination) query.append('no_pagination', 'true')

  return apiCall(`/fn/m_interface/getLeafCoa?${query.toString()}`, {
    method: 'GET'
  })
}

/**
 * Vue Composable untuk mempermudah form transaksi lain mengkonsumsi COA dari Interface
 *
 * Contoh penggunaan:
 * const { coaList, loading, fetchCoa } = useCoaInterface('V_CASH', currentUnitBisnisId)
 * onMounted(() => fetchCoa())
 */
export function useCoaInterface(initialVarName?: string, initialUnitBisnisId?: string) {
  const loading = ref(false)
  const coaList: Ref<LeafCoaItem[]> = ref([])
  const interfaceInfo = ref<InterfaceCoaResult['interface']>(null)
  const error = ref<string | null>(null)

  const fetchCoa = async (varName?: string, unitBisnisId?: string) => {
    const targetVar = varName || initialVarName
    const targetUb = unitBisnisId || initialUnitBisnisId
    if (!targetVar) return []

    loading.value = true
    error.value = null
    try {
      const res = await getDataCoaByInterface({
        var_name: targetVar,
        m_unit_bisnis_id: targetUb
      })
      if (res.status === 'success') {
        coaList.value = res.data || []
        interfaceInfo.value = res.interface || null
        return res.data
      } else {
        error.value = res.message || 'Gagal memuat akun COA dari interface'
        return []
      }
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat memuat COA'
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    coaList,
    interfaceInfo,
    error,
    fetchCoa
  }
}
