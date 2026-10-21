<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldSelect } from '@/components/field'
import { createUnitBisnis, updateUnitBisnis, getUnitBisnisById } from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'UnitBisnisForm')
const isViewMode = computed(() => route.name === 'UnitBisnisView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const companyOptions = ref<Array<{ value: string; label: string; fullData: any }>>([])
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail UnitBisnis'
  if (isCopyMode.value) return 'Salin UnitBisnis'
  if (isEditMode.value) return 'Edit UnitBisnis'
  return 'Tambah UnitBisnis Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data UnitBisnis'
  if (isCopyMode.value) return 'Buat UnitBisnis baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data UnitBisnis'
  return 'Buat UnitBisnis aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  kode_unit_bisnis: '',
  company_id: '',
  nama_comp: '',
  provinsi: '',
  kota: '',
  kecamatan: '',
  kodepos: null as number | null,
  alamat_detail: '',
  email: '',
  pic: '',
  no_telp_pic: '',
  catatan: '',
  prefix: '',
  is_active: true // Default true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}


// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_unit_bisnis: '',
    company_id: '',
    nama_comp: '',
    provinsi: '',
    kota: '',
    kecamatan: '',
    kodepos: null,
    alamat_detail: '',
    email: '',
    pic: '',
    no_telp_pic: '',
    catatan: '',
    is_active: true // Default true
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

const syncSelectedCompanyFromName = () => {
  if (!values.nama_comp || !companyOptions.value.length) return

  const matchedCompany = companyOptions.value.find(
    company => company.label?.trim().toLowerCase() === values.nama_comp?.trim().toLowerCase()
  )

  if (matchedCompany) {
    values.company_id = matchedCompany.value
  }
}

// Di frontend: src/utils/stringHelper.js

function generateCompanyAbbreviation(companyName: String) {
  if (!companyName) return "";
  console.log('generate prefix', companyName)

  const skipWords = [
    "PT", "CV", "UD", "FIRMA", "KOPERASI", "YAYASAN", 
    "PERSEROAN", "TERBATAS", "PT.", "CV.", "UD."
  ];

  const words = companyName
    .toUpperCase()
    .split(/\s+/)
    .filter((word:any) => {
      if (!word) return false;
      if (skipWords.includes(word)) return false;
      return true;
    });

  if (words.length === 0) {
    return companyName
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join("")
      .slice(0, 5);
  }

  return words.map((word:any) => word.charAt(0)).join("");
}

const onUpdateNamaComp = (item: String) =>{
  if(!values.prefix){
    values.prefix = generateCompanyAbbreviation(item)
  }
}


const applyCompanyToForm = (companyData: any | null) => {
  const shouldPreserveExistingUnitBisnisName =
    (isEditMode.value || isViewMode.value) && !!values.nama_comp?.trim()

  if (!companyData) {
    values.company_id = ''
    if (!shouldPreserveExistingUnitBisnisName) {
      values.nama_comp = ''
    }
    values.provinsi = ''
    values.kota = ''
    values.kecamatan = ''
    values.kodepos = null
    values.alamat_detail = ''
    return
  }

  values.company_id = companyData.id || ''
  if (!shouldPreserveExistingUnitBisnisName) {
    values.nama_comp = ''
  }
  values.provinsi = companyData.provinsi || ''
  values.kota = companyData.kota || ''
  values.kecamatan = companyData.kecamatan || ''
  values.kodepos = companyData.kode_pos ?? null
  values.alamat_detail = companyData.alamat_detail || companyData.alamat || ''
}
// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset()

  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_company?join=true&no_pagination=true`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    const res = await response.json()

    if (res.status === 'success' && Array.isArray(res.data)) {
      companyOptions.value = res.data.map((company: any) => ({
        value: company.id,
        label: company.nama,
        fullData: company
      }))
      syncSelectedCompanyFromName()
    }
  } catch (error) {
    console.error('Failed to load company options:', error)
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getUnitBisnisById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Minimal normalisasi (tidak sekompleks normalizeIncoming sebelumnya)
    // Pastikan boolean (API sudah boolean, tapi jaga-jaga kalau 1/0)
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }

    syncSelectedCompanyFromName()

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai UnitBisnis baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data UnitBisnis', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_unit_bisnis')
      }
    })
    setTimeout(() => router.push('/setup/m_unit_bisnis'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama_comp: '',
  provinsi: '',
  kota: '',
  prefix: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.nama_comp?.trim()) { errors.nama_comp = 'Nama Unit Bisnis wajib diisi'; invalid = true }
  if (!values.provinsi?.trim()) { errors.provinsi = 'Provinsi wajib diisi'; invalid = true }
  if (!values.kota?.trim()) { errors.kota = 'Kota wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null
    const payload = {
      company_id: values.company_id?.trim() || null,
      kode_unit_bisnis: values.kode_unit_bisnis?.trim() || null,
      nama_comp: values.nama_comp?.trim() || null,
      provinsi: values.provinsi?.trim() || null,
      kota: values.kota?.trim() || null,
      kecamatan: values.kecamatan?.trim() || null,
      kodepos: values.kodepos || null,
      alamat_detail: values.alamat_detail?.trim() || null,
      email: values.email?.trim() || null,
      pic: values.pic?.trim() || null,
      no_telp_pic: values.no_telp_pic?.trim() || null,
      catatan: values.catatan?.trim() || null,
      prefix: values.prefix?.trim() || null,
      is_active: values.is_active
    }

    if (isEditMode.value) {
      await updateUnitBisnis(menuId.value, payload as any)
      toast.success('Unit Bisnis berhasil diperbarui', { description: `Unit Bisnis "${values.nama_comp}" telah diperbarui` })
    } else {
      await createUnitBisnis(payload as any)
      toast.success('Unit Bisnis berhasil dibuat', { description: `Unit Bisnis "${values.nama_comp}" telah ditambahkan` })
    }
    router.replace('/setup/m_unit_bisnis?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui UnitBisnis' : 'Gagal membuat UnitBisnis', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_unit_bisnis')
}


</script>

<template>
  <div class="p-6 space-y-6  mx-auto">
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
      <Card>
        <CardHeader>
          <CardTitle>Informasi Unit Bisnis</CardTitle>
          <CardDescription>
            Isi data unit bisnis dengan lengkap. Provinsi, Kota, dan Nama Unit Bisnis wajib diisi.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Unit Bisnis (Auto-generated, Read-only) -->
            <FieldX id="kode_unit_bisnis" label="Kode Unit Bisnis" :value="values.kode_unit_bisnis"
              @input="v => values.kode_unit_bisnis = v" :required="false" :disabled="true" :readonly="true"
              placeholder="Auto-generated by System" class="w-full" />

            <!-- Company -->
            <FieldSelect id="company_id" label="Company" :value="values.company_id"
              @input="(v: string) => values.company_id = v"
              @update:valueFull="(selectedCompany: any) => applyCompanyToForm(selectedCompany?.fullData || null)" :options="companyOptions"
              :bind="{ disabled: loading || isReadOnly, clearable: true }" placeholder="Pilih Company"
              class="w-full" />

            <!-- Prefix -->
            <FieldX id="prefix" label="Kode Prefix" :value="values.prefix"
              :errorname="errors.prefix ? 'failed' : ''" @input="v => values.prefix = v" :hints="errors.prefix"
              :required="false" :disabled="loading || isReadOnly" :readonly="isReadOnly"
              placeholder="Masukkan kode prefix" class="w-full" />

            <!-- Nama Unit Bisnis (Required) -->
            <FieldX id="nama_comp" label="Nama Unit Bisnis" :value="values.nama_comp"
              :errorname="errors.nama_comp ? 'failed' : ''" @input="v => values.nama_comp = v" :hints="errors.nama_comp"
              @update:modelValue="onUpdateNamaComp"
              :required="!isReadOnly" :disabled="loading || isReadOnly" :readonly="isReadOnly"
              placeholder="PT HUTOMO BAUT INDONESIA" class="w-full" />

            <!-- Provinsi (Required) - Cascading Select -->
            <FieldSelect id="provinsi" label="Provinsi" :value="values.provinsi"
              @input="(v: any) => { values.provinsi = v; values.kota = ''; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) { values.kota = ''; values.kecamatan = '' } }" :api="{
                url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                params: { search: '', searchfield: 'name', selectfield: 'name,id', paginate: 35 },
                fullUrl: true
              } as any" :bind="{ disabled: loading || isReadOnly, clearable: true }"
              :errorname="errors.provinsi ? 'failed' : ''" :hints="errors.provinsi" :required="!isReadOnly"
              placeholder="Pilih Provinsi" class="w-full" />

            <!-- Kota (Required) - Dependent on Provinsi -->
            <FieldSelect id="kota" label="Kota" :value="values.kota"
              @input="(v: any) => { values.kota = v; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) values.kecamatan = '' }" :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                params: {
                  provinsi: values.provinsi,
                  search: '', searchfield: 'name', selectfield: 'name,id', paginate: 35
                },
                fullUrl: true
              } as any" :bind="{ disabled: !values.provinsi || loading || isReadOnly, clearable: true }"
              :errorname="errors.kota ? 'failed' : ''" :hints="errors.kota" :required="!isReadOnly"
              placeholder="Pilih Kota" class="w-full" />

            <!-- Kecamatan (Optional) - Dependent on Kota -->
            <FieldSelect id="kecamatan" label="Kecamatan (Opsional)" :value="values.kecamatan"
              @input="(v: any) => values.kecamatan = v" :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                params: { kota: values.kota },
                fullUrl: true
              } as any" valueField="key" displayField="key"
              :bind="{ disabled: !values.kota || loading || isReadOnly, clearable: true }" placeholder="Pilih Kecamatan"
              class="w-full" />

            <!-- Kode Pos (Optional) -->
            <FieldX id="kodepos" label="Kode Pos (Opsional)" :value="values.kodepos?.toString() || ''"
              @input="(v: any) => values.kodepos = v ? Number(v) : null" :required="false"
              :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="12345" class="w-full" />

            <!-- Email (Optional) -->
            <FieldX id="email" label="Email (Opsional)" type="email" :value="values.email"
              @input="v => values.email = v" :required="false" :disabled="loading || isReadOnly" :readonly="isReadOnly"
              placeholder="email@gmail.com" class="w-full" />

            <!-- PIC (Optional) -->
            <FieldX id="pic" label="PIC (Opsional)" :value="values.pic" @input="v => values.pic = v" :required="false"
              :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Nama PIC" class="w-full" />

            <!-- No Telp PIC (Optional) -->
            <FieldX id="no_telp_pic" label="No Telp PIC (Opsional)" :value="values.no_telp_pic"
              @input="v => values.no_telp_pic = v" :required="false" :disabled="loading || isReadOnly"
              :readonly="isReadOnly" placeholder="08123456789" class="w-full" />
          </div>

          <!-- Alamat Detail (Full Width, Optional) -->
          <FieldX id="alamat_detail" type="textarea" label="Alamat Detail (Opsional)" v-model="values.alamat_detail"
            :required="false" :disabled="loading || isReadOnly" :readonly="isReadOnly"
            placeholder="Masukkan detail alamat unit bisnis..." class="w-full" />

          <!-- Catatan (Full Width, Optional) -->
          <FieldX id="catatan" type="textarea" label="Catatan (Opsional)" v-model="values.catatan" :required="false"
            :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Catatan tambahan..." class="w-full" />

          <!-- Status -->
          <FieldStatus label="Status Aktif" name="is_active" v-model="values.is_active" :disabled="loading"
            :readonly="isReadOnly" active-text="Aktif" inactive-text="Tidak Aktif" />

        </CardContent>
      </Card>

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
