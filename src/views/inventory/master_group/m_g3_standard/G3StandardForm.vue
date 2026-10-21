<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { reactive, onBeforeMount, computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldPopup, FieldTextarea } from '@/components/field'
import { createG3Standard, updateG3Standard, getG3StandardById, getG2MaterialReferenceById, getG1TypeReferenceById, getGCategoryReferenceById } from './service'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'G3StandardForm')
const isViewMode = computed(() => route.name === 'G3StandardView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail G3 Standard'
  if (isCopyMode.value) return 'Salin G3 Standard'
  if (isEditMode.value) return 'Edit G3 Standard'
  return 'Tambah G3 Standard Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data G3 Standard'
  if (isCopyMode.value) return 'Buat G3 Standard baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data G3 Standard'
  return 'Buat G3 Standard baru'
})

let values = reactive({
  g_category_id: '',
  g_category_name: '',
  g1_type_id: '',
  g1_type_name: '',
  g2_material_id: '',
  g2_material_name: '',
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
    g_category_id: '',
    g_category_name: '',
    g1_type_id: '',
    g1_type_name: '',
    g2_material_id: '',
    g2_material_name: '',
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
    const res = await getG3StandardById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    }

    // Normalize: backend may return g2_type_id instead of g2_material_id
    if (!initialValues.g2_material_id && (initialValues as any).g2_type_id) {
      initialValues.g2_material_id = (initialValues as any).g2_type_id
    }

    if (!initialValues.g_category_id && initialValues.m_g2_material?.m_g1_type?.category_id) {
       initialValues.g_category_id = initialValues.m_g2_material.m_g1_type.category_id
    }
    if (!initialValues.g1_type_id && initialValues.m_g2_material?.g1_type_id) {
       initialValues.g1_type_id = initialValues.m_g2_material.g1_type_id
    }

    if (initialValues.m_g2_material?.m_g1_type?.m_g_category?.name) {
      initialValues.g_category_name = formatCodeName(initialValues.m_g2_material.m_g1_type.m_g_category)
    } else if (initialValues.g_category_id) {
      const category = (await getGCategoryReferenceById(initialValues.g_category_id).catch(() => null))?.data
      if (category) initialValues.g_category_name = formatCodeName(category)
    }

    if (initialValues.m_g2_material?.m_g1_type?.name) {
      initialValues.g1_type_name = formatCodeName(initialValues.m_g2_material.m_g1_type)
    } else if (initialValues.g1_type_id) {
      const g1Type = (await getG1TypeReferenceById(initialValues.g1_type_id).catch(() => null))?.data
      if (g1Type) initialValues.g1_type_name = formatCodeName(g1Type)
    }

    if (initialValues.m_g2_material?.name) {
      initialValues.g2_material_name = formatCodeName(initialValues.m_g2_material)
    } else if (initialValues.g2_material_id) {
      const g2Material = (await getG2MaterialReferenceById(initialValues.g2_material_id).catch(() => null))?.data
      if (g2Material) initialValues.g2_material_name = formatCodeName(g2Material)
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



    if (initialValues.is_active === undefined || initialValues.is_active === null) {
      initialValues.is_active = true
    } else {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai G3 Standard baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data G3 Standard', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master_group/m_g3_standard')
      }
    })
    setTimeout(() => router.push('/inventory/master_group/m_g3_standard'), 2000)
  } finally {
    loading.value = false
  }
})

const errors = reactive({
  g_category_id: '',
  g1_type_id: '',
  g2_material_id: '',
  code: '',
  name: '',
  catatan: ''
})

const handleCategoryChange = (category: any) => {
  values.g_category_name = formatCodeName(category)
  if (values.g_category_id) errors.g_category_id = ''
  // Reset dependents
  values.g1_type_id = ''
  values.g1_type_name = ''
  values.g2_material_id = ''
  values.g2_material_name = ''
}

const handleG1TypeChange = (g1Type: any) => {
  values.g1_type_name = formatCodeName(g1Type)
  if (values.g1_type_id) errors.g1_type_id = ''
  // Reset dependents
  values.g2_material_id = ''
  values.g2_material_name = ''
}

const handleG2MaterialChange = (g2Material: any) => {
  values.g2_material_name = formatCodeName(g2Material)
  if (values.g2_material_id) {
    errors.g2_material_id = ''
  }
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.g_category_id?.trim()) { errors.g_category_id = 'Category wajib dipilih'; invalid = true }
  if (!values.g1_type_id?.trim()) { errors.g1_type_id = 'G1 Type wajib dipilih'; invalid = true }
  if (!values.g2_material_id?.trim()) { errors.g2_material_id = 'G2 Material wajib dipilih'; invalid = true }
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
      g_category_id: values.g_category_id || null,
      g1_type_id: values.g1_type_id || null,
      g2_material_id: values.g2_material_id || null,
      g2_type_id: values.g2_material_id || null,
      code: values.code?.trim() || null,
      name: values.name?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: Boolean(values.is_active)
    }

    if (isEditMode.value) {
      payload.update_by = currentUserId
      await updateG3Standard(menuId.value, payload as any)
      toast.success('G3 Standard berhasil diperbarui', { description: `G3 Standard "${values.name}" telah diperbarui` })
    } else {
      payload.created_by = currentUserId
      payload.status = isSuperAdmin.value ? 'POST' : 'DRAFT'
      await createG3Standard(payload as any)
      toast.success('G3 Standard berhasil dibuat', { description: `G3 Standard "${values.name}" telah ditambahkan` })
    }
    router.replace('/inventory/master_group/m_g3_standard?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui G3 Standard' : 'Gagal membuat G3 Standard', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/master_group/m_g3_standard')
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
          <CardTitle>Informasi G3 Standard</CardTitle>
          <CardDescription>
            Isi data G3 Standard dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="g_category_id"
              label="Category"
              :value="values.g_category_id"
              :display-value="values.g_category_name"
              :error-text="errors.g_category_id ? 'failed' : ''"
              @input="v => values.g_category_id = v"
              @update:valueFull="handleCategoryChange"
              :hints="errors.g_category_id"
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
              :disabled="loading || isReadOnly || !values.g_category_id"
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
                  filter_column_category_id: values.g_category_id,
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

            <FieldPopup
              id="g2_material_id"
              label="G2 Material"
              :value="values.g2_material_id"
              :display-value="values.g2_material_name"
              :error-text="errors.g2_material_id ? 'failed' : ''"
              @input="v => values.g2_material_id = v"
              @update:valueFull="handleG2MaterialChange"
              :hints="errors.g2_material_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.g1_type_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G2 Material"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g2_material`,
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_is_active: true,
                  filter_column_g1_type_id: values.g1_type_id,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                }
              }"
              :columns="[
                { key: 'code', label: 'Code G2 Material', filterable: true, width: '160px' },
                { key: 'name', label: 'Name G2 Material', filterable: true, width: '220px', render: (item: any) => {
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
              placeholder="Contoh: G3-001"
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
              placeholder="Nama G3 Standard"
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
            placeholder="Catatan G3 Standard"
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
