<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FieldX, FieldStatus, FieldSelect } from '@/components/field'
import { createSuratJalan, updateSuratJalan, getSuratJalanById } from './service'
import AuditInfo from '@/components/AuditInfo.vue'
import { ArrowLeft, Save, Loader2, Search, Plus, Trash2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'SuratJalanForm')
const isViewMode = computed(() => route.name === 'SuratJalanView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Surat Jalan'
  if (isCopyMode.value) return 'Salin Surat Jalan'
  if (isEditMode.value) return 'Edit Surat Jalan'
  return 'Tambah Surat Jalan Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Detail data Surat Jalan'
  if (isCopyMode.value) return 'Buat Surat Jalan baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Surat Jalan'
  return 'Buat Surat Jalan baru'
})

// ============================================================================
// UNIT BISNIS (mengikuti konsep dari Transform Item)
// ============================================================================
const isSuperAdmin = computed(() => {
  const user = authStore.user
  if (!user || !user.tipe) return false
  return user.tipe.value1?.toUpperCase() === 'SUPER ADMIN'
})

// Untuk non-Super Admin: nama company diambil dari SelectRespo (akun login)
const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        return parsed.companyName || '-'
      }
    } catch {
      // ignore
    }
  }
  return '-'
})

// Nama company (perusahaan induk) dari Unit Bisnis yang dipilih.
// Tampil sebagai field readonly ketika Super Admin memilih Unit Bisnis.
const selectedUnitBisnisCompanyName = ref<string>('')

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || ''
}

// Untuk mode Edit/View/Copy, FieldSelect tidak meng-emit valueFull saat
// load awal, jadi ambil nama company-nya via API sekali saja.
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
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )
    const result = await response.json()
    if (result?.status === 'success' && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama ||
        result.data?.m_company?.kode ||
        '-'
    }
  } catch {
    // ignore, field will just stay empty
  }
}

// ============================================================================
// OPTIONS (TODO: ganti dengan data dari API/master)
// ============================================================================
const alamatKirimOptions = ref<{ label: string, value: string }[]>([])

const topOptions = ref<{ label: string, value: string }[]>([
  { label: 'Cash', value: 'Cash' },
  { label: '7 Hari', value: '7 Hari' },
  { label: '14 Hari', value: '14 Hari' },
  { label: '30 Hari', value: '30 Hari' }
])

const caraBayarOptions = ref<{ label: string, value: string }[]>([
  { label: 'Cash', value: 'Cash' },
  { label: 'Transfer', value: 'Transfer' },
  { label: 'Giro', value: 'Giro' }
])

const kendaraanOptions = ref<{ label: string, value: string }[]>([
  { label: 'Truck Hino', value: 'Truck Hino' },
  { label: 'Truck Fuso', value: 'Truck Fuso' },
  { label: 'Pickup', value: 'Pickup' }
])

const noPolisiOptions = ref<{ label: string, value: string }[]>([])

const supirOptions = ref<{ label: string, value: string }[]>([
  { label: 'Joni', value: 'Joni' },
  { label: 'Dwi', value: 'Dwi' },
  { label: 'Eka', value: 'Eka' },
  { label: 'Dino', value: 'Dino' },
  { label: 'Putra', value: 'Putra' }
])

// ============================================================================
// FORM VALUES (HEADER)
// ============================================================================
interface SuratJalanDetailRow {
  id?: number | string
  no_ref: string
  kode: string
  nama_item: string
  qty_sj: number
  uom: string
  berat: number
  catatan: string
}

let values = reactive({
  m_unit_bisnis_id: '',
  tgl_sj: '',
  no_sj: '',
  customer_id: '' as string | number | null,
  customer_name: '',
  alamat_kirim: '',
  top: '',
  cara_bayar: '',
  kendaraan: '',
  no_polisi: '',
  supir: '',
  catatan: '',
  status: 'Draft',
  created_by: '',
  created_at: '',
  details: [] as SuratJalanDetailRow[]
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})

// ============================================================================
// COMPUTED - TOTAL BERAT
// ============================================================================
const totalBerat = computed(() => {
  return values.details.reduce((sum, row) => sum + (Number(row.berat) || 0), 0)
})

// ============================================================================
// DETAIL ROWS HANDLER
// ============================================================================
const emptyDetailRow = (): SuratJalanDetailRow => ({
  no_ref: '',
  kode: '',
  nama_item: '',
  qty_sj: 0,
  uom: '',
  berat: 0,
  catatan: ''
})

const addDetailRow = () => {
  values.details.push(emptyDetailRow())
}

const removeDetailRow = (index: number) => {
  values.details.splice(index, 1)
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: '',
    tgl_sj: '',
    no_sj: '',
    customer_id: '',
    customer_name: '',
    alamat_kirim: '',
    top: '',
    cara_bayar: '',
    kendaraan: '',
    no_polisi: '',
    supir: '',
    catatan: '',
    status: 'Draft',
    created_by: '',
    created_at: '',
    details: []
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset()

  // Non-Super Admin: set Unit Bisnis otomatis dari company akun login (saat create)
  const isCopyModeLocalCheck = route.query.action === 'copy' && route.query.source
  if (
    !isSuperAdmin.value &&
    !(isEditMode.value || isViewMode.value || isCopyModeLocalCheck)
  ) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId
        }
      }
    } catch {
      // ignore
    }
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getSuratJalanById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    }

    // Pastikan details berupa array
    if (!Array.isArray(initialValues.details)) {
      initialValues.details = []
    }

    // Mode copy: hapus id, no_sj, status & timestamps agar jadi Draft baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).no_sj
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      initialValues.status = 'Draft'
      initialValues.created_by = ''
      initialValues.created_at = ''
      initialValues.details = (initialValues.details || []).map((d: any) => {
        const { id, ...rest } = d
        return rest
      })
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }

    // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
    if (isSuperAdmin.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Surat Jalan baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Surat Jalan', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/marketing/transaksi/t_surat_jalan')
      }
    })
    setTimeout(() => router.push('/marketing/transaksi/t_surat_jalan'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  m_unit_bisnis_id: '',
  tgl_sj: '',
  customer_name: '',
  alamat_kirim: '',
  top: '',
  cara_bayar: '',
  kendaraan: '',
  no_polisi: '',
  supir: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib diisi'; invalid = true }
  if (!values.tgl_sj?.trim()) { errors.tgl_sj = 'Tanggal Surat Jalan wajib diisi'; invalid = true }
  if (!values.customer_name?.trim()) { errors.customer_name = 'Customer wajib diisi'; invalid = true }
  if (!values.alamat_kirim?.trim()) { errors.alamat_kirim = 'Alamat Kirim wajib diisi'; invalid = true }
  if (!values.kendaraan?.trim()) { errors.kendaraan = 'Kendaraan wajib diisi'; invalid = true }
  if (!values.supir?.trim()) { errors.supir = 'Supir wajib diisi'; invalid = true }
  if (values.details.length === 0) {
    invalid = true
    toast.error('Validasi gagal', { description: 'Minimal 1 baris Detail Surat Jalan harus diisi' })
  }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null
    const payload = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_sj: values.tgl_sj?.trim() || null,
      no_sj: values.no_sj?.trim() || null,
      customer_id: values.customer_id || null,
      customer_name: values.customer_name?.trim() || null,
      alamat_kirim: values.alamat_kirim?.trim() || null,
      top: values.top?.trim() || null,
      cara_bayar: values.cara_bayar?.trim() || null,
      kendaraan: values.kendaraan?.trim() || null,
      no_polisi: values.no_polisi?.trim() || null,
      supir: values.supir?.trim() || null,
      total_berat: totalBerat.value,
      catatan: values.catatan?.trim() || null,
      status: values.status,
      details: values.details
    }

    if (isEditMode.value) {
      await updateSuratJalan(menuId.value, payload as any)
      toast.success('Surat Jalan berhasil diperbarui', { description: `Surat Jalan "${values.no_sj}" telah diperbarui` })
    } else {
      await createSuratJalan(payload as any)
      toast.success('Surat Jalan berhasil dibuat', { description: 'Surat Jalan baru telah ditambahkan' })
    }
    router.replace('/marketing/transaksi/t_surat_jalan?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Surat Jalan' : 'Gagal membuat Surat Jalan', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CUSTOMER SEARCH HANDLER
// ============================================================================
const onSearchCustomer = () => {
  // TODO: buka modal pencarian customer, lalu isi values.customer_id & values.customer_name
  toast.info('Fitur pencarian customer akan segera tersedia')
}

// ============================================================================
// CANCEL / BATAL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/marketing/transaksi/t_surat_jalan')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between">
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

      <!-- Status Badge -->
      <Badge
        v-if="isReadOnly"
        :variant="values.status === 'Posted' ? 'default' : 'secondary'"
        class="uppercase tracking-wide"
      >
        {{ values.status }}
      </Badge>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardContent class="space-y-6 pt-6">
          <!-- Grid 2 Columns for Desktop, 4 kolom untuk baris ke-3 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Unit Bisnis -->
            <template v-if="isSuperAdmin">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                v-model="values.m_unit_bisnis_id"
                :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
                :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'nama_comp',
                    filter_column_is_active: true,
                    join: 'true',
                  },
                }"
                valueField="id"
                displayField="nama_comp"
                placeholder="Pilih unit bisnis"
                :clearable="true"
                @update:value-full="handleUnitBisnisSelected"
              />

              <!-- Asal Company dari Unit Bisnis yang dipilih (selalu tampil, readonly) -->
              <FieldX
                id="m_unit_bisnis_company_display"
                label="Company"
                :value="selectedUnitBisnisCompanyName || '-'"
                :disabled="true"
                :readonly="true"
                placeholder="-"
                hints="Company dari Unit Bisnis yang dipilih"
              />
            </template>

            <FieldX
              v-else
              id="m_unit_bisnis_id_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Unit Bisnis dari akun Anda"
            />

            <!-- Tanggal Surat Jalan -->
            <FieldX
              id="tgl_sj"
              type="date"
              label="Tanggal Surat Jalan"
              :value="values.tgl_sj"
              :errorname="errors.tgl_sj ? 'failed' : ''"
              @input="v => values.tgl_sj = v"
              :hints="errors.tgl_sj"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="dd/mm/yyyy"
              class="w-full"
            />

            <!-- No. Surat Jalan -->
            <FieldX
              id="no_sj"
              label="No. Surat Jalan"
              :value="values.no_sj"
              :disabled="true"
              :readonly="true"
              placeholder="Otomatis dibuat sistem"
              hints="Nomor dibuat otomatis oleh sistem"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Customer -->
            <div class="flex flex-col gap-1.5">
              <label for="customer_name" class="text-sm font-medium" :class="!isReadOnly && 'required'">
                Customer
              </label>
              <div class="flex items-center gap-2">
                <FieldX
                  id="customer_name"
                  :value="values.customer_name"
                  :errorname="errors.customer_name ? 'failed' : ''"
                  @input="v => values.customer_name = v"
                  :hints="errors.customer_name"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Pilih Customer"
                  class="w-full flex-1"
                  hide-label
                />
                <Button
                  v-if="!isReadOnly"
                  type="button"
                  variant="outline"
                  size="icon"
                  :disabled="loading"
                  @click="onSearchCustomer"
                >
                  <Search class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <!-- Alamat Kirim -->
            <FieldX
              id="alamat_kirim"
              type="select"
              label="Alamat Kirim"
              :options="alamatKirimOptions"
              :value="values.alamat_kirim"
              :errorname="errors.alamat_kirim ? 'failed' : ''"
              @input="v => values.alamat_kirim = v"
              :hints="errors.alamat_kirim"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Alamat Kirim"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <!-- ToP -->
            <FieldX
              id="top"
              type="select"
              label="ToP"
              :options="topOptions"
              :value="values.top"
              :errorname="errors.top ? 'failed' : ''"
              @input="v => values.top = v"
              :hints="errors.top"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih ToP"
              class="w-full"
            />

            <!-- Cara Bayar -->
            <FieldX
              id="cara_bayar"
              type="select"
              label="Cara Bayar"
              :options="caraBayarOptions"
              :value="values.cara_bayar"
              :errorname="errors.cara_bayar ? 'failed' : ''"
              @input="v => values.cara_bayar = v"
              :hints="errors.cara_bayar"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Cara Bayar"
              class="w-full"
            />

            <!-- Kendaraan -->
            <FieldX
              id="kendaraan"
              type="select"
              label="Kendaraan"
              :options="kendaraanOptions"
              :value="values.kendaraan"
              :errorname="errors.kendaraan ? 'failed' : ''"
              @input="v => values.kendaraan = v"
              :hints="errors.kendaraan"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Kendaraan"
              class="w-full"
            />

            <!-- No Polisi -->
            <FieldX
              id="no_polisi"
              type="select"
              label="No Polisi"
              :options="noPolisiOptions"
              :value="values.no_polisi"
              :errorname="errors.no_polisi ? 'failed' : ''"
              @input="v => values.no_polisi = v"
              :hints="errors.no_polisi"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih No Polisi"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Supir -->
            <FieldX
              id="supir"
              type="select"
              label="Supir"
              :options="supirOptions"
              :value="values.supir"
              :errorname="errors.supir ? 'failed' : ''"
              @input="v => values.supir = v"
              :hints="errors.supir"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Supir"
              class="w-full"
            />

            <!-- Total Berat (Kg) - readonly, dihitung dari detail -->
            <FieldX
              id="total_berat"
              label="Total Berat (Kg)"
              :value="totalBerat"
              :disabled="true"
              :readonly="true"
              hints="Dihitung otomatis dari Detail Surat Jalan"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldX
              id="catatan"
              type="textarea"
              label="Catatan"
              :value="values.catatan"
              @input="v => values.catatan = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
              class="w-full md:col-span-1"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL SURAT JALAN -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Detail Surat Jalan</CardTitle>
            <CardDescription>Daftar item yang dikirim pada Surat Jalan ini</CardDescription>
          </div>
          <Button
            v-if="!isReadOnly"
            type="button"
            size="sm"
            variant="outline"
            class="gap-2"
            :disabled="loading"
            @click="addDetailRow"
          >
            <Plus class="h-4 w-4" />
            Tambah Item
          </Button>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto border rounded-md">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr class="border-b">
                  <th class="px-3 py-2 text-left font-semibold w-10">No</th>
                  <th class="px-3 py-2 text-left font-semibold">No. Ref</th>
                  <th class="px-3 py-2 text-left font-semibold">Kode</th>
                  <th class="px-3 py-2 text-left font-semibold">Nama Item</th>
                  <th class="px-3 py-2 text-right font-semibold w-24">Qty SJ</th>
                  <th class="px-3 py-2 text-left font-semibold w-24">UoM</th>
                  <th class="px-3 py-2 text-right font-semibold w-28">Berat (Kg)</th>
                  <th class="px-3 py-2 text-left font-semibold">Catatan</th>
                  <th v-if="!isReadOnly" class="px-3 py-2 text-center font-semibold w-12"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="values.details.length === 0">
                  <td :colspan="isReadOnly ? 8 : 9" class="px-3 py-6 text-center text-muted-foreground">
                    Belum ada item Surat Jalan
                  </td>
                </tr>
                <tr v-for="(row, index) in values.details" :key="row.id ?? index" class="border-b last:border-b-0">
                  <td class="px-3 py-2 align-top">{{ index + 1 }}</td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_no_ref_${index}`"
                      :value="row.no_ref"
                      @input="v => row.no_ref = v"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="SO-XXXX-XXXX"
                      hide-label
                      class="w-full min-w-[120px]"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_kode_${index}`"
                      :value="row.kode"
                      @input="v => row.kode = v"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="ITEM-XXXX"
                      hide-label
                      class="w-full min-w-[110px]"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_nama_item_${index}`"
                      :value="row.nama_item"
                      @input="v => row.nama_item = v"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="Nama Item"
                      hide-label
                      class="w-full min-w-[180px]"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_qty_sj_${index}`"
                      type="number"
                      :value="row.qty_sj"
                      @input="v => row.qty_sj = Number(v)"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="0"
                      hide-label
                      class="w-full min-w-[80px] text-right"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_uom_${index}`"
                      :value="row.uom"
                      @input="v => row.uom = v"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="PCS"
                      hide-label
                      class="w-full min-w-[80px]"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_berat_${index}`"
                      type="number"
                      :value="row.berat"
                      @input="v => row.berat = Number(v)"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="0"
                      hide-label
                      class="w-full min-w-[90px] text-right"
                    />
                  </td>
                  <td class="px-3 py-2 align-top">
                    <FieldX
                      :id="`detail_catatan_${index}`"
                      :value="row.catatan"
                      @input="v => row.catatan = v"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="Catatan"
                      hide-label
                      class="w-full min-w-[140px]"
                    />
                  </td>
                  <td v-if="!isReadOnly" class="px-3 py-2 align-top text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-destructive"
                      :disabled="loading"
                      @click="removeDetailRow(index)"
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

      <!-- ================================================================ -->
      <!-- AUDIT INFO -->
      <!-- ================================================================ -->
      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
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
</style>