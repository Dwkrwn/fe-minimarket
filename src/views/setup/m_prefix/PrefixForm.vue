<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldPopup, FieldSelect } from '@/components/field'
import { createPrefix, updatePrefix, getPrefixById } from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

// Get auth store for API token
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
const isEditMode = computed(() => !!route.params.id && route.name === 'PrefixForm')
const isViewMode = computed(() => route.name === 'PrefixView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Prefix'
  if (isCopyMode.value) return 'Salin Prefix'
  if (isEditMode.value) return 'Edit Prefix'
  return 'Tambah Prefix Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Prefix'
  if (isCopyMode.value) return 'Buat Prefix baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Prefix'
  return 'Buat Prefix aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  m_unit_bisnis_id: '',
  nama_prefx: '',
  value: '',
  tipe_prefix: '',
  is_active: true // Default true
})

// Store display name for FieldPopup
const unitBisnisDisplayName = ref('')

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}


// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: '',
    nama_prefx: '',
    value: '',
    tipe_prefix: '',
    is_active: true // Default true
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
    const res = await getPrefixById(sourceId)
    
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
    
    // Set display name for unit bisnis if available
    if (initialValues.company?.nama_comp) {
      unitBisnisDisplayName.value = initialValues.company.nama_comp
    } else if (initialValues.m_unit_bisnis?.nama_comp) {
      unitBisnisDisplayName.value = initialValues.m_unit_bisnis.nama_comp
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Prefix baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Prefix', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_prefix')
      }
    })
    setTimeout(() => router.push('/setup/m_prefix'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama_prefx: '',
  value: '',
  tipe_prefix: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.nama_prefx?.trim()) { errors.nama_prefx = 'Nama Prefix wajib diisi'; invalid = true }
  if (!values.value?.trim()) { errors.value = 'Value wajib diisi'; invalid = true }
  if (!values.tipe_prefix?.trim()) { errors.tipe_prefix = 'Tipe Prefix wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null
    const payload = {
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      nama_prefx: values.nama_prefx?.trim() || null,
      value: values.value?.trim() || null,
      tipe_prefix: values.tipe_prefix?.trim() || null,
      is_active: values.is_active
    }
    
    if (isEditMode.value) {
      await updatePrefix(menuId.value, payload as any)
      toast.success('Prefix berhasil diperbarui', { description: `Prefix "${values.nama_prefx}" telah diperbarui` })
    } else {
      await createPrefix(payload as any)
      toast.success('Prefix berhasil dibuat', { description: `Prefix "${values.nama_prefx}" telah ditambahkan` })
    }
    router.replace('/setup/m_prefix?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Prefix' : 'Gagal membuat Prefix', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_prefix')
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
          <CardTitle>Informasi Prefix</CardTitle>
          <CardDescription>
            Isi data Prefix dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis Field (Optional) -->
            <FieldPopup
              id="m_unit_bisnis_id"
              label="Unit Bisnis (Opsional)"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => values.m_unit_bisnis_id = v"
              @update:valueFull="(obj: any) => { unitBisnisDisplayName = obj?.nama_comp || '' }"
              displayField="nama_comp"
              valueField="id"
              :clearable="true"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'kode_unit_bisnis,nama_comp,provinsi',
                  filter_column_is_active:true
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                { key: 'kode_unit_bisnis', label: 'Kode', filterable: true },
                { key: 'nama_comp', label: 'Nama Company', filterable: true },
                { key: 'provinsi', label: 'Provinsi', filterable: true },
                { key: 'pic', label: 'PIC', filterable: true },
                { key: 'catatan', label: 'catatan', filterable: true }
              ]"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full md:col-span-2"
            />

            <!-- Nama Prefix Field -->
            <FieldX 
              id="nama_prefx" 
              label="Nama Prefix" 
              :value="values.nama_prefx" 
              :errorname="errors.nama_prefx ? 'failed' : ''"
              @input="(v: any) => values.nama_prefx = v" 
              :hints="errors.nama_prefx" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: PREFIX_INVOICE" 
              class="w-full" 
            />

            <!-- Value Field -->
            <FieldX 
              id="value" 
              label="Value" 
              :value="values.value" 
              :errorname="errors.value ? 'failed' : ''"
              @input="(v: any) => values.value = v" 
              :hints="errors.value" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: INV" 
              class="w-full" 
            />

            <!-- Tipe Prefix Field -->
            <FieldSelect
              id="tipe_prefix"
              label="Tipe Prefix"
              :value="values.tipe_prefix"
              @input="(v: any) => values.tipe_prefix = v"
              :errorname="errors.tipe_prefix ? 'failed' : ''"
              :hints="errors.tipe_prefix"
              :options="[
                { value: 'TEXT', label: 'TEXT' },
                { value: 'COMPANY CODE', label: 'COMPANY CODE' },
                { value: 'DAY', label: 'DAY ' },
                { value: 'SEQ', label: 'SEQ (XXXX)' },
                { value: 'MONTH', label: 'MONTH' },
                { value: 'YEAR', label: 'YEAR' }
              ]"
              :bind="{ 
                disabled: loading || isReadOnly, 
                clearable: false 
              }"
              :required="!isReadOnly"
              class="w-full md:col-span-2"
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
