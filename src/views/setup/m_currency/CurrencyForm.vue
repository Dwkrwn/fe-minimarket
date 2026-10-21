<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldNumber, FieldDateTime, FieldStatus, FieldPopup } from '@/components/field'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createCurrency,
  updateCurrency,
  getCurrencyById,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'CurrencyForm')
const isViewMode = computed(() => route.name === 'CurrencyView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Currency'
  if (isCopyMode.value) return 'Salin Currency'
  if (isEditMode.value) return 'Edit Currency'
  return 'Tambah Currency Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Currency'
  if (isCopyMode.value) return 'Buat Currency baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Currency'
  return 'Buat Currency aplikasi baru'
})

// Form values - m_currency schema
let values = reactive({
  kode_currency: '',
  nama_currency: '',
  simbol_id: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_currency: '',
    nama_currency: '',
    simbol_id: '',
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
  
  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }
  
  loading.value = true
  try {
    const res = await getCurrencyById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Minimal normalisasi
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
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Currency baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Currency', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_currency')
      }
    })
    setTimeout(() => router.push('/setup/m_currency'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  kode_currency: '',
  nama_currency: '',
  simbol_id: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.nama_currency?.trim()) { errors.nama_currency = 'Nama Currency wajib diisi'; invalid = true }
  if (!values.simbol_id?.trim()) { errors.simbol_id = 'Simbol wajib dipilih'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Helper to normalize empty string to null
    const toNull = (v: any) => (v === '' || v === undefined ? null : v)

    // Clean payload: convert empty strings to null
    const payload: any = {
      nama_currency: values.nama_currency?.trim() || null,
      simbol_id: values.simbol_id?.trim() || null,
      is_active: values.is_active,
    }
    
    // kode_currency only included on edit (auto-generated on create)
    if (isEditMode.value && values.kode_currency) {
      payload.kode_currency = values.kode_currency.trim() || null
    }

    if (isEditMode.value) {
      await updateCurrency(menuId.value, payload as any)
      toast.success('Currency berhasil diperbarui', { description: `Currency "${values.nama_currency}" telah diperbarui` })
    } else {
      await createCurrency(payload as any)
      toast.success('Currency berhasil dibuat', { description: `Currency "${values.nama_currency}" telah ditambahkan` })
    }
    router.replace('/setup/m_currency?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Currency' : 'Gagal membuat Currency', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_currency')
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
          <CardTitle>Informasi Currency</CardTitle>
          <CardDescription>
            Isi data Currency dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Currency Field (auto-generated, always disabled) -->
            <FieldX id="kode_currency" label="Kode Currency" :value="values.kode_currency"
              :errorname="errors.kode_currency ? 'failed' : ''" @input="v => values.kode_currency = v"
              :hints="'Auto-generated by system'" :required="false"
              :disabled="true" :readonly="true" placeholder="Auto-generated" class="w-full" />

            <!-- Nama Currency Field (required) -->
            <FieldX id="nama_currency" label="Nama Currency" :value="values.nama_currency"
              :errorname="errors.nama_currency ? 'failed' : ''" @input="v => values.nama_currency = v"
              :hints="errors.nama_currency" :required="!isReadOnly" :disabled="loading || isReadOnly"
              :readonly="isReadOnly" placeholder="Contoh: US Dollar" class="w-full" />

            <!-- Simbol Field (Popup dari money API) -->
            <FieldPopup id="simbol_id" label="Simbol Mata Uang" :value="values.simbol_id"
              @input="(v: string) => values.simbol_id = v" :errorText="errors.simbol_id ? 'failed' : ''"
              :hints="errors.simbol_id || 'Pilih simbol dari tabel money'" :required="!isReadOnly"
              :disabled="loading || isReadOnly" :readonly="isReadOnly" displayField="value1" valueField="id"
              :displayValue="initialValues.money?.value1 || ''" :api="{
                url: `${API_BASE_URL}/dynamic/money`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,value1,value2,value3',
                  filter_column_is_active: 'true',
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                {
                  field: 'code',
                  headerName: 'Code',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'value1',
                  headerName: 'Nama Mata Uang',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'value2',
                  headerName: 'Simbol',
                  width: '100px',
                  sortable: true
                },
                {
                  field: 'value4',
                  headerName: 'Negara',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                }
              ]" placeholder="Pilih simbol mata uang" :clearable="true" class="w-full" />
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

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari, Opera */
}
</style>