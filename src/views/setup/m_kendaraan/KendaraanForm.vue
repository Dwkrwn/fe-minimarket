<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldPopup, FieldNumber, FieldDate, FieldSelect } from '@/components/field'
import { createKendaraan, updateKendaraan, getKendaraanById } from './service'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'KendaraanForm')
const isViewMode = computed(() => route.name === 'KendaraanView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Kendaraan'
  if (isCopyMode.value) return 'Salin Kendaraan'
  if (isEditMode.value) return 'Edit Kendaraan'
  return 'Tambah Kendaraan Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Kendaraan'
  if (isCopyMode.value) return 'Buat Kendaraan baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Kendaraan'
  return 'Buat Kendaraan aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  kode_kendaraan: '',
  jenis_kendaraan_id: '',
  nama_kendaraan: '',
  no_polisi: '',
  no_stnk: '',
  no_mesin: '',
  no_kir: '',
  tgl_exp_stnk: null as string | null,
  tgl_exp_kir: null as string | null,
  m_unit_bisnis_id: '', // Unit bisnis/company
  catatan: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// ============================================================================
// COMPUTED - COMPANY INFO FROM SELECTRESPO
// ============================================================================
const companyNameDisplay = computed(() => {
  // Untuk non-super admin, ambil dari SelectRespo
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        return parsed.companyName || ''
      }
    } catch (e) {
      console.error('Failed to parse SelectRespo:', e)
    }
  }
  return ''
})

const isUnitBisnisReadOnly = computed(() => {
  // Readonly untuk non-super admin atau saat view mode
  return !authStore.isSuperAdmin || isReadOnly.value
})

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_kendaraan: '',
    jenis_kendaraan_id: '',
    nama_kendaraan: '',
    no_polisi: '',
    no_stnk: '',
    no_mesin: '',
    no_kir: '',
    tgl_exp_stnk: null,
    tgl_exp_kir: null,
    m_unit_bisnis_id: '',
    catatan: '',
    is_active: true
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
  
  // Auto-fill unit bisnis dari SelectRespo untuk non-super admin
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId
        }
      }
    } catch (e) {
      // Failed to parse SelectRespo
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
    const res = await getKendaraanById(sourceId)
    
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
      delete (initialValues as any).kode_kendaraan // Hapus kode_kendaraan agar auto-generate baru
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // Handle date fields: convert timestamp to YYYY-MM-DD
        if ((key === 'tgl_exp_stnk' || key === 'tgl_exp_kir') && initialValues[key]) {
          const dateValue = new Date(initialValues[key])
          if (!isNaN(dateValue.getTime())) {
            // @ts-ignore
            values[key] = dateValue.toISOString().split('T')[0]
          } else {
            // @ts-ignore
            values[key] = initialValues[key]
          }
        } else {
          // @ts-ignore dynamic assign
          values[key] = initialValues[key]
        }
      }
    }
    
    // Jika m_unit_bisnis_id dari API null dan user bukan super admin, gunakan dari SelectRespo
    if (!values.m_unit_bisnis_id && !authStore.isSuperAdmin) {
      try {
        const selectRespo = localStorage.getItem('SelectRespo')
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo)
          if (parsed.companyId) {
            values.m_unit_bisnis_id = parsed.companyId
          }
        }
      } catch (e) {
        // Failed to parse SelectRespo
      }
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Kendaraan baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Kendaraan', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_kendaraan')
      }
    })
    setTimeout(() => router.push('/setup/m_kendaraan'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  jenis_kendaraan_id: '',
  nama_kendaraan: '',
  no_polisi: '',
  m_unit_bisnis_id: ''
})

// Helper to convert empty strings to null
const toNull = (val?: string | null) => (val?.trim() ? val.trim() : null)

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  if (!values.jenis_kendaraan_id?.trim()) { 
    errors.jenis_kendaraan_id = 'Jenis kendaraan wajib dipilih'; 
    invalid = true 
  }
  
  if (!values.nama_kendaraan?.trim()) { 
    errors.nama_kendaraan = 'Nama kendaraan wajib diisi'; 
    invalid = true 
  }
  
  if (!values.no_polisi?.trim()) { 
    errors.no_polisi = 'No polisi wajib diisi'; 
    invalid = true 
  }
  
  if (!values.m_unit_bisnis_id || !values.m_unit_bisnis_id.trim()) { 
    errors.m_unit_bisnis_id = 'Unit bisnis wajib dipilih'; 
    invalid = true 
  }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null
    const payload: any = {
      jenis_kendaraan_id: values.jenis_kendaraan_id,
      nama_kendaraan: values.nama_kendaraan.trim(),
      no_polisi: values.no_polisi.trim(),
      no_stnk: toNull(values.no_stnk),
      no_mesin: toNull(values.no_mesin),
      no_kir: toNull(values.no_kir),
      tgl_exp_stnk: values.tgl_exp_stnk || null,
      tgl_exp_kir: values.tgl_exp_kir || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      catatan: toNull(values.catatan),
      is_active: values.is_active
    }
    
    // Kode kendaraan: jangan kirim saat create, kirim (bahkan null) saat edit
    if (isEditMode.value) {
      payload.kode_kendaraan = toNull(values.kode_kendaraan)
      await updateKendaraan(menuId.value, payload)
      toast.success('Kendaraan berhasil diperbarui', { description: `Kendaraan "${values.nama_kendaraan}" telah diperbarui` })
    } else {
      await createKendaraan(payload)
      toast.success('Kendaraan berhasil dibuat', { description: `Kendaraan "${values.nama_kendaraan}" telah ditambahkan` })
    }
    router.replace('/setup/m_kendaraan?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Kendaraan' : 'Gagal membuat Kendaraan', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_kendaraan')
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
          <CardTitle>Informasi Kendaraan</CardTitle>
          <CardDescription>
            Isi data Kendaraan dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Kendaraan (readonly/auto-generated) -->
            <FieldX 
              id="kode_kendaraan" 
              label="Kode Kendaraan" 
              :value="values.kode_kendaraan" 
              @input="v => values.kode_kendaraan = v" 
              :hints="'Auto-generated, readonly'"
              :required="false"
              :disabled="true" 
              :readonly="true" 
              placeholder="-" 
              class="w-full" 
            />

                        <div v-if="!authStore.isSuperAdmin" class="w-full">
              <FieldX
                id="m_unit_bisnis_display"
                label="Unit Bisnis"
                :value="companyNameDisplay"
                :disabled="true"
                :readonly="true"
                placeholder="Unit bisnis dari respo"
                class="w-full"
                hints="Unit bisnis otomatis dari respo yang dipilih"
              />
            </div>
            
            <FieldPopup
              v-else
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => values.m_unit_bisnis_id = v"
              @update:valueFull="(obj: any) => {
                console.log('Selected Unit Bisnis:', obj)
              }"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Pilih unit bisnis dari popup table"
              :clearable="true"
              displayField="nama_comp"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'kode_unit_bisnis,nama_comp,pic'
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                {
                  key: 'index',
                  label: 'No',
                  width: '60px',
                  sortable: false,
                  filterable: false,
                  render: (item: any, index: number) => index + 1
                },
                {
                  field: 'kode_unit_bisnis',
                  headerName: 'Kode',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'nama_comp',
                  headerName: 'Nama Unit Bisnis',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'pic',
                  headerName: 'PIC',
                  width: '120px',
                  sortable: true,
                  filterable: false
                },
                {
                  field: 'kota',
                  headerName: 'Kota',
                  width: '150px',
                  sortable: true,
                  filterable: false
                }
              ]"
              placeholder="Pilih unit bisnis"
              class="w-full"
            />

            <!-- Jenis Kendaraan (FieldSelect from m_general group JENIS KENDARAAN) -->
            <FieldSelect 
              id="jenis_kendaraan_id" 
              label="Jenis Kendaraan" 
              :value="values.jenis_kendaraan_id" 
              @input="(v: string) => values.jenis_kendaraan_id = v"
              :errorText="errors.jenis_kendaraan_id ? 'failed' : ''"
              :hints="errors.jenis_kendaraan_id || 'Pilih jenis kendaraan'"
              :required="!isReadOnly"
              :clearable="false"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield:'id,value1',
                  filter_column_group: 'JENIS KENDARAAN',
                  filter_column_is_active: 'true'
                },
              }"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih jenis kendaraan"
              class="w-full"
            />

            <!-- Nama Kendaraan -->
            <FieldX 
              id="nama_kendaraan" 
              label="Nama Kendaraan" 
              :value="values.nama_kendaraan" 
              :errorname="errors.nama_kendaraan ? 'failed' : ''"
              @input="v => values.nama_kendaraan = v" 
              :hints="errors.nama_kendaraan" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: Toyota Avanza Hitam" 
              class="w-full" 
            />

            <!-- No Polisi -->
            <FieldX 
              id="no_polisi" 
              label="No Polisi" 
              :value="values.no_polisi" 
              :errorname="errors.no_polisi ? 'failed' : ''"
              @input="v => values.no_polisi = v" 
              :hints="errors.no_polisi" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: B 1234 XYZ" 
              class="w-full" 
            />

            <!-- No STNK -->
            <FieldX 
              id="no_stnk" 
              label="No STNK (Opsional)" 
              :value="values.no_stnk" 
              @input="v => values.no_stnk = v" 
              :hints="'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nomor STNK" 
              class="w-full" 
            />

            <!-- No Mesin -->
            <FieldX 
              id="no_mesin" 
              label="No Mesin (Opsional)" 
              :value="values.no_mesin" 
              @input="v => values.no_mesin = v" 
              :hints="'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nomor mesin kendaraan" 
              class="w-full" 
            />

            <!-- No KIR -->
            <FieldX 
              id="no_kir" 
              label="No KIR (Opsional)" 
              :value="values.no_kir" 
              @input="v => values.no_kir = v" 
              :hints="'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nomor KIR" 
              class="w-full" 
            />

            <!-- Tgl Exp STNK -->
            <FieldDate 
              id="tgl_exp_stnk" 
              label="Tgl Exp STNK (Opsional)" 
              :value="values.tgl_exp_stnk" 
              @input="v => values.tgl_exp_stnk = v" 
              :hints="'Tanggal expired STNK'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Pilih tanggal" 
              class="w-full" 
            />

            <!-- Tgl Exp KIR -->
            <FieldDate 
              id="tgl_exp_kir" 
              label="Tgl Exp KIR (Opsional)" 
              :value="values.tgl_exp_kir" 
              @input="v => values.tgl_exp_kir = v" 
              :hints="'Tanggal expired KIR'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Pilih tanggal" 
              class="w-full" 
            />

          </div>

          <!-- Catatan (full width) -->
          <FieldX 
            id="catatan" 
            type="textarea"
            label="Catatan (Opsional)" 
            v-model="values.catatan" 
            :hints="'Catatan tambahan tentang kendaraan'"
            :required="false"
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Tulis catatan disini..." 
            class="w-full" 
          />

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
