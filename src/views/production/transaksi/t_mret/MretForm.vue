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
  createMret,
  updateMret,
  getMretById,
  type MretItem,
  type MretDetailItem
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
const isEditMode = computed(() => !!route.params.id && route.name === 'MretForm')
const isViewMode = computed(() => route.name === 'MretView')
const copySourceId = computed(() => {
  const source = route.query.copy || route.query.source;
  return Array.isArray(source) ? source[0] : source;
});
const isCopyMode = computed(() => !!copySourceId.value)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()))
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Material Return'
  if (isCopyMode.value) return 'Salin Material Return'
  if (isEditMode.value) return 'Edit Material Return'
  return 'Tambah Material Return Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Material Return'
  if (isCopyMode.value) return 'Buat Material Return baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Material Return'
  return 'Buat Material Return baru untuk memindahkan persediaan'
})

// Header values matching DB schema
const values = reactive({
  id: '',
  m_unit_bisnis_id: '',
  no: '',
  date: new Date().toISOString().split('T')[0],
  t_wo_id: '',
  t_mtf_id: '',
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
const selectedWoLabel = ref("")
const selectedMtfLabel = ref("")
const selectedWoItemLabel = ref("")
const selectedWoRoutingLabel = ref("")
const selectedWarehouseLabel = ref("")
const selectedUnitBisnisCompanyName = ref("")

// Detail array
const detailArr = ref<MretDetailItem[]>([])

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  t_wo_id: '',
  t_mtf_id: '',
  to_warehouse_id: ''
})

// Check if user is in confirmation mode (status is POST and they are editing)
const isConfirmMode = computed(() => {
  return values.status === 'POST' && !isReadOnly.value
})

// ============================================================================
// COMPUTED API CONFIGS
// ============================================================================
const woApi = computed(() => {
  const params: any = {
    searchfield: 'no,notes',
    order_by: 'no',
    order_type: 'DESC',
    join: 'true',
    filter_column_status: 'APPROVED',
    include: 'm_customer,t_wo_d_item@t_wo_d_items>t_sales_order,t_wo_d_item@t_wo_d_items>t_io'
  }
  if (values.m_unit_bisnis_id) {
    params.filter_column_m_unit_bisnis_id = values.m_unit_bisnis_id
  }
  return {
    url: `${API_BASE_URL}/dynamic/t_wo`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params
  }
})

const woColumns = [
  { field: 'no', headerName: 'No WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { 
    field: 'so_io', 
    headerName: 'No SO/IO', 
    width: '150px', 
    valueGetter: (params: any) => {
      const row = params.data
      return row.t_wo_d_items?.[0]?.t_sales_order?.no || row.t_wo_d_items?.[0]?.t_io?.no || '-'
    }
  },
  { field: 'm_customer.nama_customer', headerName: 'Customer', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' }
]

const mtfApi = computed(() => {
  if (!values.t_wo_id) return undefined
  return {
    url: `${API_BASE_URL}/dynamic/t_mtf`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      searchfield: 'no,notes',
      order_by: 'no',
      order_type: 'DESC',
      join: 'true',
      filter_column_status: 'CONFIRM',
      filter_column_t_wo_id: values.t_wo_id,
      include: 't_wo_d_item>m_items,t_wo_sd_routing>m_routing,m_gudang'
    }
  }
})

const mtfColumns = [
  { field: 'no', headerName: 'No Mat Transfer', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { 
    field: 'item_name', 
    headerName: 'Item', 
    width: '180px', 
    sortable: true,
    valueGetter: (params: any) => {
      const row = params.data
      return row.t_wo_d_item?.m_items?.nama_item || row.t_wo_d_item?.m_item?.nama_item || '-'
    }
  },
  { 
    field: 'routing_code', 
    headerName: 'Routing', 
    width: '150px', 
    sortable: true,
    valueGetter: (params: any) => {
      const row = params.data
      return row.t_wo_sd_routing?.m_routing?.code || '-'
    }
  },
  { field: 'm_gudang.nama_gudang', headerName: 'To Warehouse', width: '180px', sortable: true }
]

const detailMultiSelectApi = computed(() => {
  if (!values.t_mtf_id) return undefined
  
  return {
    url: `${API_BASE_URL}/fn/t_mret/getMtfDetailsForReturn`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`
    },
    params: {
      t_mtf_id: values.t_mtf_id,
    }
  }
})

const detailMultiSelectColumns = [
  { field: 'tipe_material', headerName: 'Tipe Material', width: '130px', sortable: true },
  { field: 'item_code', headerName: 'Kode Material', width: '130px', sortable: true, filterable: true },
  { field: 'item_name', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true },
  { field: 'uom_name', headerName: 'UOM', width: '100px' },
  { field: 'qty_transfer_confirm', headerName: 'Qty Transfer Confirm', width: '150px' },
  { field: 'qty_usage', headerName: 'Qty Usage', width: '120px' },
  { field: 'qty_available', headerName: 'Qty Available', width: '120px' },
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
    if (res.status === 'success' && res.data) {
      const rObj = res.data
      selectedWoRoutingLabel.value = rObj.m_routing ? `${rObj.m_routing.code || '-'} (${rObj.m_item?.kode_item || '-'})` : id
    }
  } catch (e) {
    selectedWoRoutingLabel.value = id
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

// ============================================================================
// EVENT HANDLERS
// ============================================================================
const handleWoSelected = (item: any) => {
  if (item) {
    values.t_wo_id = item.id
    selectedWoLabel.value = item.no || ""
  } else {
    values.t_wo_id = ""
    selectedWoLabel.value = ""
  }
  // Clear dependent selectors
  handleMtfSelected(null)
}

const handleMtfSelected = (item: any) => {
  if (item) {
    values.t_mtf_id = item.id
    selectedMtfLabel.value = item.no || ""

    // Auto-fill header fields
    values.t_wo_d_item_id = item.t_wo_d_item_id || ""
    values.t_wo_sd_routing_id = item.t_wo_sd_routing_id || ""
    values.m_warehouse_id = item.to_warehouse_id || "" // Gudang Tujuan Transfer (Gudang Produksi)

    // Set display labels
    if (item.t_wo_d_item) {
      const it = item.t_wo_d_item
      selectedWoItemLabel.value = it.m_items?.kode_item || it.m_item?.kode_item ? `${it.m_items?.kode_item || it.m_item?.kode_item || '-'} - ${it.m_items?.nama_item || it.m_item?.nama_item || '-'}` : ""
    } else {
      selectedWoItemLabel.value = ""
    }

    if (item.t_wo_sd_routing) {
      const rt = item.t_wo_sd_routing
      selectedWoRoutingLabel.value = rt.m_routing ? `${rt.m_routing.code || '-'} (${rt.m_item?.kode_item || '-'})` : ""
    } else {
      selectedWoRoutingLabel.value = ""
    }

    selectedWarehouseLabel.value = item.m_gudang?.nama_gudang || ""
  } else {
    values.t_mtf_id = ""
    selectedMtfLabel.value = ""
    values.t_wo_d_item_id = ""
    values.t_wo_sd_routing_id = ""
    values.m_warehouse_id = ""

    selectedWoItemLabel.value = ""
    selectedWoRoutingLabel.value = ""
    selectedWarehouseLabel.value = ""
  }
  
  // Clear details array upon changing reference header
  detailArr.value = []
}

const handleMaterialsAdded = (items: any[]) => {
  items.forEach(item => {
    // Prevent duplicate entries of the same material detail ID
    if (!detailArr.value.find((d: any) => d.t_mtf_d_id === item.t_mtf_d_id)) {
      detailArr.value.push({
        sequence: detailArr.value.length + 1,
        t_mtf_d_id: item.t_mtf_d_id,
        m_item_id: item.m_item_id,
        batch: item.batch || '',
        is_batch: Boolean(item.is_batch),
        qty_return: 0, // default 0, user wajib input sendiri
        unit_id: item.uom_id,
        notes: '',

        // Relational details for display in the table
        item_code: item.item_code,
        item_name: item.item_name,
        uom_name: item.uom_name,
        qty_transfer_confirm: item.qty_transfer_confirm,
        qty_usage: item.qty_usage,
        qty_available: item.qty_available
      })
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
    t_wo_id: '',
    t_mtf_id: '',
    t_wo_d_item_id: '',
    t_wo_sd_routing_id: '',
    m_warehouse_id: '',
    to_warehouse_id: '',
    notes: '',
    status: 'DRAFT',
    confirmed_by: null,
    confirmed_at: null
  })

  selectedWoLabel.value = ""
  selectedMtfLabel.value = ""
  selectedWoItemLabel.value = ""
  selectedWoRoutingLabel.value = ""
  selectedWarehouseLabel.value = ""
  selectedUnitBisnisCompanyName.value = ""

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
    const res = await getMretById(sourceId)
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
    values.t_mtf_id = raw.t_mtf_id ?? ""
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
    selectedMtfLabel.value = raw.t_mtf?.no || ""
    
    if (raw.t_wo_d_item) {
      const item = raw.t_wo_d_item
      selectedWoItemLabel.value = item.m_items?.kode_item || item.m_item?.kode_item ? `${item.m_items?.kode_item || item.m_item?.kode_item || '-'} - ${item.m_items?.nama_item || item.m_item?.nama_item || '-'}` : ""
    } else {
      selectedWoItemLabel.value = ""
    }
    
    if (raw.t_wo_sd_routing) {
      const rObj = raw.t_wo_sd_routing
      selectedWoRoutingLabel.value = rObj.m_routing ? `${rObj.m_routing.code || '-'} (${rObj.m_item?.kode_item || '-'})` : ""
    } else {
      selectedWoRoutingLabel.value = ""
    }
    
    selectedWarehouseLabel.value = raw.m_gudang?.nama_gudang || raw.m_gudang?.nama || ""

    // Hydrate detail array items
    const rawDetails = raw.t_mret_ds || raw.t_mret_details || raw.t_mret_d || []
    detailArr.value = rawDetails.map((row: any, idx: number) => {
      const qtyConfirm = Number(row.t_mtf_d?.qty_confirm !== null && row.t_mtf_d?.qty_confirm !== undefined ? row.t_mtf_d.qty_confirm : row.t_mtf_d?.qty_transfer || 0)
      const qtyUsage = Number(row.t_mtf_d?.qty_usage || 0)
      const qtyAlreadyReturned = Number(row.t_mtf_d?.qty_return || 0)
      const qtyAvailable = Math.max(0, qtyConfirm - qtyUsage - (qtyAlreadyReturned - Number(row.qty_return || 0)))

      return {
        id: row.id,
        t_mret_id: row.t_mret_id,
        sequence: row.sequence ?? (idx + 1),
        t_mtf_d_id: row.t_mtf_d_id,
        m_item_id: row.m_item_id,
        qty_return: Number(row.qty_return || 0),
        unit_id: row.unit_id,
        notes: row.notes || '',

        // Relational fields for UI
        item_code: row.m_items?.kode_item || row.m_item?.kode_item || '-',
        item_name: row.m_items?.nama_item || row.m_item?.nama_item || '-',
        batch: row.batch || '',
        is_batch: Boolean(row.m_items?.is_batch || row.m_item?.is_batch),
        uom_name: row.m_general?.value1 || row.uom?.value1 || '-',
        qty_transfer_confirm: qtyConfirm,
        qty_usage: qtyUsage,
        qty_already_returned: qtyAlreadyReturned,
        qty_available: qtyAvailable
      }
    })

    if (isCopyModeLocal) {
      values.id = ""
      values.no = ""
      values.status = "DRAFT"
      detailArr.value = detailArr.value.map(row => {
        const copy = { ...row }
        delete copy.id
        delete copy.t_mret_id
        return copy
      })
      toast.success('Data berhasil disalin', {
        description: 'Silakan simpan sebagai Material Return baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Material Return', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    setTimeout(() => router.push('/production/transaksi/t_mret'), 2000)
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
  if (!values.t_wo_id) { errors.t_wo_id = 'No WO wajib diisi'; invalid = true }
  if (!values.t_mtf_id) { errors.t_mtf_id = 'No Mat Transfer wajib diisi'; invalid = true }
  if (!values.to_warehouse_id) { errors.to_warehouse_id = 'To Warehouse wajib diisi'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  if (detailArr.value.length === 0) {
    toast.error('Gagal menyimpan', { description: 'Minimal harus ada 1 item material di daftar detail' })
    return
  }

  for (let i = 0; i < detailArr.value.length; i++) {
    const item = detailArr.value[i]
    if (!item) continue
    const seq = item.sequence || (i + 1)
    
    if (item.qty_return === undefined || item.qty_return === null || String(item.qty_return) === "") {
      toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Return wajib diisi' })
      return
    }
    
    const qtyReturnVal = Number(item.qty_return)
    if (qtyReturnVal <= 0) {
      toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Return harus bernilai positif' })
      return
    }
    
    // Qty Return tidak boleh melebihi Qty Available Return
    const qtyAvailableVal = Number(item.qty_available ?? 0)
    if (qtyReturnVal > qtyAvailableVal) {
      toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Return tidak boleh melebihi Qty Available Return (${qtyAvailableVal})` })
      return
    }
  }

  loading.value = true
  try {
    const payload: Partial<MretItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      no: values.no?.trim() || undefined,
      date: values.date || undefined,
      t_wo_id: values.t_wo_id || undefined,
      t_mtf_id: values.t_mtf_id || undefined,
      t_wo_d_item_id: values.t_wo_d_item_id || undefined,
      t_wo_sd_routing_id: values.t_wo_sd_routing_id || undefined,
      m_warehouse_id: values.m_warehouse_id || undefined,
      to_warehouse_id: values.to_warehouse_id || undefined,
      notes: values.notes?.trim() || undefined,
      status: values.status,
      t_mret_d: detailArr.value.map((row, index) => ({
        id: row.id,
        t_mret_id: row.t_mret_id,
        sequence: index + 1,
        t_mtf_d_id: row.t_mtf_d_id,
        m_item_id: row.m_item_id,
        batch: row.batch || undefined,
        qty_return: Number(row.qty_return),
        unit_id: row.unit_id,
        notes: row.notes?.trim() || undefined
      }))
    }
    
    if (isEditMode.value) {
      await updateMret(menuId.value, payload)
      toast.success('Material Return berhasil diperbarui')
    } else {
      await createMret(payload)
      toast.success('Material Return berhasil dibuat')
    }
    router.replace('/production/transaksi/t_mret?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui data' : 'Gagal menyimpan data', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/production/transaksi/t_mret')
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
          <CardTitle>Header Material Return</CardTitle>
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

            <!-- No Transfer (Material Return No) -->
            <FieldX
              id="no"
              label="Material Return No"
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
              :hints="errors.date || 'Tanggal return barang'"
              :required="true"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              type="date"
              @input="(v) => (values.date = v)"
            />

            <!-- No WO Popup -->
            <FieldPopup
              id="t_wo_id"
              label="No WO"
              :value="values.t_wo_id"
              :errorText="errors.t_wo_id ? 'failed' : ''"
              :hints="errors.t_wo_id || 'Pilih Work Order yang status Approved'"
              :required="true"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedWoLabel"
              :api="woApi"
              valueField="id"
              displayField="no"
              placeholder="Pilih Work Order"
              :columns="woColumns"
              @input="(v) => (values.t_wo_id = v)"
              @update:valueFull="handleWoSelected"
            />

            <!-- No Mat Transfer Popup -->
            <FieldPopup
              id="t_mtf_id"
              label="No Mat Transfer"
              :value="values.t_mtf_id"
              :errorText="errors.t_mtf_id ? 'failed' : ''"
              :hints="errors.t_mtf_id || 'Pilih Material Transfer'"
              :required="true"
              :disabled="loading || isReadOnly || !values.t_wo_id"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedMtfLabel"
              :api="mtfApi"
              valueField="id"
              displayField="no"
              placeholder="Pilih Material Transfer"
              :columns="mtfColumns"
              @input="(v) => (values.t_mtf_id = v)"
              @update:valueFull="handleMtfSelected"
            />

            <!-- Item (Readonly - auto-filled from Mat Transfer) -->
            <FieldX
              id="item_display"
              label="Item"
              :value="selectedWoItemLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Routing (Readonly - auto-filled from Mat Transfer) -->
            <FieldX
              id="routing_display"
              label="Routing"
              :value="selectedWoRoutingLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Origin Warehouse (Readonly - auto-filled from Mat Transfer) -->
            <FieldX
              id="warehouse_display"
              label="Warehouse (Gudang Asal)"
              :value="selectedWarehouseLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- To Warehouse (Select Warehouse with flag = 'INV') -->
            <FieldSelect
              id="to_warehouse_id"
              label="To Warehouse (Gudang Bahan)"
              :value="values.to_warehouse_id"
              :errorText="errors.to_warehouse_id ? 'failed' : ''"
              :hints="errors.to_warehouse_id || 'Pilih gudang inventory tujuan'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
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
                  filter_column_flag: 'INV',
                  filter_column_is_active: true,
                },
              }"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Gudang Bahan"
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
                  :disabled="loading || !values.t_mtf_id"
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
                      <th class="px-4 py-3 text-right w-36">Qty Transfer Confirm</th>
                      <th class="px-4 py-3 text-right w-32">Qty Usage</th>
                      <th class="px-4 py-3 text-right w-36">Qty Available Return</th>
                      <th class="px-4 py-3 text-right w-36">Qty Return <span class="text-destructive">*</span></th>
                      <th class="px-4 py-3 text-left w-24">Unit</th>
                      <th class="px-4 py-3 text-left min-w-[150px]">Catatan / Keterangan</th>
                      <th v-if="!isReadOnly" class="px-2 py-3 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="detailArr.length === 0">
                      <td colspan="11" class="text-center py-8 text-muted-foreground">
                        Belum ada material dipilih. Klik "Pilih Material" untuk mengambil data dari referensi.
                      </td>
                    </tr>
                    <tr v-for="(detail, idx) in detailArr" :key="detail.id || idx" class="hover:bg-slate-50/50">
                      <!-- Sequence -->
                      <td class="px-4 py-3 text-slate-700">{{ idx + 1 }}</td>
                      
                      <!-- Material Code -->
                      <td class="px-4 py-3 font-mono text-slate-900">
                        {{ detail.item_code || detail.m_item?.kode_item || '-' }}
                      </td>
                      
                      <!-- Material Name -->
                      <td class="px-4 py-3 text-slate-700">
                        {{ detail.item_name || detail.m_item?.nama_item || '-' }}
                      </td>
                      
                      <!-- Batch -->
                      <td class="px-4 py-3 text-slate-700">
                        <span v-if="detail.is_batch" class="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {{ detail.batch || '-' }}
                        </span>
                        <span v-else class="text-muted-foreground text-xs">
                          -
                        </span>
                      </td>
                      
                      <!-- Qty Transfer Confirm -->
                      <td class="px-4 py-3 text-right font-mono text-slate-600">
                        {{ detail.qty_transfer_confirm ?? '-' }}
                      </td>
                      
                      <!-- Qty Usage -->
                      <td class="px-4 py-3 text-right font-mono text-slate-600">
                        {{ detail.qty_usage ?? '-' }}
                      </td>

                      <!-- Qty Available Return -->
                      <td class="px-4 py-3 text-right font-mono text-slate-600">
                        {{ detail.qty_available ?? '-' }}
                      </td>
                      
                      <!-- Qty Return (Editable in DRAFT) -->
                      <td class="px-4 py-3 text-right">
                        <input
                          v-if="!isReadOnly"
                          type="number"
                          v-model.number="detail.qty_return"
                          class="w-full text-right px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
                          step="0.01"
                          min="0"
                        />
                        <span v-else class="font-mono text-slate-700">{{ detail.qty_return }}</span>
                      </td>
                      
                      <!-- Unit (UOM) -->
                      <td class="px-4 py-3 text-slate-600">
                        {{ detail.uom_name || detail.m_item?.mi_uom?.value1 || '-' }}
                      </td>
                      
                      <!-- Notes -->
                      <td class="px-4 py-3">
                        <input
                          v-if="!isReadOnly"
                          type="text"
                          v-model="detail.notes"
                          class="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                          placeholder="Catatan baris..."
                        />
                        <span v-else class="text-slate-600">{{ detail.notes || '-' }}</span>
                      </td>
                      
                      <!-- Action Delete -->
                      <td v-if="!isReadOnly" class="px-2 py-3 text-center">
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