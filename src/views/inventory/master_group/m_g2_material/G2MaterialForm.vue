<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldPopup, FieldTextarea } from '@/components/field'
import { createG2Material, updateG2Material, getG2MaterialById, getG1TypeReferenceById, getGCategoryReferenceById } from './service'
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

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'G2MaterialForm')
const isViewMode = computed(() => route.name === 'G2MaterialView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail G2 Material'
  if (isCopyMode.value) return 'Salin G2 Material'
  if (isEditMode.value) return 'Edit G2 Material'
  return 'Tambah G2 Material Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data G2 Material'
  if (isCopyMode.value) return 'Buat G2 Material baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data G2 Material'
  return 'Buat G2 Material baru'
})

let values = reactive({
  category_id: '',
  category_name: '',
  g1_type_id: '',
  g1_type_name: '',
  code: '',
  name: '',
  catatan: '',
  is_active: true
})

let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})

const formatCodeName = (item?: any) => {
  if (!item) return ''
  const code = item.code?.trim()
  const name = item.name?.trim()
  return code && name ? `${code} - ${name}` : code || name || ''
}



// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    category_id: '',
    category_name: '',
    g1_type_id: '',
    g1_type_name: '',
    code: '',
    name: '',
    catatan: '',
    is_active: true
  })

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset()

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getG2MaterialById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    }

    if (initialValues.is_active === undefined || initialValues.is_active === null) {
      initialValues.is_active = true
    } else {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    }

    if (initialValues.m_g1_type?.name) {
      initialValues.g1_type_name = formatCodeName(initialValues.m_g1_type)
    }

    if (initialValues.m_g_category?.name) {
      initialValues.category_name = formatCodeName(initialValues.m_g_category)
    } else if (initialValues.category_id) {
      const category = (await getGCategoryReferenceById(initialValues.category_id).catch(() => null))?.data
      if (category) {
        initialValues.category_name = formatCodeName(category)
      }
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      delete (initialValues as any).created_by
      delete (initialValues as any).update_by
      delete (initialValues as any).updated_by
    }

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }



    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai G2 Material baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data G2 Material', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master_group/m_g2_material')
      }
    })
    setTimeout(() => router.push('/inventory/master_group/m_g2_material'), 2000)
  } finally {
    loading.value = false
  }
})

const errors = reactive({
  category_id: '',
  g1_type_id: '',
  code: '',
  name: '',
  catatan: ''
})

const handleCategoryChange = (category: any) => {
  values.category_name = formatCodeName(category)
  if (values.category_id) {
    errors.category_id = ''
  }
  // Reset G1 Type
  values.g1_type_id = ''
  values.g1_type_name = ''
}

const handleG1TypeChange = (g1Type: any) => {
  values.g1_type_name = formatCodeName(g1Type)
  if (values.g1_type_id) {
    errors.g1_type_id = ''
  }
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.category_id?.trim()) { errors.category_id = 'Category wajib dipilih'; invalid = true }
  if (!values.g1_type_id?.trim()) { errors.g1_type_id = 'G1 Type wajib dipilih'; invalid = true }
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
      g1_type_id: values.g1_type_id || null,
      code: values.code?.trim() || null,
      name: values.name?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: Boolean(values.is_active)
    }

    if (isEditMode.value) {
      payload.update_by = currentUserId
      await updateG2Material(menuId.value, payload as any)
      toast.success('G2 Material berhasil diperbarui', { description: `G2 Material "${values.name}" telah diperbarui` })
    } else {
      payload.created_by = currentUserId
      payload.status = isSuperAdmin.value ? 'POST' : 'DRAFT'
      await createG2Material(payload as any)
      toast.success('G2 Material berhasil dibuat', { description: `G2 Material "${values.name}" telah ditambahkan` })
    }
    router.replace('/inventory/master_group/m_g2_material?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui G2 Material' : 'Gagal membuat G2 Material', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/master_group/m_g2_material')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
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

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi G2 Material</CardTitle>
          <CardDescription>
            Isi data G2 Material dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
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
              placeholder="Pilih Category"
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
                { key: 'code', label: 'Code Category', filterable: true, width: '140px' },
                { key: 'name', label: 'Name Category', filterable: true, width: '220px', render: (item: any) => {
                  const code = item.code?.trim()
                  const name = item.name?.trim()
                  return code && name ? `${code} - ${name}` : name || '-'
                } },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' }
              ]"
            />

            <FieldPopup
              id="g1_type_id"
              label="G1 Type"
              :value="values.g1_type_id"
              :display-value="values.g1_type_name"
              :error-text="errors.g1_type_id ? 'failed' : ''"
              @input="v => values.g1_type_id = v"
              @update:valueFull="handleG1TypeChange"
              :hints="errors.g1_type_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.category_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G1 Type"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g1_type`,
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_is_active: true,
                  filter_column_category_id: values.category_id,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                }
              }"
              :columns="[
                { key: 'code', label: 'Code G1 Type', filterable: true, width: '140px' },
                { key: 'name', label: 'Name G1 Type', filterable: true, width: '220px', render: (item: any) => {
                  const code = item.code?.trim()
                  const name = item.name?.trim()
                  return code && name ? `${code} - ${name}` : name || '-'
                } },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' }
              ]"
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
              placeholder="Contoh: G2-001"
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
              placeholder="Nama G2 Material"
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
            placeholder="Catatan G2 Material"
            class="w-full"
          />

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
