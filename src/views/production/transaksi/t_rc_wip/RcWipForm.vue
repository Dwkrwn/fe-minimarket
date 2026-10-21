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
import { ButtonMultiSelect } from '@/components/button'
import { FieldX, FieldDate, FieldSelect, FieldTextarea } from '@/components/field'
import { Trash2, Save, Loader2, SlidersHorizontal, ArrowLeft, Plus, Search } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { apiCall } from '@/lib/api'
import {
  createRcWip,
  updateRcWip,
  getRcWipById,
  getAvailableProductionResults,
  type RcDItem
} from './service'

import { usePermission } from '@/composables/usePermission'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore()
const { isSuperAdmin } = usePermission()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'RcWipForm')
const isViewMode = computed(() => route.name === 'RcWipView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isConfirmMode = computed(() => (values.status || '').toUpperCase() === 'POST' && !isViewMode.value && route.meta.readOnly !== true)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || (values.status || '').toUpperCase() === 'RECEIVED')
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value || isConfirmMode.value)
const menuId = computed(() => route.params.id as string)

const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo')
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err)
    return null
  }
}

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return
  const selectRespo = getSelectRespoData()
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || ""
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId)
    fetchUnitBisnisCompanyName(String(ubId))
  }
}

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Result Confirmation WIP'
  if (isCopyMode.value) return 'Salin Result Confirmation WIP'
  if (isConfirmMode.value) return 'Konfirmasi Penerimaan Result Confirmation WIP'
  if (isEditMode.value) return 'Edit Result Confirmation WIP'
  return 'Tambah Result Confirmation WIP'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Result Confirmation WIP (t_rc)'
  if (isCopyMode.value) return 'Buat data Result Confirmation WIP baru dari data yang disalin'
  if (isConfirmMode.value) return 'Input Qty Received untuk konfirmasi penerimaan Result Confirmation WIP'
  if (isEditMode.value) return 'Perbarui data Result Confirmation WIP'
  return 'Buat data Result Confirmation WIP baru'
})

// Header Form values (t_rc schema)
let values = reactive({
  no: '',
  group: '',
  date: new Date().toISOString().split('T')[0],
  key1: new Date().toISOString().split('T')[0],
  m_unit_bisnis_id: '',
  flag: 'WIP',
  code: 'WIP',
  m_warehouse_id: '',
  value1: '',
  to_warehouse_id: '',
  value2: '',
  notes: '',
  value3: '',
  status: 'DRAFT',
  is_active: true
})

// Real-time automatic date display (DD/MM/YYYY)
const displayDate = computed(() => {
  const targetDate = (values.key1 || values.date || new Date().toISOString().split('T')[0] || '') as string
  if (targetDate.includes('-')) {
    const parts = (targetDate.split('T')[0] || '').split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
  }
  return targetDate
})

// Display labels for dynamic FieldSelect components
const selectedUnitBisnisLabel = ref('')
const selectedUnitBisnisCompanyName = ref('')
const selectedWarehouseLabel = ref('')
const selectedToWarehouseLabel = ref('')

// Warehouse Asal (Production): flag = 'PROD'
const warehouseApiConfig = computed(() => {
  return {
    url: `${API_BASE_URL}/dynamic/m_gudang`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      searchfield: 'kode_gudang,nama_gudang',
      filter_column_is_active: 'true',
      filter_column_flag: 'PROD',
      ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
    },
  }
})

// Warehouse Tujuan (Confirmation): flag = 'INV'
const toWarehouseApiConfig = computed(() => {
  return {
    url: `${API_BASE_URL}/dynamic/m_gudang`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      searchfield: 'kode_gudang,nama_gudang',
      filter_column_is_active: 'true',
      filter_column_flag: 'INV',
      ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
    },
  }
})

const handleUnitBisnisSelected = (obj: any) => {
  if (obj) {
    selectedUnitBisnisLabel.value = obj.nama_comp || obj.kode_unit_bisnis || obj.nama || ''
    const compName = obj.m_company?.nama || obj.m_company?.kode || obj.nama_company || ''
    if (compName) {
      selectedUnitBisnisCompanyName.value = compName
    } else {
      fetchUnitBisnisCompanyName(obj.id)
    }
  } else {
    selectedUnitBisnisLabel.value = ''
    selectedUnitBisnisCompanyName.value = ''
  }
}

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = ''
    return
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    )
    const result = await response.json()
    if (result?.status === 'success' && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama || result.data?.m_company?.kode || result.data?.nama_comp || '-'
      // Set the select box label too!
      selectedUnitBisnisLabel.value = result.data?.nama_comp || ''
    }
  } catch (err) {
    console.error('Gagal mengambil nama company:', err)
  }
}

const woMap = ref<Record<string, string>>({})
const fetchWoList = async () => {
  try {
    const res = await apiCall<any>('/dynamic/t_wo?no_pagination=true')
    if (res.status === 'success') {
      const list = Array.isArray(res.data) ? res.data : (res.data?.rows || [])
      list.forEach((wo: any) => {
        if (wo.id && wo.no) {
          woMap.value[wo.id] = wo.no
        }
      })
    }
  } catch (err) {
    console.warn('Gagal memuat list WO:', err)
  }
}

const fetchWarehouseLabel = async (warehouseId: string | number, isDest: boolean) => {
  if (!warehouseId) return
  try {
    const result = await apiCall<any>(`/dynamic/m_gudang/${String(warehouseId)}`)
    if (result?.status === 'success' && result.data) {
      const label = result.data.nama_gudang || result.data.nama || result.data.nama_gudang_display || '-'
      if (isDest) {
        selectedToWarehouseLabel.value = label
      } else {
        selectedWarehouseLabel.value = label
      }
    }
  } catch (err) {
    console.error('Gagal mengambil nama gudang:', err)
  }
}

const handleWarehouseSelected = (obj: any) => {
  if (obj) {
    selectedWarehouseLabel.value = obj.nama_gudang || obj.nama || obj.nama_warehouse || ''
  } else {
    selectedWarehouseLabel.value = ''
  }
}

const handleToWarehouseSelected = (obj: any) => {
  if (obj) {
    selectedToWarehouseLabel.value = obj.nama_gudang || obj.nama || obj.nama_warehouse || ''
  } else {
    selectedToWarehouseLabel.value = ''
  }
}

// Temp penampung data API mentah
let initialValues: Record<string, any> = {}

// Detail array (t_rc_d schema)
const detailArr = ref<any[]>([])

// Add Detail Modal & Available Production Result State
// IDs pres yang sudah ada di detail (untuk excludeIds agar tidak dobel pilih)
const existingPresIds = computed(() =>
  [...new Set(detailArr.value.map((d: any) => d.t_pres_id).filter(Boolean))]
)

const isHeaderComplete = computed(() => {
  return !!values.m_unit_bisnis_id && !!values.value1 && !!values.value2
})

function formatBatchDate(dateVal: any): string {
  if (!dateVal) return ''
  const s = String(dateVal).split('T')[0] || ''
  const parts = s.split('-')
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`
  }
  return s.replace(/[^0-9]/g, '')
}

// API config untuk ButtonMultiSelect — reaktif terhadap flag saat ini
const presMultiSelectApi = computed(() => {
  const flag = values.code || 'WIP'
  const whId = values.value1 || values.m_warehouse_id
  const params: Record<string, any> = {
    join: 'all,sub',
    no_pagination: 'true',
    filter_column_status: 'POST',
    searchfield: 'no',
    filter_column_flag: flag,
    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
    ...(whId ? { filter_column_to_warehouse_id: whId } : {}),
  }
  return {
    url: `${API_BASE_URL}/dynamic/t_pres`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params,
  }
})

const presMultiSelectColumns = [
  { field: 'no', headerName: 'No. Production Result', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Tanggal', width: '120px', sortable: true },
  {
    field: 't_wo.no',
    headerName: 'No. WO',
    width: '160px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter',
    valueGetter: (p: any) => p.data?.t_wo?.no || '-',
  },
  {
    field: 'flag',
    headerName: 'Tipe',
    width: '100px',
    valueGetter: (p: any) => p.data?.flag || '-',
  },
]

// Handler saat user klik "Tambahkan" di ButtonMultiSelect
const handlePresAdded = (selectedItems: any[]) => {
  selectedItems.forEach((pres: any) => {
    const presFlag = pres.flag || 'WIP'

    // Set flag dari item pertama yang ditambahkan.
    if (detailArr.value.length === 0) {
      values.code = presFlag
    }

    const details: any[] = pres.t_pres_d_items || []
    if (details.length > 0) {
      details.forEach((dItem: any) => {
        const alreadyAdded = detailArr.value.some(
          (d: any) => d.t_pres_id === pres.id && d.t_pres_d_item_id === dItem.id
        )
        if (alreadyAdded) return

        const qtyResult = Number(dItem.qty ?? 0)
        const qtyConfirmed = Number(dItem.qty_confirm ?? 0)
        const qtyAvail = Math.max(0, qtyResult - qtyConfirmed)
        const effectiveAvail = qtyAvail > 0 ? qtyAvail : (qtyConfirmed >= qtyResult ? qtyResult : 0)

        const formattedDate = formatBatchDate(pres.date)
        const fallbackBatch = pres.no && formattedDate ? `${pres.no}-${formattedDate}` : (pres.no || '')
        const initialBatch = dItem.batch && dItem.batch !== '-' ? dItem.batch : ''
        const isBatch = Boolean(dItem.is_batch ?? dItem.m_item?.is_batch ?? initialBatch)
        const newRow = reactive({
          t_pres_id: pres.id,
          t_pres_d_item_id: dItem.id,
          flag: presFlag,
          no_pres: pres.no || '-',
          date_pres: (pres.date || '').slice(0, 10),
          no_wo: pres.t_wo?.no || '-',
          m_item_id: dItem.m_item_id,
          item_name: dItem.m_item?.nama_item || dItem.m_item?.nama || '-',
          item_type: dItem.type_item_pres?.value1 || dItem.m_general_item_type?.value1 || presFlag,
          is_batch: isBatch,
          batch: initialBatch || fallbackBatch || '-',
          qty_result: qtyResult,
          qty_confirmed: qtyConfirmed,
          qty_available: effectiveAvail,
          qty_confirm: 0, // default 0, user wajib input sendiri
          unit_id: dItem.unit_id,
          uom: dItem.unit_id_pres?.value1 || dItem.m_general?.value1 || dItem.m_general_unit?.value1 || dItem.unit_id || '-',
          notes: '',
        })

        // Sesuai Batch yg ada di stok dari Prod Result pada WH dan Rak yang dipilih, utk Gudang Produksi
        if ((!initialBatch || initialBatch === '-') && dItem.m_item_id) {
          const whId = values.value1 || values.m_warehouse_id
          const filterWh = whId ? `&filter_column_stock_gudang.m_gudang_id=${whId}` : ''
          apiCall(`/dynamic/stock_gudang_d?filter_column_m_items_id=${dItem.m_item_id}${filterWh}&order_by=createdAt&order_type=DESC&limit=1`)
            .then((res: any) => {
              if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                const b = res.data[0]?.batch
                if (b && b !== '-') newRow.batch = b
              }
            })
            .catch(() => {})
        }

        detailArr.value.push(newRow)
      })
    } else {
      // Pres tanpa detail item — tambah sebagai satu baris ringkasan
      const alreadyAdded = detailArr.value.some(
        (d: any) => d.t_pres_id === pres.id && !d.t_pres_d_item_id
      )
      if (!alreadyAdded) {
        const formattedDate = formatBatchDate(pres.date)
        const fallbackBatch = pres.no && formattedDate ? `${pres.no}-${formattedDate}` : (pres.no || '-')
        detailArr.value.push({
          t_pres_id: pres.id,
          t_pres_d_item_id: null,
          flag: presFlag,
          no_pres: pres.no || '-',
          date_pres: (pres.date || '').slice(0, 10),
          no_wo: pres.t_wo?.no || '-',
          m_item_id: null,
          item_name: '-',
          item_type: presFlag,
          is_batch: true,
          batch: fallbackBatch,
          qty_result: Number(pres.qty_result ?? 0),
          qty_confirmed: Number(pres.qty_confirmed ?? 0),
          qty_available: Number(pres.qty_result ?? 0),
          qty_confirm: Number(pres.qty_result ?? 0),
          unit_id: null,
          uom: '-',
          notes: '',
        })
      }
    }
  })
}

// Audit Footer
const createdByText = computed(() => {
  return initialValues.created_by || initialValues.createdBy || authStore.user?.name || 'admin'
})

const createdAtText = computed(() => {
  if (initialValues.created_at || initialValues.createdAt) {
    const d = new Date(initialValues.created_at || initialValues.createdAt)
    return d.toLocaleString('id-ID', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
  }
  return '-'
})

// Detail Methods
const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail dihapus')
}

// Reset Form Handler
const onReset = () => {
  Object.assign(values, {
    no: '',
    group: '',
    date: new Date().toISOString().split('T')[0],
    key1: new Date().toISOString().split('T')[0],
    m_unit_bisnis_id: '',
    flag: 'WIP',
    code: 'WIP',
    m_warehouse_id: '',
    value1: '',
    to_warehouse_id: '',
    value2: '',
    notes: '',
    value3: '',
    status: 'DRAFT',
    is_active: true
  })

  selectedUnitBisnisLabel.value = ''
  selectedUnitBisnisCompanyName.value = ''
  selectedWarehouseLabel.value = ''
  selectedToWarehouseLabel.value = ''

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  detailArr.value = []
}

// Lifecycle Hooks - Load Data
onBeforeMount(async () => {
  onReset()
  await fetchWoList()
  
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    applyCurrentUserUnitBisnis()
    return
  }
  
  loading.value = true
  try {
    const res = await getRcWipById(sourceId)
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      }
    }
    
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data
    console.log('[RcWipForm] Raw API response data:', initialValues)

    if (initialValues.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(initialValues.m_unit_bisnis_id)
    }
    if (initialValues.m_unit_bisnis?.nama_comp || initialValues.m_unit_bisni?.nama_comp) {
      selectedUnitBisnisLabel.value = initialValues.m_unit_bisnis?.nama_comp || initialValues.m_unit_bisni?.nama_comp
    }
    if (initialValues.m_unit_bisnis?.m_company?.nama || initialValues.m_unit_bisni?.m_company?.nama) {
      selectedUnitBisnisCompanyName.value = initialValues.m_unit_bisnis?.m_company?.nama || initialValues.m_unit_bisni?.m_company?.nama
    }
    if (initialValues.m_warehouse?.nama_gudang || initialValues.m_warehouse?.nama || initialValues.m_gudang?.nama_gudang) {
      selectedWarehouseLabel.value = initialValues.m_warehouse?.nama_gudang || initialValues.m_warehouse?.nama || initialValues.m_gudang?.nama_gudang
    }
    if (initialValues.to_warehouse?.nama_gudang || initialValues.to_warehouse?.nama || initialValues.to_gudang?.nama_gudang) {
      selectedToWarehouseLabel.value = initialValues.to_warehouse?.nama_gudang || initialValues.to_warehouse?.nama || initialValues.to_gudang?.nama_gudang
    }

    // Detail array mapping (t_rc_ds or t_rc_d or t_rc_details or t_rcwip_details)
    const rawDetails = initialValues.t_rc_ds || initialValues.t_rc_d || initialValues.t_rc_details || initialValues.t_rcwip_details || []
    if (Array.isArray(rawDetails) && rawDetails.length > 0) {
      detailArr.value = rawDetails.map(d => {
        const woNo = d.no_wo || d.t_pres?.no_wo || d.t_pres?.t_wo?.no || d.t_pre?.t_wo?.no || d.t_pre?.t_wo_d_item?.t_wo?.no || woMap.value[d.t_pre?.t_wo_id] || woMap.value[d.t_pres?.t_wo_id] || '-'
        const presNo = d.t_pre?.no || d.t_pres?.no || d.no_pres || d.no_result || '-'
        const itemName = d.item_name || d.name || d.m_item?.nama_item || d.m_items?.nama_item || d.m_item?.nama || d.m_items?.nama || d.t_pres_d_item?.m_item?.nama_item || d.t_pre?.t_wo_d_item?.m_item?.nama_item || d.t_pre?.t_wo_d_item?.m_item?.nama || '-'
        const itemType = d.item_type || d.t_pres_d_item?.type_item_pres?.value1 || d.t_pre?.t_wo_d_item?.as_item_type_wod?.value1 || d.m_general_item_type?.value1 || d.m_general_item_type?.nama || 'WIP'
        const qtyRes = Number(d.qty_result ?? d.qty ?? d.t_pres_d_item?.qty ?? d.t_pre?.t_wo_d_item?.qty ?? 0)
        const qtyConf = Number(d.qty_confirm ?? d.qty ?? 0)
        const qtyRec = Number(d.qty_received ?? qtyConf ?? 0)
        const qtyAvail = Number(d.qty_available ?? qtyRes ?? 0)
        const uomName = d.t_pres_d_item?.unit_id_pres?.value1 || d.t_pre?.t_wo_d_item?.as_unit_wod?.value1 || d.m_general?.value1 || d.m_general_unit?.value1 || d.m_general_unit?.nama || d.uom || 'PCS'
        const notesStr = d.notes || d.catatan || ''

        const rawBatch = d.batch && d.batch !== '-' ? d.batch : (d.t_pres_d_item?.batch && d.t_pres_d_item.batch !== '-' ? d.t_pres_d_item.batch : '')
        const isBatch = Boolean(d.is_batch ?? d.m_item?.is_batch ?? d.m_items?.is_batch ?? d.t_pres_d_item?.is_batch ?? d.t_pres_d_item?.m_item?.is_batch ?? rawBatch)

        const row = reactive({
          ...d,
          no_wo: woNo,
          no_pres: presNo,
          item_name: itemName,
          item_type: itemType,
          is_batch: isBatch,
          batch: rawBatch || '-',
          qty_result: qtyRes,
          qty_confirm: qtyConf,
          qty_received: qtyRec,
          qty_available: qtyAvail,
          uom: uomName,
          notes: notesStr
        })

        if ((!rawBatch || rawBatch === '-') && d.m_item_id) {
          const whId = initialValues.m_warehouse_id || initialValues.value1
          const filterWh = whId ? `&filter_column_stock_gudang.m_gudang_id=${whId}` : ''
          apiCall(`/dynamic/stock_gudang_d?filter_column_m_items_id=${d.m_item_id}${filterWh}&order_by=createdAt&order_type=DESC&limit=1`)
            .then((res: any) => {
              if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                const b = res.data[0]?.batch
                if (b && b !== '-') row.batch = b
              }
            })
            .catch(() => {})
        }

        return row
      })
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).no
      delete (initialValues as any).group
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      detailArr.value.forEach((item: any) => {
        delete item.id
      })
    }

    // Assign main fields and relation objects (similar to WoWip data flow)
    for (const key in initialValues) {
      if (key === 'date' || key === 'key1') {
        const rawDate = initialValues[key]
        if (rawDate) {
          (values as any)[key] = rawDate.slice(0, 10)
        } else {
          (values as any)[key] = ''
        }
      } else {
        // @ts-ignore dynamic assign
        (values as any)[key] = initialValues[key]
      }
    }

    // Sync legacy and new properties
    if (values.group) values.no = values.group
    else if (values.no) values.group = values.no

    if (values.key1) values.date = values.key1
    else if (values.date) values.key1 = values.date

    if (values.value1) values.m_warehouse_id = values.value1
    else if (values.m_warehouse_id) values.value1 = values.m_warehouse_id

    if (values.value2) values.to_warehouse_id = values.value2
    else if (values.to_warehouse_id) values.value2 = values.to_warehouse_id

    if (values.value3) values.notes = values.value3
    else if (values.notes) values.value3 = values.notes

    // Fetch labels if relation object is missing
    if (values.value1 && !selectedWarehouseLabel.value) {
      fetchWarehouseLabel(values.value1, false)
    }
    if (values.value2 && !selectedToWarehouseLabel.value) {
      fetchWarehouseLabel(values.value2, true)
    }

    console.log('[RcWipForm] Mapped form values:', { ...values })
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Result Confirmation WIP baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Result Confirmation WIP', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/production/transaksi/t_rc_wip')
      }
    })
  } finally {
    loading.value = false
  }
})

// Validation Errors
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  m_warehouse_id: '',
  to_warehouse_id: '',
  notes: ''
})

// Save Handler
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false

  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib dipilih'; invalid = true }
  if (!values.key1 && !values.date) { errors.date = 'Tanggal wajib diisi'; invalid = true }
  if (!values.value1 && !values.m_warehouse_id) { errors.m_warehouse_id = 'Warehouse Asal wajib dipilih'; invalid = true }
  if (!values.value2 && !values.to_warehouse_id) { errors.to_warehouse_id = 'To Warehouse wajib dipilih'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Validasi detail
  if (isConfirmMode.value) {
    for (let i = 0; i < detailArr.value.length; i++) {
      const item = detailArr.value[i]!
      const seq = i + 1
      if (item.qty_received === undefined || item.qty_received === null || String(item.qty_received).trim() === "") {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Received untuk "${item.item_name}" wajib diisi` })
        return
      }
      const qtyRec = Number(item.qty_received)
      const qtyConf = Number(item.qty_confirm)
      if (qtyRec <= 0) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Received untuk "${item.item_name}" harus bernilai positif (> 0)` })
        return
      }
      if (qtyRec > qtyConf) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Received (${qtyRec}) tidak boleh melebihi Qty Confirm (${qtyConf})` })
        return
      }
      if (qtyRec !== qtyConf && (!item.notes || !item.notes.trim())) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Catatan baris wajib diisi jika Qty Received tidak sama dengan Qty Confirm (${item.item_name})` })
        return
      }
    }
  } else {
    // Mode Draft / Edit: Qty Confirm tidak boleh melebihi Qty Available
    for (let i = 0; i < detailArr.value.length; i++) {
      const item = detailArr.value[i]!
      const qtyConf = Number(item.qty_confirm) || 0
      const qtyAvail = Number(item.qty_available ?? item.qty_result) || 0
      if (qtyConf <= 0) {
        toast.error('Validasi detail gagal', {
          description: `Baris ${i + 1} (${item.item_name}): Qty Confirm harus lebih dari 0`
        })
        return
      }
      if (qtyAvail > 0 && qtyConf > qtyAvail) {
        toast.error('Validasi Qty gagal', {
          description: `Baris ${i + 1} (${item.item_name}): Qty Confirm (${qtyConf}) melebihi Qty Available (${qtyAvail})`
        })
        return
      }
    }
  }

  loading.value = true
  try {
    const detailsPayload = detailArr.value.map((item, idx) => ({
      id: !isCopyMode.value && item.id && !String(item.id).startsWith('temp-') ? item.id : undefined,
      sequence: idx + 1,
      no_wo: item.no_wo || null,
      no_pres: item.no_pres || null,
      t_pres_id: item.t_pres_id || null,
      t_pres_d_item_id: item.t_pres_d_item_id || null,
      item_type_id: item.item_type_id || null,
      item_type: item.item_type || null,
      m_item_id: item.m_item_id || null,
      item_name: item.item_name || null,
      batch: (item.is_batch ?? true) && item.batch && item.batch !== '-' ? item.batch : null,
      qty_result: Number(item.qty_result) || 0,
      qty_confirm: Number(item.qty_confirm) || 0,
      qty_received: isConfirmMode.value ? Number(item.qty_received) : (item.qty_received !== undefined && item.qty_received !== null ? Number(item.qty_received) : Number(item.qty_confirm) || 0),
      unit_id: item.unit_id || null,
      uom: item.uom || null,
      notes: item.notes || item.catatan || null
    }))

    const payload: any = {
      id: isEditMode.value ? menuId.value : undefined,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      no: values.group?.trim() || values.no?.trim() || null,
      group: values.group?.trim() || values.no?.trim() || null,
      date: values.key1?.trim() || values.date?.trim() || null,
      key1: values.key1?.trim() || values.date?.trim() || null,
      flag: 'WIP',
      code: 'WIP',
      m_warehouse_id: values.value1 || values.m_warehouse_id || null,
      value1: values.value1 || values.m_warehouse_id || null,
      to_warehouse_id: values.value2 || values.to_warehouse_id || null,
      value2: values.value2 || values.to_warehouse_id || null,
      notes: values.value3?.trim() || values.notes?.trim() || null,
      value3: values.value3?.trim() || values.notes?.trim() || null,
      status: isConfirmMode.value ? 'RECEIVED' : (values.status || 'DRAFT'),
      is_active: values.is_active,
      t_rc_d: detailsPayload
    }
    
    if (isConfirmMode.value) {
      await updateRcWip(menuId.value, payload)
      toast.success('Result Confirmation WIP berhasil dikonfirmasi (RECEIVED)')
    } else if (isEditMode.value) {
      await updateRcWip(menuId.value, payload)
      toast.success('Result Confirmation WIP berhasil diperbarui')
    } else {
      await createRcWip(payload)
      toast.success('Result Confirmation WIP berhasil dibuat')
    }
    router.replace('/production/transaksi/t_rc_wip?reload=' + Date.now())
  } catch (error) {
    toast.error(isConfirmMode.value ? 'Gagal mengonfirmasi Result Confirmation WIP' : (isEditMode.value ? 'Gagal memperbarui Result Confirmation WIP' : 'Gagal membuat Result Confirmation WIP'), {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

// Cancel Handler
const handleCancel = () => {
  router.push('/production/transaksi/t_rc_wip')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- HEADER -->
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

    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Result Confirmation WIP</CardTitle>
          <CardDescription>Isi data Result Confirmation WIP dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <!-- Unit Bisnis -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :display-value="selectedUnitBisnisLabel"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', searchfield: 'kode_unit_bisnis,nama_comp', join: 'true' },
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Unit Bisnis"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              @input="(v) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
              class="w-full"
            />

            <!-- Company (auto-fill) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Terisi otomatis dari Unit Bisnis"
              class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- No. Confirmation (Auto-generate) -->
            <FieldX
              id="group"
              label="No. Result Confirmation WIP"
              :value="values.group || 'Auto Generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generate"
              hints="Nomor dibuat otomatis oleh sistem"
              class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Tanggal -->
            <FieldX
              id="key1"
              label="Tanggal"
              type="date"
              :value="values.key1"
              @input="v => { values.key1 = v; values.date = v }"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :required="!isReadOnly && !isConfirmMode"
              hints="Tanggal otomatis diisi hari ini"
              class="w-full"
            />

            <!-- Warehouse Production (Asal) -->
            <FieldSelect
              id="value1"
              label="Warehouse Production (Asal)"
              :value="values.value1"
              :display-value="selectedWarehouseLabel"
              :api="warehouseApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Production"
              :required="!isReadOnly && !isConfirmMode"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="!isConfirmMode"
              :errorText="errors.m_warehouse_id ? 'failed' : ''"
              :hints="errors.m_warehouse_id || 'Pilih Warehouse Production'"
              @input="(v) => { values.value1 = v; values.m_warehouse_id = v }"
              @update:valueFull="handleWarehouseSelected"
              class="w-full"
            />

            <!-- Warehouse Confirmation (Tujuan) -->
            <FieldSelect
              id="value2"
              label="Warehouse Confirmation (Tujuan)"
              :value="values.value2"
              :display-value="selectedToWarehouseLabel"
              :api="toWarehouseApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Confirmation"
              :required="!isReadOnly && !isConfirmMode"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="!isConfirmMode"
              :errorText="errors.to_warehouse_id ? 'failed' : ''"
              :hints="errors.to_warehouse_id || 'Pilih Warehouse Confirmation'"
              @input="(v) => { values.value2 = v; values.to_warehouse_id = v }"
              @update:valueFull="handleToWarehouseSelected"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldX
              id="value3"
              type="textarea"
              label="Catatan"
              :value="values.value3"
              @input="v => { values.value3 = v; values.notes = v }"
              :required="false"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              placeholder="Catatan (opsional)"
              class="w-full md:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TAB — Production Results -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="detail1">Production Result</TabsTrigger>
        </TabsList>

        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Production Result</CardTitle>
                  <CardDescription>
                    <span v-if="isConfirmMode" class="text-primary font-medium">
                      Mode Konfirmasi: Masukkan Qty Received yang diterima secara riil. Default sama dengan Qty Confirm.
                    </span>
                    <span v-else-if="values.code" class="text-foreground font-medium">
                      Flag aktif: <span class="font-bold">{{ values.code }}</span> — hanya Production Result dengan flag yang sama yang bisa ditambahkan.
                    </span>
                    <span v-else>
                      Pilih Production Result yang akan dikonfirmasi
                    </span>
                  </CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly && !isConfirmMode"
                  title="Pilih Production Result"
                  :disabled="loading || !isHeaderComplete"
                  :api="presMultiSelectApi"
                  :columns="presMultiSelectColumns"
                  :exclude-ids="existingPresIds"
                  search-key="no"
                  unique-key="id"
                  @add="handlePresAdded"
                />
              </div>
            </CardHeader>
            <CardContent>

          <!-- Table Container -->
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left w-12">No</th>
                  <th class="px-4 py-3 text-left whitespace-nowrap">No. WO</th>
                  <th class="px-4 py-3 text-left whitespace-nowrap">No. Result</th>
                  <th class="px-4 py-3 text-left min-w-[180px]">Item</th>
                  <th class="px-4 py-3 text-left whitespace-nowrap">Item Type</th>
                  <th class="px-4 py-3 text-left whitespace-nowrap">Batch</th>
                  <th class="px-4 py-3 text-right w-28">Qty Result</th>
                  <th class="px-4 py-3 text-right w-32">Qty Confirm</th>
                  <th v-if="isConfirmMode || isReadOnly" class="px-4 py-3 text-right w-36">
                    Qty Received <span v-if="isConfirmMode" class="text-destructive font-bold">*</span>
                  </th>
                  <th class="px-4 py-3 text-left w-20">UoM</th>
                  <th class="px-4 py-3 text-left min-w-[180px]">
                    Catatan <span v-if="isConfirmMode && detailArr.some(d => Number(d.qty_received) !== Number(d.qty_confirm))" class="text-destructive font-bold">*</span>
                  </th>
                  <th v-if="!isReadOnly && !isConfirmMode" class="px-2 py-3 text-center w-12">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-if="detailArr.length === 0">
                  <td colspan="11" class="text-center py-10 text-muted-foreground">
                    Belum ada Production Result dipilih.
                    <span v-if="!isReadOnly && !isConfirmMode" class="block text-xs mt-1">
                      Klik "+ Add to List" untuk menambahkan dari Production Result.
                    </span>
                  </td>
                </tr>
                <tr
                  v-for="(detail, index) in detailArr"
                  :key="index"
                  class="hover:bg-slate-50/50"
                >
                  <td class="px-4 py-3 text-slate-700">{{ index + 1 }}</td>
                  <td class="px-4 py-3 text-slate-700 whitespace-nowrap">{{ detail.no_wo }}</td>
                  <td class="px-4 py-3 text-slate-700 whitespace-nowrap">{{ detail.no_pres }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ detail.item_name }}</td>
                  <td class="px-4 py-3 text-slate-600 whitespace-nowrap">{{ detail.item_type }}</td>
                  <td class="px-4 py-3 text-slate-600 whitespace-nowrap">
                    <span v-if="detail.batch && detail.batch !== '-'" class="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {{ detail.batch }}
                    </span>
                    <span v-else class="text-muted-foreground text-xs">-</span>
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-slate-600">{{ detail.qty_result }}</td>
                  <td class="px-4 py-3 text-right">
                    <input
                      v-if="!isReadOnly && !isConfirmMode"
                      v-model.number="detail.qty_confirm"
                      type="number"
                      min="0"
                      :max="Number(detail.qty_available ?? detail.qty_result ?? 999999)"
                      class="w-24 text-right px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
                      step="0.01"
                    />
                    <span v-else class="font-mono text-slate-700">{{ detail.qty_confirm }}</span>
                  </td>
                  <td v-if="isConfirmMode || isReadOnly" class="px-4 py-3 text-right">
                    <input
                      v-if="isConfirmMode"
                      v-model.number="detail.qty_received"
                      type="number"
                      min="0.01"
                      :max="Number(detail.qty_confirm)"
                      step="0.01"
                      class="w-24 text-right px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono transition-all"
                      :class="{ 'border-destructive focus:ring-destructive bg-destructive/5': Number(detail.qty_received) > Number(detail.qty_confirm) || Number(detail.qty_received) <= 0 }"
                    />
                    <span v-else class="font-mono text-slate-700">{{ detail.qty_received ?? '-' }}</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ detail.uom }}</td>
                  <td class="px-4 py-3">
                    <input
                      v-if="!isReadOnly || isConfirmMode"
                      v-model="detail.notes"
                      type="text"
                      class="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                      :class="{ 'border-destructive focus:ring-destructive bg-destructive/5': isConfirmMode && Number(detail.qty_received) !== Number(detail.qty_confirm) && (!detail.notes || !detail.notes.trim()) }"
                      :placeholder="isConfirmMode && Number(detail.qty_received) !== Number(detail.qty_confirm) ? 'Catatan wajib diisi...' : 'Catatan baris...'"
                    />
                    <span v-else class="text-slate-600">{{ detail.notes || detail.catatan || '-' }}</span>
                  </td>
                  <td v-if="!isReadOnly && !isConfirmMode" class="px-2 py-3 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      @click="removeDetailArr(index)"
                      class="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- FOOTER SECTION -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <!-- Left: Created By info -->
        <div class="text-sm font-medium text-muted-foreground">
          Created By {{ createdByText }} On {{ createdAtText }}
        </div>

        <!-- Right: Actions -->
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button 
            type="button" 
            variant="outline" 
            @click="handleCancel" 
            :disabled="loading" 
            class="px-5 font-medium"
          >
            {{ isReadOnly && !isConfirmMode ? 'Kembali' : 'Batal' }}
          </Button>

          <Button 
            v-if="!isReadOnly || isConfirmMode" 
            type="button" 
            variant="default"
            @click="onSave" 
            :disabled="loading" 
            class="gap-2 px-5 font-medium shadow-xs"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ isConfirmMode ? 'Konfirmasi Penerimaan (RECEIVED)' : (isEditMode ? 'Perbarui' : 'Simpan') }}
          </Button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

/* Hide scrollbar */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
