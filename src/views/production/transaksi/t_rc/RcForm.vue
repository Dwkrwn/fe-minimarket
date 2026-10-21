<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldX, FieldSelect } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { Trash2, ArrowLeft, Save, Loader2, Plus } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { apiCall } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import {
  createRc,
  updateRc,
  getRcById,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'RcForm')
const isViewMode = computed(() => route.name === 'RcView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isConfirmMode = computed(() => (values.status || '').toUpperCase() === 'POST' && !isViewMode.value && route.meta.readOnly !== true)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || (values.status || '').toUpperCase() === 'RECEIVED')
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value || isConfirmMode.value)
const menuId = computed(() => route.params.id as string)

// Display labels
const selectedUnitBisnisLabel = ref('')
const selectedUnitBisnisCompanyName = ref('')
const selectedWarehouseProductionLabel = ref('')
const selectedWarehouseConfirmLabel = ref('')

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
  if (isViewMode.value) return 'Detail Result Confirmation'
  if (isCopyMode.value) return 'Salin Result Confirmation'
  if (isConfirmMode.value) return 'Konfirmasi Penerimaan Result Confirmation'
  if (isEditMode.value) return 'Edit Result Confirmation'
  return 'Tambah Result Confirmation'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Result Confirmation'
  if (isCopyMode.value) return 'Buat data Result Confirmation baru dari data yang disalin'
  if (isConfirmMode.value) return 'Input Qty Received untuk konfirmasi penerimaan Result Confirmation'
  if (isEditMode.value) return 'Perbarui data Result Confirmation'
  return 'Buat data Result Confirmation baru'
})

// Form values
let values = reactive({
  group: '',
  key1: new Date().toISOString().split('T')[0],
  m_unit_bisnis_id: '',
  code: '',   // flag: ditentukan otomatis dari Production Result yang dipilih
  value1: '',
  value2: '',
  value3: '',
  status: 'DRAFT',
  is_active: true
})

// Temp penampung data API
let initialValues: Record<string, any> = {}

// Detail array — Production Results yang dipilih
const detailArr = ref<any[]>([])

// ============================================================================
// WAREHOUSE API CONFIG — filter berdasarkan flag gudang
// ============================================================================
// Warehouse Production: flag = 'PROD'
const warehouseProdApiConfig = computed(() => ({
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
}))

// Warehouse Confirmation (To Warehouse): flag = 'INV'
const warehouseInvApiConfig = computed(() => ({
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
}))

// ============================================================================
// PRODUCTION RESULT PICKER — ButtonMultiSelect config
// ============================================================================

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
  const flag = values.code || 'FG'
  const params: Record<string, any> = {
    join: 'all,sub',
    no_pagination: 'true',
    filter_column_status: 'POST',
    searchfield: 'no',
    filter_column_flag: flag,
    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
    ...(values.value1 ? { filter_column_to_warehouse_id: values.value1 } : {}),
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

// IDs pres yang sudah ada di detail (untuk excludeIds agar tidak dobel pilih)
const existingPresIds = computed(() =>
  [...new Set(detailArr.value.map((d: any) => d.t_pres_id).filter(Boolean))]
)

// Handler saat user klik "Tambahkan" di ButtonMultiSelect
const handlePresAdded = (selectedItems: any[]) => {
  selectedItems.forEach((pres: any) => {
    const presFlag = pres.flag || 'FG'

    // Set flag dari item pertama yang ditambahkan.
    // Reset warehouse hanya jika flag berubah (bukan saat pertama kali isi).
    if (detailArr.value.length === 0) {
      if (values.code && values.code !== presFlag) {
        values.value1 = ''
        values.value2 = ''
        selectedWarehouseProductionLabel.value = ''
        selectedWarehouseConfirmLabel.value = ''
        toast.info(`Flag diubah ke ${presFlag}. Warehouse direset.`)
      }
      values.code = presFlag
    }

    const details: any[] = pres.t_pres_d_items || []
    if (details.length > 0) {
      details.forEach((dItem: any) => {
        const key = `${pres.id}_${dItem.id}`
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
          const whId = values.value1 || (values as any).m_warehouse_id
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
          qty_result: 0,
          qty_confirmed: 0,
          qty_available: 0,
          qty_confirm: 0,
          unit_id: null,
          uom: '-',
          notes: '',
        })
      }
    }
  })

  const count = selectedItems.length
  toast.success(`${count} Production Result berhasil ditambahkan`)
}

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail dihapus')
}

// ============================================================================
// RESET FORM
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    group: '',
    key1: new Date().toISOString().split('T')[0],
    m_unit_bisnis_id: '',
    code: '',
    value1: '',
    value2: '',
    value3: '',
    status: 'DRAFT',
    is_active: true
  })
  selectedUnitBisnisLabel.value = ''
  selectedUnitBisnisCompanyName.value = ''
  selectedWarehouseProductionLabel.value = ''
  selectedWarehouseConfirmLabel.value = ''
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  detailArr.value = []
}

// ============================================================================
// UNIT BISNIS HANDLER
// ============================================================================
const handleUnitBisnisSelected = (obj: any) => {
  if (obj) {
    selectedUnitBisnisLabel.value = obj.nama_comp || obj.kode_unit_bisnis || ''
    const compName = obj.m_company?.nama || obj.nama_company || ''
    if (compName) {
      selectedUnitBisnisCompanyName.value = compName
    } else {
      fetchUnitBisnisCompanyName(obj.id)
    }
  } else {
    values.m_unit_bisnis_id = ''
    selectedUnitBisnisLabel.value = ''
    selectedUnitBisnisCompanyName.value = ''
  }
}

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) { selectedUnitBisnisCompanyName.value = ''; return }
  try {
    const res = await fetch(`${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
    })
    const result = await res.json()
    if (result?.status === 'success' && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama || result.data?.m_company?.kode || result.data?.nama_comp || '-'
    }
  } catch (err) { console.error('Gagal mengambil nama company:', err) }
}

// ============================================================================
// WAREHOUSE HANDLERS
// ============================================================================
const handleWarehouseProductionSelected = (obj: any) => {
  if (obj) {
    selectedWarehouseProductionLabel.value = obj.nama_gudang || obj.kode_gudang || ''
  } else {
    values.value1 = ''
    selectedWarehouseProductionLabel.value = ''
  }
}

const handleWarehouseConfirmSelected = (obj: any) => {
  if (obj) {
    selectedWarehouseConfirmLabel.value = obj.nama_gudang || obj.kode_gudang || ''
  } else {
    values.value2 = ''
    selectedWarehouseConfirmLabel.value = ''
  }
}

const fetchWarehouseLabel = async (gudangId: string, target: 'production' | 'confirm') => {
  if (!gudangId) return
  try {
    const res = await fetch(`${API_BASE_URL}/dynamic/m_gudang/${gudangId}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
    })
    const result = await res.json()
    if (result?.status === 'success' && result.data) {
      const label = result.data.nama_gudang || result.data.kode_gudang || ''
      if (target === 'production') selectedWarehouseProductionLabel.value = label
      else selectedWarehouseConfirmLabel.value = label
    }
  } catch (err) { console.error('Gagal mengambil nama gudang:', err) }
}

// Handler ketika flag berubah — clear warehouse & detail agar tidak salah flag
const handleFlagChange = (newFlag: string) => {
  if (newFlag !== values.code) {
    values.value1 = ''
    values.value2 = ''
    selectedWarehouseProductionLabel.value = ''
    selectedWarehouseConfirmLabel.value = ''
    detailArr.value = []
    toast.info(`Flag diubah ke ${newFlag}. Warehouse dan detail direset.`)
  }
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset()

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    applyCurrentUserUnitBisnis()
    return
  }

  loading.value = true
  try {
    const res = await getRcById(sourceId)
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

    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Load detail
    const detailsRaw = initialValues.t_rc_ds || initialValues.t_rc_d || initialValues.t_rc_details || []
    if (detailsRaw && detailsRaw.length) {
      detailArr.value = detailsRaw.map((d: any) => {
        const rawBatch = d.batch && d.batch !== '-' ? d.batch : (d.t_pres_d_item?.batch && d.t_pres_d_item.batch !== '-' ? d.t_pres_d_item.batch : '')
        const isBatch = Boolean(d.is_batch ?? d.m_item?.is_batch ?? d.m_items?.is_batch ?? d.t_pres_d_item?.is_batch ?? d.t_pres_d_item?.m_item?.is_batch ?? rawBatch)
        const qtyConfirmVal = Number(d.qty_confirm ?? 0)
        const row = reactive({
          id: d.id || undefined,
          t_pres_id: d.t_pres_id || d.pres_id || null,
          t_pres_d_item_id: d.t_pres_d_item_id || null,
          m_item_id: d.m_item_id || d.t_pres_d_item?.m_item_id || null,
          unit_id: d.unit_id || d.t_pres_d_item?.unit_id || null,
          item_type_id: d.item_type_id || d.t_pres_d_item?.item_type_id || null,
          no_pres: d.no_pres || d.t_pres?.no || d.t_pre?.no || '-',
          date_pres: d.date_pres || (d.t_pres?.date || d.t_pre?.date || '').slice(0, 10) || '-',
          no_wo: d.no_wo || d.t_pres?.t_wo?.no || d.t_pre?.t_wo?.no || d.t_pre?.t_wo_d_item?.t_wo?.no || '-',
          item_name: d.item_name || d.name || d.m_item?.nama_item || d.m_items?.nama_item || d.t_pre?.t_wo_d_item?.m_item?.nama_item || d.t_pre?.t_wo_d_item?.m_items?.nama_item || d.m_item?.nama || d.m_items?.nama || '-',
          item_type: d.item_type || d.t_pres_d_item?.type_item_pres?.value1 || d.t_pre?.t_wo_d_item?.as_item_type_wod?.value1 || d.m_general_item_type?.value1 || '-',
          is_batch: isBatch,
          batch: rawBatch || '-',
          qty_result: Number(d.qty_result ?? d.qty ?? 0),
          qty_confirm: qtyConfirmVal,
          qty_received: d.qty_received !== undefined && d.qty_received !== null ? Number(d.qty_received) : qtyConfirmVal,
          uom: d.t_pres_d_item?.unit_id_pres?.value1 || d.t_pre?.t_wo_d_item?.as_unit_wod?.value1 || d.m_general?.value1 || d.m_general_unit?.value1 || d.uom || '-',
          notes: d.notes || d.catatan || '',
        })

        if ((!rawBatch || rawBatch === '-') && row.m_item_id) {
          const whId = initialValues.m_warehouse_id || initialValues.value1
          const filterWh = whId ? `&filter_column_stock_gudang.m_gudang_id=${whId}` : ''
          apiCall(`/dynamic/stock_gudang_d?filter_column_m_items_id=${row.m_item_id}${filterWh}&order_by=createdAt&order_type=DESC&limit=1`)
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
    }

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore
        values[key] = initialValues[key]
      }
    }

    // Map database actual columns back to generic values used in the template
    values.group = initialValues.no || ''
    values.key1 = initialValues.date ? initialValues.date.slice(0, 10) : (initialValues.key1 ? initialValues.key1.slice(0, 10) : '')
    values.code = initialValues.flag || initialValues.code || ''
    values.value1 = initialValues.m_warehouse_id || initialValues.value1 || ''
    values.value2 = initialValues.to_warehouse_id || initialValues.value2 || ''
    values.value3 = initialValues.notes || initialValues.value3 || ''

    if (!values.m_unit_bisnis_id && initialValues.m_unit_bisnis_id) {
      values.m_unit_bisnis_id = initialValues.m_unit_bisnis_id
    }

    // Restore unit bisnis label
    if (values.m_unit_bisnis_id) {
      selectedUnitBisnisLabel.value = initialValues.m_unit_bisnis?.nama_comp || initialValues.m_unit_bisni?.nama_comp || ''
      selectedUnitBisnisCompanyName.value = initialValues.m_unit_bisnis?.m_company?.nama || initialValues.m_unit_bisni?.m_company?.nama || ''
      if (!selectedUnitBisnisCompanyName.value) fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }

    // Restore warehouse labels
    if (values.value1) fetchWarehouseLabel(values.value1, 'production')
    if (values.value2) fetchWarehouseLabel(values.value2, 'confirm')

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', { description: 'Silakan edit dan simpan sebagai Result Confirmation baru' })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Result Confirmation', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: { label: 'Kembali', onClick: () => router.push('/production/transaksi/t_rc') }
    })
    setTimeout(() => router.push('/production/transaksi/t_rc'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// VALIDATION ERRORS
// ============================================================================
const errors = reactive({
  m_unit_bisnis_id: '',
  value1: '',
  value2: '',
})

// Header dianggap lengkap jika unit bisnis, warehouse production, dan warehouse confirmation sudah diisi
const isHeaderComplete = computed(() =>
  !!values.m_unit_bisnis_id?.trim() &&
  !!values.value1?.trim() &&
  !!values.value2?.trim()
)

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.m_unit_bisnis_id?.trim()) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib dipilih'; invalid = true }
  if (!values.value1?.trim()) { errors.value1 = 'Warehouse Production wajib dipilih'; invalid = true }
  if (!values.value2?.trim()) { errors.value2 = 'Warehouse Confirmation wajib dipilih'; invalid = true }
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
    // Mode Draft / Edit: qty_confirm > 0 dan tidak melebihi qty_available
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
        toast.error('Validasi detail gagal', {
          description: `Baris ${i + 1} (${item.item_name}): Qty Confirm (${qtyConf}) tidak boleh melebihi Qty Available (${qtyAvail})`
        })
        return
      }
    }
  }

  loading.value = true
  try {
    const detailsPayload = detailArr.value.map((item, idx) => ({
      id: item.id || undefined,
      sequence: idx + 1,
      t_pres_id: item.t_pres_id || null,
      t_pres_d_item_id: item.t_pres_d_item_id || null,
      no_pres: item.no_pres || null,
      no_wo: item.no_wo || null,
      m_item_id: item.m_item_id || null,
      item_name: item.item_name || null,
      item_type: item.item_type || null,
      batch: (item.is_batch ?? true) && item.batch && item.batch !== '-' ? item.batch : null,
      qty_result: Number(item.qty_result) || 0,
      qty_confirm: Number(item.qty_confirm) || 0,
      qty_received: isConfirmMode.value ? Number(item.qty_received) : (item.qty_received !== undefined && item.qty_received !== null ? Number(item.qty_received) : Number(item.qty_confirm) || 0),
      unit_id: item.unit_id || null,
      uom: item.uom || null,
      notes: item.notes || null,
    }))

    const payload: any = {
      no: values.group?.trim() || null,
      date: values.key1?.trim() || new Date().toISOString().split('T')[0],
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      flag: values.code?.trim() || (detailArr.value[0]?.flag) || 'FG',
      m_warehouse_id: values.value1?.trim() || null,
      to_warehouse_id: values.value2?.trim() || null,
      notes: values.value3?.trim() || null,
      status: isConfirmMode.value ? 'RECEIVED' : values.status,
      is_active: values.is_active,
      t_rc_d: detailsPayload,
    }

    if (isConfirmMode.value) {
      await updateRc(menuId.value, payload)
      toast.success('Result Confirmation berhasil dikonfirmasi (RECEIVED)')
    } else if (isEditMode.value) {
      await updateRc(menuId.value, payload)
      toast.success('Result Confirmation berhasil diperbarui')
    } else {
      await createRc(payload)
      toast.success('Result Confirmation berhasil dibuat')
    }
    router.replace('/production/transaksi/t_rc?reload=' + Date.now())
  } catch (error) {
    toast.error(
      isConfirmMode.value ? 'Gagal mengonfirmasi Result Confirmation' : (isEditMode.value ? 'Gagal memperbarui Result Confirmation' : 'Gagal membuat Result Confirmation'),
      { description: error instanceof Error ? error.message : 'Terjadi kesalahan' }
    )
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/production/transaksi/t_rc')
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
          <CardTitle>Informasi Result Confirmation</CardTitle>
          <CardDescription>Isi data Result Confirmation dengan lengkap dan benar</CardDescription>
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

            <!-- No. RC (Auto-generate) -->
            <FieldX
              id="group"
              label="No. Result Confirmation"
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
              @input="v => values.key1 = v"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :required="!isReadOnly && !isConfirmMode"
              hints="Tanggal otomatis diisi hari ini"
              class="w-full"
            />

            <!-- Warehouse Production — flag PROD -->
            <FieldSelect
              id="value1"
              label="Warehouse Production (Asal)"
              :value="values.value1"
              :display-value="selectedWarehouseProductionLabel"
              :api="warehouseProdApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Production"
              :required="!isReadOnly && !isConfirmMode"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="!isConfirmMode"
              :errorText="errors.value1 ? 'failed' : ''"
              :hints="errors.value1 || 'Pilih Warehouse Production'"
              @input="(v) => (values.value1 = v)"
              @update:valueFull="handleWarehouseProductionSelected"
              class="w-full"
            />

            <!-- Warehouse Confirmation — flag INV -->
            <FieldSelect
              id="value2"
              label="Warehouse Confirmation (Tujuan)"
              :value="values.value2"
              :display-value="selectedWarehouseConfirmLabel"
              :api="warehouseInvApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Confirmation"
              :required="!isReadOnly && !isConfirmMode"
              :disabled="loading || isReadOnly || isConfirmMode"
              :readonly="isReadOnly || isConfirmMode"
              :clearable="!isConfirmMode"
              :errorText="errors.value2 ? 'failed' : ''"
              :hints="errors.value2 || 'Pilih Warehouse Confirmation'"
              @input="(v) => (values.value2 = v)"
              @update:valueFull="handleWarehouseConfirmSelected"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldX
              id="value3"
              type="textarea"
              label="Catatan"
              :value="values.value3"
              @input="v => values.value3 = v"
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
                          <template v-if="!isHeaderComplete">
                            Lengkapi Unit Bisnis, Warehouse Production, dan Warehouse Confirmation di header terlebih dahulu.
                          </template>
                          <template v-else>
                            Klik "Pilih Production Result" untuk menambahkan.
                          </template>
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
                          :max="detail.qty_available || detail.qty_result"
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
                        <span v-else class="text-slate-600">{{ detail.notes || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly && !isConfirmMode" class="px-2 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr(index)"
                          class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

      <!-- ACTION BUTTONS -->
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly && !isConfirmMode ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly || isConfirmMode" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isConfirmMode ? 'Konfirmasi Penerimaan (RECEIVED)' : (isEditMode ? 'Perbarui' : 'Simpan') }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
