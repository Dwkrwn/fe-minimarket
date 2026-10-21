<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { FieldX, FieldSelect, FieldTextarea, FieldNumber } from '@/components/field'
import { ButtonMultiSelect, DeleteButton } from '@/components/button'
import { ArrowLeft, Save, Loader2, Sparkles, Send, Trash2, RefreshCw } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'
import { apiCall } from '@/lib/api'
import {
  createMrp,
  updateMrp,
  getMrpById,
  postMrp,
  type MrpDetailItem,
  type MrpDetailMtr
} from './service'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const { canUpdate, isSuperAdmin } = usePermission()
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isGenerating = ref(false)
const isPosting = ref(false)
const isPostDialogOpen = ref(false)
const activeTab = ref('detail1')

const isEditMode = computed(() => !!route.params.id && route.name === 'MrpForm')
const isViewMode = computed(() => route.name === 'MrpView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() =>
  isViewMode.value ||
  route.meta.readOnly === true ||
  ['POST', 'APPROVED'].includes((values.status || '').toUpperCase())
)
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail MRP'
  if (isCopyMode.value) return 'Salin MRP'
  if (isEditMode.value) return 'Edit MRP'
  return 'Tambah MRP Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail transaksi Material Requirements Planning'
  if (isCopyMode.value) return 'Buat MRP baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data MRP'
  return 'Buat perencanaan kebutuhan material (MRP) baru'
})

const getTodayDateString = () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const formatInputDate = (d: any) => {
  if (!d) return ''
  const str = String(d).trim()
  if (str.includes('T')) return str.split('T')[0]
  if (str.includes(' ')) return str.split(' ')[0]
  return str.slice(0, 10)
}

// Header values matching t_mrp schema
const values = reactive({
  m_unit_bisnis_id: '',
  no: '',
  date: getTodayDateString(),
  note: '',
  status: 'DRAFT'
})

const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  note: ''
})

const selectedUnitBisnisCompanyName = ref<string>('')

// Detail arrays
const detailArr = ref<MrpDetailItem[]>([])
const detailArr2 = ref<MrpDetailMtr[]>([])

// Exclude IDs for multi-select popups
const existingSourceIds = computed(() => detailArr.value.map(d => d.source_id).filter(Boolean))
const existingMaterialIds = computed(() => detailArr2.value.map(d => d.m_item_id).filter(Boolean))

// ============================================================================
// UNIT BISNIS HELPER
// ============================================================================
const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo')
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    return null
  }
}

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = ''
    return
  }
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`)
    if (res?.status === 'success' && res.data) {
      selectedUnitBisnisCompanyName.value = res.data?.m_company?.nama || res.data?.m_company?.kode || '-'
    }
  } catch (err) {
    console.error('Gagal mengambil data company:', err)
  }
}

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value = item?.m_company?.nama || item?.m_company?.kode || ''
}

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return
  const selectRespo = getSelectRespoData()
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || ''
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId)
    fetchUnitBisnisCompanyName(String(ubId))
  }
}

watch(() => values.m_unit_bisnis_id, (newVal, oldVal) => {
  if (!loading.value && oldVal && newVal !== oldVal) {
    if (detailArr.value.length > 0 || detailArr2.value.length > 0) {
      detailArr.value = []
      detailArr2.value = []
      toast.info('Company diubah, daftar item dan material direset')
    }
  }
})

// ============================================================================
// DETAIL 1 (ITEM) MULTI-SELECT CONFIGS & HANDLERS
// ============================================================================
const soMultiSelectApi = computed(() => ({
  url: `${API_BASE_URL}/dynamic/t_so_d`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`
  },
  params: {
    join: 'true',
    include: 't_so>m_customer,m_items>m_general,m_general',
    searchfield: 't_so.no_so,m_items.kode_item,m_items.nama_item',
    filter_column_is_active: 'true',
    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
  }
}))

const soColumns = [
  {
    field: 't_so.no_so',
    headerName: 'No. SO',
    width: '160px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.t_so?.no_so || d?.no_so || d?.no || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.t_so?.no_so || d?.no_so || d?.no || '-'
    }
  },
  {
    field: 't_so.m_customer.nama_customer',
    headerName: 'Customer',
    width: '180px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.t_so?.m_customer?.nama_customer || d?.m_customer?.nama_customer || d?.customer || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.t_so?.m_customer?.nama_customer || d?.m_customer?.nama_customer || d?.customer || '-'
    }
  },
  {
    field: 'kode_item',
    headerName: 'Kode Item',
    width: '130px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.m_item?.kode_item || d?.m_items?.kode_item || d?.kode_item || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.m_item?.kode_item || d?.m_items?.kode_item || d?.kode_item || '-'
    }
  },
  {
    field: 'nama_item',
    headerName: 'Nama Item',
    width: '220px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.m_item?.nama_item || d?.m_items?.nama_item || d?.nama_item || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.m_item?.nama_item || d?.m_items?.nama_item || d?.nama_item || '-'
    }
  },
  {
    field: 'qty_so',
    headerName: 'Qty SO',
    width: '100px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.qty_so ?? d?.qty ?? 0
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.qty_so ?? d?.qty ?? 0
    }
  },
  {
    field: 'uom',
    headerName: 'Satuan',
    width: '90px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.m_item?.mi_uom?.value1 || d?.m_items?.mi_uom?.value1 || d?.m_general?.value1 || d?.uom?.value1 || d?.satuan || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.m_item?.mi_uom?.value1 || d?.m_items?.mi_uom?.value1 || d?.m_general?.value1 || d?.uom?.value1 || d?.satuan || '-'
    }
  }
]

// ============================================================================
// STOCK & WO OUTSTANDING HELPERS
// ============================================================================
// 1. Qty Stok sekarang (sesuai Item yg dipilih)
const fetchItemStock = async (itemId: string, unitBisnisId?: string): Promise<number> => {
  if (!itemId) return 0

  // 1. Coba via endpoint getFreeStock
  try {
    const fnRes = await fetch(`${API_BASE_URL}/fn/m_gudang/getFreeStock?m_item_id=${encodeURIComponent(itemId)}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    })
    const fnJson = await fnRes.json()
    if (fnJson?.status === 'success' && Array.isArray(fnJson.data) && fnJson.data.length > 0) {
      let rows = fnJson.data
      if (unitBisnisId) {
        const filtered = rows.filter((r: any) => !r.m_unit_bisnis_id || r.m_unit_bisnis_id === unitBisnisId)
        if (filtered.length > 0) {
          rows = filtered
        }
      }
      return rows.reduce((sum: number, r: any) => sum + Number(r?.free_stock || 0), 0)
    }
  } catch (err) {
    console.error('Failed to fetch getFreeStock for item', itemId, err)
  }

  // 2. Fallback via /dynamic/stock_gudang
  try {
    const params = new URLSearchParams()
    params.set('filter_column_m_items_id', itemId)
    params.set('no_pagination', 'true')
    if (unitBisnisId) {
      params.set('filter_column_m_unit_bisnis_id', unitBisnisId)
    }
    const res = await apiCall<{ status: string; data: any[] }>(
      `/dynamic/stock_gudang?${params.toString()}`
    )
    if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.reduce((sum, r) => sum + Number(r?.free_stock || 0), 0)
    }
  } catch (err) {
    try {
      const res = await apiCall<{ status: string; data: any[] }>(
        `/dynamic/stock_gudang?filter_column_m_items_id=${itemId}&no_pagination=true`
      )
      if (res?.status === 'success' && Array.isArray(res.data)) {
        return res.data.reduce((sum, r) => sum + Number(r?.free_stock || 0), 0)
      }
    } catch (e) {
      console.error('Failed fallback stock for item', itemId, e)
    }
  }
  return 0
}

const handleAddFromSo = async (items: any[]) => {
  if (!items || items.length === 0) return

  const existingSet = new Set(detailArr.value.map(d => `${d.source_type}_${d.source_id}_${d.m_item_id}`))
  const newItems = items.filter(item => {
    const itemObj = item.m_item || item.m_items || {}
    const itemId = itemObj.id || item.m_item_id || item.m_items_id
    return !existingSet.has(`SO_${item.id}_${itemId}`)
  })

  if (newItems.length === 0) {
    toast.warning('Item sudah ada di daftar')
    return
  }

  try {
    const payloadItems = newItems.map(item => {
      const itemObj = item.m_item || item.m_items || {}
      return {
        m_item_id: itemObj.id || item.m_item_id || item.m_items_id,
        qty_so_io: Number(item.qty_so || item.qty || 0),
        source_type: 'SO',
        source_id: item.id,
        source_no: item.t_so?.no_so || item.no_so || '-',
        item_code: itemObj.kode_item || item.kode_item || '-',
        item_name: itemObj.nama_item || item.nama_item || '-',
        unit_id: itemObj.uom_id || item.unit_id || null,
        unit_name: itemObj.mi_uom?.value1 || item.m_general?.value1 || item.uom?.value1 || '-'
      }
    })

    const res = await apiCall<{ status: string; data: any[] }>(`/fn/t_mrp/getMrpItemData`, {
      method: 'POST',
      body: JSON.stringify({
        items: payloadItems,
        m_unit_bisnis_id: values.m_unit_bisnis_id || undefined
      })
    })

    if (res.status === 'success' && Array.isArray(res.data)) {
      let addedCount = 0
      for (const item of res.data) {
        const uniqueKey = `SO_${item.source_id}_${item.m_item_id}`
        if (existingSet.has(uniqueKey)) continue

        detailArr.value.push({
          seq: detailArr.value.length + 1,
          source_type: 'SO',
          source_id: item.source_id,
          t_so_id: item.t_so_id || item.source_id,
          source_no: item.source_no || '-',
          m_item_id: item.m_item_id,
          item_code: item.item_code || '-',
          item_name: item.item_name || '-',
          m_item: {
            id: item.m_item_id,
            kode_item: item.item_code,
            nama_item: item.item_name,
            uom_id: item.unit_id
          },
          m_bom_id: item.m_bom_id || '',
          m_bom: item.m_bom || null,
          qty_so_io: Number(item.qty_so_io || 0),
          qty_wo: Number(item.qty_wo || 0),
          qty_stok: Number(item.qty_stok || 0),
          qty_req: Number(item.qty_req !== undefined ? item.qty_req : (Number(item.qty_so_io || 0) - (Number(item.qty_wo || 0) + Number(item.qty_stok || 0)))),
          unit_id: item.unit_id || null,
          unit_name: item.unit_name || '-',
          note: ''
        })
        existingSet.add(uniqueKey)
        addedCount++
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} item dari SO berhasil ditambahkan`)
      }
    }
  } catch (err: any) {
    console.error('Failed to get MRP SO items from custom function', err)
    toast.error('Gagal mengambil data kebutuhan item dari server')
  }
}

const ioMultiSelectApi = computed(() => ({
  url: `${API_BASE_URL}/dynamic/t_io`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`
  },
  params: {
    join: 'detail,sub',
    include: 't_io_d>m_items>m_general,t_io_d>m_general',
    searchfield: 'no,notes',
    filter_column_status: 'APPROVED',
    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
  }
}))

const ioColumns = [
  {
    field: 'no',
    headerName: 'No. IO',
    width: '160px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.no || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.no || '-'
    }
  },
  {
    field: 'date',
    headerName: 'Tanggal',
    width: '110px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      const val = d?.date
      return val ? String(val).slice(0, 10) : '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      const val = d?.date
      return val ? String(val).slice(0, 10) : '-'
    }
  },
  {
    field: 'kode_item',
    headerName: 'Kode Item',
    width: '130px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length === 1) {
        return details[0].m_item?.kode_item || details[0].m_items?.kode_item || details[0].kode_item || '-'
      }
      if (details.length > 1) {
        return details.map((x: any) => x.m_item?.kode_item || x.m_items?.kode_item || x.kode_item).filter(Boolean).join(', ')
      }
      return '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length === 1) {
        return details[0].m_item?.kode_item || details[0].m_items?.kode_item || details[0].kode_item || '-'
      }
      if (details.length > 1) {
        return details.map((x: any) => x.m_item?.kode_item || x.m_items?.kode_item || x.kode_item).filter(Boolean).join(', ')
      }
      return '-'
    }
  },
  {
    field: 'nama_item',
    headerName: 'Nama Item',
    width: '180px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length === 1) {
        return details[0].m_item?.nama_item || details[0].m_items?.nama_item || details[0].nama_item || '-'
      }
      if (details.length > 1) {
        return `${details.length} Items`
      }
      return '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length === 1) {
        return details[0].m_item?.nama_item || details[0].m_items?.nama_item || details[0].nama_item || '-'
      }
      if (details.length > 1) {
        return `${details.length} Items`
      }
      return '-'
    }
  },
  {
    field: 'qty',
    headerName: 'Qty IO',
    width: '90px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length > 0) {
        return details.reduce((sum: number, x: any) => sum + Number(x.qty || 0), 0)
      }
      return Number(d?.qty || 0)
    },
    render: (item: any) => {
      const d = item?.data || item
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      let total = 0
      if (details.length > 0) {
        total = details.reduce((sum: number, x: any) => sum + Number(x.qty || 0), 0)
      } else {
        total = Number(d?.qty || 0)
      }
      return Number(total).toLocaleString('id-ID')
    }
  },
  {
    field: 'uom',
    headerName: 'Satuan',
    width: '80px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length > 0) {
        return details[0].unit_d_io?.value1 || details[0].m_item?.mi_uom?.value1 || details[0].m_items?.mi_uom?.value1 || '-'
      }
      return '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      const details = d?.t_io_ds || d?.t_io_d || d?.details || []
      if (details.length > 0) {
        return details[0].unit_d_io?.value1 || details[0].m_item?.mi_uom?.value1 || details[0].m_items?.mi_uom?.value1 || '-'
      }
      return '-'
    }
  },
  {
    field: 'notes',
    headerName: 'Catatan',
    width: '160px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.notes || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.notes || '-'
    }
  },
  {
    field: 'status',
    headerName: 'Status',
    width: '100px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.status || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.status || '-'
    }
  }
]

const handleAddFromIo = async (items: any[]) => {
  if (!items || items.length === 0) return

  const ioIds = items.map(io => io.id).filter(Boolean)
  if (ioIds.length === 0) return

  try {
    const res = await apiCall<{ status: string; data: any[] }>(`/fn/t_mrp/getMrpItemData`, {
      method: 'POST',
      body: JSON.stringify({
        io_ids: ioIds,
        m_unit_bisnis_id: values.m_unit_bisnis_id || undefined
      })
    })

    if (res.status === 'success' && Array.isArray(res.data)) {
      const existingSet = new Set(detailArr.value.map(d => `${d.source_type}_${d.source_id}_${d.m_item_id}`))
      let addedCount = 0

      for (const item of res.data) {
        const uniqueKey = `IO_${item.source_id}_${item.m_item_id}`
        if (existingSet.has(uniqueKey)) continue

        detailArr.value.push({
          seq: detailArr.value.length + 1,
          source_type: 'IO',
          source_id: item.source_id,
          t_io_id: item.t_io_id || item.source_id,
          source_no: item.source_no || '-',
          m_item_id: item.m_item_id,
          item_code: item.item_code || '-',
          item_name: item.item_name || '-',
          m_item: {
            id: item.m_item_id,
            kode_item: item.item_code,
            nama_item: item.item_name,
            uom_id: item.unit_id
          },
          m_bom_id: item.m_bom_id || '',
          m_bom: item.m_bom || null,
          qty_so_io: Number(item.qty_so_io || 0),
          qty_wo: Number(item.qty_wo || 0),
          qty_stok: Number(item.qty_stok || 0),
          qty_req: Number(item.qty_req !== undefined ? item.qty_req : (Number(item.qty_so_io || 0) - (Number(item.qty_wo || 0) + Number(item.qty_stok || 0)))),
          unit_id: item.unit_id || null,
          unit_name: item.unit_name || '-',
          note: item.note || ''
        })
        existingSet.add(uniqueKey)
        addedCount++
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} item dari IO berhasil ditambahkan`)
      } else {
        toast.info('Item sudah ada di daftar atau IO tidak memiliki item')
      }
    }
  } catch (err: any) {
    console.error('Failed to get MRP IO items from custom function', err)
    toast.error('Gagal mengambil data kebutuhan item dari server')
  }
}

const removeDetailRow = (index: number) => {
  detailArr.value.splice(index, 1)
  detailArr.value.forEach((row, idx) => { row.seq = idx + 1 })
  toast.info('Item dihapus dari daftar')
}

// Recalculate Qty Req: Qty Req = Qty O/S SO/IO - (Qty O/S WO + Qty Stok)
const calculateItemQtyReq = (row: MrpDetailItem) => {
  const soIo = Number(row.qty_so_io || 0)
  const wo = Number(row.qty_wo || 0)
  const stok = Number(row.qty_stok || 0)
  row.qty_req = soIo - (wo + stok)
}

const isRefreshingItems = ref(false)
const refreshAllItemsQty = async () => {
  if (detailArr.value.length === 0) return
  isRefreshingItems.value = true
  try {
    const res = await apiCall<{ status: string; data: any[] }>(`/fn/t_mrp/getMrpItemData`, {
      method: 'POST',
      body: JSON.stringify({
        items: detailArr.value.map(row => ({
          m_item_id: row.m_item_id,
          qty_so_io: row.qty_so_io,
          source_type: row.source_type,
          source_id: row.source_id,
          t_io_id: row.t_io_id || row.source_id,
          t_so_id: row.t_so_id || row.source_id,
          source_no: row.source_no
        })),
        m_unit_bisnis_id: values.m_unit_bisnis_id || undefined
      })
    })

    if (res.status === 'success' && Array.isArray(res.data)) {
      // Create map for reliable lookup
      const calcMap = new Map<string, any>()
      res.data.forEach((calc) => {
        const key = `${calc.source_id || ''}_${calc.m_item_id || ''}`
        if (key !== '_') calcMap.set(key, calc)
      })

      detailArr.value.forEach((row, idx) => {
        const key = `${row.source_id}_${row.m_item_id}`
        const calc = calcMap.get(key) || res.data[idx]
        if (calc) {
          row.qty_wo = Number(calc.qty_wo || 0)
          row.qty_stok = Number(calc.qty_stok || 0)
          const soIo = Number(row.qty_so_io || 0)
          row.qty_req = calc.qty_req !== undefined ? Number(calc.qty_req) : (soIo - (row.qty_wo + row.qty_stok))
          if (!row.m_bom_id && calc.m_bom_id) {
            row.m_bom_id = calc.m_bom_id
            row.m_bom = calc.m_bom
          }
        } else {
          calculateItemQtyReq(row)
        }
      })
      toast.success('Qty WO, Stok, dan Req berhasil diperbarui')
    }
  } catch (err: any) {
    console.error('Error refreshing items qty:', err)
    toast.error('Gagal memperbarui Qty dari server')
  } finally {
    isRefreshingItems.value = false
  }
}

// ============================================================================
// DETAIL 2 (MATERIAL) MULTI-SELECT CONFIGS & HANDLERS
// ============================================================================
const materialTypeIds = ref<string[]>([])
const fetchMaterialTypeIds = async () => {
  try {
    const res = await apiCall<{ status: string; data: any[] }>(
      '/dynamic/m_general?filter_column_group=TIPE_ITEM&filter_column_is_active=true&no_pagination=true'
    )
    if (res?.status === 'success' && Array.isArray(res.data)) {
      const filtered = res.data.filter(g => {
        const k = (g.key1 || '').toUpperCase()
        return k === 'RM' || k === 'WIP' || k === 'SM'
      })
      materialTypeIds.value = filtered.map(g => g.id).filter(Boolean)
    }
  } catch (e) {
    console.error('Failed to fetch material type IDs', e)
  }
}

const materialMultiSelectApi = computed(() => {
  const whereClause = materialTypeIds.value.length > 0
    ? materialTypeIds.value.map(id => `tipe_id:${id}`).join('||')
    : 'mi_tipe.key1:RM||mi_tipe.key1:WIP||mi_tipe.key1:SM'

  return {
    url: `${API_BASE_URL}/dynamic/m_items`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`
    },
    params: {
      join: 'true',
      include: 'm_general@mi_tipe,m_general@mi_uom',
      searchfield: 'kode_item,nama_item',
      filter_column_is_active: 'true',
      where: whereClause
    }
  }
})

const materialColumns = [
  { field: 'kode_item', headerName: 'Kode', width: '130px' },
  { field: 'nama_item', headerName: 'Nama Material', width: '220px' },
  {
    field: 'mi_tipe.value1',
    headerName: 'Tipe',
    width: '120px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.mi_tipe?.value1 || d?.tipe_material || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.mi_tipe?.value1 || d?.tipe_material || '-'
    }
  },
  {
    field: 'mi_uom.value1',
    headerName: 'Satuan',
    width: '90px',
    valueGetter: (params: any) => {
      const d = params?.data || params
      return d?.mi_uom?.value1 || d?.m_general?.value1 || '-'
    },
    render: (item: any) => {
      const d = item?.data || item
      return d?.mi_uom?.value1 || d?.m_general?.value1 || '-'
    }
  }
]

// Helper to fetch calculated material parameters (stock, os mreq, os pp, os po, suggest)
const fetchMrpMaterialData = async (materials: { m_item_id: string; qty_req?: number }[]) => {
  if (!materials || materials.length === 0) return []
  try {
    const res = await apiCall<{ status: string; data: any[] }>('/fn/t_mrp/getMrpMaterialData', {
      method: 'POST',
      body: JSON.stringify({
        materials,
        m_unit_bisnis_id: values.m_unit_bisnis_id || undefined
      })
    })
    if (res.status === 'success' && Array.isArray(res.data)) {
      return res.data
    }
  } catch (err) {
    console.error('Failed to fetch getMrpMaterialData:', err)
  }
  return []
}

const isRefreshingMaterials = ref(false)
const refreshAllMaterialsQty = async () => {
  if (detailArr2.value.length === 0) return
  isRefreshingMaterials.value = true
  try {
    const calcData = await fetchMrpMaterialData(
      detailArr2.value.map(row => ({
        m_item_id: row.m_item_id,
        qty_req: Number(row.qty_req || 0)
      }))
    )
    if (calcData.length > 0) {
      const calcMap = new Map<string, any>(calcData.map((c: any) => [c.m_item_id, c]))
      detailArr2.value.forEach(row => {
        const calc = calcMap.get(row.m_item_id)
        if (calc) {
          row.qty_stok = Number(calc.qty_stok || 0)
          row.qty_mreq = Number(calc.qty_mreq || 0)
          row.qty_pp = Number(calc.qty_pp || 0)
          row.qty_po = Number(calc.qty_po || 0)
          row.qty_suggest = Number(calc.qty_suggest ?? Math.max(0, Number(row.qty_req || 0) - (row.qty_stok + row.qty_mreq + row.qty_pp + row.qty_po)))
        } else {
          calculateMaterialQtySuggest(row)
        }
      })
      toast.success('Kalkulasi material berhasil diperbarui')
    }
  } catch (err: any) {
    console.error('Failed to refresh materials qty:', err)
    toast.error('Gagal memperbarui kalkulasi material')
  } finally {
    isRefreshingMaterials.value = false
  }
}

const handleAddMaterial = async (items: any[]) => {
  const existingSet = new Set(detailArr2.value.map(d => d.m_item_id))
  const newItems = items.filter(item => !existingSet.has(item.id))

  if (newItems.length === 0) {
    toast.warning('Material sudah ada di daftar')
    return
  }

  // Ambil kalkulasi stok, O/S MRQ, O/S PP, O/S PO dari backend
  const calcData = await fetchMrpMaterialData(newItems.map(item => ({ m_item_id: item.id, qty_req: 0 })))
  const calcMap = new Map<string, any>((calcData || []).map((c: any) => [c.m_item_id, c]))

  for (const item of newItems) {
    const calc: any = calcMap.get(item.id)
    const newMtr: MrpDetailMtr = {
      seq: detailArr2.value.length + 1,
      item_type_id: item.tipe_id || item.mi_tipe?.id || null,
      item_type_name: item.mi_tipe?.value1 || item.tipe_material || '-',
      m_item_id: item.id,
      material_code: item.kode_item || '-',
      material_name: item.nama_item || '-',
      m_item: item,
      qty_req: 0,
      qty_stok: Number(calc?.qty_stok || 0),
      qty_mreq: Number(calc?.qty_mreq || 0),
      qty_pp: Number(calc?.qty_pp || 0),
      qty_po: Number(calc?.qty_po || 0),
      qty_suggest: 0,
      unit_id: item.uom_id || item.mi_uom?.id || null,
      unit_name: item.mi_uom?.value1 || item.m_general?.value1 || '-',
      note: '',
      is_generated: false
    }
    calculateMaterialQtySuggest(newMtr)
    detailArr2.value.push(newMtr)
  }

  toast.success(`${newItems.length} material ditambahkan secara manual`)
}

const removeMaterialRow = (index: number) => {
  detailArr2.value.splice(index, 1)
  detailArr2.value.forEach((row, idx) => { row.seq = idx + 1 })
  toast.info('Material dihapus dari daftar')
}

// Recalculate Qty Suggest: Qty Suggest = Qty Requirement - (Qty Stok + Qty O/S Mat Request + Qty O/S PP + Qty O/S PO)
const calculateMaterialQtySuggest = (row: MrpDetailMtr) => {
  const req = Number(row.qty_req || 0)
  const stok = Number(row.qty_stok || 0)
  const mreq = Number(row.qty_mreq || 0)
  const pp = Number(row.qty_pp || 0)
  const po = Number(row.qty_po || 0)
  row.qty_suggest = Math.max(0, req - (stok + mreq + pp + po))
}

// ============================================================================
// GENERATE MATERIAL METHOD
// ============================================================================
const generateMaterials = async () => {
  if (detailArr.value.length === 0) {
    toast.error('Belum ada Item', { description: 'Tambahkan item dari SO atau IO terlebih dahulu' })
    return
  }

  // Cek apakah ada item yang BOM-nya masih kosong
  const rowsWithoutBom = detailArr.value.filter(d => !d.m_bom_id || String(d.m_bom_id).trim() === '')
  if (rowsWithoutBom.length > 0) {
    const itemNames = rowsWithoutBom
      .map(d => d.item_code || d.item_name || d.source_no || 'Item')
      .slice(0, 3)
      .join(', ')
    const moreText = rowsWithoutBom.length > 3 ? ` dan ${rowsWithoutBom.length - 3} item lainnya` : ''
    toast.warning('Tidak dapat generate material', {
      description: `Ada item yang BOM-nya masih kosong (${itemNames}${moreText}). Silakan pilih BOM untuk semua item terlebih dahulu.`
    })
    return
  }

  isGenerating.value = true
  try {
    const res = await apiCall<{ status: string; message?: string; data?: any[] }>('/fn/t_mrp/generateMrpMaterials', {
      method: 'POST',
      body: JSON.stringify({
        items: detailArr.value,
        m_unit_bisnis_id: values.m_unit_bisnis_id || undefined
      })
    })

    if (res.status === 'warning') {
      toast.warning('Pemberitahuan Generate Material', {
        description: res.message || 'Periksa kembali data item atau BOM yang dipilih.'
      })
      return
    }

    if (res.status !== 'success') {
      toast.error('Gagal generate material', {
        description: res.message || 'Terjadi kesalahan pada backend'
      })
      return
    }

    const generatedMaterials: MrpDetailMtr[] = (res.data || []).map((m: any, idx: number) => ({
      seq: idx + 1,
      item_type_id: m.item_type_id || null,
      item_type_name: m.item_type_name || '-',
      m_item_id: m.m_item_id,
      material_code: m.material_code || '-',
      material_name: m.material_name || '-',
      m_item: m.m_item || {
        id: m.m_item_id,
        kode_item: m.material_code,
        nama_item: m.material_name
      },
      qty_req: Number(m.qty_req || 0),
      qty_stok: Number(m.qty_stok || 0),
      qty_mreq: Number(m.qty_mreq || 0),
      qty_pp: Number(m.qty_pp || 0),
      qty_po: Number(m.qty_po || 0),
      qty_suggest: Number(m.qty_suggest || 0),
      unit_id: m.unit_id || null,
      unit_name: m.unit_name || '-',
      note: m.note || '',
      is_generated: true
    }))

    const manualMaterials = detailArr2.value.filter(m => !m.is_generated)

    detailArr2.value = [...generatedMaterials, ...manualMaterials].map((m, idx) => ({
      ...m,
      seq: idx + 1
    }))

    activeTab.value = 'detail2'

    if (generatedMaterials.length === 0) {
      toast.warning('Tidak ada material yang dihasilkan', {
        description: res.message || 'Pastikan item memiliki BOM dan Qty Requirement > 0'
      })
    } else {
      toast.success('Material Berhasil Digenerate', {
        description: `${generatedMaterials.length} material berhasil dihitung dari BOM, QTY STOK, QTY PP, dan Outstanding PO`
      })
    }
  } catch (err: any) {
    console.error('generateMaterials error:', err)
    toast.error('Gagal generate material', {
      description: err?.message || 'Terjadi kesalahan saat memproses BOM dan kalkulasi material'
    })
  } finally {
    isGenerating.value = false
  }
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: '',
    no: '',
    date: getTodayDateString(),
    note: '',
    status: 'DRAFT'
  })

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })

  selectedUnitBisnisCompanyName.value = ''
  detailArr.value = []
  detailArr2.value = []
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset()
  fetchMaterialTypeIds()

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    applyCurrentUserUnitBisnis()
    return
  }

  loading.value = true
  try {
    const res = await getMrpById(sourceId)
    if (res.status !== 'success' || !res.data) throw new Error('Gagal memuat data')
    const raw = res.data

    if (raw) {
      auditMeta.value = {
        created_by: (raw as any).created_by,
        createdAt: (raw as any).createdAt,
        updated_by: (raw as any).update_by || (raw as any).updated_by,
        updatedAt: (raw as any).updatedAt,
      }
    }

    values.m_unit_bisnis_id = raw.m_unit_bisnis_id || ''
    values.no = isCopyModeLocal ? '' : (raw.no || '')
    values.date = raw.date ? formatInputDate(raw.date) : getTodayDateString()
    values.note = raw.note || ''
    values.status = isCopyModeLocal ? 'DRAFT' : (raw.status || 'DRAFT')

    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }

    // Detail Items
    const rawItems = raw.t_mrp_d_item || raw.t_mrp_d_items || []
    detailArr.value = rawItems.map((row: any, idx: number) => {
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '')
      const sourceNo = (row.source_no && !isUuid(row.source_no)) ? row.source_no : '-'

      return {
        id: isCopyModeLocal ? undefined : row.id,
        t_mrp_id: isCopyModeLocal ? undefined : row.t_mrp_id,
        seq: row.seq || idx + 1,
        source_type: row.source_type || 'SO',
        source_id: row.source_id,
        source_no: sourceNo,
        m_item_id: row.m_item_id,
        item_code: row.m_item?.kode_item || row.m_items?.kode_item || row.item_code || '-',
        item_name: row.m_item?.nama_item || row.m_items?.nama_item || row.item_name || '-',
        m_item: row.m_item || row.m_items,
        m_bom_id: row.m_bom_id || '',
        m_bom: row.m_bom,
        qty_so_io: Number(row.qty_so_io || 0),
        qty_wo: Number(row.qty_wo || 0),
        qty_stok: Number(row.qty_stok || 0),
        qty_req: Number(row.qty_req || 0),
        unit_id: row.unit_id,
        unit_name: row.m_general?.value1 || row.unit_name || '-',
        note: row.note || ''
      }
    })

    // Resolve source_no if not yet available (e.g. for legacy records)
    const ioSourceIds = detailArr.value
      .filter(d => d.source_type === 'IO' && (!d.source_no || d.source_no === '-'))
      .map(d => d.source_id)
      .filter(Boolean)

    if (ioSourceIds.length > 0) {
      apiCall<{ status: string; data: any[] }>(
        `/dynamic/t_io_d?join=true&include=t_io&filter_column_id_in=${ioSourceIds.join(',')}&no_pagination=true`
      ).then(ioRes => {
        if (ioRes?.status === 'success' && Array.isArray(ioRes.data)) {
          const ioMap = new Map(ioRes.data.map((d: any) => [d.id, d.t_io?.no || d.no || '-']))
          detailArr.value.forEach(row => {
            if (row.source_type === 'IO' && ioMap.has(row.source_id)) {
              row.source_no = ioMap.get(row.source_id) || '-'
            }
          })
        }
      }).catch(err => console.error('Failed to resolve IO source_no:', err))
    }

    // Detail Materials
    const rawMtrs = raw.t_mrp_d_mtr || raw.t_mrp_d_mtrs || []
    detailArr2.value = rawMtrs.map((row: any, idx: number) => ({
      id: isCopyModeLocal ? undefined : row.id,
      t_mrp_id: isCopyModeLocal ? undefined : row.t_mrp_id,
      seq: row.seq || idx + 1,
      item_type_id: row.item_type_id,
      item_type_name: row.it_mrp_mtr?.value1 || row.m_general?.value1 || '-',
      m_item_id: row.m_item_id,
      material_code: row.m_item?.kode_item || row.m_items?.kode_item || row.material_code || '-',
      material_name: row.m_item?.nama_item || row.m_items?.nama_item || row.material_name || '-',
      m_item: row.m_item || row.m_items,
      qty_req: Number(row.qty_req || 0),
      qty_stok: Number(row.qty_stok || 0),
      qty_mreq: Number(row.qty_mreq || 0),
      qty_pp: Number(row.qty_pp || 0),
      qty_po: Number(row.qty_po || 0),
      qty_suggest: Number(row.qty_suggest || 0),
      unit_id: row.unit_id,
      unit_name: row.unit_mrp_mtr?.value1 || row.m_general?.value1 || '-',
      note: row.note || '',
      is_generated: true
    }))

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', { description: 'Silakan sesuaikan dan simpan sebagai MRP baru' })
    }
  } catch (error) {
    toast.error('Gagal memuat data MRP', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    setTimeout(() => router.push('/production/transaksi/t_mrp'), 1500)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false

  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Company wajib dipilih'; invalid = true }
  if (!values.date) { errors.date = 'Date wajib diisi'; invalid = true }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  if (detailArr.value.length === 0) {
    toast.error('Validasi gagal', { description: 'Wajib menambahkan minimal 1 detail item' })
    return
  }

  loading.value = true
  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      no: values.no || null,
      date: values.date || null,
      note: values.note || null,
      status: values.status || 'DRAFT',
      t_mrp_d_item: detailArr.value.map((row, index) => ({
        id: isCopyMode.value ? undefined : row.id,
        t_mrp_id: isCopyMode.value ? undefined : (menuId.value || undefined),
        seq: index + 1,
        source_type: row.source_type,
        source_id: row.source_id,
        source_no: row.source_no || null,
        m_item_id: row.m_item_id,
        m_bom_id: row.m_bom_id || null,
        qty_so_io: Number(row.qty_so_io) || 0,
        qty_wo: Number(row.qty_wo) || 0,
        qty_stok: Number(row.qty_stok) || 0,
        qty_req: Number(row.qty_req) || 0,
        unit_id: row.unit_id || null,
        note: row.note || null,
      })),
      t_mrp_d_mtr: detailArr2.value.map((row, index) => ({
        id: isCopyMode.value ? undefined : row.id,
        t_mrp_id: isCopyMode.value ? undefined : (menuId.value || undefined),
        seq: index + 1,
        item_type_id: row.item_type_id || null,
        m_item_id: row.m_item_id,
        qty_req: Number(row.qty_req) || 0,
        qty_stok: Number(row.qty_stok) || 0,
        qty_mreq: Number(row.qty_mreq) || 0,
        qty_pp: Number(row.qty_pp || 0),
        qty_po: Number(row.qty_po) || 0,
        qty_suggest: Number(row.qty_suggest) || 0,
        unit_id: row.unit_id || null,
        note: row.note || null,
      }))
    }

    if (isEditMode.value) {
      await updateMrp(menuId.value, payload)
      toast.success('MRP berhasil diperbarui', { description: `MRP ${values.no || ''} telah diperbarui` })
    } else {
      const created = await createMrp(payload)
      const newNo = (created as any)?.data?.no || (created as any)?.no || values.no || ''
      toast.success('MRP berhasil dibuat', { description: `MRP ${newNo} telah ditambahkan` })
    }
    router.replace('/production/transaksi/t_mrp?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui MRP' : 'Gagal membuat MRP', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// POST HANDLER IN FORM
// ============================================================================
const openPostDialog = () => {
  isPostDialogOpen.value = true
}

const confirmPost = async () => {
  if (!menuId.value) return
  isPosting.value = true
  try {
    const res = await postMrp(menuId.value)
    if (res.status === 'success') {
      values.status = 'POST'
      toast.success(`MRP "${values.no || ''}" berhasil di-POST`)
      isPostDialogOpen.value = false
      router.replace('/production/transaksi/t_mrp?reload=' + Date.now())
    } else {
      toast.error('Gagal mem-POST MRP')
    }
  } catch (err: any) {
    toast.error('Gagal mem-POST MRP', {
      description: err?.message || 'Terjadi kesalahan'
    })
  } finally {
    isPosting.value = false
  }
}

const cancelPost = () => {
  isPostDialogOpen.value = false
}

const handleCancel = () => {
  router.push('/production/transaksi/t_mrp')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
      <span class="px-3 py-1 bg-accent text-accent-foreground font-semibold text-xs rounded-md border border-border uppercase tracking-wider">
        {{ values.status || 'DRAFT' }}
      </span>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi MRP</CardTitle>
          <CardDescription>Isi data MRP dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Row 1 Left: Company (m_unit_bisnis_id) -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Company"
              :value="values.m_unit_bisnis_id"
              :display-value="selectedUnitBisnisCompanyName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'kode_unit_bisnis,nama_comp',
                  join: 'true',
                },
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Company"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih company'"
              @input="v => values.m_unit_bisnis_id = v"
              @update:valueFull="handleUnitBisnisSelected"
              class="w-full"
            />

            <!-- Row 1 Right: No MRP (auto-generate, readonly) -->
            <FieldX
              id="no"
              label="No MRP"
              :value="values.no || 'Auto Generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generate"
              hints="Nomor dibuat otomatis oleh sistem"
              class="w-full opacity-70"
            />

            <!-- Row 2 Left: Date -->
            <FieldX
              id="date"
              label="Date"
              type="date"
              :value="values.date"
              @input="v => values.date = v"
              @update:model-value="v => values.date = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorname="errors.date ? 'failed' : ''"
              :hints="errors.date || 'Tanggal transaksi'"
              class="w-full"
            />

            <!-- Row 2 Right: Status -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status || 'DRAFT'"
              :disabled="true"
              :readonly="true"
              placeholder="DRAFT"
              class="w-full opacity-70"
            />
          </div>

          <FieldTextarea
            id="note"
            label="Catatan"
            :value="values.note"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan..."
            :rows="3"
            @input="v => values.note = v"
          />
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL TABS -->
      <!-- ================================================================ -->
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="detail1" class="gap-2">
            <span>Detail Item</span>
            <span v-if="detailArr.length > 0" class="px-1.5 py-0.2 rounded-full bg-primary/20 text-xs font-semibold">
              {{ detailArr.length }}
            </span>
          </TabsTrigger>
          <TabsTrigger value="detail2" class="gap-2">
            <span>Detail Material</span>
            <span v-if="detailArr2.length > 0" class="px-1.5 py-0.2 rounded-full bg-primary/20 text-xs font-semibold">
              {{ detailArr2.length }}
            </span>
          </TabsTrigger>
        </TabsList>

        <!-- ============================================================== -->
        <!-- TAB 1: DETAIL ITEM (t_mrp_d_item) -->
        <!-- ============================================================== -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle class="text-base">Detail Item</CardTitle>
                  <CardDescription class="text-xs">
                    Pilih SO/IO yang outstanding terhadap SPK & pilih BOM untuk masing-masing item
                  </CardDescription>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="Add From SO"
                    buttonClass="h-9"
                    :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                    @add="handleAddFromSo"
                    :api="soMultiSelectApi"
                    :columns="soColumns"
                    :excludeIds="existingSourceIds"
                    uniqueKey="id"
                  />
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="Add From IO"
                    buttonClass="h-9"
                    :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                    @add="handleAddFromIo"
                    :api="ioMultiSelectApi"
                    :columns="ioColumns"
                    :excludeIds="existingSourceIds"
                    uniqueKey="id"
                  />
                  <Button
                    v-if="!isReadOnly && detailArr.length > 0"
                    variant="outline"
                    size="sm"
                    class="h-9 gap-1.5"
                    :disabled="loading || isRefreshingItems"
                    @click="refreshAllItemsQty"
                    title="Perbarui Qty WO dan Qty Stok"
                  >
                    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isRefreshingItems }" />
                    Refresh Qty
                  </Button>
                  <Button
                    v-if="!isReadOnly"
                    variant="default"
                    size="sm"
                    class="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                    :disabled="loading || isGenerating || detailArr.length === 0 || !values.m_unit_bisnis_id"
                    @click="generateMaterials"
                  >
                    <Loader2 v-if="isGenerating" class="h-3.5 w-3.5 animate-spin" />
                    <Sparkles v-else class="h-3.5 w-3.5" />
                    Generate Material
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th class="px-3 py-3 text-left w-12">No</th>
                      <th class="px-3 py-3 text-left min-w-[70px]">Tipe</th>
                      <th class="px-3 py-3 text-left min-w-[140px]">No SO/IO</th>
                      <th class="px-3 py-3 text-left min-w-[180px]">Item</th>
                      <th class="px-3 py-3 text-left min-w-[170px]">No BOM</th>
                      <th class="px-3 py-3 text-right w-28">Qty O/S SO/IO</th>
                      <th class="px-3 py-3 text-right w-24">Qty WO</th>
                      <th class="px-3 py-3 text-right w-24">Qty Stock</th>
                      <th class="px-3 py-3 text-right w-28">Qty Req</th>
                      <th class="px-3 py-3 text-left w-20">Unit</th>
                      <th class="px-3 py-3 text-left min-w-[150px]">Keterangan</th>
                      <th v-if="!isReadOnly" class="px-2 py-3 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="detailArr.length === 0">
                      <td :colspan="isReadOnly ? 11 : 12" class="text-center py-10 text-muted-foreground text-sm">
                        <template v-if="!values.m_unit_bisnis_id">
                          Pilih Company terlebih dahulu untuk memilih item SO/IO.
                        </template>
                        <template v-else>
                          Belum ada item ditambahkan. Klik <strong class="text-foreground">Add From SO</strong> atau <strong class="text-foreground">Add From IO</strong> untuk memilih item.
                        </template>
                      </td>
                    </tr>
                    <tr v-for="(row, index) in detailArr" :key="index" class="hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-xs text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <span :class="['inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold', row.source_type === 'SO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300']">
                          {{ row.source_type }}
                        </span>
                      </td>
                      <td class="px-3 py-2 font-medium text-foreground">{{ row.source_no || '-' }}</td>
                      <td class="px-3 py-2">
                        <div class="font-medium text-foreground">{{ row.item_code }}</div>
                        <div class="text-xs text-muted-foreground truncate max-w-[200px]">{{ row.item_name }}</div>
                      </td>
                      <!-- BOM Selector -->
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-if="!isReadOnly"
                          :id="`bom_${index}`"
                          :value="row.m_bom_id"
                          :display-value="row.m_bom?.no || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_bom`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_status: 'true',
                              searchfield: 'no',
                              ...(row.m_item_id ? { filter_column_m_item_id: row.m_item_id } : {})
                            },
                          }"
                          display-field="no"
                          value-field="id"
                          placeholder="Pilih BOM..."
                          :clearable="true"
                          @input="(v) => (row.m_bom_id = v)"
                          @update:valueFull="(item) => (row.m_bom = item)"
                          class="w-full text-xs"
                        />
                        <span v-else class="text-xs">{{ row.m_bom?.no || row.m_bom_id || '-' }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-sm font-medium">{{ Number(row.qty_so_io).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_wo).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_stok).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm font-semibold text-foreground">{{ Number(row.qty_req).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">{{ row.unit_name || '-' }}</td>
                      <td class="px-3 py-2">
                        <FieldX
                          v-if="!isReadOnly"
                          :value="row.note"
                          @input="v => row.note = v"
                          placeholder="Keterangan..."
                          :disabled="loading"
                          class="min-w-[130px]"
                        />
                        <span v-else class="text-sm text-muted-foreground">{{ row.note || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          class="h-7 w-7"
                          @click="removeDetailRow(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ============================================================== -->
        <!-- TAB 2: DETAIL MATERIAL (t_mrp_d_mtr) -->
        <!-- ============================================================== -->
        <TabsContent value="detail2" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle class="text-base">Detail Material</CardTitle>
                  <CardDescription class="text-xs">
                    Detail hasil generate BOM (dibuatkan summary per material) & material input manual
                  </CardDescription>
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    v-if="!isReadOnly && detailArr2.length > 0"
                    variant="outline"
                    size="sm"
                    class="h-9 gap-1.5"
                    :disabled="loading || isRefreshingMaterials"
                    @click="refreshAllMaterialsQty"
                    title="Perbarui Qty Stock, Qty O/S MReq, Qty O/S PP, Qty O/S PO"
                  >
                    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isRefreshingMaterials }" />
                    Refresh Qty
                  </Button>
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="+ Add Material"
                    buttonClass="h-9"
                    :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                    @add="handleAddMaterial"
                    :api="materialMultiSelectApi"
                    :columns="materialColumns"
                    :excludeIds="existingMaterialIds"
                    uniqueKey="id"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th class="px-3 py-3 text-left w-12">No</th>
                      <th class="px-3 py-3 text-left min-w-[100px]">Tipe Item</th>
                      <th class="px-3 py-3 text-left min-w-[200px]">Material</th>
                      <th class="px-3 py-3 text-right w-32">Qty Requirement</th>
                      <th class="px-3 py-3 text-right w-24">Qty Stock</th>
                      <th class="px-3 py-3 text-right w-24">Qty O/S MReq</th>
                      <th class="px-3 py-3 text-right w-24">Qty O/S PP</th>
                      <th class="px-3 py-3 text-right w-24">Qty O/S PO</th>
                      <th class="px-3 py-3 text-right w-32">Qty Suggest</th>
                      <th class="px-3 py-3 text-left w-20">Unit</th>
                      <th class="px-3 py-3 text-left min-w-[150px]">Keterangan</th>
                      <th v-if="!isReadOnly" class="px-2 py-3 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="detailArr2.length === 0">
                      <td :colspan="isReadOnly ? 11 : 12" class="text-center py-10 text-muted-foreground text-sm">
                        <template v-if="!values.m_unit_bisnis_id">
                          Pilih Company terlebih dahulu.
                        </template>
                        <template v-else>
                          Belum ada kebutuhan material. Klik <strong class="text-foreground">Generate Material</strong> di tab Detail Item atau <strong class="text-foreground">+ Add Material</strong> untuk input manual.
                        </template>
                      </td>
                    </tr>
                    <tr v-for="(row, index) in detailArr2" :key="index" class="hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-xs text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">{{ row.item_type_name || '-' }}</td>
                      <td class="px-3 py-2">
                        <div class="font-medium text-foreground">{{ row.material_code }}</div>
                        <div class="text-xs text-muted-foreground truncate max-w-[200px]">{{ row.material_name }}</div>
                      </td>
                      <!-- Qty Req: Readonly if generated, editable if manual -->
                      <td class="px-3 py-2 text-right">
                        <span v-if="row.is_generated || isReadOnly" class="text-sm font-semibold text-foreground">
                          {{ Number(row.qty_req).toLocaleString('id-ID') }}
                        </span>
                        <FieldNumber
                          v-else
                          :value="row.qty_req"
                          @input="v => { row.qty_req = Number(v); calculateMaterialQtySuggest(row) }"
                          :min="0"
                          :disabled="loading"
                          class="w-24 text-right"
                        />
                      </td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_stok).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_mreq).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_pp).toLocaleString('id-ID') }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">{{ Number(row.qty_po).toLocaleString('id-ID') }}</td>
                      <!-- Qty Suggest: Editable -->
                      <td class="px-3 py-2 text-right">
                        <FieldNumber
                          v-if="!isReadOnly"
                          :value="row.qty_suggest"
                          @input="v => row.qty_suggest = Number(v)"
                          :min="0"
                          :disabled="loading"
                          class="w-24 text-right font-bold text-emerald-600 dark:text-emerald-400"
                        />
                        <span v-else class="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {{ Number(row.qty_suggest).toLocaleString('id-ID') }}
                        </span>
                      </td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">{{ row.unit_name || '-' }}</td>
                      <td class="px-3 py-2">
                        <FieldX
                          v-if="!isReadOnly"
                          :value="row.note"
                          @input="v => row.note = v"
                          placeholder="Keterangan..."
                          :disabled="loading"
                          class="min-w-[130px]"
                        />
                        <span v-else class="text-sm text-muted-foreground">{{ row.note || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          class="h-7 w-7"
                          @click="removeMaterialRow(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- AUDIT INFO -->
      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <!-- ACTION BUTTONS -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button
          v-if="isEditMode && values.status === 'DRAFT' && canUpdate"
          type="button"
          variant="secondary"
          @click="openPostDialog"
          :disabled="loading || isPosting"
          class="gap-2 w-full sm:w-auto">
          <Send class="h-4 w-4" />
          POST
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>

  <!-- POST CONFIRM DIALOG -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="POST MRP"
    :description="`Apakah Anda yakin ingin POST MRP &quot;${values.no || 'ini'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>