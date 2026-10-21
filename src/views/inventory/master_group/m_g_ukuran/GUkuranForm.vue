<script setup lang="ts">
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldTextarea, FieldPopup, FieldNumber } from '@/components/field'
import {
  createGUkuran,
  updateGUkuran,
  getGUkuranById,
  getGCategoryReferenceById,
  getG1TypeReferenceById,
  getG2MaterialReferenceById,
  getG3StandardReferenceById,
  getG4SubtypeReferenceById,
  getG5FinishingReferenceById,
  getG6MerkReferenceById
} from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import AuditInfo from '@/components/AuditInfo.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'GUkuranForm')
const isViewMode = computed(() => route.name === 'GUkuranView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail G Ukuran'
  if (isCopyMode.value) return 'Salin G Ukuran'
  if (isEditMode.value) return 'Edit G Ukuran'
  return 'Tambah G Ukuran Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data G Ukuran'
  if (isCopyMode.value) return 'Buat G Ukuran baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data G Ukuran'
  return 'Buat G Ukuran baru'
})

let values = reactive({
  g_category_id: '',
  category_name: '',
  g1_type_id: '',
  g1_type_name: '',
  g2_material_id: '',
  g2_material_name: '',
  g3_standard_id: '',
  g3_standard_name: '',
  g4_subtype_id: '',
  g4_subtype_name: '',
  g5_finishing_id: '',
  g5_finishing_name: '',
  g6_merk_id: '',
  g6_merk_name: '',
  code: '',
  name: '',
  panjang: null as number | null,
  catatan: '',
  is_active: true,
  status: 'DRAFT'
})

let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})

const errors = reactive({
  g_category_id: '',
  g1_type_id: '',
  g2_material_id: '',
  g3_standard_id: '',
  g4_subtype_id: '',
  g5_finishing_id: '',
  g6_merk_id: '',
  code: '',
  name: '',
  panjang: '',
  catatan: ''
})

const formatCodeName = (item?: any) => {
  if (!item) return ''
  const code = item.code?.trim()
  const name = item.name?.trim()
  return code && name ? `${code} - ${name}` : code || name || ''
}

const sameId = (left?: any, right?: any) => {
  return Boolean(left && right && String(left) === String(right))
}

const pickFirst = (...items: any[]) => {
  return items.find(item => item) || null
}

const getGroupHierarchyIds = (item: any) => {
  const g6Merk = pickFirst(item?.m_g6_merk, item?.g6_merk, item?.g6, item?.m_g6, item?.ukuran_g6_merk)
  const g5Finishing = pickFirst(item?.m_g5_finishing, item?.g5_finishing, item?.g5, item?.m_g5, g6Merk?.m_g5_finishing, g6Merk?.g5_finishing)
  const g4Subtype = pickFirst(item?.m_g4_subtype, item?.g4_subtype, item?.g4, item?.m_g4, g5Finishing?.m_g4_subtype, g5Finishing?.g4_subtype)
  const g3Standard = pickFirst(item?.m_g3_standard, item?.g3_standard, item?.g3, item?.m_g3, g4Subtype?.m_g3_standard, g4Subtype?.g3_standard)
  const g2Material = pickFirst(item?.m_g2_material, item?.g2_material, item?.g2, item?.m_g2, g3Standard?.m_g2_material, g3Standard?.g2_material)
  const g1Type = pickFirst(item?.m_g1_type, item?.g1_type, item?.g1, item?.m_g1, g2Material?.m_g1_type, g2Material?.g1_type)
  const category = pickFirst(item?.m_g_category, item?.g_category, item?.category, item?.m_category, g1Type?.m_g_category, g1Type?.g_category)

  return {
    category_id: item?.g_category_id || item?.category_id || g6Merk?.g_category_id || g6Merk?.category_id || g5Finishing?.g_category_id || g5Finishing?.category_id || g4Subtype?.g_category_id || g4Subtype?.category_id || category?.id || g1Type?.category_id || null,
    g1_type_id: item?.g1_type_id || g6Merk?.g1_type_id || g5Finishing?.g1_type_id || g4Subtype?.g1_type_id || g1Type?.id || g2Material?.g1_type_id || null,
    g2_material_id: item?.g2_material_id || item?.g2_type_id || g6Merk?.g2_material_id || g6Merk?.g2_type_id || g5Finishing?.g2_material_id || g5Finishing?.g2_type_id || g4Subtype?.g2_material_id || g4Subtype?.g2_type_id || g2Material?.id || g3Standard?.g2_material_id || g3Standard?.g2_type_id || null,
    g3_standard_id: item?.g3_standard_id || g6Merk?.g3_standard_id || g5Finishing?.g3_standard_id || g4Subtype?.g3_standard_id || g3Standard?.id || null,
    g4_subtype_id: item?.g4_subtype_id || g6Merk?.g4_subtype_id || g5Finishing?.g4_subtype_id || g4Subtype?.id || null,
    g5_finishing_id: item?.g5_finishing_id || g6Merk?.g5_finishing_id || g5Finishing?.id || null
  }
}

const withFilteredData = (response: any, data: any[]) => ({
  ...response,
  data,
  hasNext: false,
  pagination: response.pagination
    ? { ...response.pagination, next_page: null }
    : response.pagination
})

const filterG4SubtypeResponse = (response: any) => {
  if (response?.status !== 'success' || !Array.isArray(response.data)) return response

  return withFilteredData(response, response.data.filter((item: any) => {
    const ids = getGroupHierarchyIds(item)
    if (values.g3_standard_id) return sameId(ids.g3_standard_id, values.g3_standard_id)
    if (values.g2_material_id) return sameId(ids.g2_material_id, values.g2_material_id)
    if (values.g1_type_id) return sameId(ids.g1_type_id, values.g1_type_id)
    if (values.g_category_id) return sameId(ids.category_id, values.g_category_id)
    return true
  }))
}

const filterG5FinishingResponse = (response: any) => {
  if (response?.status !== 'success' || !Array.isArray(response.data)) return response

  return withFilteredData(response, response.data.filter((item: any) => {
    const ids = getGroupHierarchyIds(item)
    if (values.g4_subtype_id) return sameId(ids.g4_subtype_id, values.g4_subtype_id)
    if (values.g3_standard_id) return sameId(ids.g3_standard_id, values.g3_standard_id)
    if (values.g2_material_id) return sameId(ids.g2_material_id, values.g2_material_id)
    if (values.g1_type_id) return sameId(ids.g1_type_id, values.g1_type_id)
    if (values.g_category_id) return sameId(ids.category_id, values.g_category_id)
    return true
  }))
}

const filterG6MerkResponse = (response: any) => {
  if (response?.status !== 'success' || !Array.isArray(response.data)) return response

  return withFilteredData(response, response.data.filter((item: any) => {
    const ids = getGroupHierarchyIds(item)
    if (values.g5_finishing_id) return sameId(ids.g5_finishing_id, values.g5_finishing_id)
    if (values.g4_subtype_id) return sameId(ids.g4_subtype_id, values.g4_subtype_id)
    if (values.g3_standard_id) return sameId(ids.g3_standard_id, values.g3_standard_id)
    if (values.g2_material_id) return sameId(ids.g2_material_id, values.g2_material_id)
    if (values.g1_type_id) return sameId(ids.g1_type_id, values.g1_type_id)
    if (values.g_category_id) return sameId(ids.category_id, values.g_category_id)
    return true
  }))
}

const onReset = () => {
  Object.assign(values, {
    g_category_id: '',
    category_name: '',
    g1_type_id: '',
    g1_type_name: '',
    g2_material_id: '',
    g2_material_name: '',
    g3_standard_id: '',
    g3_standard_name: '',
    g4_subtype_id: '',
    g4_subtype_name: '',
    g5_finishing_id: '',
    g5_finishing_name: '',
    g6_merk_id: '',
    g6_merk_name: '',
    code: '',
    name: '',
    panjang: null,
    catatan: '',
    is_active: true,
    status: 'DRAFT'
  })
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
}

onBeforeMount(async () => {
  onReset()
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return

  loading.value = true
  try {
    const res = await getGUkuranById(sourceId)
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
      const value = initialValues.is_active
      initialValues.is_active = (value === true || value === 1 || value === '1')
    }

    if (!initialValues.status || typeof initialValues.status === 'boolean') {
      initialValues.status = 'DRAFT'
    } else {
      initialValues.status = String(initialValues.status).toUpperCase()
    }

    if (initialValues.m_g_category?.name) {
      initialValues.category_name = formatCodeName(initialValues.m_g_category)
    } else if (initialValues.g_category_id) {
      const category = (await getGCategoryReferenceById(initialValues.g_category_id).catch(() => null))?.data
      if (category) initialValues.category_name = formatCodeName(category)
    }

    if (initialValues.m_g1_type?.name) {
      initialValues.g1_type_name = formatCodeName(initialValues.m_g1_type)
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

    if (initialValues.m_g3_standard?.name) {
      initialValues.g3_standard_name = formatCodeName(initialValues.m_g3_standard)
    } else if (initialValues.g3_standard_id) {
      const g3Standard = (await getG3StandardReferenceById(initialValues.g3_standard_id).catch(() => null))?.data
      if (g3Standard) initialValues.g3_standard_name = formatCodeName(g3Standard)
    }

    if (initialValues.m_g4_subtype?.name) {
      initialValues.g4_subtype_name = formatCodeName(initialValues.m_g4_subtype)
    } else if (initialValues.g4_subtype_id) {
      const g4Subtype = (await getG4SubtypeReferenceById(initialValues.g4_subtype_id).catch(() => null))?.data
      if (g4Subtype) initialValues.g4_subtype_name = formatCodeName(g4Subtype)
    }

    if (initialValues.m_g5_finishing?.name) {
      initialValues.g5_finishing_name = formatCodeName(initialValues.m_g5_finishing)
    } else if (initialValues.g5_finishing_id) {
      const g5Finishing = (await getG5FinishingReferenceById(initialValues.g5_finishing_id).catch(() => null))?.data
      if (g5Finishing) initialValues.g5_finishing_name = formatCodeName(g5Finishing)
    }

    if (initialValues.m_g6_merk?.name) {
      initialValues.g6_merk_name = formatCodeName(initialValues.m_g6_merk)
    } else if (initialValues.g6_merk_id) {
      const g6Merk = (await getG6MerkReferenceById(initialValues.g6_merk_id).catch(() => null))?.data
      if (g6Merk) initialValues.g6_merk_name = formatCodeName(g6Merk)
    }

    if (isCopyModeLocal) {
      initialValues.status = isSuperAdmin.value ? 'POST' : 'DRAFT'
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

    toast.success(isCopyModeLocal ? 'Data berhasil disalin' : 'Data berhasil dimuat', {
      description: isCopyModeLocal ? 'Silakan edit dan simpan sebagai G Ukuran baru' : undefined
    })
  } catch (error) {
    toast.error('Gagal memuat data G Ukuran', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/master_group/m_g_ukuran')
      }
    })
    setTimeout(() => router.push('/inventory/master_group/m_g_ukuran'), 2000)
  } finally {
    loading.value = false
  }
})

const handleCategoryChange = (category: any) => {
  values.category_name = formatCodeName(category)
  if (values.g_category_id) errors.g_category_id = ''
  values.g1_type_id = ''
  values.g1_type_name = ''
  values.g2_material_id = ''
  values.g2_material_name = ''
  values.g3_standard_id = ''
  values.g3_standard_name = ''
  values.g4_subtype_id = ''
  values.g4_subtype_name = ''
  values.g5_finishing_id = ''
  values.g5_finishing_name = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG1TypeChange = (g1Type: any) => {
  values.g1_type_name = formatCodeName(g1Type)
  if (values.g1_type_id) errors.g1_type_id = ''
  values.g2_material_id = ''
  values.g2_material_name = ''
  values.g3_standard_id = ''
  values.g3_standard_name = ''
  values.g4_subtype_id = ''
  values.g4_subtype_name = ''
  values.g5_finishing_id = ''
  values.g5_finishing_name = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG2MaterialChange = (g2Material: any) => {
  values.g2_material_name = formatCodeName(g2Material)
  if (values.g2_material_id) errors.g2_material_id = ''
  values.g3_standard_id = ''
  values.g3_standard_name = ''
  values.g4_subtype_id = ''
  values.g4_subtype_name = ''
  values.g5_finishing_id = ''
  values.g5_finishing_name = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG3StandardChange = (g3Standard: any) => {
  values.g3_standard_name = formatCodeName(g3Standard)
  if (values.g3_standard_id) errors.g3_standard_id = ''
  values.g4_subtype_id = ''
  values.g4_subtype_name = ''
  values.g5_finishing_id = ''
  values.g5_finishing_name = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG4SubtypeChange = (g4Subtype: any) => {
  values.g4_subtype_name = formatCodeName(g4Subtype)
  if (values.g4_subtype_id) errors.g4_subtype_id = ''
  values.g5_finishing_id = ''
  values.g5_finishing_name = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG5FinishingChange = (g5Finishing: any) => {
  values.g5_finishing_name = formatCodeName(g5Finishing)
  if (values.g5_finishing_id) errors.g5_finishing_id = ''
  values.g6_merk_id = ''
  values.g6_merk_name = ''
}

const handleG6MerkChange = (g6Merk: any) => {
  values.g6_merk_name = formatCodeName(g6Merk)
  if (values.g6_merk_id) errors.g6_merk_id = ''
}

const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.g_category_id?.trim()) { errors.g_category_id = 'Category wajib dipilih'; invalid = true }
  if (!values.g1_type_id?.trim()) { errors.g1_type_id = 'G1 Type wajib dipilih'; invalid = true }
  if (!values.g2_material_id?.trim()) { errors.g2_material_id = 'G2 Material wajib dipilih'; invalid = true }
  if (!values.code?.trim()) { errors.code = 'Code wajib diisi'; invalid = true }
  if (!values.name?.trim()) { errors.name = 'Name wajib diisi'; invalid = true }
  if (values.panjang === null || values.panjang === undefined) {
    errors.panjang = 'Panjang wajib diisi'
    invalid = true
  } else if (Number.isNaN(Number(values.panjang))) {
    errors.panjang = 'Panjang harus berupa angka'
    invalid = true
  } else if (Number(values.panjang) <= 0) {
    errors.panjang = 'Panjang harus lebih dari 0'
    invalid = true
  }
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
      g3_standard_id: values.g3_standard_id || null,
      g4_subtype_id: values.g4_subtype_id || null,
      g5_finishing_id: values.g5_finishing_id || null,
      g6_merk_id: values.g6_merk_id || null,
      code: values.code?.trim() || null,
      name: values.name?.trim() || null,
      panjang: values.panjang === null || values.panjang === undefined ? null : Number(values.panjang),
      catatan: values.catatan?.trim() || null,
      is_active: Boolean(values.is_active),
      status: isEditMode.value
        ? (values.status || 'DRAFT')
        : (isSuperAdmin.value ? 'POST' : 'DRAFT')
    }

    if (isEditMode.value) {
      payload.update_by = currentUserId
      await updateGUkuran(menuId.value, payload)
      toast.success('G Ukuran berhasil diperbarui', { description: `G Ukuran "${values.name}" telah diperbarui` })
    } else {
      payload.created_by = currentUserId
      await createGUkuran(payload)
      toast.success('G Ukuran berhasil dibuat', { description: `G Ukuran "${values.name}" telah ditambahkan` })
    }
    router.replace('/inventory/master_group/m_g_ukuran?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui G Ukuran' : 'Gagal membuat G Ukuran', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/inventory/master_group/m_g_ukuran')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi G Ukuran</CardTitle>
          <CardDescription>Isi data G Ukuran dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="g_category_id"
              label="Category"
              :value="values.g_category_id"
              :display-value="values.category_name"
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

            <FieldPopup
              id="g3_standard_id"
              label="G3 Standard"
              :value="values.g3_standard_id"
              :display-value="values.g3_standard_name"
              :error-text="errors.g3_standard_id ? 'failed' : ''"
              @input="v => values.g3_standard_id = v"
              @update:valueFull="handleG3StandardChange"
              :hints="errors.g3_standard_id"
              :required="false"
              :disabled="loading || isReadOnly || !values.g2_material_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G3 Standard (Opsional)"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g3_standard`,
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_is_active: true,
                  filter_column_g2_type_id: values.g2_material_id,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                }
              }"
              :columns="[
                { key: 'code', label: 'Code G3 Standard', filterable: true, width: '160px' },
                { key: 'name', label: 'Name G3 Standard', filterable: true, width: '200px' },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '220px' }
              ]"
            />

            <FieldPopup
              id="g4_subtype_id"
              label="G4 Subtype"
              :value="values.g4_subtype_id"
              :display-value="values.g4_subtype_name"
              :error-text="errors.g4_subtype_id ? 'failed' : ''"
              @input="v => values.g4_subtype_id = v"
              @update:valueFull="handleG4SubtypeChange"
              :hints="errors.g4_subtype_id"
              :required="false"
              :disabled="loading || isReadOnly || !values.g2_material_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G4 Subtype (Opsional)"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g4_subtype`,
                params: {
                  searchfield: 'code,name,catatan',
                  join: true,
                  include: 'm_g3_standard>m_g2_material>m_g1_type',
                  no_pagination: true,
                  filter_column_is_active: true,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                },
                onsuccess: filterG4SubtypeResponse
              }"
              :columns="[
                { key: 'code', label: 'Code G4 Subtype', filterable: true, width: '150px' },
                { key: 'name', label: 'Name G4 Subtype', filterable: true, width: '220px' },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' }
              ]"
            />

            <FieldPopup
              id="g5_finishing_id"
              label="G5 Finishing"
              :value="values.g5_finishing_id"
              :display-value="values.g5_finishing_name"
              :error-text="errors.g5_finishing_id ? 'failed' : ''"
              @input="v => values.g5_finishing_id = v"
              @update:valueFull="handleG5FinishingChange"
              :hints="errors.g5_finishing_id"
              :required="false"
              :disabled="loading || isReadOnly || !values.g2_material_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G5 Finishing (Opsional)"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g5_finishing`,
                params: {
                  searchfield: 'code,name,catatan',
                  join: true,
                  include: 'm_g4_subtype>m_g3_standard>m_g2_material>m_g1_type',
                  no_pagination: true,
                  filter_column_is_active: true,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                },
                onsuccess: filterG5FinishingResponse
              }"
              :columns="[
                { key: 'code', label: 'Code G5 Finishing', filterable: true, width: '150px' },
                { key: 'name', label: 'Name G5 Finishing', filterable: true, width: '220px' },
                { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' }
              ]"
            />

            <FieldPopup
              id="g6_merk_id"
              label="G6 Merk"
              :value="values.g6_merk_id"
              :display-value="values.g6_merk_name"
              :error-text="errors.g6_merk_id ? 'failed' : ''"
              @input="v => values.g6_merk_id = v"
              @update:valueFull="handleG6MerkChange"
              :hints="errors.g6_merk_id"
              :required="false"
              :disabled="loading || isReadOnly || !values.g2_material_id"
              :readonly="isReadOnly"
              displayField="name"
              valueField="id"
              placeholder="Pilih G6 Merk (Opsional)"
              class="w-full"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g6_merk`,
                params: {
                  searchfield: 'code,name,catatan',
                  join: true,
                  include: 'm_g5_finishing>m_g4_subtype>m_g3_standard>m_g2_material>m_g1_type',
                  no_pagination: true,
                  filter_column_is_active: true,
                  ...(!isEditMode ? { filter_column_status: 'POST' } : {})
                },
                onsuccess: filterG6MerkResponse
              }"
              :columns="[
                { key: 'code', label: 'Code G6 Merk', filterable: true, width: '150px' },
                { key: 'name', label: 'Name G6 Merk', filterable: true, width: '220px' },
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
              placeholder="Contoh: U-001"
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
              placeholder="Nama G Ukuran"
              class="w-full"
            />

            <FieldNumber
              id="panjang"
              label="Panjang"
              :value="values.panjang ?? ''"
              :min="0"
              @input="v => values.panjang = v === '' || v === null || v === undefined ? null : Number(v)"
              :errorname="errors.panjang ? 'failed' : ''"
              :hints="errors.panjang || 'Hanya bisa diisi angka'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: 100"
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
            placeholder="Catatan G Ukuran"
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

      <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
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
