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
import { FieldX, FieldNumber, FieldSelect, FieldStatus, FieldPopup, FieldDate } from '@/components/field'
import { DeleteButton } from '@/components/button'
import { Trash2 } from 'lucide-vue-next'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createIo,
  updateIo,
  getIoById,
  type IoItem,
  type IoItemDetail,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'IoForm')
const isViewMode = computed(() => route.name === 'IoView')
const isCopyMode = computed(() => !!route.query.copy || (route.query.action === 'copy' && !!route.query.source))
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()))
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Internal Order'
  if (isCopyMode.value) return 'Salin Io'
  if (isEditMode.value) return 'Edit Internal Order'
  return 'Tambah Internal Order Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Io'
  if (isCopyMode.value) return 'Buat Io baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Internal Order'
  return 'Buat Io baru'
})

// Form values matching backend schema
const values = reactive({
  m_unit_bisnis_id: '',
  pic_id: '',
  date: '',
  no: '',
  notes: '',
  status: 'DRAFT',
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

// Parent company display state
const selectedUnitBisnisCompanyName = ref<string>("")

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
}

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = "";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result?.status === "success" && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama || result.data?.m_company?.kode || "-";
    }
  } catch (err) {
    console.error("Gagal mengambil nama company:", err);
  }
}

// Temp penampung data API mentah
let initialValues: Record<string, any> = {}

// Detail arrays
const detailArr = ref<IoItemDetail[]>([])

const selectedItemIds = computed(() => {
  return detailArr.value.map((row) => row.m_item_id).filter(Boolean) as string[]
})

const addDetailRow = () => {
  detailArr.value.push({
    m_item_id: '',
    m_item: null,
    item_type_id: '',
    qty: 0,
    unit_id: '',
    target_date: '',
    qty_spk: 0,
    notes: '',
  })
}

const handleDetailItemSelected = (row: IoItemDetail, item: any) => {
  row.m_item = item
  if (item?.uom_id) row.unit_id = item.uom_id
}

const handleDetailTypeChange = (row: IoItemDetail, v: string) => {
  if (row.item_type_id !== v && row.m_item_id) {
    row.m_item_id = ''
    row.m_item = null
  }
  row.item_type_id = v
}

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail dihapus')
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: '',
    pic_id: '',
    date: '',
    no: '',
    notes: '',
    status: 'DRAFT',
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  selectedUnitBisnisCompanyName.value = ""
  detailArr.value = []
}

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset()

  const isCopyModeLocal = route.query.copy !== undefined || (route.query.action === 'copy' && route.query.source)
  const sourceId = route.query.copy ? String(route.query.copy) : (isCopyModeLocal ? String(route.query.source) : menuId.value)

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    applyCurrentUserUnitBisnis()
    return
  }

  loading.value = true
  try {
    const res = await getIoById(sourceId)
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

    // Load detail items
    if (initialValues.t_io_ds) {
      detailArr.value = initialValues.t_io_ds.map((row: any) => ({
        id: row.id,
        t_io_id: row.t_io_id,
        sequence: row.sequence,
        item_type_id: row.item_type_id,
        m_item_id: row.m_item_id,
        qty: row.qty ?? 0,
        unit_id: row.unit_id,
        target_date: row.target_date ? row.target_date.split('T')[0] : '',
        qty_spk: row.qty_spk ?? 0,
        notes: row.notes ?? '',
        m_item: row.m_item,
        m_general_item_type: row.item_type_d_io || row.m_general_item_type || row.item_type || row.m_general,
        m_general_unit: row.unit_d_io || row.m_general_unit || row.unit || row.m_general2,
      }))
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      delete (initialValues as any).no
      
      detailArr.value = detailArr.value.map(row => {
        const copyRow = { ...row }
        delete copyRow.id
        delete copyRow.t_io_id
        return copyRow
      })
    }

    // Assign main fields
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }

    if (values.date) {
      values.date = values.date.slice(0, 10)
    }

    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Io baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Io', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/production/transaksi/t_io')
      }
    })
    setTimeout(() => router.push('/production/transaksi/t_io'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  pic_id: '',
  date: '',
  no: '',
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib dipilih'; invalid = true }
  if (!values.date) { errors.date = 'Tanggal wajib diisi'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Validasi detail: setiap baris qty harus lebih dari 0
  for (let i = 0; i < detailArr.value.length; i++) {
    const row = detailArr.value[i]!
    if (!row.m_item_id) {
      toast.error('Validasi detail gagal', { description: `Baris ${i + 1}: Item wajib dipilih` })
      return
    }
    if (!Number(row.qty) || Number(row.qty) <= 0) {
      toast.error('Validasi detail gagal', { description: `Baris ${i + 1}: Qty harus lebih dari 0` })
      return
    }
  }

  loading.value = true
  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      pic_id: values.pic_id || null,
      date: values.date || null,
      no: values.no || null,
      notes: values.notes || null,
      status: values.status || 'DRAFT',
      created_by: isEditMode.value ? undefined : (authStore.user?.id || null),
      updated_by: authStore.user?.id || null,
      t_io_ds: detailArr.value.map((row: any, index: number) => ({
        id: isCopyMode.value ? undefined : row.id,
        t_io_id: isCopyMode.value ? undefined : (menuId.value || undefined),
        sequence: index + 1,
        item_type_id: row.item_type_id || null,
        m_item_id: row.m_item_id || null,
        qty: row.qty !== '' ? Number(row.qty) : 0,
        unit_id: row.unit_id || null,
        target_date: row.target_date || null,
        qty_spk: row.qty_spk !== '' ? Number(row.qty_spk) : 0,
        notes: row.notes || null,
      }))
    }
    
    if (isEditMode.value) {
      await updateIo(menuId.value, payload)
      toast.success('Io berhasil diperbarui', { description: `Io "${values.no || 'tanpa nomor'}" telah diperbarui` })
    } else {
      const created = await createIo(payload)
      toast.success('Io berhasil dibuat', { description: `Io "${(created as any)?.data?.no || (created as any)?.no || 'tanpa nomor'}" telah ditambahkan` })
    }
    router.replace('/production/transaksi/t_io?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Io' : 'Gagal membuat Io', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/production/transaksi/t_io')
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
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Internal Order</CardTitle>
          <CardDescription>
            Isi data Io dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Unit Bisnis selector -->
                <FieldSelect
                  id="m_unit_bisnis_id"
                  label="Unit Bisnis"
                  :value="values.m_unit_bisnis_id"
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
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly || isUnitBisnisReadonly"
                  :readonly="isReadOnly || isUnitBisnisReadonly"
                  :clearable="!isUnitBisnisReadonly"
                  :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
                  :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk Io ini'"
                  @input="(v) => (values.m_unit_bisnis_id = v)"
                  @update:valueFull="handleUnitBisnisSelected"
                  class="w-full"
                />

                <!-- Company (readonly) -->
                <FieldX
                  id="company_display"
                  label="Company"
                  :value="selectedUnitBisnisCompanyName || '-'"
                  :disabled="true"
                  :readonly="true"
                  placeholder="-"
                  class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
                />

                <!-- No Io Field -->
                <FieldX 
                  id="no" 
                  label="No Io" 
                  :value="values.no || 'Auto generate sistem'" 
                  :disabled="true" 
                  :readonly="true" 
                  placeholder="Auto generate sistem" 
                  hints="Nomor dibuat otomatis oleh sistem" 
                  class="w-full" 
                />

                <!-- Tanggal Field -->
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

                <!-- PIC Field -->
                <FieldSelect
                  id="pic_id"
                  label="PIC"
                  :value="values.pic_id"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_kary`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      no_pagination: 'true',
                      selectfield: 'id,nama_kary',
                      filter_column_is_active: 'true',
                    },
                  }"
                  display-field="nama_kary"
                  value-field="id"
                  placeholder="Pilih PIC"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :clearable="true"
                  :errorText="errors.pic_id ? 'failed' : ''"
                  :hints="errors.pic_id || 'Pilih PIC untuk Io ini'"
                  @input="(v) => (values.pic_id = v)"
                  class="w-full"
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

          <!-- Notes / Catatan -->
          <div class="mt-4">
            <FieldX
              id="notes"
              label="Catatan"
              :value="values.notes"
              @input="(v) => (values.notes = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
              class="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
                    <TabsTrigger value="detail1">Detail Item</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Item Io</CardTitle>
                  <CardDescription>Kelola detail item t_io_ds</CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  size="sm"
                  variant="outline"
                  :disabled="loading || !values.m_unit_bisnis_id"
                  @click="addDetailRow"
                >
                  + Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Tipe Item</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Item</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Qty</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Satuan</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Target Date</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td :colspan="isReadOnly ? 7 : 8" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail. Klik "Tambah" untuk menambahkan baris.
                      </td>
                    </tr>
                    <tr v-for="(row, idx) in detailArr" :key="row.id || idx" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ idx + 1 }}</td>
                                            <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldSelect
                          v-if="!isReadOnly"
                          :id="`item_type_${idx}`"
                          :value="row.item_type_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_group: 'TIPE ITEM',
                              where: 'key1:FG||key1:WIP',
                              selectfield: 'id,value1',
                              searchfield: 'value1',
                            },
                          }"
                          display-field="value1"
                          value-field="id"
                          placeholder="Tipe Item"
                          :clearable="true"
                          @input="(v: string) => handleDetailTypeChange(row, v)"
                          class="w-full min-w-[150px]"
                        />
                        <span v-else>{{ row.m_general_item_type?.value1 || (row as any).item_type_d_io?.value1 || row.m_general?.value1 || row.item_type_id || "-" }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldPopup
                          v-if="!isReadOnly"
                          :id="`detail_item_${idx}`"
                          :value="row.m_item_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'kode_item,nama_item',
                              filter_column_is_active: 'true',
                              join: true,
                              include: 'm_items_unit_bisnis',
                              'filter_column_m_items_unit_bisnis.unit_bisnis_id': values.m_unit_bisnis_id || undefined,
                              ...(row.item_type_id ? { filter_column_tipe_id: row.item_type_id } : {}),
                            },
                          }"
                          display-field="nama_item"
                          value-field="id"
                          :display-value="row.m_item?.nama_item || ''"
                          :columns="[
                            { key: 'kode_item', label: 'Kode', width: '120px' },
                            { key: 'nama_item', label: 'Nama Item', width: '200px' },
                            { key: 'mi_uom.value1', label: 'Satuan', width: '200px' },
                          ]"
                          placeholder="Pilih Item"
                          :disabled="loading || !row.item_type_id"
                          :clearable="true"
                          :hints="!row.item_type_id ? 'Pilih Tipe terlebih dahulu' : ''"
                          :excludeIds="selectedItemIds"
                          @input="(v: string) => (row.m_item_id = v)"
                          @update:valueFull="(item: any) => handleDetailItemSelected(row, item)"
                          class="w-full min-w-[180px]"
                        />
                        <span v-else>{{ row.m_item?.nama_item || "-" }}</span>
                      </td>

                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-if="!isReadOnly"
                          :id="`qty_${idx}`"
                          :value="row.qty ?? 0"
                          type="decimal"
                          :min="0"
                          placeholder="Qty"
                          :disabled="loading"
                          @input="(v: string) => (row.qty = Number(v))"
                          class="w-24"
                        />
                        <span v-else>{{ row.qty || 0 }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldSelect
                          v-if="!isReadOnly"
                          :id="`unit_${idx}`"
                          :value="row.unit_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_group: 'UOM',
                              selectfield: 'id,value1',
                              searchfield: 'value1',
                            },
                          }"
                          display-field="value1"
                          value-field="id"
                          placeholder="Satuan"
                          :clearable="true"
                          @input="(v: string) => (row.unit_id = v)"
                          class="w-full min-w-[120px]"
                        />
                        <span v-else>{{ row.m_general_unit?.value1 || (row as any).unit_d_io?.value1 || row.unit_id || "-" }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldDate
                          v-if="!isReadOnly"
                          :id="`target_date_${idx}`"
                          label=""
                          :value="row.target_date || ''"
                          :disabled="loading"
                          placeholder="Pilih tanggal"
                          @input="(v: string) => (row.target_date = v)"
                          class="w-36"
                        />
                        <span v-else>{{ row.target_date ? new Date(row.target_date).toLocaleDateString('id-ID') : '-' }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldX
                          v-if="!isReadOnly"
                          :id="`notes_${idx}`"
                          label=""
                          :value="row.notes || ''"
                          :disabled="loading"
                          placeholder="Catatan"
                          @input="(v: string) => (row.notes = v)"
                          class="w-full min-w-[150px]"
                        />
                        <span v-else>{{ row.notes || "-" }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
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

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari, Opera */
}
</style>