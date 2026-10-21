<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldSelect, FieldTextarea, FieldStatus, FieldX } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import AuditInfo from '@/components/AuditInfo.vue'
import { createInterface, updateInterface, getInterfaceById, type InterfaceDetailItem } from './service'
import { ArrowLeft, Save, Loader2, Trash2, Eye } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

// ============================================================================
// SETUP & COMPOSABLES
// ============================================================================
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'InterfaceForm')
const isViewMode = computed(() => route.name === 'InterfaceView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Interface'
  if (isCopyMode.value) return 'Salin Interface'
  if (isEditMode.value) return 'Edit Interface'
  return 'Tambah Interface Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Interface'
  if (isCopyMode.value) return 'Buat Interface baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Interface'
  return 'Buat Interface baru'
})

// Display labels
const selectedCompanyLegalLabel = ref('')
const selectedUnitBisnisLabel = ref('')
const selectedVarLabel = ref('')

// Form values
let values = reactive({
  m_unit_bisnis_id: '',
  var_id: '',
  type: '',
  catatan: '',
  status: true,
})

// Detail items
const detailItems = ref<InterfaceDetailItem[]>([])

// Audit info state
const auditMeta = ref<{
  created_by?: string | null
  createdAt?: string | null
  updated_by?: string | null
  updatedAt?: string | null
}>({})

// Modal preview state
const isPreviewOpen = ref(false)

// Helper: ambil SelectRespo untuk Unit Bisnis user
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
  const selectRespo = getSelectRespoData()
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || ''
  if (ubId && !values.m_unit_bisnis_id) {
    values.m_unit_bisnis_id = String(ubId)
  }
  if (!selectedUnitBisnisLabel.value) {
    selectedUnitBisnisLabel.value = selectRespo?.unitBisnisName || selectRespo?.companyName || ''
  }
  if (!selectedCompanyLegalLabel.value) {
    selectedCompanyLegalLabel.value = selectRespo?.companyLegalName || selectRespo?.companyName || ''
  }
}

// Reset form
const onReset = () => {
  values.m_unit_bisnis_id = ''
  values.var_id = ''
  values.type = ''
  values.catatan = ''
  values.status = true
  detailItems.value = []
  selectedCompanyLegalLabel.value = ''
  selectedUnitBisnisLabel.value = ''
  selectedVarLabel.value = ''

  applyCurrentUserUnitBisnis()

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = ''
  })
}

// Computed: apakah tipe SINGLE
const isSingleType = computed(() => (values.type || '').toUpperCase() === 'SINGLE')

// Computed: disable tombol add COA jika tipe SINGLE dan sudah ada 1 COA
const isAddCoaDisabled = computed(() => {
  if (loading.value || isReadOnly.value) return true
  if (!values.var_id) return true
  if (isSingleType.value && detailItems.value.length >= 1) return true
  return false
})

// ============================================================================
// VARIABLE CHANGE HANDLER
// ============================================================================
const onVarSelected = (full: any) => {
  if (!full) {
    selectedVarLabel.value = ''
    values.type = ''
    return
  }
  selectedVarLabel.value = full.value1 || full.code || ''
  // Auto-terisi m_general.key1 sesuai Variable yg dipilih (SINGLE / MULTI)
  const newType = (full.key1 || 'MULTI').toUpperCase()
  values.type = newType

  // Auto-terisi m_general.value2 (Keterangan penggunaan interface) jika catatan masih kosong
  if (!values.catatan || values.catatan.trim() === '') {
    values.catatan = full.value2 || ''
  }

  // Jika bertipe SINGLE dan detail yang ada > 1, peringatkan dan batasi
  if (newType === 'SINGLE' && detailItems.value.length > 1) {
    toast.warning('Tipe Interface SINGLE', {
      description: 'Hanya 1 akun COA yang diperbolehkan. Akun COA lainnya dipotong.',
    })
    detailItems.value = detailItems.value.slice(0, 1)
  }
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset()
  applyCurrentUserUnitBisnis()

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getInterfaceById(sourceId)
    if (res.status !== 'success' || !res.data) throw new Error('Gagal memuat data')
    const data = res.data

    values.m_unit_bisnis_id = data.m_unit_bisnis_id || ''
    values.var_id = data.var_id || ''
    values.type = data.type || data.var_interface?.key1 || ''
    values.catatan = data.catatan || ''
    values.status = data.status ?? true

    selectedUnitBisnisLabel.value = data.m_unit_bisnis?.nama_comp || data.m_unit_bisni?.nama_comp || ''
    selectedCompanyLegalLabel.value = data.m_unit_bisnis?.m_company?.nama || data.m_unit_bisnis?.company?.nama || ''
    if (!selectedCompanyLegalLabel.value) {
      const selectRespo = getSelectRespoData()
      selectedCompanyLegalLabel.value = selectRespo?.companyLegalName || selectRespo?.companyName || ''
    }
    if (!selectedUnitBisnisLabel.value) {
      const selectRespo = getSelectRespoData()
      selectedUnitBisnisLabel.value = selectRespo?.unitBisnisName || selectRespo?.companyName || ''
    }
    if (!values.m_unit_bisnis_id) {
      applyCurrentUserUnitBisnis()
    }
    selectedVarLabel.value = data.var_interface?.value1 || data.var_interface?.code || ''

    auditMeta.value = {
      created_by: (data as any).created_by || (data as any).createdBy || null,
      createdAt: data.createdAt || null,
      updated_by: (data as any).updated_by || (data as any).update_by || (data as any).edited_by || null,
      updatedAt: data.updatedAt || null,
    }

    const rawDetails = data.m_interface_ds || data.details || []
    detailItems.value = rawDetails.map((d: any, idx: number) => ({
      id: isCopyModeLocal ? undefined : d.id,
      sequence: d.sequence || idx + 1,
      m_coa_id: d.m_coa_id,
      notes: d.notes || '',
      kode_coa: d.m_coa?.kode || '-',
      nama_coa: d.m_coa?.nama || '-',
      m_coa: d.m_coa || null,
    }))

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Interface baru',
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Interface', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/accounting/master/m_interface'),
      },
    })
  } finally {
    loading.value = false
  }
})

// ============================================================================
// DETAIL HANDLERS (MULTI SELECT & ROW REMOVE)
// ============================================================================
const handleCoaAdded = (items: any[]) => {
  if (!items || items.length === 0) return

  // NOTES 2: Jika Type SINGLE, hanya bisa menambahkan 1 COA
  if (isSingleType.value) {
    if (detailItems.value.length >= 1) {
      toast.warning('Tipe SINGLE', {
        description: 'Interface dengan Type SINGLE hanya boleh memiliki 1 akun COA. Hapus akun sebelumnya untuk mengganti.',
      })
      return
    }
    items = items.slice(0, 1)
  }

  let addedCount = 0
  items.forEach((item) => {
    const coaId = item.id
    if (!coaId) return

    // NOTES 1: Tidak boleh menambahkan Kode COA yang sama
    const exists = detailItems.value.some((d) => d.m_coa_id === coaId)
    if (exists) return

    if (isSingleType.value && detailItems.value.length >= 1) return

    detailItems.value.push({
      id: undefined,
      sequence: detailItems.value.length + 1,
      m_coa_id: coaId,
      kode_coa: item.kode || '-',
      nama_coa: item.nama || '-',
      notes: '',
      m_coa: {
        id: item.id,
        kode: item.kode,
        nama: item.nama,
        level: item.level,
        status: item.status,
      },
    })
    addedCount++
  })

  if (addedCount > 0) {
    toast.success(`${addedCount} akun COA berhasil ditambahkan`)
  } else {
    toast.info('Semua akun COA yang dipilih sudah ada di detail')
  }
}

const removeDetailRow = (index: number) => {
  detailItems.value.splice(index, 1)
  detailItems.value.forEach((d, i) => {
    d.sequence = i + 1
  })
}

// NOTES 5: Preview hasil function GetData COA
const handlePreviewGetDataCoa = () => {
  if (detailItems.value.length === 0) {
    toast.info('Belum ada detail COA', {
      description: 'Tambahkan minimal 1 akun COA untuk melihat preview GetData COA',
    })
    return
  }
  isPreviewOpen.value = true
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const errors = reactive({
  m_unit_bisnis_id: '',
  var_id: '',
  type: '',
})

const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = ''
  })
  let invalid = false

  if (!values.m_unit_bisnis_id) {
    applyCurrentUserUnitBisnis()
  }
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = 'Unit Bisnis wajib terisi dari user login'
    invalid = true
  }
  if (!values.var_id) {
    errors.var_id = 'Variable Interface wajib dipilih'
    invalid = true
  }
  if (!values.type) {
    errors.type = 'Type Interface wajib terisi'
    invalid = true
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  if (detailItems.value.length === 0) {
    toast.error('Detail masih kosong', { description: 'Minimal harus menambahkan 1 akun COA' })
    return
  }

  // NOTES 2: Validasi SINGLE detail row
  if (isSingleType.value && detailItems.value.length > 1) {
    toast.error('Validasi Type SINGLE gagal', {
      description: 'Interface bertipe SINGLE hanya boleh memiliki 1 baris detail COA',
    })
    return
  }

  loading.value = true
  try {
    const detailsPayload = detailItems.value.map((item, idx) => ({
      id: item.id && !String(item.id).startsWith('temp-') ? item.id : undefined,
      sequence: idx + 1,
      m_coa_id: item.m_coa_id,
      notes: item.notes?.trim() || null,
    }))

    const currentUserId = authStore.user?.id || null
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id,
      var_id: values.var_id,
      type: values.type,
      catatan: values.catatan?.trim() || null,
      status: values.status,
      created_by: currentUserId,
      updated_by: currentUserId,
      details: detailsPayload,
    }

    if (isEditMode.value) {
      await updateInterface(menuId.value, payload)
      toast.success('Interface berhasil diperbarui')
    } else {
      await createInterface(payload)
      toast.success('Interface berhasil dibuat')
    }
    router.replace('/accounting/master/m_interface?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Interface' : 'Gagal membuat Interface', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/accounting/master/m_interface')
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
          <CardTitle>Informasi Interface</CardTitle>
          <CardDescription>
            Isi data Interface dengan lengkap dan benar sesuai Company, Unit Bisnis, dan Variable Interface
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Company (Readonly, otomatis dari user login) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedCompanyLegalLabel || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="Company otomatis dari user login"
              hints="Company otomatis dari user login"
              class="w-full"
            />

            <!-- Unit Bisnis (Readonly, otomatis dari user login) -->
            <FieldX
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="selectedUnitBisnisLabel || '-'"
              :disabled="true"
              :readonly="true"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Unit bisnis otomatis dari user login'"
              placeholder="Unit Bisnis otomatis dari user login"
              class="w-full"
            />

            <!-- Variable (var_id -> m_general group 'INTERFACE VAR') -->
            <FieldSelect
              id="var_id"
              label="Variable"
              :value="values.var_id"
              @input="(v) => (values.var_id = v)"
              @update:valueFull="onVarSelected"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  filter_column_group: 'INTERFACE VAR',
                  filter_column_is_active: 'true',
                  searchfield: 'code,value1,value2,key1',
                },
              }"
              valueField="id"
              displayField="value1"
              placeholder="Pilih Variable Interface"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorname="errors.var_id ? 'failed' : ''"
              :hints="errors.var_id"
              class="w-full"
            />

            <!-- Type (Auto terisi SINGLE / MULTI dari m_general.key1, Readonly) -->
            <FieldX
              id="type"
              label="Type"
              :value="values.type"
              placeholder="Auto terisi dari Variable (SINGLE / MULTI)"
              :disabled="true"
              :readonly="true"
              hints="Auto terisi SINGLE / MULTI sesuai Variable yang dipilih"
              class="w-full"
            />

            <!-- Status -->
            <FieldStatus
              label="Status"
              name="status"
              v-model="values.status"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />
          </div>

          <!-- Notes (catatan, auto terisi m_general.value2) -->
          <FieldTextarea
            id="catatan"
            label="Notes"
            :value="values.catatan"
            @input="(v) => (values.catatan = v)"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Keterangan penggunaan interface (auto terisi dari Variable)..."
            class="w-full"
          />
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL SECTION: COA MULTI SELECT -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Detail Akun COA</CardTitle>
              <CardDescription>
                Pilih akun COA yang terhubung dengan interface ini (hanya COA paling anak / non-induk).
                <span v-if="values.type" class="font-semibold text-primary">
                  Tipe: {{ values.type }} {{ isSingleType ? '(Maks. 1 COA)' : '(Bisa banyak COA)' }}
                </span>
              </CardDescription>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- NOTES 5: Tombol Preview Hasil GetData COA -->
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-9 gap-1.5"
                :disabled="detailItems.length === 0"
                @click="handlePreviewGetDataCoa"
              >
                <Eye class="h-4 w-4" />
                Preview GetData COA
              </Button>

              <!-- NOTES 2 & 4: ButtonMultiSelect COA Leaf -->
              <ButtonMultiSelect
                v-if="!isReadOnly"
                title="+ Add to List"
                buttonClass="h-9"
                :disabled="isAddCoaDisabled"
                :singleSelect="isSingleType"
                :excludeIds="detailItems.map((d) => d.m_coa_id).filter(Boolean) as string[]"
                searchKey="kode,nama"
                uniqueKey="id"
                :api="{
                  url: `${API_BASE_URL}/fn/m_interface/getLeafCoa`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                }"
                :columns="[
                  { checkboxSelection: true, headerCheckboxSelection: !isSingleType, width: '50px' },
                  { field: 'kode', headerName: 'Kode COA', width: '160px', sortable: true, filterable: true },
                  { field: 'nama', headerName: 'Nama COA', width: '280px', sortable: true, filterable: true },
                  { field: 'level', headerName: 'Level', width: '90px', sortable: true },
                  {
                    field: 'status',
                    headerName: 'Status',
                    width: '100px',
                    render: (item: any) => (item.status ? 'Aktif' : 'Nonaktif'),
                  },
                ]"
                @add="handleCoaAdded"
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
                  <th class="px-3 py-2 text-left font-medium min-w-[160px]">Kode COA</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[280px]">Nama COA</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[220px]">Notes</th>
                  <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td
                    :colspan="isReadOnly ? 4 : 5"
                    class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                  >
                    Belum ada detail akun COA.
                    <span v-if="!values.var_id"> (Pilih Variable terlebih dahulu)</span>
                    <span v-else-if="!isReadOnly"> Klik "+ Add to List" untuk menambahkan akun COA.</span>
                  </td>
                </tr>
                <tr
                  v-for="(detail, idx) in detailItems"
                  :key="detail.id || detail.m_coa_id || idx"
                  class="border-t hover:bg-muted/50"
                >
                  <td class="px-3 py-2 text-slate-700">{{ idx + 1 }}</td>
                  <td class="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">
                    {{ detail.kode_coa || detail.m_coa?.kode || '-' }}
                  </td>
                  <td class="px-3 py-2 text-slate-700">
                    {{ detail.nama_coa || detail.m_coa?.nama || '-' }}
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-if="!isReadOnly"
                      v-model="detail.notes"
                      type="text"
                      placeholder="Catatan..."
                      class="w-full px-2 py-1 border rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span v-else class="text-slate-600 text-xs">{{ detail.notes || '-' }}</span>
                  </td>
                  <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      @click="removeDetailRow(idx)"
                      class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
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

      <!-- AUDIT INFO -->
      <AuditInfo
        v-if="isEditMode || isViewMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        :audit-meta="auditMeta"
      />

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button
          type="button"
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
          class="w-full sm:w-auto"
        >
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button
          v-if="!isReadOnly"
          type="button"
          @click="onSave"
          :disabled="loading"
          class="gap-2 w-full sm:w-auto"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>

    <!-- ================================================================ -->
    <!-- NOTES 5: DIALOG PREVIEW HASIL GETDATA COA -->
    <!-- ================================================================ -->
    <Dialog :open="isPreviewOpen" @update:open="(v) => (isPreviewOpen = v)">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Eye class="h-5 w-5 text-primary" />
            Preview Hasil GetData COA
          </DialogTitle>
          <DialogDescription>
            Simulasi pemanggilan helper <code>getDataCoaByInterface('{{ selectedVarLabel || '-' }}')</code> untuk Company: <strong>{{ selectedUnitBisnisLabel || '-' }}</strong> (Tipe: <strong>{{ values.type || '-' }}</strong>).
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <div class="rounded-md border overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium w-12">No</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[140px]">Kode COA</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[220px]">Nama COA</th>
                  <th class="px-3 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in detailItems"
                  :key="item.id || item.m_coa_id || idx"
                  class="border-t"
                >
                  <td class="px-3 py-2 text-slate-700">{{ idx + 1 }}</td>
                  <td class="px-3 py-2 font-mono font-medium text-primary">{{ item.kode_coa || item.m_coa?.kode || '-' }}</td>
                  <td class="px-3 py-2 text-slate-800">{{ item.nama_coa || item.m_coa?.nama || '-' }}</td>
                  <td class="px-3 py-2 text-slate-500 text-xs">{{ item.notes || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 p-3 rounded-md">
            ℹ️ Seluruh akun di atas telah lolos filter <strong>COA paling anak (non-induk)</strong> dan siap digunakan untuk jurnal transaksi.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isPreviewOpen = false">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}
</style>
