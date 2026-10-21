<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldSelect, FieldNumber, FieldMultiSelect } from '@/components/field'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { createEkspedisi, updateEkspedisi, getEkspedisiById, getEkspedisiList, getTujuanEkspedisiByEkspedisiId } from './service'
import AuditInfo from '@/components/AuditInfo.vue'
import { ArrowLeft, Save, Loader2, X, Plus } from 'lucide-vue-next'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'EkspedisiForm')
const isViewMode = computed(() => route.name === 'EkspedisiView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Ekspedisi'
  if (isCopyMode.value) return 'Salin Ekspedisi'
  if (isEditMode.value) return 'Edit Ekspedisi'
  return 'Tambah Ekspedisi Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Ekspedisi'
  if (isCopyMode.value) return 'Buat Ekspedisi baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Ekspedisi'
  return 'Buat Ekspedisi baru'
})

// Reactive form values with defaults
let values = reactive({
  kode_ekspedisi: '',
  nama: '',
  tujuan_kirim: '',
  alamat: '',
  provinsi: '',
  kota: '',
  kecamatan: '',
  telepon: '',
  cp_kantor: '',
  cp_lapangan: '',
  catatan_biaya: '',
  catatan_lain: '',
  is_active: true // Default true
})

// Destinations state
const currentProvinsi = ref<string>('') // Currently selected province for filtering
const selectedKotaIds = ref<(string | number)[]>([])
const selectedDestinations = ref<Array<{ provinsi_name: string; kota_name: string }>>([])
const kotaSelectKey = ref(0) // Force re-render when province changes

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})
const isDuplicateDialogOpen = ref(false)
const duplicateEkspedisiNames = ref<string[]>([])
const pendingSavePayload = ref<any | null>(null)
const duplicateDialogDescription = computed(() =>
  `Ekspedisi dengan nama "${values.nama}" sudah terdaftar. Apakah Anda tetap ingin menyimpan data ini?`
)


// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_ekspedisi: '',
    nama: '',
    tujuan_kirim: '',
    alamat: '',
    provinsi: '',
    kota: '',
    kecamatan: '',
    telepon: '',
    cp_kantor: '',
    cp_lapangan: '',
    catatan_biaya: '',
    catatan_lain: '',
    is_active: true // Default true
  })

  // Reset destinations
  currentProvinsi.value = ''
  selectedKotaIds.value = []
  selectedDestinations.value = []
  kotaSelectKey.value = 0

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
  
  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }
  
  loading.value = true
  try {
    const res = await getEkspedisiById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    }

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
      initialValues.kode_ekspedisi = ''
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }
    
    // Load tujuan ekspedisi - try from included relation first, if not exists fetch separately
    if (!isCopyModeLocal && sourceId) {
      try {
        let tujuanData: any[] = []
        
        // Try to get from included relation
        if (initialValues.m_tujuan_ekspedisis && Array.isArray(initialValues.m_tujuan_ekspedisis)) {
          tujuanData = initialValues.m_tujuan_ekspedisis
        } else {
          // If not included, fetch separately
          const tujuanRes = await getTujuanEkspedisiByEkspedisiId(sourceId)
          if (tujuanRes.status === 'success' && tujuanRes.data) {
            tujuanData = tujuanRes.data
          }
        }
        
        // Map to selectedDestinations
        if (tujuanData.length > 0) {
          selectedDestinations.value = tujuanData.map((item: any) => ({
            provinsi_name: item.nama_provinsi,
            kota_name: item.nama_kota
          }))
        }
      } catch (error) {
        console.error('Failed to load destinations:', error)
      }
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Ekspedisi baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Ekspedisi', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/purchasing/master/m_ekspedisi')
      }
    })
    setTimeout(() => router.push('/purchasing/master/m_ekspedisi'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama: '',
  tujuan_kirim: '',
  alamat: '',
  provinsi: '',
  kota: '',
  kecamatan: '',
  telepon: '',
  cp_kantor: '',
  cp_lapangan: '',
  catatan_biaya: '',
  catatan_lain: ''
})

// Handler when province changes
const handleProvinsiChange = (newProvinsi: string) => {
  currentProvinsi.value = newProvinsi
  
  // Reset kota selection for current province
  selectedKotaIds.value = []
  
  // Force refresh kota dropdown
  kotaSelectKey.value++
}

// Handler when cities selection changes
const handleKotaChange = (selectedIds: (string | number)[]) => {
  selectedKotaIds.value = selectedIds
  
  // Clear error when user selects destinations
  if (selectedDestinations.value.length > 0 || selectedIds.length > 0) {
    errors.tujuan_kirim = ''
  }
}

// Add selected cities to destinations list (accumulate from all provinces)
const addCitiesToDestinations = () => {
  if (!currentProvinsi.value || selectedKotaIds.value.length === 0) {
    toast.error('Pilih provinsi dan minimal 1 kota')
    return
  }
  
  const addedCount = selectedKotaIds.value.length
  
  // Add new cities to destinations
  selectedKotaIds.value.forEach(kotaName => {
    // Check if city already exists
    const exists = selectedDestinations.value.some(
      dest => dest.kota_name === kotaName && dest.provinsi_name === currentProvinsi.value
    )
    
    if (!exists) {
      selectedDestinations.value.push({
        provinsi_name: currentProvinsi.value,
        kota_name: String(kotaName)
      })
    }
  })
  
  // Clear selections for next province
  currentProvinsi.value = ''
  selectedKotaIds.value = []
  kotaSelectKey.value++
  
  // Clear error if destinations exist
  if (selectedDestinations.value.length > 0) {
    errors.tujuan_kirim = ''
  }
  
  toast.success(`${addedCount} kota ditambahkan`)
}

// Remove destination from list
const removeDestination = (index: number) => {
  selectedDestinations.value.splice(index, 1)
}

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const normalizeName = (name?: string | null) =>
  (name || '').trim().toLowerCase().replace(/\s+/g, ' ')

const validateForm = () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.nama?.trim()) { errors.nama = 'Nama wajib diisi'; invalid = true }
  if (selectedDestinations.value.length === 0) { errors.tujuan_kirim = 'Minimal 1 tujuan kirim wajib dipilih'; invalid = true }
  if (!values.alamat?.trim()) { errors.alamat = 'Alamat wajib diisi'; invalid = true }
  if (!values.provinsi?.trim()) { errors.provinsi = 'Provinsi wajib diisi'; invalid = true }
  if (!values.kota?.trim()) { errors.kota = 'Kota/Kabupaten wajib diisi'; invalid = true }
  if (!values.kecamatan?.trim()) { errors.kecamatan = 'Kecamatan wajib diisi'; invalid = true }
  if (!values.telepon?.trim()) { errors.telepon = 'Telepon wajib diisi'; invalid = true }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return false
  }

  return true
}

const buildPayload = () => ({
  nama: values.nama?.trim() || null,
  tujuan_kirim: values.tujuan_kirim?.trim() || null,
  alamat: values.alamat?.trim() || null,
  provinsi: values.provinsi?.trim() || null,
  kota: values.kota?.trim() || null,
  kecamatan: values.kecamatan?.trim() || null,
  telepon: values.telepon?.trim() || null,
  cp_kantor: values.cp_kantor?.trim() || null,
  cp_lapangan: values.cp_lapangan?.trim() || null,
  catatan_biaya: values.catatan_biaya?.trim() || null,
  catatan_lain: values.catatan_lain?.trim() || null,
  is_active: values.is_active,
  m_tujuan_ekspedisis: selectedDestinations.value.map(dest => ({
    nama_provinsi: dest.provinsi_name,
    nama_kota: dest.kota_name
  }))
})

const findDuplicateEkspedisiNames = async () => {
  const currentName = normalizeName(values.nama)
  if (!currentName) return []

  const response = await getEkspedisiList(
    1,
    20,
    'createdAt',
    'DESC',
    values.nama.trim(),
    'nama'
  )

  return (response.data || [])
    .filter((item: any) => normalizeName(item.nama) === currentName)
    .filter((item: any) => !isEditMode.value || item.id !== menuId.value)
    .map((item: any) => item.nama)
}

const submitPayload = async (payload: any) => {
  loading.value = true
  try {
    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || null
      await updateEkspedisi(menuId.value, payload)
      toast.success('Ekspedisi berhasil diperbarui', { description: `Ekspedisi "${values.nama}" telah diperbarui` })
    } else {
      payload.created_by = authStore.user?.id || null
      payload.updated_by = authStore.user?.id || null
      await createEkspedisi(payload)
      toast.success('Ekspedisi berhasil dibuat', { description: `Ekspedisi "${values.nama}" telah ditambahkan` })
    }

    router.replace('/purchasing/master/m_ekspedisi?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Ekspedisi' : 'Gagal membuat Ekspedisi', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
    pendingSavePayload.value = null
  }
}

const onSave = async () => {
  if (!validateForm()) return

  const payload = buildPayload()
  loading.value = true
  try {
    const duplicateNames = await findDuplicateEkspedisiNames()
    if (duplicateNames.length > 0) {
      duplicateEkspedisiNames.value = duplicateNames
      pendingSavePayload.value = payload
      isDuplicateDialogOpen.value = true
      return
    }
  } catch (error) {
    toast.error('Gagal mengecek duplikasi nama Ekspedisi', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
    return
  } finally {
    loading.value = false
  }

  await submitPayload(payload)
}

const confirmDuplicateSave = async () => {
  isDuplicateDialogOpen.value = false
  if (!pendingSavePayload.value) return
  await submitPayload(pendingSavePayload.value)
}

const cancelDuplicateSave = () => {
  isDuplicateDialogOpen.value = false
  pendingSavePayload.value = null
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/purchasing/master/m_ekspedisi')
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
          <CardTitle>Informasi Ekspedisi</CardTitle>
          <CardDescription>
            Isi data Ekspedisi dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Ekspedisi Field (Auto-generated, readonly) -->
            <FieldX
              id="kode_ekspedisi"
              label="Kode Ekspedisi"
              :value="values.kode_ekspedisi"
              @input="(v) => (values.kode_ekspedisi = v)"
              :errorname="''"
              :hints="'Auto-generated by system'"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full"
            />

            <!-- Nama Field -->
            <FieldX 
              id="nama" 
              label="Nama" 
              :value="values.nama" 
              :errorname="errors.nama ? 'failed' : ''"
              @input="v => values.nama = v" 
              :hints="errors.nama" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nama ekspedisi" 
              class="w-full" 
            />
          </div>

          <!-- Tujuan Kirim Section - Full Width -->
          <div class="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold">Tujuan Kirim (Kota/kabupaten Tujuan) 
                <span class="text-destructive">*</span>
              </h3>
              <p class="text-xs text-muted-foreground">
                Pilih provinsi, lalu pilih kota-kota tujuan dari provinsi tersebut. 
                Untuk menambah kota dari provinsi lain, ganti provinsi dan ulangi.
              </p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Provinsi Dropdown (Single Select) -->
              <FieldSelect 
                id="provinsi_selector"
                label="Pilih Provinsi"
                :value="currentProvinsi"
                @input="(v: any) => handleProvinsiChange(v)"
                :api="{
                  url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                  params: { 
                    search: '', 
                    searchfield: 'name', 
                    selectfield: 'name,id', 
                    paginate: 50 
                  },
                  fullUrl: true
                } as any"
                displayField="name"
                valueField="name"
                :bind="{ clearable: true }"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih provinsi..."
                hints="Pilih provinsi untuk memfilter kota"
                class="w-full"
              />

              <!-- Kota Multi-Select (Filtered by Provinsi) -->
              <FieldMultiSelect
                :key="kotaSelectKey"
                id="kota_selector"
                label="Pilih Kota/Kabupaten"
                v-model="selectedKotaIds"
                @update:modelValue="handleKotaChange"
                :api="{
                  url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                  params: { 
                    provinsi: currentProvinsi,
                    search: '', 
                    searchfield: 'name', 
                    selectfield: 'name,id', 
                    paginate: 100 
                  },
                  fullUrl: true
                } as any"
                displayField="name"
                valueField="name"
                :disabled="!currentProvinsi || loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih kota/Kabupaten..."
                :hints="!currentProvinsi ? 'Pilih provinsi terlebih dahulu' : 'Pilih satu atau lebih kota/kabupaten'"
                class="w-full"
              />
            </div>

            <!-- Add Button -->
            <div v-if="!isReadOnly" class="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                @click="addCitiesToDestinations"
                :disabled="!currentProvinsi || selectedKotaIds.length === 0 || loading"
              >
                <Plus class="h-4 w-4 mr-1" />
                Tambahkan Kota
              </Button>
            </div>

            <!-- Selected Destinations List -->
            <div v-if="selectedDestinations.length > 0" class="space-y-2">
              <div class="flex items-center justify-between">
                <Label class="text-sm font-medium">Kota Tujuan Terpilih:</Label>
                <span class="text-xs text-muted-foreground">{{ selectedDestinations.length }} kota</span>
              </div>
              
              <div class="max-h-[200px] overflow-y-auto border rounded-md p-2 bg-background space-y-1">
                <div
                  v-for="(dest, index) in selectedDestinations"
                  :key="index"
                  class="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm"
                >
                  <div class="flex-1">
                    <span class="font-medium">{{ dest.kota_name }}</span>
                    <span class="text-muted-foreground text-xs ml-2">({{ dest.provinsi_name }})</span>
                  </div>
                  <Button
                    v-if="!isReadOnly"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-destructive hover:text-destructive"
                    @click="removeDestination(index)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <!-- Error Message -->
            <p v-if="errors.tujuan_kirim" class="text-xs text-destructive">
              {{ errors.tujuan_kirim }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Alamat Field -->
            <FieldX 
              id="alamat" 
              label="Alamat" 
              :value="values.alamat" 
              :errorname="errors.alamat ? 'failed' : ''"
              @input="v => values.alamat = v" 
              :hints="errors.alamat" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Alamat lengkap" 
              class="w-full" 
            />

            <!-- Provinsi Field -->
            <FieldSelect 
              id="provinsi"
              label="Provinsi"
              :value="values.provinsi"
              @input="(v: any) => { values.provinsi = v; values.kota = ''; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) { values.kota = ''; values.kecamatan = '' } }"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                params: { search: '', searchfield: 'name', selectfield: 'name,id', paginate: 35 },
                fullUrl: true
              } as any"
              :bind="{ disabled: loading || isReadOnly, clearable: true }"
              :errorname="errors.provinsi ? 'failed' : ''"
              :hints="errors.provinsi"
              :required="!isReadOnly"
              placeholder="Pilih Provinsi"
              class="w-full"
            />

            <!-- Kota Field -->
            <FieldSelect 
              id="kota"
              label="Kota"
              :value="values.kota"
              @input="(v: any) => { values.kota = v; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) values.kecamatan = '' }"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                params: {
                  provinsi: values.provinsi,
                  search: '', searchfield: 'name', selectfield: 'name,id', paginate: 35
                },
                fullUrl: true
              } as any"
              :bind="{ disabled: !values.provinsi || loading || isReadOnly, clearable: true }"
              :errorname="errors.kota ? 'failed' : ''"
              :hints="errors.kota"
              :required="!isReadOnly"
              placeholder="Pilih Kota"
              class="w-full"
            />

            <!-- Kecamatan Field -->
            <FieldSelect 
              id="kecamatan"
              label="Kecamatan"
              :value="values.kecamatan"
              @input="(v: any) => values.kecamatan = v"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                params: { kota: values.kota },
                fullUrl: true
              } as any"
              valueField="key"
              displayField="key"
              :bind="{ disabled: !values.kota || loading || isReadOnly, clearable: true }"
              :errorname="errors.kecamatan ? 'failed' : ''"
              :hints="errors.kecamatan"
              :required="!isReadOnly"
              placeholder="Pilih Kecamatan"
              class="w-full"
            />

            <!-- Telepon Field -->
            <FieldX 
              id="telepon" 
              label="Telepon" 
              :value="values.telepon" 
              :errorname="errors.telepon ? 'failed' : ''"
              @input="v => values.telepon = v" 
              :hints="errors.telepon"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nomor telepon" 
              class="w-full" 
            />

            <!-- CP Kantor Field -->
            <FieldX 
              id="cp_kantor" 
              label="CP Kantor (Opsional)" 
              :value="values.cp_kantor" 
              :errorname="errors.cp_kantor ? 'failed' : ''"
              @input="v => values.cp_kantor = v" 
              :hints="errors.cp_kantor || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contact person kantor" 
              class="w-full" 
            />

            <!-- CP Lapangan Field -->
            <FieldX 
              id="cp_lapangan" 
              label="CP Lapangan (Opsional)" 
              :value="values.cp_lapangan" 
              :errorname="errors.cp_lapangan ? 'failed' : ''"
              @input="v => values.cp_lapangan = v" 
              :hints="errors.cp_lapangan || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contact person lapangan" 
              class="w-full" 
            />

            <!-- Catatan Biaya Field -->
            <FieldX 
              id="catatan_biaya" 
              label="Catatan Biaya (Opsional)" 
              :value="values.catatan_biaya" 
              @input="v => values.catatan_biaya = v"
              :errorname="errors.catatan_biaya ? 'failed' : ''"
              :hints="errors.catatan_biaya || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Masukkan catatan biaya" 
              class="w-full" 
            />

            <!-- Catatan Lain Field -->
            <FieldX 
              id="catatan_lain" 
              label="Catatan Lain (Opsional)" 
              :value="values.catatan_lain" 
              :errorname="errors.catatan_lain ? 'failed' : ''"
              @input="v => values.catatan_lain = v" 
              :hints="errors.catatan_lain || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Catatan tambahan lainnya" 
              class="w-full" 
            />
          </div>

          <!-- Status -->
          <FieldStatus 
            label="Status Aktif" 
            name="is_active" 
            v-model="values.is_active" 
            :disabled="loading"
            :readonly="isReadOnly" 
            active-text="Aktif" 
            inactive-text="Tidak Aktif" 
          />

        </CardContent>
      </Card>

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

    <GlobalDialog
      :open="isDuplicateDialogOpen"
      title="Nama Ekspedisi Sudah Ada"
      :description="duplicateDialogDescription"
      type="warning"
      confirm-text="Tetap Simpan"
      cancel-text="Batal"
      :is-loading="loading"
      @confirm="confirmDuplicateSave"
      @cancel="cancelDuplicateSave"
      @update:open="isDuplicateDialogOpen = $event"
    >
      <div v-if="duplicateEkspedisiNames.length" class="text-sm text-muted-foreground">
        Data yang sama: {{ duplicateEkspedisiNames.join(', ') }}
      </div>
    </GlobalDialog>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}
</style>
