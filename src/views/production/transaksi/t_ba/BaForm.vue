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
import { FieldX, FieldNumber, FieldStatus, FieldPopup, FieldSelect, FieldTextarea } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { Trash2, ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { apiCall } from '@/lib/api'
import { createBa, updateBa, getBaById, type BaItem, type BaDetailItem } from './service'
import { Badge } from '@/components/ui/badge'
import { getApprovalStatusBadgeClass } from '@/lib/approvalStatus'

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
const isEditMode = computed(() => !!route.params.id && (route.name === 'BaForm' || route.path.includes('/form/')))
const isViewMode = computed(() => route.name === 'BaView' || route.path.includes('/view/'))
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()))
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value)
const menuId = computed(() => route.params.id as string)

const selectedWoLabel = ref('')
const selectedWoItemLabel = ref('')
const selectedWoRoutingLabel = ref('')
const selectedUnitBisnisCompanyName = ref('')
const selectedUnitBisnisLabel = ref('')
const selectedWarehouseLabel = ref('')
const selectedReasonLabel = ref('')

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

// Handle type change - clear details when type changes
const handleTypeChange = (newType: string) => {
  values.type = newType
  // Clear detail items when type changes since the data source will be different
  detailItems.value = []
}

// Check if should use WO materials or Master materials based on type
const isWoMaterialSource = computed(() => {
  return values.type === 'CHANGE MATERIAL' || values.type === 'ADD QTY'
})

const isMasterMaterialSource = computed(() => {
  return values.type === 'ADD MATERIAL'
})

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Berita Acara'
  if (isCopyMode.value) return 'Salin Berita Acara'
  if (isEditMode.value) return 'Edit Berita Acara'
  return 'Tambah Berita Acara Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Berita Acara'
  if (isCopyMode.value) return 'Buat Berita Acara baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Berita Acara'
  return 'Buat Berita Acara baru'
})

// Form values
const values = reactive({
  m_unit_bisnis_id: '',
  no: '',
  date: new Date().toISOString().split('T')[0],
  type: '',
  t_wo_id: '',
  t_wo_d_item_id: '',
  t_wo_sd_routing_id: '',
  warehouse_id: '',
  reason_id: '',
  notes: '',
  status: 'DRAFT' as 'DRAFT' | 'POST' | 'CONFIRM'
})

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  type: '',
  t_wo_id: '',
  warehouse_id: '',
  reason_id: ''
})

const detailItems = ref<BaDetailItem[]>([])

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: '',
    no: '',
    date: new Date().toISOString().split('T')[0],
    type: '',
    t_wo_id: '',
    t_wo_d_item_id: '',
    t_wo_sd_routing_id: '',
    warehouse_id: '',
    reason_id: '',
    notes: '',
    status: 'DRAFT'
  })

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  detailItems.value = []
  selectedWoLabel.value = ''
  selectedWoItemLabel.value = ''
  selectedWoRoutingLabel.value = ''
  selectedUnitBisnisCompanyName.value = ''
  selectedUnitBisnisLabel.value = ''
  selectedWarehouseLabel.value = ''
  selectedReasonLabel.value = ''
}

// ============================================================================
// ASYNC RELATIONAL LABELS FETCHERS
// ============================================================================
const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = ''
    return
  }
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`)
    if (res.status === 'success' && res.data) {
      selectedUnitBisnisCompanyName.value = res.data.m_company?.nama_company || res.data.nama_comp || ''
    }
  } catch (error) {
    console.error('Gagal mengambil nama unit bisnis', error)
  }
}

const handleUnitBisnisSelected = (item: any) => {
  if (!item) {
    selectedUnitBisnisCompanyName.value = ''
    selectedUnitBisnisLabel.value = ''
    return
  }
  selectedUnitBisnisCompanyName.value = item.m_company?.nama_company || item.m_company?.nama || item.nama_comp || ''
  selectedUnitBisnisLabel.value = item.nama_comp || ''
}

const handleWarehouseSelected = (item: any) => {
  selectedWarehouseLabel.value = item ? (item.nama_gudang || '') : ''
}

const handleReasonSelected = (item: any) => {
  selectedReasonLabel.value = item ? (item.value1 || '') : ''
}

// ============================================================================
// POPUP EVENT HANDLERS
// ============================================================================
const handleWoSelected = async (item: any) => {
  if (item) {
    values.t_wo_id = item.id || ''
    selectedWoLabel.value = item.no || ''
    values.m_unit_bisnis_id = item.m_unit_bisnis_id || ''
    fetchUnitBisnisCompanyName(item.m_unit_bisnis_id)
    
    try {
      const res = await apiCall<{ status: string; data: any }>(`/fn/t_wo/getWoDetail?id=${item.id}`)
      if (res.status === 'success' && res.data) {
        const fullWo = res.data
        if (fullWo.t_wo_d_items && fullWo.t_wo_d_items.length > 0) {
          const dItem = fullWo.t_wo_d_items[0]
          values.t_wo_d_item_id = dItem.id
          selectedWoItemLabel.value = dItem.m_item 
            ? `${dItem.m_item.kode_item || dItem.m_item.kode || '-'} - ${dItem.m_item.nama_item || dItem.m_item.nama || '-'}` 
            : dItem.id

          if (dItem.t_wo_sd_routings && dItem.t_wo_sd_routings.length > 0) {
            const routing = dItem.t_wo_sd_routings[0]
            values.t_wo_sd_routing_id = routing.id
            selectedWoRoutingLabel.value = routing.m_routing 
              ? `${routing.m_routing.code || '-'} (${routing.m_item?.kode_item || routing.m_item?.kode || '-'})` 
              : routing.id
          } else {
            values.t_wo_sd_routing_id = ''
            selectedWoRoutingLabel.value = ''
          }
        } else {
          values.t_wo_d_item_id = ''
          selectedWoItemLabel.value = ''
          values.t_wo_sd_routing_id = ''
          selectedWoRoutingLabel.value = ''
        }
      }
    } catch (error) {
      console.error('Gagal memuat detail Work Order terpilih', error)
    }

    // Reset details if WO changes
    detailItems.value = []
  } else {
    values.t_wo_id = ''
    selectedWoLabel.value = ''
    values.m_unit_bisnis_id = ''
    selectedUnitBisnisCompanyName.value = ''
    values.t_wo_d_item_id = ''
    selectedWoItemLabel.value = ''
    values.t_wo_sd_routing_id = ''
    selectedWoRoutingLabel.value = ''
    detailItems.value = []
  }
}

const handleWoItemFullSelected = (item: any) => {
  if (item) {
    selectedWoItemLabel.value = item.m_item ? `${item.m_item.kode_item || item.m_item.kode || '-'} - ${item.m_item.nama_item || item.m_item.nama || '-'}` : item.id
  } else {
    selectedWoItemLabel.value = ''
  }
}

const handleWoRoutingFullSelected = (item: any) => {
  if (item) {
    selectedWoRoutingLabel.value = item.m_routing ? `${item.m_routing.code || '-'} (${item.m_item?.kode_item || item.m_item?.kode || '-'})` : item.id
  } else {
    selectedWoRoutingLabel.value = ''
  }
}

const handleMaterialsAdded = (items: any[]) => {
  // For CHANGE MATERIAL and ADD QTY - add from WO materials
  items.forEach((item) => {
    const matId = item.t_wo_sd_material_id || item.id || ''
    if (!matId) return
    // Avoid duplicate material addition
    if (detailItems.value.some(d => d.t_wo_sd_material_id === matId)) return

    const uom = item.uom || item.m_item?.mi_uom?.value1 || item.m_general?.value1 || ''
    const isAddQty = values.type === 'ADD QTY'

    detailItems.value.push({
      sequence: detailItems.value.length + 1,
      t_wo_sd_material_id: matId,
      material_wo_label: item.nama_material || (item.m_item ? `${item.m_item.kode_item || item.m_item.kode || '-'} - ${item.m_item.nama_item || item.m_item.nama || '-'}` : '-'),
      m_item_id: isAddQty ? (item.m_item_id || item.m_item?.id || '') : '',
      qty_wo: item.qty_wo ?? item.qty ?? 0,
      qty_stock: item.qty_stock ?? 0,
      qty: 0,
      unit_id: isAddQty ? (item.unit_id || item.m_item?.uom_id || '') : '',
      uom: isAddQty ? uom : '',
      qty_confirm: 0,
      notes: item.notes || '',
      m_item: isAddQty ? (item.m_item || (item.nama_material ? { kode_item: item.kode_item, nama_item: item.nama_item } : null)) : null,
      m_general: isAddQty && uom ? { value1: uom } : null,
      t_wo_sd_material: item,
    })
  })
}

// Handle ADD MATERIAL from Master Material
const handleMasterMaterialsAdded = (items: any[]) => {
  items.forEach((item) => {
    const itemId = item.id || item.m_item_id || ''
    if (!itemId) return
    // Avoid duplicate material addition based on m_item_id
    if (detailItems.value.some(d => d.m_item_id === itemId)) return

    const uom = item.uom || item.mi_uom?.value1 || item.m_general?.value1 || ''
    detailItems.value.push({
      sequence: detailItems.value.length + 1,
      t_wo_sd_material_id: null,
      material_wo_label: '-',
      m_item_id: itemId,
      qty_wo: 0,
      qty_stock: item.qty_stock ?? 0,
      qty: 0,
      unit_id: item.unit_id || item.uom_id || item.mi_uom?.id || '',
      uom: uom,
      qty_confirm: 0,
      notes: '',
      m_item: item.m_item || item,
      m_general: uom ? { value1: uom } : null,
    })
  })
}

const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1)
  detailItems.value = detailItems.value.map((row, idx) => ({ ...row, sequence: idx + 1 }))
}

const normalizeDetailItems = (rows: any[] = []) =>
  rows.map((row: any, index: number) => {
    const woMat = row.t_wo_sd_material || {}
    const woItem = woMat.m_item || {}
    const baItem = row.m_item || row.m_items || {}
    const uom = row.uom || baItem.mi_uom?.value1 || row.m_general?.value1 || woItem.mi_uom?.value1 || ''

    return {
      id: row.id,
      t_ba_id: row.t_ba_id,
      sequence: row.sequence ?? index + 1,
      t_wo_sd_material_id: row.t_wo_sd_material_id ?? null,
      material_wo_label: woItem.nama_item ? `${woItem.kode_item || '-'} - ${woItem.nama_item}` : (row.material_wo_label || '-'),
      m_item_id: row.m_item_id ?? '',
      qty_wo: woMat.qty ?? row.qty_wo ?? 0,
      qty_stock: row.qty_stock ?? 0,
      qty: row.qty ?? 0,
      unit_id: row.unit_id ?? '',
      uom: uom,
      qty_confirm: row.qty_confirm ?? 0,
      notes: row.notes ?? '',
      m_item: baItem.id ? baItem : null,
      t_wo_sd_material: woMat.id ? woMat : null,
      m_general: uom ? { value1: uom } : null,
    }
  })

const asArray = (value: unknown) => (Array.isArray(value) ? value : [])

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
    const res = await getBaById(sourceId)
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
    values.m_unit_bisnis_id = raw.m_unit_bisnis_id ?? ''
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }
    
    values.no = raw.no ?? ''
    values.date = (raw.date || '').slice(0, 10)
    values.type = raw.type ?? ''
    values.t_wo_id = raw.t_wo_id ?? ''
    values.t_wo_d_item_id = raw.t_wo_d_item_id ?? ''
    values.t_wo_sd_routing_id = raw.t_wo_sd_routing_id ?? ''
    values.warehouse_id = raw.warehouse_id ?? ''
    values.reason_id = raw.reason_id ?? ''
    values.notes = raw.notes ?? ''
    values.status = raw.status ?? 'DRAFT'

    // Retrieve display labels
    if (raw.m_unit_bisni) {
      selectedUnitBisnisLabel.value = raw.m_unit_bisni.nama_comp || ''
    }
    if (raw.m_gudang) {
      selectedWarehouseLabel.value = raw.m_gudang.nama_gudang || ''
    }
    if (raw.m_general) {
      selectedReasonLabel.value = raw.m_general.value1 || ''
    }
    if (raw.t_wo) {
      selectedWoLabel.value = raw.t_wo.no || ''
    }
    if (raw.t_wo_d_item) {
      const dItem = raw.t_wo_d_item
      selectedWoItemLabel.value = dItem.m_item ? `${dItem.m_item.kode_item || dItem.m_item.kode || '-'} - ${dItem.m_item.nama_item || dItem.m_item.nama || '-'}` : dItem.id
    }
    if (raw.t_wo_sd_routing) {
      const routing = raw.t_wo_sd_routing
      selectedWoRoutingLabel.value = routing.m_routing ? `${routing.m_routing.code || '-'} (${routing.m_item?.kode_item || routing.m_item?.kode || '-'})` : routing.id
    }

    detailItems.value = normalizeDetailItems(asArray(raw.t_ba_d || raw.t_ba_ds || raw.t_ba_details))

    if (isCopyModeLocal) {
      values.no = ''
      values.status = 'DRAFT'
      detailItems.value = detailItems.value.map(row => {
        const copy = { ...row }
        delete copy.id
        delete copy.t_ba_id
        return copy
      })
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', { description: 'Silakan edit dan simpan sebagai Berita Acara baru' })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Berita Acara', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    setTimeout(() => router.push('/production/transaksi/t_ba'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Clear previous errors
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  if (!values.date) { errors.date = 'Tanggal wajib diisi'; invalid = true }
  if (!values.type?.trim()) { errors.type = 'Tipe wajib diisi'; invalid = true }
  if (!values.t_wo_id) { errors.t_wo_id = 'Work Order wajib dipilih'; invalid = true }
  if (!values.warehouse_id) { errors.warehouse_id = 'Gudang wajib dipilih'; invalid = true }
  if (!values.reason_id) { errors.reason_id = 'Alasan wajib dipilih'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  if (detailItems.value.length === 0) {
    toast.error('Validasi gagal', { description: 'Minimal harus ada 1 detail material' })
    return
  }

  // Validasi khusus per tipe
  for (let i = 0; i < detailItems.value.length; i++) {
    const d = detailItems.value[i]
    if (!d) continue

    if (values.type === 'CHANGE MATERIAL' && !d.m_item_id) {
      toast.error('Validasi gagal', { description: `Baris ${i + 1}: Material BA / Material Pengganti wajib dipilih` })
      return
    }

    if (values.type === 'ADD MATERIAL' && !d.m_item_id) {
      toast.error('Validasi gagal', { description: `Baris ${i + 1}: Material BA wajib dipilih` })
      return
    }

    const qtyVal = Number(d.qty || 0)
    if (qtyVal <= 0) {
      toast.error('Validasi gagal', { description: `Baris ${i + 1}: Qty BA harus lebih besar dari 0` })
      return
    }

    // Untuk ADD QTY dan CHANGE MATERIAL: qty tidak boleh melebihi qty_wo
    if ((values.type === 'ADD QTY' || values.type === 'CHANGE MATERIAL') && d.qty_wo !== undefined) {
      const qtyWo = Number(d.qty_wo || 0)
      if (qtyWo > 0 && qtyVal > qtyWo) {
        toast.error('Validasi gagal', {
          description: `Baris ${i + 1}: Qty BA (${qtyVal}) tidak boleh melebihi Qty WO (${qtyWo})`
        })
        return
      }
    }
  }

  loading.value = true
  try {
    const payload: Partial<BaItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      no: values.no || undefined,
      date: values.date,
      type: values.type,
      t_wo_id: values.t_wo_id,
      t_wo_d_item_id: values.t_wo_d_item_id || undefined,
      t_wo_sd_routing_id: values.t_wo_sd_routing_id || undefined,
      warehouse_id: values.warehouse_id,
      reason_id: values.reason_id,
      notes: values.notes || undefined,
      status: values.status,
      t_ba_d: detailItems.value.map((row, idx) => ({
        sequence: idx + 1,
        t_wo_sd_material_id: (values.type === 'CHANGE MATERIAL' || values.type === 'ADD QTY') ? (row.t_wo_sd_material_id || null) : null,
        m_item_id: row.m_item_id || row.m_item?.id || null,
        qty: Number(row.qty || 0),
        unit_id: row.unit_id || row.m_item?.uom_id || row.m_item?.mi_uom?.id || null,
        qty_confirm: row.qty_confirm !== undefined && row.qty_confirm !== null && row.qty_confirm !== '' ? Number(row.qty_confirm) : 0,
        notes: row.notes?.trim() || undefined
      }))
    }
    
    if (isEditMode.value) {
      await updateBa(menuId.value, payload)
      toast.success('Berita Acara berhasil diperbarui')
    } else {
      await createBa(payload)
      toast.success('Berita Acara berhasil dibuat')
    }
    router.replace('/production/transaksi/t_ba?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui data' : 'Gagal membuat data', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/production/transaksi/t_ba')
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
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Berita Acara</CardTitle>
          <CardDescription>Isi detail informasi Berita Acara (t_ba) dengan lengkap</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis Selector -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis (Company)"
              :value="values.m_unit_bisnis_id"
              :display-value="selectedUnitBisnisLabel"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk Berita Acara ini'"
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :required="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'kode_unit_bisnis,nama_comp',
                  join: 'true'
                },
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Unit Bisnis"
              @input="(v) => {
                values.m_unit_bisnis_id = v;
                // Clear dependent selectors
                values.t_wo_id = '';
                values.t_wo_d_item_id = '';
                values.t_wo_sd_routing_id = '';
                selectedWoLabel = '';
                selectedWoItemLabel = '';
                selectedWoRoutingLabel = '';
                detailItems = [];
              }"
              @update:valueFull="handleUnitBisnisSelected"
            />

            <!-- Company (readonly) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="w-full opacity-70"
            />

            <!-- No BA -->
            <FieldX 
              id="no" 
              label="No Berita Acara" 
              :value="values.no" 
              :readonly="true" 
              placeholder="AUTO GENERATED" 
              class="w-full opacity-70" 
            />

            <!-- Date -->
            <FieldX 
              id="date" 
              label="Tanggal" 
              type="date"
              :value="values.date" 
              :errorname="errors.date ? 'failed' : ''"
              @input="v => values.date = v" 
              :hints="errors.date" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              class="w-full" 
            />

            <!-- Type Selector -->
            <FieldSelect
              id="type"
              label="Tipe"
              :value="values.type"
              :errorText="errors.type ? 'failed' : ''"
              :hints="errors.type || 'Pilih tipe berita acara'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :options="[
                { label: 'ADD MATERIAL', value: 'ADD MATERIAL' },
                { label: 'CHANGE MATERIAL', value: 'CHANGE MATERIAL' },
                { label: 'ADD QTY', value: 'ADD QTY' }
              ]"
              display-field="label"
              value-field="value"
              placeholder="Pilih Tipe"
              class="w-full"
              @input="handleTypeChange"
            />

            <!-- Work Order Selector -->
            <FieldPopup
              id="t_wo_id"
              label="Work Order"
              :value="values.t_wo_id"
              :disabled="loading || isReadOnly || isEditMode"
              :readonly="isReadOnly || isEditMode"
              :clearable="true"
              :display-value="selectedWoLabel"
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
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
                },
              }"
              valueField="id"
              displayField="no"
              placeholder="Pilih Work Order"
              :columns="[
                { field: 'no', headerName: 'No WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'date', headerName: 'Date', width: '130px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'flag', headerName: 'Tipe WO', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'm_customer.nama_customer', headerName: 'Customer', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'status', headerName: 'Status', width: '110px', sortable: true },
              ]"
              @input="(v) => {
                values.t_wo_id = v;
                values.t_wo_d_item_id = '';
                values.t_wo_sd_routing_id = '';
              }"
              @update:valueFull="handleWoSelected"
            />

            <!-- WO Item (Read-Only) -->
            <FieldX
              id="t_wo_d_item_id"
              label="WO Item"
              :value="selectedWoItemLabel"
              :readonly="true"
              placeholder="-"
              class="opacity-70"
            />

            <!-- WO Routing Selector -->
            <FieldPopup
              id="t_wo_sd_routing_id"
              label="WO Routing"
              :value="values.t_wo_sd_routing_id"
              :disabled="loading || isReadOnly || !values.t_wo_id"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedWoRoutingLabel"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo_sd_routing`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'notes',
                  order_by: 'sequence',
                  order_type: 'ASC',
                  join: 'true',
                  ...(values.t_wo_id ? { filter_column_t_wo_id: values.t_wo_id } : {}),
                  ...(values.t_wo_d_item_id ? { filter_column_t_wo_d_item_id: values.t_wo_d_item_id } : {}),
                },
              }"
              valueField="id"
              displayField="m_routing.code"
              placeholder="Pilih WO Routing"
              :columns="[
                { field: 'sequence', headerName: 'Seq', width: '90px', sortable: true },
                { field: 'm_routing.code', headerName: 'Kode Routing', width: '150px', sortable: true },
                { field: 'm_item.kode_item', headerName: 'Item Output', width: '150px', sortable: true },
                { field: 'qty', headerName: 'Qty', width: '120px', sortable: true },
                { field: 'notes', headerName: 'Notes', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              @input="(v) => (values.t_wo_sd_routing_id = v)"
              @update:valueFull="handleWoRoutingFullSelected"
            />

            <!-- Warehouse Selector (Flag = 'INV') -->
            <FieldSelect
              id="warehouse_id"
              label="Warehouse"
              :value="values.warehouse_id"
              :display-value="selectedWarehouseLabel"
              :errorText="errors.warehouse_id ? 'failed' : ''"
              :hints="errors.warehouse_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :required="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,kode_gudang,nama_gudang,flag',
                  searchfield: 'kode_gudang,nama_gudang',
                  filter_column_flag: 'INV',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
                },
              }"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse"
              @input="(v) => (values.warehouse_id = v)"
              @update:valueFull="handleWarehouseSelected"
            />

            <!-- Reason Selector -->
            <FieldSelect
              id="reason_id"
              label="Alasan (Reason)"
              :value="values.reason_id"
              :display-value="selectedReasonLabel"
              :errorText="errors.reason_id ? 'failed' : ''"
              :hints="errors.reason_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :required="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,code,value1',
                  searchfield: 'code,value1',
                  filter_column_key1: 'm_ba_reason'
                },
              }"
              display-field="value1"
              value-field="id"
              placeholder="Pilih Alasan"
              @input="(v) => (values.reason_id = v)"
              @update:valueFull="handleReasonSelected"
            />

            <!-- Status (readonly) -->
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

          <!-- Notes -->
          <FieldTextarea 
            id="notes" 
            label="Catatan (Notes)" 
            :value="values.notes" 
            @input="v => values.notes = v" 
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Tambahkan catatan jika diperlukan..." 
            class="w-full" 
          />
        </CardContent>
      </Card>

      <!-- DETAILS CARD -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Detail Material Berita Acara</CardTitle>
              <CardDescription>Kelola detail item penyesuaian material</CardDescription>
            </div>
            <div v-if="!isReadOnly" class="flex items-center gap-2">
              <!-- For CHANGE MATERIAL and ADD QTY - use WO Sub Detail Material -->
              <ButtonMultiSelect
                v-if="values.type === 'CHANGE MATERIAL' || values.type === 'ADD QTY'"
                title="+ Add Material WO"
                buttonClass="h-9"
                :disabled="loading || !values.t_wo_sd_routing_id || !values.t_wo_id"
                :excludeIds="detailItems.map(d => d.t_wo_sd_material_id || '').filter(id => !!id)"
                searchKey="tipe_material,nama_material,kode_item,nama_item"
                uniqueKey="t_wo_sd_material_id"
                :api="{
                  url: `${API_BASE_URL}/fn/t_ba/getWoMaterialForBa`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    t_wo_id: values.t_wo_id,
                    t_wo_d_item_id: values.t_wo_d_item_id,
                    t_wo_sd_routing_id: values.t_wo_sd_routing_id,
                    ...(values.warehouse_id ? { warehouse_id: values.warehouse_id } : {})
                  }
                }"
                :columns="[
                  { checkboxSelection: true, headerCheckboxSelection: true, width: '50px' },
                  { field: 'tipe_material', headerName: 'Tipe Material', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'nama_material', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'uom', headerName: 'UOM', width: '100px', sortable: true },
                  { field: 'qty_wo', headerName: 'Qty WO', width: '100px', sortable: true },
                  { field: 'qty_stock', headerName: 'Qty Stock', width: '110px', sortable: true },
                ]"
                @add="handleMaterialsAdded"
              />

              <!-- For ADD MATERIAL - use Master Material -->
              <ButtonMultiSelect
                v-else-if="values.type === 'ADD MATERIAL'"
                title="+ Add Material"
                buttonClass="h-9"
                :disabled="loading"
                :excludeIds="detailItems.map(d => d.m_item_id || '').filter(id => !!id)"
                searchKey="tipe_material,nama_material,kode_item,nama_item"
                uniqueKey="id"
                :api="{
                  url: `${API_BASE_URL}/fn/t_ba/getMasterMaterialForBa`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    ...(values.warehouse_id ? { warehouse_id: values.warehouse_id } : {})
                  }
                }"
                :columns="[
                  { checkboxSelection: true, headerCheckboxSelection: true, width: '50px' },
                  { field: 'tipe_material', headerName: 'Tipe Material', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'nama_material', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'uom', headerName: 'UOM', width: '100px', sortable: true },
                  { field: 'qty_stock', headerName: 'Qty Stock', width: '110px', sortable: true },
                ]"
                @add="handleMasterMaterialsAdded"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium w-12">No</th>
                  
                  <!-- For CHANGE MATERIAL -->
                  <template v-if="values.type === 'CHANGE MATERIAL'">
                    <th class="px-3 py-2 text-left font-medium min-w-[180px]">Material WO</th>
                    <th class="px-3 py-2 text-right font-medium w-24">Qty WO</th>
                    <th class="px-3 py-2 text-right font-medium w-24">Qty Stock</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[220px]">Material BA</th>
                    <th class="px-3 py-2 text-right font-medium w-36 min-w-[130px]">Qty BA</th>
                    <th class="px-3 py-2 text-left font-medium w-24">UoM</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[160px]">Catatan</th>
                  </template>

                  <!-- For ADD QTY -->
                  <template v-else-if="values.type === 'ADD QTY'">
                    <th class="px-3 py-2 text-left font-medium min-w-[180px]">Material WO</th>
                    <th class="px-3 py-2 text-right font-medium w-24">Qty WO</th>
                    <th class="px-3 py-2 text-right font-medium w-24">Qty Stock</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[180px]">Material BA</th>
                    <th class="px-3 py-2 text-right font-medium w-36 min-w-[130px]">Qty BA</th>
                    <th class="px-3 py-2 text-left font-medium w-24">UoM</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[160px]">Catatan</th>
                  </template>

                  <!-- For ADD MATERIAL -->
                  <template v-else-if="values.type === 'ADD MATERIAL'">
                    <th class="px-3 py-2 text-left font-medium min-w-[220px]">Material BA</th>
                    <th class="px-3 py-2 text-right font-medium w-24">Qty Stock</th>
                    <th class="px-3 py-2 text-right font-medium w-36 min-w-[130px]">Qty BA</th>
                    <th class="px-3 py-2 text-left font-medium w-24">UoM</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[160px]">Catatan</th>
                  </template>

                  <!-- Default (no type selected) -->
                  <template v-else>
                    <th class="px-3 py-2 text-left font-medium min-w-[200px]">Item</th>
                    <th class="px-3 py-2 text-right font-medium w-36 min-w-[130px]">Qty BA</th>
                    <th class="px-3 py-2 text-left font-medium w-24">UoM</th>
                    <th class="px-3 py-2 text-left font-medium min-w-[160px]">Catatan</th>
                  </template>

                  <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td colspan="12" class="text-center py-8 text-muted-foreground">
                    Belum ada detail material.
                  </td>
                </tr>
                <tr v-for="(detail, idx) in detailItems" :key="detail.id || idx" class="border-t hover:bg-muted/50">
                  <td class="px-3 py-2">{{ idx + 1 }}</td>
                  
                  <!-- For CHANGE MATERIAL -->
                  <template v-if="values.type === 'CHANGE MATERIAL'">
                    <!-- Material WO -->
                    <td class="px-3 py-2">
                      <span class="font-medium text-slate-700">{{ detail.material_wo_label || '-' }}</span>
                    </td>
                    <!-- Qty WO -->
                    <td class="px-3 py-2 text-right">
                      <span>{{ detail.qty_wo ?? 0 }}</span>
                    </td>
                    <!-- Qty Stock -->
                    <td class="px-3 py-2 text-right">
                      <span>{{ detail.qty_stock ?? 0 }}</span>
                    </td>
                    <!-- Material BA (Replacement Material Selector) -->
                    <td class="px-3 py-2">
                      <FieldPopup
                        v-if="!isReadOnly"
                        :id="`m_item_pengganti_${idx}`"
                        :value="detail.m_item_id || ''"
                        :display-value="detail.m_item ? (detail.m_item.kode_item || detail.m_item.kode || '-') + ' - ' + (detail.m_item.nama_item || detail.m_item.nama || '-') : ''"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        :clearable="true"
                        :api="{
                          url: `${API_BASE_URL}/dynamic/m_items`,
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${authStore.token}`,
                          },
                          params: {
                            searchfield: 'nama_item,kode_item,tipe_material',
                            join: 'true',
                            include: 'm_general@mi_uom,m_general@mi_tipe',
                          }
                        }"
                        valueField="id"
                        displayField="nama_item"
                        placeholder="Pilih Material Pengganti"
                        :columns="[
                          { field: 'kode_item', headerName: 'Kode', width: '120px', sortable: true },
                          { field: 'nama_item', headerName: 'Nama', width: '200px', sortable: true },
                          { field: 'mi_tipe.value1', headerName: 'Tipe', width: '120px', sortable: true },
                          { field: 'mi_uom.value1', headerName: 'UOM', width: '80px', sortable: true },
                        ]"
                        @input="(v) => {
                          detail.m_item_id = v
                          if (!v) {
                            detail.m_item = null
                            detail.unit_id = ''
                            detail.uom = ''
                          }
                        }"
                        @update:valueFull="(item) => {
                          detail.m_item_id = item?.id || ''
                          detail.m_item = item || null
                          detail.unit_id = item?.uom_id || item?.unit_id || item?.mi_uom?.id || ''
                          detail.uom = item?.mi_uom?.value1 || item?.uom || ''
                        }"
                      />
                      <div v-else>
                        <div class="font-semibold">{{ detail.m_item?.kode_item || detail.m_item?.kode || '-' }}</div>
                        <div class="text-xs text-muted-foreground">{{ detail.m_item?.nama_item || detail.m_item?.nama || '-' }}</div>
                      </div>
                    </td>
                    <!-- Qty BA -->
                    <td class="px-3 py-2 w-36 min-w-[130px]">
                      <FieldNumber
                        :id="`qty_${idx}`"
                        :model-value="Number(detail.qty || 0)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        type="decimal"
                        class="w-full"
                        @update:model-value="(v) => (detail.qty = v)"
                      />
                    </td>
                    <!-- UoM -->
                    <td class="px-3 py-2">
                      <span>{{ detail.uom || detail.m_item?.mi_uom?.value1 || '-' }}</span>
                    </td>
                    <!-- Catatan -->
                    <td class="px-3 py-2">
                      <input
                        v-if="!isReadOnly"
                        type="text"
                        v-model="detail.notes"
                        class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Catatan..."
                      />
                      <span v-else>{{ detail.notes || '-' }}</span>
                    </td>
                  </template>

                  <!-- For ADD QTY -->
                  <template v-else-if="values.type === 'ADD QTY'">
                    <!-- Material WO -->
                    <td class="px-3 py-2">
                      <span class="font-medium text-slate-700">{{ detail.material_wo_label || '-' }}</span>
                    </td>
                    <!-- Qty WO -->
                    <td class="px-3 py-2 text-right">
                      <span>{{ detail.qty_wo ?? 0 }}</span>
                    </td>
                    <!-- Qty Stock -->
                    <td class="px-3 py-2 text-right">
                      <span>{{ detail.qty_stock ?? 0 }}</span>
                    </td>
                    <!-- Material BA (Same as Material WO) -->
                    <td class="px-3 py-2">
                      <span>{{ detail.material_wo_label || '-' }}</span>
                    </td>
                    <!-- Qty BA -->
                    <td class="px-3 py-2 w-36 min-w-[130px]">
                      <FieldNumber
                        :id="`qty_${idx}`"
                        :model-value="Number(detail.qty || 0)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        type="decimal"
                        class="w-full"
                        @update:model-value="(v) => (detail.qty = v)"
                      />
                    </td>
                    <!-- UoM -->
                    <td class="px-3 py-2">
                      <span>{{ detail.uom || detail.m_item?.mi_uom?.value1 || '-' }}</span>
                    </td>
                    <!-- Catatan -->
                    <td class="px-3 py-2">
                      <input
                        v-if="!isReadOnly"
                        type="text"
                        v-model="detail.notes"
                        class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Catatan..."
                      />
                      <span v-else>{{ detail.notes || '-' }}</span>
                    </td>
                  </template>

                  <!-- For ADD MATERIAL -->
                  <template v-else-if="values.type === 'ADD MATERIAL'">
                    <!-- Material BA -->
                    <td class="px-3 py-2">
                      <div class="font-semibold">{{ detail.m_item?.kode_item || detail.m_item?.kode || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ detail.m_item?.nama_item || detail.m_item?.nama || '-' }}</div>
                    </td>
                    <!-- Qty Stock -->
                    <td class="px-3 py-2 text-right">
                      <span>{{ detail.qty_stock ?? 0 }}</span>
                    </td>
                    <!-- Qty BA -->
                    <td class="px-3 py-2 w-36 min-w-[130px]">
                      <FieldNumber
                        :id="`qty_${idx}`"
                        :model-value="Number(detail.qty || 0)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        type="decimal"
                        class="w-full"
                        @update:model-value="(v) => (detail.qty = v)"
                      />
                    </td>
                    <!-- UoM -->
                    <td class="px-3 py-2">
                      <span>{{ detail.uom || detail.m_item?.mi_uom?.value1 || '-' }}</span>
                    </td>
                    <!-- Catatan -->
                    <td class="px-3 py-2">
                      <input
                        v-if="!isReadOnly"
                        type="text"
                        v-model="detail.notes"
                        class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Catatan..."
                      />
                      <span v-else>{{ detail.notes || '-' }}</span>
                    </td>
                  </template>

                  <!-- Default (fallback) -->
                  <template v-else>
                    <td class="px-3 py-2">
                      <div class="font-semibold">{{ detail.m_item?.kode_item || detail.m_item?.kode || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ detail.m_item?.nama_item || detail.m_item?.nama || '-' }}</div>
                    </td>
                    <td class="px-3 py-2 w-36 min-w-[130px]">
                      <FieldNumber
                        :id="`qty_${idx}`"
                        :model-value="Number(detail.qty || 0)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        type="decimal"
                        class="w-full"
                        @update:model-value="(v) => (detail.qty = v)"
                      />
                    </td>
                    <td class="px-3 py-2">
                      <span>{{ detail.uom || '-' }}</span>
                    </td>
                    <td class="px-3 py-2">
                      <input
                        v-if="!isReadOnly"
                        type="text"
                        v-model="detail.notes"
                        class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Catatan..."
                      />
                      <span v-else>{{ detail.notes || '-' }}</span>
                    </td>
                  </template>

                  <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                    <Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="removeDetailItem(idx)">
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- ACTION CONTROL BUTTONS -->
      
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
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
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
</style>