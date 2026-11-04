<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldTextarea } from '@/components/field'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { createCategory, updateCategory, getCategoryById, type CategoryPayload } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'CategoryForm')
const isViewMode = computed(() => route.name === 'CategoryView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Category'
  if (isCopyMode.value) return 'Salin Category'
  if (isEditMode.value) return 'Edit Category'
  return 'Tambah Category Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Category'
  if (isCopyMode.value) return 'Buat Category baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Category'
  return 'Buat Category baru'
})

// Reactive form values with defaults
const values = reactive({
  code: '',
  name: '',
  catatan: '',
  is_active: true,
})

const errors = reactive({
  code: '',
  name: '',
  catatan: '',
})

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    code: '',
    name: '',
    catatan: '',
    is_active: true,
  })

  Object.keys(errors).forEach((key) => {
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
    const res = await getCategoryById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    const data = res.data

    // Normalisasi is_active (boolean, support 1/0/'1'/'0' dari API)
    const isActiveRaw = data.is_active as unknown
    values.is_active =
      isActiveRaw === undefined || isActiveRaw === null
        ? true
        : isActiveRaw === true || isActiveRaw === 1 || isActiveRaw === '1'

    values.code = data.code || ''
    values.name = data.name || ''
    values.catatan = data.catatan || ''

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Category baru',
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Category', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master/m_category'),
      },
    })
    setTimeout(() => router.push('/inventory/master/m_category'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = ''
  })

  let invalid = false
  if (!values.name?.trim()) {
    errors.name = 'Nama wajib diisi'
    invalid = true
  } else if (values.name.trim().length > 100) {
    errors.name = 'Nama maksimal 100 karakter'
    invalid = true
  }
  if (values.code && values.code.trim().length > 50) {
    errors.code = 'Kode maksimal 50 karakter'
    invalid = true
  }
  if (values.catatan && values.catatan.trim().length > 255) {
    errors.catatan = 'Catatan maksimal 255 karakter'
    invalid = true
  }

  if (invalid) {
    toast.error('Validasi gagal', {
      description: 'Mohon lengkapi semua field yang wajib diisi',
    })
    return
  }

  loading.value = true
  try {
    const payload: CategoryPayload = {
      code: values.code?.trim() || null,
      name: values.name.trim(),
      catatan: values.catatan?.trim() || null,
      is_active: Boolean(values.is_active),
    }

    if (isEditMode.value) {
      await updateCategory(menuId.value, payload)
      toast.success('Category berhasil diperbarui', {
        description: `Category "${payload.name}" telah diperbarui`,
      })
    } else {
      await createCategory(payload)
      toast.success('Category berhasil dibuat', {
        description: `Category "${payload.name}" telah ditambahkan`,
      })
    }
    router.replace('/inventory/master/m_category?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Category' : 'Gagal membuat Category', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/master/m_category')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between gap-4">
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
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Category</CardTitle>
          <CardDescription>
            Isi data Category dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Code Field -->
            <FieldX
              id="code"
              label="Kode"
              :value="values.code"
              :errorname="errors.code ? 'failed' : ''"
              @input="(v) => (values.code = v)"
              :hints="errors.code || 'Boleh dikosongkan'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: CAT001"
              class="w-full"
            />

            <!-- Name Field -->
            <FieldX
              id="name"
              label="Nama Category"
              :value="values.name"
              :errorname="errors.name ? 'failed' : ''"
              @input="(v) => (values.name = v)"
              :hints="errors.name"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Nama category"
              class="w-full"
            />
          </div>

          <FieldTextarea
            id="catatan"
            label="Catatan"
            :value="values.catatan"
            :errorname="errors.catatan ? 'failed' : ''"
            @input="(v) => (values.catatan = v)"
            :hints="errors.catatan || 'Boleh dikosongkan'"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan category"
            class="w-full"
          />

          <!-- Status Aktif/Nonaktif -->
          <FieldStatus
            label="Status Active"
            name="is_active"
            v-model="values.is_active"
            :disabled="loading"
            :readonly="isReadOnly"
            active-text="Aktif"
            inactive-text="Nonaktif"
          />
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
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
