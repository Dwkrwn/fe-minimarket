<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FieldX, FieldStatus, FieldTextarea } from '@/components/field'
import { createGCategory, updateGCategory, getGCategoryById } from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import AuditInfo from '@/components/AuditInfo.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const route = useRoute()

/** Apakah user yang sedang login adalah superadmin (menentukan auto status POST/DRAFT) */
const isSuperAdmin = computed(() => authStore.isSuperAdmin)

/**
 * Normalisasi status pencatatan jadi 'DRAFT' atau 'POST'.
 * Data lama (sebelum field status berisi DRAFT/POST) tersimpan sebagai boolean/string true/false
 * setelah kolom diubah jadi string -> nilai itu dianggap data established, jadi dipetakan ke 'POST'.
 * Hanya nilai yang memang literal 'DRAFT' atau 'POST' yang dihormati apa adanya.
 */
const normalizePostingStatus = (raw: unknown): 'DRAFT' | 'POST' => {
  if (typeof raw === 'string') {
    const v = raw.trim().toUpperCase()
    if (v === 'DRAFT' || v === 'POST') return v as 'DRAFT' | 'POST'
  }
  return 'POST'
}

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'GCategoryForm')
const isViewMode = computed(() => route.name === 'GCategoryView')
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

/** Badge class untuk status pencatatan (DRAFT/POST) */
const postingStatusBadgeClass = computed(() => {
  const v = (values.status || 'DRAFT').toUpperCase()
  return v === 'POST'
    ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
})

// Reactive form values with defaults
let values = reactive({
  code: '',
  name: '',
  catatan: '',
  is_active: true,
  // Status pencatatan: auto-determined by creator role (superadmin -> POST, lainnya -> DRAFT)
  status: isSuperAdmin.value ? 'POST' : 'DRAFT'
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})


// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    code: '',
    name: '',
    catatan: '',
    is_active: true,
    status: isSuperAdmin.value ? 'POST' : 'DRAFT'
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
    const res = await getGCategoryById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    }

    // Normalisasi is_active (boolean, support 1/0/'1'/'0' dari API)
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Normalisasi status (string DRAFT/POST)
    if (isCopyModeLocal) {
      // Data hasil copy dianggap entri baru -> status ikut role user yang menyalin saat ini
      initialValues.status = isSuperAdmin.value ? 'POST' : 'DRAFT'
    } else {
      initialValues.status = normalizePostingStatus(initialValues.status)
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      delete (initialValues as any).created_by
      delete (initialValues as any).update_by
      delete (initialValues as any).updated_by
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
        description: 'Silakan edit dan simpan sebagai Category baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Category', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master_group/m_g_category')
      }
    })
    setTimeout(() => router.push('/inventory/master_group/m_g_category'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  code: '',
  name: '',
  catatan: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.code?.trim()) { errors.code = 'Code wajib diisi'; invalid = true }
  if (!values.name?.trim()) { errors.name = 'Name wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    const currentUserId = authStore.user?.id || null
    const payload: any = {
      code: values.code?.trim() || null,
      name: values.name?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: Boolean(values.is_active),
      // Edit: pertahankan status pencatatan yang sudah ada.
      // Create (termasuk hasil copy): status otomatis mengikuti role pembuat saat ini.
      status: isEditMode.value
        ? (values.status || 'DRAFT')
        : (isSuperAdmin.value ? 'POST' : 'DRAFT')
    }
    
    if (isEditMode.value) {
      payload.update_by = currentUserId
      await updateGCategory(menuId.value, payload as any)
      toast.success('Category berhasil diperbarui', { description: `Category "${values.name}" telah diperbarui` })
    } else {
      payload.created_by = currentUserId
      await createGCategory(payload as any)
      toast.success('Category berhasil dibuat', { description: `Category "${values.name}" telah ditambahkan` })
    }
    router.replace('/inventory/master_group/m_g_category?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Category' : 'Gagal membuat Category', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/master_group/m_g_category')
}


</script>

<template>
  <div class="p-6 space-y-6  mx-auto">
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
      <Badge :class="postingStatusBadgeClass" class="uppercase border">
        {{ values.status || 'DRAFT' }}
      </Badge>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
  <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
  <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Category</CardTitle>
          <CardDescription>
            Isi data GCategory dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              placeholder="Contoh: CAT001" 
              class="w-full" 
            />

            <!-- Name Field -->
            <FieldX 
              id="name" 
              label="Name" 
              :value="values.name" 
              :errorname="errors.name ? 'failed' : ''"
              @input="v => values.name = v" 
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
            @input="v => values.catatan = v"
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
            active-text="Active" 
            inactive-text="Non Active" 
          />

          <!-- Info status pencatatan (DRAFT/POST) -->
          <p v-if="!isEditMode || isCopyMode" class="text-xs text-muted-foreground">
            Status pencatatan akan otomatis menjadi
            <span class="font-semibold">{{ isSuperAdmin ? 'POST' : 'DRAFT' }}</span>
            karena dibuat oleh {{ isSuperAdmin ? 'Superadmin' : 'user selain Superadmin' }}.
          </p>

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
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}
</style>