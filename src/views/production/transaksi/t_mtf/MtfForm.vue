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
import { FieldX, FieldNumber, FieldSelect, FieldPopup, FieldTextarea, FieldRadio } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { apiCall } from '@/lib/api'
import {
  createMtf,
  updateMtf,
  getMtfById,
  type MtfItem,
  type MtfDetailItem
} from './service'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'MtfForm')
const isViewMode = computed(() => route.name === 'MtfView')
const copySourceId = computed(() => {
  const source = route.query.copy || route.query.source;
  return Array.isArray(source) ? source[0] : source;
});
const isCopyMode = computed(() => !!copySourceId.value)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()))
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Material Transfer'
  if (isCopyMode.value) return 'Salin Material Transfer'
  if (isEditMode.value) return 'Edit Material Transfer'
  return 'Tambah Material Transfer Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Material Transfer'
  if (isCopyMode.value) return 'Buat Material Transfer baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Material Transfer'
  return 'Buat Material Transfer baru untuk memindahkan persediaan'
})

// Header values matching DB schema
const values = reactive({
  id: '',
  m_unit_bisnis_id: '',
  no: '',
  date: new Date().toISOString().split('T')[0],
  ref_table: '',
  ref_id: '',
  t_wo_id: '',
  t_wo_d_item_id: '',
  t_wo_sd_routing_id: '',
  m_warehouse_id: '',
  to_warehouse_id: '',
  notes: '',
  status: 'DRAFT' as 'DRAFT' | 'POST' | 'CONFIRM',
  confirmed_by: null as string | null,
  confirmed_at: null as string | null
})

// Label / display name bindings
const selectedRefLabel = ref("")
const selectedWoLabel = ref("")
const selectedWoItemLabel = ref("")
const selectedWoRoutingLabel = ref("")
const selectedWarehouseLabel = ref("")
const selectedUnitBisnisCompanyName = ref("")

// Map for stocking quantities (key: m_item_id, value: free_stock)
const warehouseStockMap = ref<Map<string, number>>(new Map())

// Detail array
const detailArr = ref<MtfDetailItem[]>([])

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  ref_table: '',
  ref_id: '',
  to_warehouse_id: ''
})

// Check if user is in confirmation mode (status is POST and they are editing)
const isConfirmMode = computed(() => {
  return values.status === 'POST' && !isReadOnly.value
})

// ============================================================================
// COMPUTED API CONFIGS
// ============================================================================
const refApi = computed(() => {
  if (!values.ref_table) return undefined
  return {
    url: `${API_BASE_URL}/dynamic/${values.ref_table}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      searchfield: 'no,notes',
      order_by: 'no',
      order_type: 'DESC',
      join: 'true',
      filter_column_status: 'APPROVED',
      ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
      ...(values.ref_table === 't_mrq'
        ? { include: 'm_gudang>stock_gudang,t_wo_d_item>m_items@m_item,t_wo_sd_routing>m_routing' }
        : { include: 't_wo_d_item>m_items@m_item,t_wo_sd_routing>m_routing' }
      )
    }
  }
})

const refColumns = computed(() => {
  const isMrq = values.ref_table === 't_mrq'
  return [
    { field: 'no', headerName: isMrq ? 'No MRQ' : 'No BA', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
    { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
    { field: 't_wo.no', headerName: 'No WO', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
    { field: 't_wo_d_item.m_item.nama_item', headerName: 'Item', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
    { field: 't_wo_sd_routing.m_routing.code', headerName: 'Routing', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  ]
})

const detailMultiSelectApi = computed(() => {
  if (!values.ref_id || !values.ref_table) return undefined
  
  return {
    url: `${API_BASE_URL}/fn/t_mtf/getMaterialsWithStock`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`
    },
    params: {
      ref_table: values.ref_table,
      ref_id: values.ref_id,
      m_warehouse_id: values.m_warehouse_id || '',
    },
    onsuccess: (response: any) => {
      if (response && response.data) {
        response.data = response.data.filter((item: any) => item.qty_available > 0)
      }
      return response
    }
  }
})

const detailMultiSelectColumns = [
  { field: 'tipe_name', headerName: 'Tipe Material', width: '130px', sortable: true, filterable: true },
  { field: 'item_code', headerName: 'Kode Material', width: '120px', sortable: true, filterable: true },
  { field: 'item_name', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true },
  { field: 'uom_name', headerName: 'UOM', width: '100px' },
  { field: 'qty_request', headerName: 'Qty Request', width: '120px' },
  { field: 'qty_confirm', headerName: 'Qty Sdh Transfer Confirm', width: '180px' },
  { field: 'qty_available', headerName: 'Qty Available', width: '120px' },
  { field: 'qty_stock_asal', headerName: 'Qty Stock (dari gudang asal)', width: '160px' },
]

// ============================================================================
// HELPER METHODS (FETCHING LABELS & STOCK)
// ============================================================================
const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = ""
    return
  }
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`)
    if (res.status === 'success' && res.data) {
      selectedUnitBisnisCompanyName.value = res.data.m_company?.nama_company || res.data.nama_comp || ""
    }
  } catch (error) {
    console.error("Gagal mengambil nama company unit bisnis", error)
  }
}

const handleUnitBisnisSelected = (item: any) => {
  if (item) {
    selectedUnitBisnisCompanyName.value = item.m_company?.nama_company || item.nama_comp || ""
  } else {
    selectedUnitBisnisCompanyName.value = ""
  }
}

const isSuperAdmin = computed(() => {
  return authStore.user?.tipe?.value1?.toUpperCase() === 'SUPER ADMIN';
})

const isUnitBisnisReadonly = computed(() => {
  return !isSuperAdmin.value || isEditMode.value || isViewMode.value
})

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

const fetchWoLabel = async (id: string) => {
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/t_wo/${id}`)
    if (res.status === 'success' && res.data) {
      selectedWoLabel.value = res.data.no || ""
    }
  } catch (e) {
    selectedWoLabel.value = id
  }
}

const fetchWoItemLabel = async (id: string) => {
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/t_wo_d_item/${id}?join=true`)
    if (res.status === 'success' && res.data) {
      const item = res.data
      selectedWoItemLabel.value = item.m_item ? `${item.m_item.kode_item || '-'} - ${item.m_item.nama_item || '-'}` : id
    }
  } catch (e) {
    selectedWoItemLabel.value = id
  }
}

const fetchWoRoutingLabel = async (id: string) => {
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/t_wo_sd_routing/${id}?join=true`)
    if (res.status !== 'success' || !res.data) {
      selectedWoRoutingLabel.value = '-'
      return
    }

    const rObj = res.data
    const label = rObj.wo_sd_routing?.code || rObj.m_routing?.code || rObj.code || rObj.wo_sd_routing?.name || rObj.m_routing?.name || rObj.name || ''
    selectedWoRoutingLabel.value = label || '-'
  } catch (e) {
    selectedWoRoutingLabel.value = '-'
  }
}

const fetchWarehouseLabel = async (id: string) => {
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/m_gudang/${id}`)
    if (res.status === 'success' && res.data) {
      selectedWarehouseLabel.value = res.data.nama_gudang || res.data.nama || ""
    }
  } catch (e) {
    selectedWarehouseLabel.value = id
  }
}

const fetchWarehouseStock = async () => {
  if (!values.m_warehouse_id) {
    warehouseStockMap.value.clear()
    return
  }
  try {
    const query = new URLSearchParams({
      gudang_id: values.m_warehouse_id,
      filter_column_is_opname: "false",
      no_pagination: "true",
    })
    const response = await fetch(
      `${API_BASE_URL}/fn/stock_gudang/stock_item?${query.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    )
    if (!response.ok) return
    const payload = await response.json()
    const groupedData = Array.isArray(payload?.data) ? payload.data : []
    
    const newMap = new Map<string, number>()
    groupedData.forEach((group: any) => {
      const groupItems = Array.isArray(group?.items) ? group.items : []
      groupItems.forEach((stockItem: any) => {
        const itemId = stockItem?.m_items_id || stockItem?.m_item_id || ""
        const freeStock = Number(stockItem?.free_stock || 0)
        if (itemId) {
          const existing = newMap.get(itemId) || 0
          newMap.set(itemId, existing + freeStock)
        }
      })
    })
    warehouseStockMap.value = newMap
    
    // Update current stocks display in details list
    detailArr.value.forEach((detail) => {
      detail.qty_stock = warehouseStockMap.value.get(detail.m_item_id) || 0
    })
  } catch (error) {
    console.error("Gagal memuat data stok gudang asal", error)
  }
}

// Watch for changes in warehouse asal to reload stocks
watch(() => values.m_warehouse_id, () => {
  fetchWarehouseStock()
})

// ============================================================================
// EVENT HANDLERS
// ============================================================================
const handleRefSelected = async (item: any) => {
  if (item) {
    values.ref_id = item.id
    selectedRefLabel.value = item.no || ""
    
    // Auto-fill header fields
    values.t_wo_id = item.t_wo_id || ""
    values.t_wo_d_item_id = item.t_wo_d_item_id || ""
    values.t_wo_sd_routing_id = item.t_wo_sd_routing_id || ""
    values.m_warehouse_id = item.warehouse_id || item.m_warehouse_id || ""
    values.m_unit_bisnis_id = item.m_unit_bisnis_id || ""
    
    // Populate display names immediately from nested relations if available
    selectedUnitBisnisCompanyName.value = item.m_unit_bisni?.m_company?.nama_company || item.m_unit_bisni?.nama_comp || ""
    selectedWarehouseLabel.value = item.m_gudang?.nama_gudang || item.m_gudang?.nama || ""
    selectedWoLabel.value = item.t_wo?.no || ""
    
    if (item.t_wo_d_item) {
      const it = item.t_wo_d_item
      selectedWoItemLabel.value = it.m_item ? `${it.m_item.kode_item || it.m_item.kode || '-'} - ${it.m_item.nama_item || it.m_item.nama || '-'}` : ""
    } else {
      selectedWoItemLabel.value = ""
    }
    
    // Routing label — selalu fetch via ID karena include m_routing tidak reliable
    if (values.t_wo_sd_routing_id) {
      fetchWoRoutingLabel(values.t_wo_sd_routing_id)
    } else {
      selectedWoRoutingLabel.value = ""
    }
    
    // Fallback to fetch functions if relations are missing
    if (values.m_unit_bisnis_id && !selectedUnitBisnisCompanyName.value) fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    if (values.t_wo_id && !selectedWoLabel.value) fetchWoLabel(values.t_wo_id)
    if (values.t_wo_d_item_id && !selectedWoItemLabel.value) fetchWoItemLabel(values.t_wo_d_item_id)
    if (values.t_wo_sd_routing_id && !selectedWoRoutingLabel.value) fetchWoRoutingLabel(values.t_wo_sd_routing_id)
    if (values.m_warehouse_id && !selectedWarehouseLabel.value) fetchWarehouseLabel(values.m_warehouse_id)
    
    // Clear details array upon changing reference header
    detailArr.value = []
  } else {
    values.ref_id = ""
    selectedRefLabel.value = ""
    values.t_wo_id = ""
    values.t_wo_d_item_id = ""
    values.t_wo_sd_routing_id = ""
    values.m_warehouse_id = ""
    
    selectedWoLabel.value = ""
    selectedWoItemLabel.value = ""
    selectedWoRoutingLabel.value = ""
    selectedWarehouseLabel.value = ""
    
    detailArr.value = []
  }
}

const handleMaterialsAdded = (items: any[]) => {
  items.forEach(item => {
    // Prevent duplicate entries of the same material detail ID
    if (!detailArr.value.find((d: any) => d.ref_id === item.id)) {
      const uomId = item.uom_id || item.unit_id || item.m_item?.uom_id || ""
      const mItemId = item.m_item_id || item.m_item?.id || ""
      const stock = item.qty_stock_asal !== undefined && item.qty_stock_asal !== null ? item.qty_stock_asal : (warehouseStockMap.value.get(mItemId) || 0)
      const isBatch = Boolean(item.m_item?.is_batch ?? item.is_batch)

      const newRow = reactive({
        sequence: detailArr.value.length + 1,
        ref_table: values.ref_table === 't_mrq' ? 't_mrq_d' : 't_ba_d',
        ref_id: item.id, // reference detail ID
        m_item_id: mItemId,
        batch: item.batch || '',
        is_batch: isBatch,
        m_item: item.m_item || {
          id: mItemId,
          kode_item: item.item_code || item.kode || "",
          nama_item: item.item_name || item.nama || "",
          is_batch: isBatch,
          mi_uom: { value1: item.uom_name || "" }
        },
        qty_req_available: item.qty_available,
        qty_stock: stock,
        qty_transfer: 0, // default 0, user wajib input sendiri
        uom_id: uomId,
        uom: item.uom || { value1: item.uom_name || "" },
        notes: '',
        qty_confirm: 0, // default 0, user wajib input sendiri
        reason_confirm: '',
      })
      detailArr.value.push(newRow)

      if (isBatch && values.m_warehouse_id && !newRow.batch) {
        fetch(`${API_BASE_URL}/dynamic/stock_gudang?filter_column_m_gudang_id=${values.m_warehouse_id}&filter_column_m_items_id=${mItemId}&limit=1`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
          .then(r => r.json())
          .then(res => {
            if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
              const sgId = res.data[0].id
              return fetch(`${API_BASE_URL}/fn/stock_gudang/getBatchesByStockGudang?stock_gudang_id=${sgId}`, {
                headers: { Authorization: `Bearer ${authStore.token}` }
              }).then(r => r.json())
            }
          })
          .then(res => {
            if (res && res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
              const b = res.data[0]
              newRow.batch = typeof b === 'string' ? b : (b?.batch || '')
            }
          })
          .catch(() => {})
      }
    }
  })
}

const removeDetailItem = (index: number) => {
  detailArr.value.splice(index, 1)
  detailArr.value = detailArr.value.map((row, idx) => ({ ...row, sequence: idx + 1 }))
  toast.info('Detail material dihapus')
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    id: '',
    m_unit_bisnis_id: '',
    no: '',
    date: new Date().toISOString().split('T')[0],
    ref_table: '',
    ref_id: '',
    t_wo_id: '',
    t_wo_d_item_id: '',
    t_wo_sd_routing_id: '',
    m_warehouse_id: '',
    to_warehouse_id: '',
    notes: '',
    status: 'DRAFT',
    confirmed_by: null,
    confirmed_at: null
  })

  selectedRefLabel.value = ""
  selectedWoLabel.value = ""
  selectedWoItemLabel.value = ""
  selectedWoRoutingLabel.value = ""
  selectedWarehouseLabel.value = ""
  selectedUnitBisnisCompanyName.value = ""
  warehouseStockMap.value.clear()

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  detailArr.value = []
  applyCurrentUserUnitBisnis()
}

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
const loadData = async () => {
  onReset()
  
  const isCopyModeLocal = !!copySourceId.value
  const sourceId = isCopyModeLocal ? String(copySourceId.value) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }
  
  loading.value = true
  try {
    const res = await getMtfById(sourceId)
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
    
    const raw: any = res.data || {}
    values.id = raw.id ?? ""
    values.m_unit_bisnis_id = raw.m_unit_bisnis_id ?? ""
    values.no = raw.no ?? ""
    values.date = (raw.date || "").slice(0, 10)
    values.ref_table = raw.ref_table ?? ""
    values.ref_id = raw.ref_id ?? ""
    values.t_wo_id = raw.t_wo_id ?? ""
    values.t_wo_d_item_id = raw.t_wo_d_item_id ?? ""
    values.t_wo_sd_routing_id = raw.t_wo_sd_routing_id ?? ""
    values.m_warehouse_id = raw.m_warehouse_id ?? ""
    values.to_warehouse_id = raw.to_warehouse_id ?? ""
    values.notes = raw.notes ?? ""
    values.status = raw.status ?? "DRAFT"
    values.confirmed_by = raw.confirmed_by ?? null
    values.confirmed_at = raw.confirmed_at ?? null

    // Load display names for selections directly from response graph
    selectedUnitBisnisCompanyName.value = raw.m_unit_bisni?.m_company?.nama_company || raw.m_unit_bisni?.nama_comp || ""
    selectedWoLabel.value = raw.t_wo?.no || ""
    
    if (raw.t_wo_d_item) {
      const item = raw.t_wo_d_item
      selectedWoItemLabel.value = item.m_item ? `${item.m_item.kode_item || item.m_item.kode || '-'} - ${item.m_item.nama_item || item.m_item.nama || '-'}` : item.id
    } else {
      selectedWoItemLabel.value = ""
    }
    
    // Routing label — selalu fetch via ID karena include m_routing tidak reliable
    if (values.t_wo_sd_routing_id) {
      fetchWoRoutingLabel(values.t_wo_sd_routing_id)
    } else {
      selectedWoRoutingLabel.value = ""
    }
    
    selectedWarehouseLabel.value = raw.m_gudang?.nama_gudang || raw.m_gudang?.nama || ""

    // Resolve reference transaction display name asynchronously (polymorphic relation)
    if (values.ref_id && values.ref_table) {
      try {
        const refRes = await apiCall<{ status: string; data: any }>(`/dynamic/${values.ref_table}/${values.ref_id}`)
        if (refRes.status === 'success' && refRes.data) {
          selectedRefLabel.value = refRes.data.no || ""
        }
      } catch (e) {
        console.error("Gagal mengambil referensi doc:", e)
        selectedRefLabel.value = values.ref_id
      }
    }

    // Load and cache warehouse stock
    if (values.m_warehouse_id) {
      await fetchWarehouseStock()
    }

    // Fetch reference details to get qty_available
    const refDetailsMap = new Map<string, any>()
    if (values.ref_id && values.ref_table) {
      try {
        const refStockRes = await apiCall<{ status: string; data: any }>(
          `/fn/t_mtf/getMaterialsWithStock?ref_table=${values.ref_table}&ref_id=${values.ref_id}&m_warehouse_id=${values.m_warehouse_id || ''}&limit=100`
        )
        if (refStockRes.status === 'success' && Array.isArray(refStockRes.data)) {
          refStockRes.data.forEach((item: any) => {
            if (item.id) {
              refDetailsMap.set(item.id, item)
            }
          })
        }
      } catch (e) {
        console.error("Gagal mengambil info stok & qty referensi:", e)
      }
    }

    // Hydrate detail array items
    const rawDetails = raw.t_mtf_ds || raw.t_mtf_details || raw.t_mtf_d || []
    detailArr.value = rawDetails.map((row: any, idx: number) => {
      const mItemId = row.m_item_id ?? ""
      const refItem = refDetailsMap.get(row.ref_id)
      
      const qtyTrans = Number(row.qty_transfer || 0)
      // Since this MTF's own transfer is included in the backend's subtraction for `qty_available`,
      // the total available quantity for this row in this MTF is:
      // (remaining available) + (current transfer quantity)
      const qtyAvailableRemaining = refItem ? Number(refItem.qty_available ?? 0) : 0
      const qtyAvailable = qtyAvailableRemaining + qtyTrans

      const stock = refItem && refItem.qty_stock_asal !== undefined && refItem.qty_stock_asal !== null ? refItem.qty_stock_asal : (warehouseStockMap.value.get(mItemId) || 0)
      
      return {
        id: row.id,
        t_mtf_id: row.t_mtf_id,
        sequence: row.sequence ?? (idx + 1),
        ref_table: row.ref_table ?? (values.ref_table === 't_mrq' ? 't_mrq_d' : 't_ba_d'),
        ref_id: row.ref_id ?? '',
        m_item_id: mItemId,
        m_item: row.m_item || null,
        batch: row.batch || refItem?.batch || '',
        is_batch: Boolean(row.m_item?.is_batch || row.batch || refItem?.batch),
        qty_transfer: qtyTrans,
        uom_id: row.uom_id ?? '',
        uom: row.uom || row.m_general || null,
        notes: row.notes ?? '',
        qty_confirm: row.qty_confirm !== undefined && row.qty_confirm !== null ? Number(row.qty_confirm) : qtyTrans,
        reason_confirm: row.reason_confirm ?? '',
        qty_usage: row.qty_usage ?? null,
        qty_return: row.qty_return ?? null,
        qty_req_available: qtyAvailable,
        qty_stock: stock
      }
    })

    if (isCopyModeLocal) {
      values.id = ""
      values.no = ""
      values.status = "DRAFT"
      detailArr.value = detailArr.value.map(row => {
        const copy = { ...row }
        delete copy.id
        delete copy.t_mtf_id
        return copy
      })
      toast.success('Data berhasil disalin', {
        description: 'Silakan simpan sebagai Material Transfer baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Material Transfer', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    setTimeout(() => router.push('/production/transaksi/t_mtf'), 2000)
  } finally {
    loading.value = false
  }
}

onBeforeMount(loadData)

watch(
  () => [route.params.id, route.query.copy, route.query.source, route.name],
  loadData
)

// ============================================================================
// SAVE HANDLER & BUSINESS RULE VALIDATIONS
// ============================================================================
const onSave = async () => {
  // Clear error list
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  
  // Basic validation rules
  let invalid = false
  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Company / Unit Bisnis wajib diisi'; invalid = true }
  if (!values.date) { errors.date = 'Date wajib diisi'; invalid = true }
  if (!values.ref_table) { errors.ref_table = 'Reference Type wajib diisi'; invalid = true }
  if (!values.ref_id) { errors.ref_id = 'Reference transaction wajib diisi'; invalid = true }
  if (!values.to_warehouse_id) { errors.to_warehouse_id = 'To Warehouse wajib diisi'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  if (detailArr.value.length === 0) {
    toast.error('Gagal menyimpan', { description: 'Minimal harus ada 1 item material di daftar detail' })
    return
  }

  // Detail validation according to business rules
  for (let i = 0; i < detailArr.value.length; i++) {
    const item = detailArr.value[i]
    if (!item) continue
    const seq = item.sequence || (i + 1)
    
    if (isConfirmMode.value) {
      // Rule 5: Qty Confirm tidak boleh lebih dari Qty Transfer
      if (item.qty_confirm === undefined || item.qty_confirm === null || String(item.qty_confirm) === "") {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm wajib diisi' })
        return
      }
      const qtyConfVal = Number(item.qty_confirm)
      const qtyTransVal = Number(item.qty_transfer)
      
      if (qtyConfVal < 0) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm tidak boleh negatif' })
        return
      }
      
      if (qtyConfVal > qtyTransVal) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm tidak boleh melebihi Qty Transfer' })
        return
      }
      
      // Rule 6: Jika Qty Confirm kurang dari Qty Transfer, maka User wajib input alasannya
      if (qtyConfVal < qtyTransVal && !item.reason_confirm?.trim()) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Reason Confirm wajib diisi jika Qty Confirm lebih kecil dari Qty Transfer' })
        return
      }
    } else {
      // Creating or updating before Confirm mode (e.g. status === 'DRAFT' or status === 'POST' if editing draft before posting)
      if (item.qty_transfer === undefined || item.qty_transfer === null || String(item.qty_transfer) === "") {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Transfer wajib diisi' })
        return
      }
      
      const qtyTransVal = Number(item.qty_transfer)
      if (qtyTransVal <= 0) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Transfer harus bernilai positif' })
        return
      }
      
      // Rule 4: Qty Transfer tidak boleh melebihi Qty Req Available maupun Qty Stock di gudang asal
      if (qtyTransVal > Number(item.qty_req_available || 0)) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Transfer tidak boleh melebihi Qty Req Available (${item.qty_req_available})` })
        return
      }
      if (qtyTransVal > Number(item.qty_stock || 0)) {
        toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Transfer tidak boleh melebihi persediaan (Qty Stock: ${item.qty_stock}) di gudang asal` })
        return
      }
    }
  }

  loading.value = true
  try {
    const payload: Partial<MtfItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      no: values.no?.trim() || undefined,
      date: values.date || undefined,
      ref_table: values.ref_table as 't_mrq' | 't_ba',
      ref_id: values.ref_id || undefined,
      t_wo_id: values.t_wo_id || undefined,
      t_wo_d_item_id: values.t_wo_d_item_id || undefined,
      t_wo_sd_routing_id: values.t_wo_sd_routing_id || undefined,
      m_warehouse_id: values.m_warehouse_id || undefined,
      to_warehouse_id: values.to_warehouse_id || undefined,
      notes: values.notes?.trim() || undefined,
      status: values.status,
      created_by: isEditMode.value ? undefined : (authStore.user?.id || null),
      updated_by: authStore.user?.id || null,
      t_mtf_d: detailArr.value.map((row, index) => ({
        id: row.id,
        t_mtf_id: row.t_mtf_id,
        sequence: index + 1,
        ref_table: row.ref_table,
        ref_id: row.ref_id,
        m_item_id: row.m_item_id,
        batch: row.batch || undefined,
        qty_transfer: Number(row.qty_transfer),
        uom_id: row.uom_id,
        notes: row.notes?.trim() || undefined,
        qty_confirm: isConfirmMode.value ? Number(row.qty_confirm) : Number(row.qty_transfer),
        reason_confirm: row.reason_confirm?.trim() || undefined,
        qty_usage: row.qty_usage || undefined,
        qty_return: row.qty_return || undefined
      }))
    }
    
    if (isEditMode.value) {
      await updateMtf(menuId.value, payload)
      toast.success('Material Transfer berhasil diperbarui')
    } else {
      await createMtf(payload)
      toast.success('Material Transfer berhasil dibuat')
    }
    router.replace('/production/transaksi/t_mtf?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui data' : 'Gagal menyimpan data', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/production/transaksi/t_mtf')
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
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ pageDescription }}
        </p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Header Material Transfer</CardTitle>
          <CardDescription>
            Informasi umum transaksi transfer persediaan
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Unit Bisnis (Select) - First -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="true"
              :disabled="loading || isReadOnly || isConfirmMode || isUnitBisnisReadonly"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="!isUnitBisnisReadonly"
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
              placeholder="Pilih Unit Bisnis"
              @input="(v) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
            />

            <!-- Company / Unit Bisnis Display (Readonly) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- No Transfer -->
            <FieldX
              id="no"
              label="No Transfer"
              :value="values.no || 'Auto Generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generate"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Date -->
            <FieldX
              id="date"
              label="Date"
              :value="values.date"
              :errorname="errors.date ? 'failed' : ''"
              :hints="errors.date || 'Tanggal pengiriman barang'"
              :required="true"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              type="date"
              @input="(v) => (values.date = v)"
            />

            <!-- Reference Table Type (Radio Buttons) -->
            <FieldRadio
              id="ref_table"
              label="Referensi"
              :modelValue="values.ref_table"
              :errorname="errors.ref_table ? 'failed' : ''"
              :hints="errors.ref_table"
              :required="true"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :options="[
                { label: 'Material Request', value: 't_mrq' },
                { label: 'Berita Acara', value: 't_ba' }
              ]"
              @update:modelValue="(v) => {
                values.ref_table = v;
                handleRefSelected(null);
              }"
            />

            <!-- Reference Transaction Document (ref_id) -->
            <FieldPopup
              id="ref_id"
              label="No Reference"
              :value="values.ref_id"
              :errorText="errors.ref_id ? 'failed' : ''"
              :hints="errors.ref_id || 'Pilih dokumen transaksi referensi yang sudah Approved'"
              :required="true"
              :disabled="loading || isReadOnly || !values.ref_table || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="true"
              :display-value="selectedRefLabel"
              :api="refApi"
              valueField="id"
              displayField="no"
              placeholder="Pilih Dokumen Referensi"
              :columns="refColumns"
              @input="(v) => (values.ref_id = v)"
              @update:valueFull="handleRefSelected"
            />

            <!-- No WO (Readonly - filled from reference) -->
            <FieldX
              id="wo_display"
              label="No WO"
              :value="selectedWoLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Item (Readonly - filled from reference) -->
            <FieldX
              id="item_display"
              label="Item"
              :value="selectedWoItemLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Routing (Readonly - filled from reference) -->
            <FieldX
              id="routing_display"
              label="Routing"
              :value="selectedWoRoutingLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Origin Warehouse (Readonly - filled from reference) -->
            <FieldX
              id="warehouse_display"
              label="Warehouse (Gudang Asal)"
              :value="selectedWarehouseLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- To Warehouse (Select Warehouse with flag = 'PROD') -->
            <FieldSelect
              id="to_warehouse_id"
              label="To Warehouse (Gudang Produksi)"
              :value="values.to_warehouse_id"
              :errorText="errors.to_warehouse_id ? 'failed' : ''"
              :hints="errors.to_warehouse_id || 'Pilih gudang produksi tujuan'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="true"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'kode_gudang,nama_gudang',
                  filter_column_flag: 'PROD',
                  filter_column_is_active: true,
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
                },
              }"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Gudang Produksi"
              @input="(v) => (values.to_warehouse_id = v)"
            />

            <!-- Notes -->
            <div class="md:col-span-2">
              <FieldTextarea
                id="notes"
                label="Notes"
                v-model="values.notes"
                :disabled="loading || isReadOnly || isConfirmMode"
                :readonly="isReadOnly || isConfirmMode"
                placeholder="Catatan atau keterangan tambahan..."
                class="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="material-details" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="material-details">Material Details</TabsTrigger>
        </TabsList>

        <TabsContent value="material-details" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Material</CardTitle>
                  <CardDescription>Kelola detail persediaan material yang ditransfer</CardDescription>
                </div>
                <!-- Popup MultiSelect Button (Disabled in confirm/view mode or if no reference selected) -->
                <ButtonMultiSelect
                  v-if="!isReadOnly && !isConfirmMode"
                  title="Pilih Material"
                  :disabled="loading || !values.ref_id"
                  @add="handleMaterialsAdded"
                  :api="detailMultiSelectApi"
                  :columns="detailMultiSelectColumns"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th class="px-4 py-3 text-left w-12">No</th>
                      <th class="px-4 py-3 text-left">Kode Material</th>
                      <th class="px-4 py-3 text-left min-w-[200px]">Nama Material</th>
                      <th class="px-4 py-3 text-left w-36">Batch</th>
                      <th class="px-4 py-3 text-right w-32">Qty Req Available</th>
                      <th class="px-4 py-3 text-right w-32">Qty Stock (Asal)</th>
                      <th class="px-4 py-3 text-right w-36">Qty Transfer</th>
                      <th class="px-4 py-3 text-left w-24">Unit</th>
                      <th class="px-4 py-3 text-left min-w-[150px]">Keterangan</th>
                      <th v-if="isConfirmMode || isReadOnly" class="px-4 py-3 text-right w-36">Qty Confirm</th>
                      <th v-if="isConfirmMode || isReadOnly" class="px-4 py-3 text-left min-w-[200px]">Reason Confirm</th>
                      <th v-if="!isReadOnly && !isConfirmMode" class="px-2 py-3 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="detailArr.length === 0">
                      <td :colspan="(!isReadOnly && !isConfirmMode) ? 10 : 11" class="text-center py-8 text-muted-foreground">
                        Belum ada material dipilih. Klik "Pilih Material" untuk mengambil data dari referensi.
                      </td>
                    </tr>
                    <tr v-for="(detail, idx) in detailArr" :key="detail.id || idx" class="hover:bg-slate-50/50">
                      <!-- Sequence -->
                      <td class="px-4 py-3 text-slate-700">{{ idx + 1 }}</td>
                      
                      <!-- Material Code -->
                      <td class="px-4 py-3 font-medium text-slate-900">
                        {{ detail.m_item?.kode_item || detail.m_item?.kode || '-' }}
                      </td>
                      
                      <!-- Material Name -->
                      <td class="px-4 py-3 text-slate-700">
                        {{ detail.m_item?.nama_item || detail.m_item?.nama || '-' }}
                      </td>
                      
                      <!-- Batch -->
                      <td class="px-4 py-3 text-slate-700">
                        <span v-if="detail.batch || detail.is_batch" class="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {{ detail.batch || '-' }}
                        </span>
                        <span v-else class="text-muted-foreground text-xs">
                          -
                        </span>
                      </td>
                      
                      <!-- Qty Req Available -->
                      <td class="px-4 py-3 text-right font-mono text-slate-600">
                        {{ detail.qty_req_available }}
                      </td>
                      
                      <!-- Qty Stock (Origin Warehouse) -->
                      <td class="px-4 py-3 text-right font-mono text-slate-600">
                        {{ detail.qty_stock }}
                      </td>
                      
                      <!-- Qty Transfer (Editable in DRAFT) -->
                      <td class="px-4 py-3 text-right">
                        <input
                          v-if="!isReadOnly && !isConfirmMode"
                          type="number"
                          v-model.number="detail.qty_transfer"
                          class="w-full text-right px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
                          step="0.01"
                          min="0"
                        />
                        <span v-else class="font-mono text-slate-700">{{ detail.qty_transfer }}</span>
                      </td>
                      
                      <!-- Unit (UOM) -->
                      <td class="px-4 py-3 text-slate-600">
                        {{ detail.m_item?.mi_uom?.value1 || detail.m_general?.value1 || detail.uom?.value1 || '-' }}
                      </td>
                      
                      <!-- Notes -->
                      <td class="px-4 py-3">
                        <input
                          v-if="!isReadOnly && !isConfirmMode"
                          type="text"
                          v-model="detail.notes"
                          class="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                          placeholder="Catatan baris..."
                        />
                        <span v-else class="text-slate-600">{{ detail.notes || '-' }}</span>
                      </td>

                      <!-- Qty Confirm (Editable in Confirm mode) -->
                      <td v-if="isConfirmMode || isReadOnly" class="px-4 py-3 text-right">
                        <input
                          v-if="isConfirmMode"
                          type="number"
                          v-model.number="detail.qty_confirm"
                          class="w-full text-right px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
                          step="0.01"
                          min="0"
                        />
                        <span v-else class="font-mono text-slate-700">{{ detail.qty_confirm }}</span>
                      </td>

                      <!-- Reason Confirm (Editable in Confirm mode) -->
                      <td v-if="isConfirmMode || isReadOnly" class="px-4 py-3">
                        <input
                          v-if="isConfirmMode"
                          type="text"
                          v-model="detail.reason_confirm"
                          class="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                          placeholder="Isi jika Qty Confirm < Qty Transfer"
                        />
                        <span v-else class="text-slate-600">{{ detail.reason_confirm || '-' }}</span>
                      </td>
                      
                      <!-- Action Delete -->
                      <td v-if="!isReadOnly && !isConfirmMode" class="px-2 py-3 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
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

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isConfirmMode ? 'Confirm Transfer' : (isEditMode ? 'Perbarui' : 'Simpan') }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari, Opera */
}
</style>