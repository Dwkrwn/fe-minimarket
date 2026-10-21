<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus } from '@/components/field'
import { createSalesReservation, updateSalesReservation, getSalesReservationById } from './service'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'SalesReservationForm')
const isViewMode = computed(() => route.name === 'SalesReservationView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Sales Reservation'
  if (isCopyMode.value) return 'Salin Sales Reservation'
  if (isEditMode.value) return 'Edit Sales Reservation'
  return 'Tambah Sales Reservation Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Sales Reservation'
  if (isCopyMode.value) return 'Buat Sales Reservation baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Sales Reservation'
  return 'Buat Sales Reservation baru'
})

// Reactive form values with defaults
let values = reactive({
  group: '',
  key1: '',
  code: '',
  value1: '',
  value2: '',
  value3: '',
  value4: '',
  value5: '',
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
    group: '',
    key1: '',
    code: '',
    value1: '',
    value2: '',
    value3: '',
    value4: '',
    value5: '',
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
    const res = await getSalesReservationById(sourceId)
    
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
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Sales Reservation baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Sales Reservation', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/marketing/transaksi/t_sales_reservation')
      }
    })
    setTimeout(() => router.push('/marketing/transaksi/t_sales_reservation'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  group: '',
  key1: '',
  code: '',
  value1: '',
  value2: '',
  value3: '',
  value4: '',
  value5: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.group?.trim()) { errors.group = 'Group wajib diisi'; invalid = true }
  if (!values.key1?.trim()) { errors.key1 = 'Key1 wajib diisi'; invalid = true }
  if (!values.code?.trim()) { errors.code = 'Code wajib diisi'; invalid = true }
  if (!values.value1?.trim()) { errors.value1 = 'Value1 wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null
    const payload = {
      group: values.group?.trim() || null,
      key1: values.key1?.trim() || null,
      code: values.code?.trim() || null,
      value1: values.value1?.trim() || null,
      value2: values.value2?.trim() || null,
      value3: values.value3?.trim() || null,
      value4: values.value4?.trim() || null,
      value5: values.value5?.trim() || null,
      is_active: values.is_active
    }
    
    if (isEditMode.value) {
      await updateSalesReservation(menuId.value, payload as any)
      toast.success('Sales Reservation berhasil diperbarui', { description: `Sales Reservation code "${values.code}" telah diperbarui` })
    } else {
      await createSalesReservation(payload as any)
      toast.success('Sales Reservation berhasil dibuat', { description: `Sales Reservation code "${values.code}" telah ditambahkan` })
    }
    router.replace('/marketing/transaksi/t_sales_reservation?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Sales Reservation' : 'Gagal membuat Sales Reservation', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/marketing/transaksi/t_sales_reservation')
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
          <CardTitle>Informasi Sales Reservation</CardTitle>
          <CardDescription>
            Isi data SalesReservation dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Group Field -->
            <FieldX 
              id="group" 
              label="Group" 
              :value="values.group" 
              :errorname="errors.group ? 'failed' : ''"
              @input="v => values.group = v" 
              :hints="errors.group" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: GENDER" 
              class="w-full" 
            />

            <!-- Key1 Field -->
            <FieldX 
              id="key1" 
              label="Key1" 
              :value="values.key1" 
              :errorname="errors.key1 ? 'failed' : ''"
              @input="v => values.key1 = v" 
              :hints="errors.key1" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: MALE" 
              class="w-full" 
            />

            <!-- Code Field -->
            <FieldX 
              id="code" 
              label="Code" 
              :value="values.code" 
              :errorname="errors.code ? 'failed' : ''"
              @input="v => values.code = v" 
              :hints="errors.code" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: M" 
              class="w-full" 
            />

            <!-- Value1 Field -->
            <FieldX 
              id="value1" 
              label="Value1" 
              :value="values.value1" 
              :errorname="errors.value1 ? 'failed' : ''"
              @input="v => values.value1 = v" 
              :hints="errors.value1 "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nilai tambahan 1" 
              class="w-full" 
            />

            <!-- Value2 Field -->
            <FieldX 
              id="value2" 
              label="Value2 (Opsional)" 
              :value="values.value2" 
              :errorname="errors.value2 ? 'failed' : ''"
              @input="v => values.value2 = v" 
              :hints="errors.value2 || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nilai tambahan 2" 
              class="w-full" 
            />

            <!-- Value3 Field -->
            <FieldX 
              id="value3" 
              label="Value3 (Opsional)" 
              :value="values.value3" 
              :errorname="errors.value3 ? 'failed' : ''"
              @input="v => values.value3 = v" 
              :hints="errors.value3 || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nilai tambahan 3" 
              class="w-full" 
            />

            <!-- Value4 Field -->
            <FieldX 
              id="value4" 
              label="Value4 (Opsional)" 
              :value="values.value4" 
              :errorname="errors.value4 ? 'failed' : ''"
              @input="v => values.value4 = v" 
              :hints="errors.value4 || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nilai tambahan 4" 
              class="w-full" 
            />

            <!-- Value5 Field -->
            <FieldX 
              id="value5" 
              label="Value5 (Opsional)" 
              :value="values.value5" 
              :errorname="errors.value5 ? 'failed' : ''"
              @input="v => values.value5 = v" 
              :hints="errors.value5 || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Nilai tambahan 5" 
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
