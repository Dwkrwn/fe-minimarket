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
import { FieldX, FieldSelect, FieldNumber, FieldPopup } from '@/components/field'
import { DeleteButton, ButtonMultiSelect } from '@/components/button'
import { ArrowLeft, Save, Loader2, Send } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'
import { apiCall } from '@/lib/api'
import { createTreq, updateTreq, getTreqById, postTreq, type TreqDItem } from './service'

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
const isEditMode = computed(() => !!route.params.id && route.name === 'TreqForm')
const isViewMode = computed(() => route.name === 'TreqView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() =>
  isViewMode.value ||
  route.meta.readOnly === true ||
  ['POST'].includes((values.status || '').toUpperCase())
)
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value)
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
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || ''
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId)
    fetchUnitBisnisCompanyName(String(ubId))
  }
}

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail WO Transfer Request'
  if (isCopyMode.value) return 'Salin WO Transfer Request'
  if (isEditMode.value) return 'Edit WO Transfer Request'
  return 'Tambah WO Transfer Request'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data WO Transfer Request'
  if (isCopyMode.value) return 'Buat WO Transfer Request baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data WO Transfer Request'
  return 'Buat WO Transfer Request baru'
})

// ============================================================================
// FORM VALUES
// ============================================================================
let values = reactive({
  no: '',
  date: new Date().toISOString().split('T')[0],
  m_unit_bisnis_id: '',
  t_wo_id: '',
  t_wo_d_item_id: '',
  m_warehouse_id: '',
  to_t_wo_id: '',
  to_t_wo_d_item_id: '',
  to_warehouse_id: '',
  notes: '',
  status: 'DRAFT',
  is_active: true
})

// Display labels
const selectedUnitBisnisLabel = ref('')
const selectedUnitBisnisCompanyName = ref('')
const selectedWoAsalLabel = ref('')
const selectedItemAsalLabel = ref('')
const selectedWarehouseAsalLabel = ref('')
const selectedWoTujuanLabel = ref('')
const selectedItemTujuanLabel = ref('')
const selectedWarehouseTujuanLabel = ref('')

let initialValues: Record<string, any> = {}

// Detail array
const detailArr = ref<TreqDItem[]>([])

// ============================================================================
// API CONFIGS
// ============================================================================
const unitBisnisApiConfig = computed(() => ({
  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
  params: { no_pagination: 'true', searchfield: 'kode_unit_bisnis,nama_comp', join: 'true' }
}))

// Warehouse: flag = PROD
const warehouseProdApiConfig = computed(() => ({
  url: `${API_BASE_URL}/dynamic/m_gudang`,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
  params: {
    no_pagination: 'true',
    searchfield: 'kode_gudang,nama_gudang',
    filter_column_is_active: 'true',
    filter_column_flag: 'PROD'
  }
}))

// MultiSelect API for Detail Material from WO Asal MTF
const mtfMaterialApiConfig = computed(() => ({
  url: `${API_BASE_URL}/fn/t_treq/getAvailableMaterials`,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
  params: {
    t_wo_id: values.t_wo_id || '',
    searchfield: 'nama_item,kode_item,no_mtf',
    ...(values.m_warehouse_id ? { m_warehouse_id: values.m_warehouse_id } : {})
  }
}))

// Columns for ButtonMultiSelect Popup Material Transfer
const mtfMaterialColumns = [
  {
    field: 'no_mtf',
    headerName: 'No MTF',
    width: '170px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter'
  },
  {
    field: 'item_type',
    headerName: 'Tipe Material',
    width: '140px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter'
  },
  {
    field: 'nama_item',
    headerName: 'Nama Material',
    width: '240px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter',
    valueGetter: (p: any) =>
      p.data?.kode_item && p.data?.nama_item
        ? `${p.data.kode_item} - ${p.data.nama_item}`
        : (p.data?.nama_item || p.data?.item_name || '-')
  },
  {
    field: 'uom',
    headerName: 'UOM',
    width: '90px'
  },
  {
    field: 'qty_confirm',
    headerName: 'Qty Transfer Confirm',
    width: '160px',
    cellClass: ['text-right'],
    valueGetter: (p: any) => Number(p.data?.qty_confirm ?? 0).toLocaleString('id-ID')
  },
  {
    field: 'qty_usage',
    headerName: 'Qty Usage',
    width: '110px',
    cellClass: ['text-right'],
    valueGetter: (p: any) => Number(p.data?.qty_usage ?? 0).toLocaleString('id-ID')
  },
  {
    field: 'qty_oper',
    headerName: 'Qty Transfer SPK',
    width: '140px',
    cellClass: ['text-right'],
    valueGetter: (p: any) => Number(p.data?.qty_oper ?? 0).toLocaleString('id-ID')
  },
  {
    field: 'qty_return',
    headerName: 'Qty Return',
    width: '110px',
    cellClass: ['text-right'],
    valueGetter: (p: any) => Number(p.data?.qty_return ?? 0).toLocaleString('id-ID')
  },
  {
    field: 'qty_available',
    headerName: 'Qty Available',
    width: '130px',
    cellClass: ['text-right', 'font-semibold'],
    valueGetter: (p: any) => Number(p.data?.qty_available ?? 0).toLocaleString('id-ID')
  }
]

// ============================================================================
// HANDLERS
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

// Watchers: Reset detail material jika WO Asal atau WO Tujuan diganti
watch(
  () => values.t_wo_id,
  (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal && detailArr.value.length > 0) {
      detailArr.value = []
      toast.info('Detail material direset karena No WO Asal diganti')
    }
  }
)

watch(
  () => values.to_t_wo_id,
  (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal && detailArr.value.length > 0) {
      detailArr.value = []
      toast.info('Detail material direset karena No WO Tujuan diganti')
    }
  }
)

// WO Asal dipilih → auto-fill item asal & warehouse asal, reset detail jika WO berubah
const handleWoAsalSelected = (obj: any) => {
  if (obj) {
    // Jika ganti WO Asal dan sudah ada detail, reset detail
    if (values.t_wo_id && values.t_wo_id !== obj.id && detailArr.value.length > 0) {
      detailArr.value = []
      toast.info('Detail material direset karena No WO Asal diganti')
    }

    values.t_wo_id = obj.id
    selectedWoAsalLabel.value = obj.no || ''
    values.t_wo_d_item_id = obj.t_wo_d_item_id || ''
    selectedItemAsalLabel.value = obj.item_kode && obj.item_nama
      ? `${obj.item_kode} - ${obj.item_nama}`
      : (obj.item_nama || '')

    // Auto-fill Warehouse Asal dari MTF jika belum dipilih
    if (obj.m_warehouse_id && !values.m_warehouse_id) {
      values.m_warehouse_id = obj.m_warehouse_id
      selectedWarehouseAsalLabel.value = obj.warehouse_nama || ''
    }

    // Validasi No WO Asal != No WO Tujuan
    if (values.to_t_wo_id && values.to_t_wo_id === obj.id) {
      values.to_t_wo_id = ''
      selectedWoTujuanLabel.value = ''
      values.to_t_wo_d_item_id = ''
      selectedItemTujuanLabel.value = ''
      toast.warning('No WO Tujuan direset karena tidak boleh sama dengan No WO Asal')
    }
  } else {
    values.t_wo_id = ''
    selectedWoAsalLabel.value = ''
    values.t_wo_d_item_id = ''
    selectedItemAsalLabel.value = ''
    detailArr.value = []
  }
}

const handleWarehouseAsalSelected = (obj: any) => {
  if (obj) {
    selectedWarehouseAsalLabel.value = obj.nama_gudang || obj.kode_gudang || ''
  } else {
    values.m_warehouse_id = ''
    selectedWarehouseAsalLabel.value = ''
  }
}

// WO Tujuan dipilih → cek WO Asal != WO Tujuan, lalu auto-fetch & auto-fill item tujuan
const handleWoTujuanSelected = async (obj: any) => {
  if (obj) {
    if (values.t_wo_id && obj.id === values.t_wo_id) {
      toast.error('Validasi gagal', { description: 'No WO Tujuan tidak boleh sama dengan No WO Asal' })
      values.to_t_wo_id = ''
      selectedWoTujuanLabel.value = ''
      values.to_t_wo_d_item_id = ''
      selectedItemTujuanLabel.value = ''
      return
    }

    if (values.to_t_wo_id && values.to_t_wo_id !== obj.id && detailArr.value.length > 0) {
      detailArr.value = []
      toast.info('Detail material direset karena No WO Tujuan diganti')
    }

    values.to_t_wo_id = obj.id
    selectedWoTujuanLabel.value = obj.no || ''

    // Auto-fetch item tujuan dari t_wo_d_item milik WO Tujuan
    try {
      const res = await apiCall<{ status: string; data: any[] }>(
        `/dynamic/t_wo_d_item?filter_column_t_wo_id=${obj.id}&join=true&no_pagination=true`,
        { method: 'GET' }
      )
      if (res?.status === 'success' && res.data && res.data.length > 0) {
        const itemRecord = res.data[0]
        values.to_t_wo_d_item_id = itemRecord.id
        selectedItemTujuanLabel.value = itemRecord.m_item?.kode_item && itemRecord.m_item?.nama_item
          ? `${itemRecord.m_item.kode_item} - ${itemRecord.m_item.nama_item}`
          : (itemRecord.m_item?.nama_item || itemRecord.m_item?.nama || '-')

        // Rule: Item Asal dan Item Tujuan harus berbeda
        if (values.t_wo_d_item_id && values.to_t_wo_d_item_id === values.t_wo_d_item_id) {
          toast.warning('Peringatan: Item Asal dan Item Tujuan harus berbeda!')
        }
      } else {
        values.to_t_wo_d_item_id = ''
        selectedItemTujuanLabel.value = '-'
      }
    } catch (err) {
      console.error('Failed to load item for WO Tujuan:', err)
      values.to_t_wo_d_item_id = ''
      selectedItemTujuanLabel.value = '-'
    }
  } else {
    values.to_t_wo_id = ''
    selectedWoTujuanLabel.value = ''
    values.to_t_wo_d_item_id = ''
    selectedItemTujuanLabel.value = ''
    if (detailArr.value.length > 0) {
      detailArr.value = []
      toast.info('Detail material direset karena No WO Tujuan dikosongkan')
    }
  }
}

const handleWarehouseTujuanSelected = (obj: any) => {
  if (obj) {
    selectedWarehouseTujuanLabel.value = obj.nama_gudang || obj.kode_gudang || ''
  } else {
    values.to_warehouse_id = ''
    selectedWarehouseTujuanLabel.value = ''
  }
}

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail material dihapus')
}

// IDs t_mtf_d yang sudah ada di detail (cegah duplikasi)
const existingMtfDIds = computed(() =>
  [...new Set(detailArr.value.map((d: any) => d.t_mtf_d_id).filter(Boolean))]
)

// Handler saat material ditambahkan dari ButtonMultiSelect
const handleMaterialsAdded = (selectedItems: any[]) => {
  let addedCount = 0
  selectedItems.forEach((item: any) => {
    const mtfDId = item.t_mtf_d_id || item.id
    const alreadyAdded = detailArr.value.some((d: any) => d.t_mtf_d_id === mtfDId)
    if (alreadyAdded) return

    const qtyConfirm = Number(item.qty_confirm ?? 0)
    const qtyUsage = Number(item.qty_usage ?? 0)
    const qtyOper = Number(item.qty_oper ?? 0)
    const qtyReturn = Number(item.qty_return ?? 0)
    const qtyAvailable = Number(item.qty_available ?? Math.max(0, qtyConfirm - qtyUsage - qtyOper - qtyReturn))

    detailArr.value.push({
      t_mtf_d_id: mtfDId,
      no_mtf: item.no_mtf || '-',
      m_item_id: item.m_item_id || null,
      item_type: item.item_type || 'RAW MATERIAL',
      item_name: item.kode_item && item.nama_item ? `${item.kode_item} - ${item.nama_item}` : (item.nama_item || item.item_name || '-'),
      kode_item: item.kode_item || '',
      nama_item: item.nama_item || '',
      qty_transfer_confirm: qtyConfirm,
      qty_usage: qtyUsage,
      qty_oper: qtyOper,
      qty_return: qtyReturn,
      qty_available: qtyAvailable,
      // default 0, user wajib input sendiri
      qty: 0,
      qty_confirm: undefined,
      unit_id: item.unit_id || null,
      uom: item.uom || '-',
      notes: ''
    })
    addedCount++
  })

  if (addedCount > 0) {
    toast.success(`${addedCount} material berhasil ditambahkan`)
  }
}

// ============================================================================
// RESET
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no: '',
    date: new Date().toISOString().split('T')[0],
    m_unit_bisnis_id: '',
    t_wo_id: '',
    t_wo_d_item_id: '',
    m_warehouse_id: '',
    to_t_wo_id: '',
    to_t_wo_d_item_id: '',
    to_warehouse_id: '',
    notes: '',
    status: 'DRAFT',
    is_active: true
  })
  selectedUnitBisnisLabel.value = ''
  selectedUnitBisnisCompanyName.value = ''
  selectedWoAsalLabel.value = ''
  selectedItemAsalLabel.value = ''
  selectedWarehouseAsalLabel.value = ''
  selectedWoTujuanLabel.value = ''
  selectedItemTujuanLabel.value = ''
  selectedWarehouseTujuanLabel.value = ''
  Object.keys(errors).forEach(k => { errors[k as keyof typeof errors] = '' })
  detailArr.value = []
  applyCurrentUserUnitBisnis()
}

// ============================================================================
// LIFECYCLE
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
    const res = await getTreqById(sourceId)
    if (res && res.data) {
      const rawData = res.data as any
      auditMeta.value = {
        created_by: rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt
      }
    }

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Load detail material with full MTF info
    const rawDetails = initialValues.t_treq_ds || initialValues.t_treq_d || []
    if (Array.isArray(rawDetails) && rawDetails.length > 0) {
      const detailsWithMetadata = await Promise.all(
        rawDetails.map(async (d: any) => {
          let mtfData: any = {}
          if (d.t_mtf_d_id) {
            try {
              // Note: model Sequelize is m_items (plural) and m_general
              const mtfRes = await apiCall<{ status: string; data: any }>(
                `/dynamic/t_mtf_d/${d.t_mtf_d_id}?join=true&include=t_mtf,m_items,m_general`,
                { method: 'GET' }
              )
              if (mtfRes?.status === 'success' && mtfRes.data) {
                mtfData = mtfRes.data
              }
            } catch (err) {
              console.error('Failed to fetch t_mtf_d data via apiCall:', err)
            }
          }

          // Fallback fetch item jika belum termuat dari MTF
          let itemObj = mtfData.m_item || mtfData.m_items || d.m_item || d.m_items
          const itemId = d.m_item_id || mtfData.m_item_id
          if (!itemObj && itemId) {
            try {
              const itemRes = await apiCall<{ status: string; data: any }>(
                `/dynamic/m_items/${itemId}?join=true`,
                { method: 'GET' }
              )
              if (itemRes?.status === 'success' && itemRes.data) {
                itemObj = itemRes.data
              }
            } catch { /* silent */ }
          }

          const qtyConfirm = Number(mtfData.qty_confirm ?? d.qty_transfer_confirm ?? 0)
          const qtyUsage = Number(mtfData.qty_usage ?? d.qty_usage ?? 0)
          const qtyOper = Number(mtfData.qty_oper ?? d.qty_oper ?? 0)
          const qtyReturn = Number(mtfData.qty_return ?? d.qty_return ?? 0)
          const computedQtyAvailable = Math.max(0, qtyConfirm - qtyUsage - qtyOper - qtyReturn)

          const itemName = itemObj?.kode_item && itemObj?.nama_item
            ? `${itemObj.kode_item} - ${itemObj.nama_item}`
            : (itemObj?.nama_item || itemObj?.nama || d.item_name || '-')

          const uomVal = mtfData.m_general?.value1 || itemObj?.m_general?.value1 || d.uom || '-'

          const detailObj: TreqDItem = {
            ...d,
            t_mtf_d_id: d.t_mtf_d_id || mtfData.id,
            no_mtf: mtfData.t_mtf?.no || d.no_mtf || '-',
            m_item_id: itemId || null,
            item_type: itemObj?.tipe_id || 'RAW MATERIAL',
            item_name: itemName,
            kode_item: itemObj?.kode_item || '',
            nama_item: itemObj?.nama_item || itemObj?.nama || '',
            qty_transfer_confirm: qtyConfirm,
            qty_usage: qtyUsage,
            qty_oper: qtyOper,
            qty_return: qtyReturn,
            qty_available: computedQtyAvailable,
            qty: isCopyModeLocal ? Math.min(Number(d.qty ?? 0), computedQtyAvailable) : Number(d.qty ?? 0),
            qty_confirm: isCopyModeLocal ? undefined : d.qty_confirm,
            unit_id: d.unit_id || mtfData.uom_id || itemObj?.uom_id,
            uom: uomVal,
            notes: d.notes || ''
          }

          // In copy mode, remove IDs so items are treated as new
          if (isCopyModeLocal) {
            delete detailObj.id
            delete detailObj.t_treq_id
          }

          return detailObj
        })
      )
      detailArr.value = detailsWithMetadata
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).no
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
    }

    // Assign header fields
    values.no = isCopyModeLocal ? '' : (initialValues.no || '')
    values.date = initialValues.date ? initialValues.date.slice(0, 10) : values.date
    values.m_unit_bisnis_id = initialValues.m_unit_bisnis_id || ''
    values.t_wo_id = initialValues.t_wo_id || ''
    values.t_wo_d_item_id = initialValues.t_wo_d_item_id || ''
    values.m_warehouse_id = initialValues.m_warehouse_id || ''
    values.to_t_wo_id = initialValues.to_t_wo_id || ''
    values.to_t_wo_d_item_id = initialValues.to_t_wo_d_item_id || ''
    values.to_warehouse_id = initialValues.to_warehouse_id || ''
    values.notes = initialValues.notes || ''
    values.status = isCopyModeLocal ? 'DRAFT' : (initialValues.status || 'DRAFT')
    values.is_active = isCopyModeLocal ? true : (initialValues.is_active ?? true)

    // Restore display labels
    selectedUnitBisnisLabel.value = initialValues.m_unit_bisnis?.nama_comp || initialValues.m_unit_bisni?.nama_comp || ''
    selectedUnitBisnisCompanyName.value = initialValues.m_unit_bisnis?.m_company?.nama || initialValues.m_unit_bisni?.m_company?.nama || ''
    if (!selectedUnitBisnisCompanyName.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }

    // WO Asal label
    selectedWoAsalLabel.value = initialValues.as_wo_asal?.no || initialValues.t_wo?.no || ''
    if (!selectedWoAsalLabel.value && values.t_wo_id) {
      apiCall<any>(`/dynamic/t_wo/${values.t_wo_id}`, { method: 'GET' })
        .then(res => { if (res?.data?.no) selectedWoAsalLabel.value = res.data.no })
        .catch(() => {})
    }

    // Item Asal label
    const asalItem = initialValues.as_wo_item_awal?.m_item || initialValues.t_wo_d_item?.m_item
    if (asalItem) {
      selectedItemAsalLabel.value = asalItem.kode_item && asalItem.nama_item
        ? `${asalItem.kode_item} - ${asalItem.nama_item}`
        : (asalItem.nama_item || asalItem.nama || '')
    } else if (values.t_wo_d_item_id) {
      apiCall<any>(`/dynamic/t_wo_d_item/${values.t_wo_d_item_id}?join=true`, { method: 'GET' })
        .then(res => {
          if (res?.data?.m_item) {
            selectedItemAsalLabel.value = res.data.m_item.kode_item
              ? `${res.data.m_item.kode_item} - ${res.data.m_item.nama_item}`
              : res.data.m_item.nama_item
          }
        }).catch(() => {})
    }

    // Warehouse Asal label
    selectedWarehouseAsalLabel.value = initialValues.as_wo_gudang_asal?.nama_gudang || initialValues.m_gudang?.nama_gudang || ''
    if (!selectedWarehouseAsalLabel.value && values.m_warehouse_id) {
      apiCall<any>(`/dynamic/m_gudang/${values.m_warehouse_id}`, { method: 'GET' })
        .then(res => { if (res?.data?.nama_gudang) selectedWarehouseAsalLabel.value = res.data.nama_gudang })
        .catch(() => {})
    }

    // WO Tujuan label
    selectedWoTujuanLabel.value = initialValues.as_wo_tujuan?.no || initialValues.to_t_wo?.no || ''
    if (!selectedWoTujuanLabel.value && values.to_t_wo_id) {
      apiCall<any>(`/dynamic/t_wo/${values.to_t_wo_id}`, { method: 'GET' })
        .then(res => { if (res?.data?.no) selectedWoTujuanLabel.value = res.data.no })
        .catch(() => {})
    }

    // Item Tujuan label
    const tujuanItem = initialValues.as_wo_item_tujuan?.m_item || initialValues.to_t_wo_d_item?.m_item
    if (tujuanItem) {
      selectedItemTujuanLabel.value = tujuanItem.kode_item && tujuanItem.nama_item
        ? `${tujuanItem.kode_item} - ${tujuanItem.nama_item}`
        : (tujuanItem.nama_item || tujuanItem.nama || '')
    } else if (values.to_t_wo_d_item_id) {
      apiCall<any>(`/dynamic/t_wo_d_item/${values.to_t_wo_d_item_id}?join=true`, { method: 'GET' })
        .then(res => {
          if (res?.data?.m_item) {
            selectedItemTujuanLabel.value = res.data.m_item.kode_item
              ? `${res.data.m_item.kode_item} - ${res.data.m_item.nama_item}`
              : res.data.m_item.nama_item
          }
        }).catch(() => {})
    }

    // Warehouse Tujuan label
    selectedWarehouseTujuanLabel.value = initialValues.as_wo_gudang_tujuan?.nama_gudang || initialValues.to_m_gudang?.nama_gudang || ''
    if (!selectedWarehouseTujuanLabel.value && values.to_warehouse_id) {
      apiCall<any>(`/dynamic/m_gudang/${values.to_warehouse_id}`, { method: 'GET' })
        .then(res => { if (res?.data?.nama_gudang) selectedWarehouseTujuanLabel.value = res.data.nama_gudang })
        .catch(() => {})
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', { description: 'Silakan edit dan simpan sebagai WO Transfer Request baru' })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data WO Transfer Request', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: { label: 'Kembali', onClick: () => router.push('/production/transaksi/t_treq') }
    })
    setTimeout(() => router.push('/production/transaksi/t_treq'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// VALIDATION ERRORS
// ============================================================================
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  t_wo_id: '',
  t_wo_d_item_id: '',
  m_warehouse_id: '',
  to_t_wo_id: '',
  to_t_wo_d_item_id: '',
  to_warehouse_id: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Clear errors
  Object.keys(errors).forEach(k => { errors[k as keyof typeof errors] = '' })
  let invalid = false

  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Company wajib dipilih'; invalid = true }
  if (!values.date) { errors.date = 'Date wajib diisi'; invalid = true }
  if (!values.t_wo_id) { errors.t_wo_id = 'No WO Asal wajib dipilih'; invalid = true }
  if (!values.t_wo_d_item_id) { errors.t_wo_d_item_id = 'Item Asal wajib terisi'; invalid = true }
  if (!values.m_warehouse_id) { errors.m_warehouse_id = 'Warehouse Asal wajib dipilih'; invalid = true }
  if (!values.to_t_wo_id) { errors.to_t_wo_id = 'No WO Tujuan wajib dipilih'; invalid = true }
  if (!values.to_t_wo_d_item_id) { errors.to_t_wo_d_item_id = 'Item Tujuan wajib terisi'; invalid = true }
  if (!values.to_warehouse_id) { errors.to_warehouse_id = 'Warehouse Tujuan wajib dipilih'; invalid = true }

  // Rule: WO Asal ≠ WO Tujuan
  if (values.t_wo_id && values.to_t_wo_id && values.t_wo_id === values.to_t_wo_id) {
    toast.error('Validasi gagal', { description: 'No WO Asal dan No WO Tujuan harus berbeda' })
    invalid = true
  }

  // Rule: Item Asal ≠ Item Tujuan
  if (
    values.t_wo_d_item_id &&
    values.to_t_wo_d_item_id &&
    values.t_wo_d_item_id === values.to_t_wo_d_item_id
  ) {
    toast.error('Validasi gagal', { description: 'Item Asal dan Item Tujuan harus berbeda' })
    invalid = true
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Rule: Minimal 1 detail material
  if (detailArr.value.length === 0) {
    toast.error('Validasi gagal', { description: 'Wajib menambahkan minimal 1 detail material' })
    return
  }

  // Rule: Validasi setiap baris detail
  const mtfDIdSet = new Set<string>()
  for (let i = 0; i < detailArr.value.length; i++) {
    const d = detailArr.value[i]!
    const rowNum = i + 1

    if (!d.t_mtf_d_id) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum}: Referensi Material Transfer wajib diisi` })
      return
    }

    // Rule: Tidak boleh menambahkan detail material dari Material Transfer yg sama dalam satu transaksi
    if (mtfDIdSet.has(d.t_mtf_d_id)) {
      toast.error('Validasi detail gagal', {
        description: `Baris ${rowNum}: Material transfer duplikat tidak diizinkan dalam satu transaksi`
      })
      return
    }
    mtfDIdSet.add(d.t_mtf_d_id)

    if (!d.m_item_id) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum}: Material wajib diisi` })
      return
    }

    const qty = Number(d.qty)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum} (${d.item_name}): Qty harus lebih dari 0` })
      return
    }

    // Rule: Qty tidak boleh melebihi Qty Available
    const qtyAvail = Number(d.qty_available ?? 0)
    if (qty > qtyAvail) {
      toast.error('Validasi detail gagal', {
        description: `Baris ${rowNum} (${d.item_name}): Qty (${qty}) tidak boleh melebihi Qty Available (${qtyAvail})`
      })
      return
    }
  }

  loading.value = true
  try {
    const detailsPayload = detailArr.value.map((item, idx) => ({
      id: item.id && !String(item.id).startsWith('temp-') ? item.id : undefined,
      sequence: idx + 1,
      t_mtf_d_id: item.t_mtf_d_id || null,
      m_item_id: item.m_item_id || null,
      qty: Number(item.qty) || 0,
      qty_confirm: item.qty_confirm !== undefined ? item.qty_confirm : null,
      unit_id: item.unit_id || null,
      notes: item.notes || null
    }))

    const payload: any = {
      no: values.no?.trim() || null,
      date: values.date,
      m_unit_bisnis_id: values.m_unit_bisnis_id,
      t_wo_id: values.t_wo_id,
      t_wo_d_item_id: values.t_wo_d_item_id || null,
      m_warehouse_id: values.m_warehouse_id,
      to_t_wo_id: values.to_t_wo_id,
      to_t_wo_d_item_id: values.to_t_wo_d_item_id || null,
      to_warehouse_id: values.to_warehouse_id,
      notes: values.notes?.trim() || null,
      status: values.status || 'DRAFT',
      is_active: values.is_active,
      t_treq_d: detailsPayload
    }

    if (isEditMode.value) {
      await updateTreq(menuId.value, payload)
      toast.success('WO Transfer Request berhasil diperbarui')
    } else {
      await createTreq(payload)
      toast.success('WO Transfer Request berhasil dibuat')
    }
    router.replace('/production/transaksi/t_treq?reload=' + Date.now())
  } catch (error) {
    toast.error(
      isEditMode.value ? 'Gagal memperbarui WO Transfer Request' : 'Gagal membuat WO Transfer Request',
      { description: error instanceof Error ? error.message : 'Terjadi kesalahan' }
    )
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL
// ============================================================================
const handleCancel = () => { router.push('/production/transaksi/t_treq') }

// ============================================================================
// POST HANDLER
// ============================================================================
const isPosting = ref(false)
const isPostDialogOpen = ref(false)

const openPostDialog = () => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk memposting data' })
    return
  }
  isPostDialogOpen.value = true
}

const confirmPost = async () => {
  if (!menuId.value) return
  isPosting.value = true
  try {
    const response = await postTreq(menuId.value)
    if (response.status === 'success') {
      values.status = 'POST'
      values.is_active = true
      toast.success('WO Transfer Request berhasil di-POST', {
        description: 'Data telah dikunci dan tidak dapat diubah lagi.'
      })
      isPostDialogOpen.value = false
      router.replace('/production/transaksi/t_treq?reload=' + Date.now())
    } else {
      toast.error('Gagal memposting', { description: (response as any).message || 'Terjadi kesalahan' })
    }
  } catch (error) {
    toast.error('Gagal memposting WO Transfer Request', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    isPosting.value = false
  }
}

const cancelPost = () => { isPostDialogOpen.value = false }
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
          <CardTitle>Informasi WO Transfer Request</CardTitle>
          <CardDescription>Isi data WO Transfer Request dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Row 1 Left: Company (m_unit_bisnis_id) -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Company"
              :value="values.m_unit_bisnis_id"
              :display-value="selectedUnitBisnisLabel"
              :api="unitBisnisApiConfig"
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

            <!-- Row 1 Right: No Transfer Request (auto-generate, readonly) -->
            <FieldX
              id="no"
              label="No Transfer Request"
              :value="values.no || 'Auto Generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generate"
              hints="Nomor dibuat otomatis oleh sistem"
              class="w-full opacity-70"
            />

            <!-- Row 2 Left: Date (Tanggal) -->
            <FieldX
              id="date"
              label="Date"
              type="date"
              :value="values.date"
              @input="v => values.date = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorText="errors.date ? 'failed' : ''"
              :hints="errors.date || 'Tanggal transaksi'"
              class="w-full"
            />

            <!-- Row 2 Right: Spacer for grid alignment -->
            <div class="hidden md:block" />

            <!-- ── SECTION: WO ASAL ── -->
            <!-- No WO Asal (hanya WO dengan Qty Available MTF > 0) -->
            <FieldPopup
              id="t_wo_id"
              label="No WO Asal"
              :value="values.t_wo_id"
              :display-value="selectedWoAsalLabel"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :api="{
                url: `${API_BASE_URL}/fn/t_treq/getAvailableWoAsal`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no,item_nama,item_kode,nama_customer',
                  ...(values.m_unit_bisnis_id ? { m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              valueField="id"
              displayField="no"
              placeholder="Pilih No WO Asal"
              :columns="[
                { field: 'no', headerName: 'No WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'nama_customer', headerName: 'Customer', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
                {
                  field: 'item_nama',
                  headerName: 'Item',
                  width: '240px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  valueGetter: (p: any) => p.data?.item_kode && p.data?.item_nama ? `${p.data.item_kode} - ${p.data.item_nama}` : (p.data?.item_nama || '-')
                },
                { field: 'warehouse_nama', headerName: 'Warehouse Asal', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              :errorText="errors.t_wo_id ? 'failed' : ''"
              :hints="errors.t_wo_id || 'Pilih WO dengan stok material transfer tersedia'"
              @input="(v) => {
                if (values.t_wo_id && v !== values.t_wo_id && detailArr.length > 0) {
                  detailArr = []
                  toast.info('Detail material direset karena No WO Asal diganti')
                }
                values.t_wo_id = v
                if (!v) {
                  values.t_wo_d_item_id = ''
                  selectedItemAsalLabel = ''
                  selectedWoAsalLabel = ''
                  detailArr = []
                }
              }"
              @update:valueFull="handleWoAsalSelected"
              class="w-full"
            />

            <!-- Item Asal (readonly — terisi otomatis dari WO Asal) -->
            <FieldX
              id="t_wo_d_item_id_display"
              label="Item Asal"
              :value="selectedItemAsalLabel || '-'"
              :disabled="true"
              :readonly="true"
              :required="!isReadOnly"
              placeholder="Terisi otomatis dari WO Asal"
              :errorText="errors.t_wo_d_item_id ? 'failed' : ''"
              :hints="errors.t_wo_d_item_id || 'Terisi otomatis berdasarkan WO Asal yang dipilih (readonly)'"
              class="w-full opacity-80"
            />

            <!-- Warehouse Asal (flag = PROD) -->
            <FieldSelect
              id="m_warehouse_id"
              label="Warehouse Asal"
              :value="values.m_warehouse_id"
              :display-value="selectedWarehouseAsalLabel"
              :api="warehouseProdApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Asal"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :errorText="errors.m_warehouse_id ? 'failed' : ''"
              :hints="errors.m_warehouse_id || 'Warehouse flag PROD'"
              @input="v => values.m_warehouse_id = v"
              @update:valueFull="handleWarehouseAsalSelected"
              class="w-full"
            />

            <!-- Spacer -->
            <div class="hidden md:block" />

            <!-- ── SECTION: WO TUJUAN ── -->
            <!-- No WO Tujuan (hanya WO approved yang berbeda dengan WO Asal) -->
            <FieldPopup
              id="to_t_wo_id"
              label="No WO Tujuan"
              :value="values.to_t_wo_id"
              :display-value="selectedWoTujuanLabel"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :exclude-ids="values.t_wo_id ? [values.t_wo_id] : []"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no,notes,catatan',
                  order_by: 'createdAt',
                  order_type: 'DESC',
                  join: 'true',
                  include: 'm_customer',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              valueField="id"
              displayField="no"
              placeholder="Pilih No WO Tujuan"
              :columns="[
                { field: 'no', headerName: 'No WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'date', headerName: 'Date', width: '130px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'm_customer.nama_customer', headerName: 'Customer', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'status', headerName: 'Status', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              :errorText="errors.to_t_wo_id ? 'failed' : ''"
              :hints="errors.to_t_wo_id || 'Pilih WO Tujuan (harus berbeda dari WO Asal)'"
              @input="(v) => {
                if (values.to_t_wo_id && v !== values.to_t_wo_id && detailArr.length > 0) {
                  detailArr = []
                  toast.info('Detail material direset karena No WO Tujuan diganti')
                }
                values.to_t_wo_id = v
                if (!v) {
                  values.to_t_wo_d_item_id = ''
                  selectedItemTujuanLabel = ''
                  selectedWoTujuanLabel = ''
                  detailArr = []
                }
              }"
              @update:valueFull="handleWoTujuanSelected"
              class="w-full"
            />

            <!-- Item Tujuan (readonly — terisi otomatis dari WO Tujuan) -->
            <FieldX
              id="to_t_wo_d_item_id_display"
              label="Item Tujuan"
              :value="selectedItemTujuanLabel || '-'"
              :disabled="true"
              :readonly="true"
              :required="!isReadOnly"
              placeholder="Terisi otomatis dari WO Tujuan"
              :errorText="errors.to_t_wo_d_item_id ? 'failed' : ''"
              :hints="errors.to_t_wo_d_item_id || 'Terisi otomatis berdasarkan WO Tujuan (harus beda dari Item Asal)'"
              class="w-full opacity-80"
            />

            <!-- Warehouse Tujuan (flag = PROD, boleh sama dengan Warehouse Asal) -->
            <FieldSelect
              id="to_warehouse_id"
              label="Warehouse Tujuan"
              :value="values.to_warehouse_id"
              :display-value="selectedWarehouseTujuanLabel"
              :api="warehouseProdApiConfig"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse Tujuan"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :errorText="errors.to_warehouse_id ? 'failed' : ''"
              :hints="errors.to_warehouse_id || 'Warehouse flag PROD (boleh sama dengan asal)'"
              @input="v => values.to_warehouse_id = v"
              @update:valueFull="handleWarehouseTujuanSelected"
              class="w-full"
            />

            <!-- Notes -->
            <FieldX
              id="notes"
              type="textarea"
              label="Notes"
              :value="values.notes"
              @input="v => values.notes = v"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan (opsional)"
              class="w-full md:col-span-2"
            />

          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TAB -->
      <Tabs default-value="detail_material" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="detail_material">Detail Material</TabsTrigger>
        </TabsList>

        <TabsContent value="detail_material" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Material</CardTitle>
                  <CardDescription>
                    Material yang akan ditransfer antar Work Order (berdasarkan Material Transfer dari WO Asal)
                  </CardDescription>
                </div>
                <!-- ButtonMultiSelect dari /fn/t_treq/getAvailableMaterials -->
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Add To List"
                  :disabled="loading || !values.t_wo_id"
                  :api="mtfMaterialApiConfig"
                  :columns="mtfMaterialColumns"
                  :exclude-ids="existingMtfDIds"
                  search-key="nama_item"
                  unique-key="id"
                  @add="handleMaterialsAdded"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th class="px-3 py-3 text-left w-12">No</th>
                      <th class="px-3 py-3 text-left min-w-[150px]">No MTF</th>
                      <th class="px-3 py-3 text-left min-w-[200px]">Material</th>
                      <th class="px-3 py-3 text-right w-28">Qty Transfer Confirm</th>
                      <th class="px-3 py-3 text-right w-24">Qty Usage</th>
                      <th class="px-3 py-3 text-right w-28">Qty Transfer SPK</th>
                      <th class="px-3 py-3 text-right w-24">Qty Return</th>
                      <th class="px-3 py-3 text-right w-28">Qty Available</th>
                      <th class="px-3 py-3 text-right w-32">Qty</th>
                      <th class="px-3 py-3 text-left w-20">Unit</th>
                      <th class="px-3 py-3 text-left min-w-[140px]">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-3 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="detailArr.length === 0">
                      <td :colspan="isReadOnly ? 11 : 12" class="text-center py-10 text-muted-foreground text-sm">
                        Belum ada material ditambahkan. Klik <strong>Add To List</strong> untuk memilih material.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr"
                      :key="detail.id || detail.t_mtf_d_id || idx"
                      class="hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-xs text-muted-foreground">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 text-sm font-medium text-foreground">{{ detail.no_mtf || '-' }}</td>
                      <td class="px-3 py-2 text-sm font-medium">{{ detail.item_name || '-' }}</td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">
                        {{ Number(detail.qty_transfer_confirm ?? 0).toLocaleString('id-ID') }}
                      </td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">
                        {{ Number(detail.qty_usage ?? 0).toLocaleString('id-ID') }}
                      </td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">
                        {{ Number(detail.qty_oper ?? 0).toLocaleString('id-ID') }}
                      </td>
                      <td class="px-3 py-2 text-right text-sm text-muted-foreground">
                        {{ Number(detail.qty_return ?? 0).toLocaleString('id-ID') }}
                      </td>
                      <td class="px-3 py-2 text-right text-sm font-semibold text-foreground">
                        {{ Number(detail.qty_available ?? 0).toLocaleString('id-ID') }}
                      </td>
                      <td class="px-3 py-2">
                        <div v-if="!isReadOnly" class="space-y-1">
                          <FieldNumber
                            :value="detail.qty"
                            @input="v => detail.qty = Number(v)"
                            :min="0"
                            :disabled="loading"
                            class="w-28 text-right"
                          />
                          <span
                            v-if="Number(detail.qty) > Number(detail.qty_available ?? 0)"
                            class="text-[11px] text-destructive block">
                            Max: {{ detail.qty_available }}
                          </span>
                        </div>
                        <span v-else class="text-sm text-right block font-medium">
                          {{ Number(detail.qty || 0).toLocaleString('id-ID') }}
                        </span>
                      </td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">{{ detail.uom || '-' }}</td>
                      <td class="px-3 py-2">
                        <FieldX
                          v-if="!isReadOnly"
                          :value="detail.notes"
                          @input="v => detail.notes = v"
                          placeholder="Catatan"
                          :disabled="loading"
                          class="min-w-[130px]"
                        />
                        <span v-else class="text-sm text-muted-foreground">{{ detail.notes || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          class="h-7 w-7"
                          @click="removeDetailArr(idx)"
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
    title="POST WO Transfer Request"
    :description="`Apakah Anda yakin ingin POST WO Transfer Request &quot;${values.no || 'ini'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event" />
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
