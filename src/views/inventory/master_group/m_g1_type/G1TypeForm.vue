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
import { FieldX, FieldStatus, FieldPopup, FieldTextarea } from '@/components/field'
import { createG1Type, updateG1Type, getG1TypeById } from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import AuditInfo from '@/components/AuditInfo.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
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
const isEditMode = computed(() => !!route.params.id && route.name === 'G1TypeForm')
const isViewMode = computed(() => route.name === 'G1TypeView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail G1 Type'
  if (isCopyMode.value) return 'Salin G1 Type'
  if (isEditMode.value) return 'Edit G1 Type'
  return 'Tambah G1 Type Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data G1 Type'
  if (isCopyMode.value) return 'Buat G1 Type baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data G1 Type'
  return 'Buat G1 Type baru'
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
  category_id: '',
  category_code: '',
  category_name: '',
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
    category_id: '',
    category_code: '',
    category_name: '',
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
    const res = await getG1TypeById(sourceId)
    
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

    if (initialValues.m_g_category?.name) {
      initialValues.category_name = initialValues.m_g_category.name
    }

    if (initialValues.m_g_category?.code) {
      initialValues.category_code = initialValues.m_g_category.code
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
        description: 'Silakan edit dan simpan sebagai G1 Type baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data G1 Type', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master_group/m_g1_type')
      }
    })
    setTimeout(() => router.push('/inventory/master_group/m_g1_type'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  category_id: '',
  code: '',
  name: '',
  catatan: ''
})

const handleCategoryChange = (category: any) => {
  values.category_code = category?.code || ''
  values.category_name = category?.name || ''
  if (values.category_id) {
    errors.category_id = ''
  }
}

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.category_id?.trim()) { errors.category_id = 'Category wajib dipilih'; invalid = true }
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
      category_id: values.category_id || null,
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
      await updateG1Type(menuId.value, payload as any)
      toast.success('G1 Type berhasil diperbarui', { description: `G1 Type "${values.name}" telah diperbarui` })
    } else {
      payload.created_by = currentUserId
      await createG1Type(payload as any)
      toast.success('G1 Type berhasil dibuat', { description: `G1 Type "${values.name}" telah ditambahkan` })
    }
    router.replace('/inventory/master_group/m_g1_type?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui G1 Type' : 'Gagal membuat G1 Type', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/master_group/m_g1_type')
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
          <CardTitle>Informasi G1 Type</CardTitle>
          <CardDescription>
            Isi data G1Type dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="category_id"
              label="Category"
              :value="values.category_id"
              :display-value="values.category_name"
              :error-text="errors.category_id ? 'failed' : ''"
              @input="v => values.category_id = v"
              @update:valueFull="handleCategoryChange"
              :hints="errors.category_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih category"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g_category`,
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_is_active: true,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                }
              }"
              :columns="[
                { key: 'code', label: 'Code', filterable: true, width: '140px' },
                { key: 'name', label: 'Name', filterable: true, width: '220px' },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' }
              ]"
            />

            <FieldX
              id="category_code"
              label="Category Code"
              :value="values.category_code"
              :disabled="true"
              :readonly="true"
              placeholder="Code category"
              class="w-full"
            />

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
              placeholder="Contoh: G1-001" 
              class="w-full" 
            />

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
              placeholder="Nama G1 Type" 
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
            placeholder="Catatan G1 Type"
            class="w-full"
          />

          <!-- Status Active/Non Active -->
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