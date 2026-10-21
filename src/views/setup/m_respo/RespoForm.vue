<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldX, FieldStatus, FieldSelect } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { Trash2, Plus } from 'lucide-vue-next'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createRespo,
  updateRespo,
  getRespoById,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'RespoForm')
const isViewMode = computed(() => route.name === 'RespoView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Respo'
  if (isCopyMode.value) return 'Salin Respo'
  if (isEditMode.value) return 'Edit Respo'
  return 'Tambah Respo Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Respo'
  if (isCopyMode.value) return 'Buat Respo baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Respo'
  return 'Buat Respo aplikasi baru'
})

// Form values
let values = reactive({
  nama: '',
  catatan: '',
  m_unit_bisnis_id: '',
  m_unit_bisnis: null as any,
  is_active: true,
  m_gudang_id: '' as string | null,
  m_gudang: null as any,
  is_notification_opname: false,
})

// Temp penampung data API mentah sebelum dimasukkan
let initialValues: Record<string, any> = {}

// Detail array untuk m_respo_d (role assignments)
const detailArr = ref<any[]>([])

// Excluded role IDs untuk ButtonMultiSelect
const excludedRoleIds = computed(() => {
  return detailArr.value.map(d => d.m_role_id).filter(Boolean)
})

// ============================================================================
// DETAIL METHODS
// ============================================================================

/** Handle add role from ButtonMultiSelect */
const handleRoleAdd = (selectedRoles: any[]) => {
  console.log('🎯 Selected roles:', selectedRoles)
  
  // Add each selected role to detailArr
  selectedRoles.forEach(role => {
    // Check if role already exists
    const exists = detailArr.value.some(d => d.m_role_id === role.id)
    if (!exists) {
      detailArr.value.push({
        m_role_id: role.id,
        m_role: role,
        is_active: true
      })
    }
  })
  
  toast.success(`${selectedRoles.length} role ditambahkan`)
}

/** Remove role from detail array */
const removeDetailArr = (index: number) => {
  const roleName = detailArr.value[index]?.m_role?.nama_role || 'Role'
  detailArr.value.splice(index, 1)
  toast.info(`${roleName} dihapus`)
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    nama: '',
    catatan: '',
    m_unit_bisnis_id: '',
    m_unit_bisnis: null,
    is_active: true,
    m_gudang_id: null,
    m_gudang: null,
    is_notification_opname: false,
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  // Reset detail array
  detailArr.value = []
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
    const res = await getRespoById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    console.log('📥 Load data from API:', initialValues)

    // Normalize is_active
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Load detail items - Backend returns m_respo_ds (plural)
    if (initialValues.m_respo_ds) {
      detailArr.value = initialValues.m_respo_ds.map((detail: any) => ({
        m_role_id: detail.m_role_id,
        m_role: detail.m_role || null,
        is_active: detail.is_active !== undefined ? detail.is_active : true
      }))
      console.log('📋 Loaded details:', detailArr.value)
    }

    // Mode copy: remove id and timestamps
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      delete (initialValues as any).m_respo_ds
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Respo baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Respo', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_respo')
      }
    })
    setTimeout(() => router.push('/setup/m_respo'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// VALIDATION ERRORS
// ============================================================================
const errors = reactive({
  nama: '',
  m_unit_bisnis_id: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validation
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  if (!values.nama?.trim()) { 
    errors.nama = 'Nama wajib diisi'; invalid = true 
  }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Build payload - Backend expects m_respo_d (singular)
    const payload: any = {
      nama: values.nama?.trim() || null,
      catatan: values.catatan?.trim() || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      is_active: values.is_active,
      m_gudang_id: values.m_gudang_id || null,
      is_notification_opname: values.is_notification_opname || false,
      m_respo_d: detailArr.value.map(d => ({
        m_role_id: d.m_role_id,
        is_active: d.is_active !== undefined ? d.is_active : true
      }))
    }
    
    console.log('💾 Save payload:', payload)
    
    if (isEditMode.value) {
      await updateRespo(menuId.value, payload as any)
      toast.success('Respo berhasil diperbarui', { description: `Respo "${values.nama}" telah diperbarui` })
    } else {
      await createRespo(payload as any)
      toast.success('Respo berhasil dibuat', { description: `Respo "${values.nama}" telah ditambahkan` })
    }
    router.replace('/setup/m_respo?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Respo' : 'Gagal membuat Respo', { 
      description: error instanceof Error ? error.message : 'Terjadi kesalahan' 
    })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_respo')
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
    <form class="space-y-6" @submit.prevent>
      <!-- MAIN CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Respo</CardTitle>
          <CardDescription>
            Isi data Respo dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Nama Field -->
            <div class="md:col-span-2">
              <FieldX 
                id="nama" 
                label="Nama" 
                :value="values.nama" 
                :errorname="errors.nama ? 'failed' : ''"
                @input="v => values.nama = v" 
                :hints="errors.nama" 
                :required="!isReadOnly"
                :disabled="loading || isReadOnly" 
                :readonly="isReadOnly" 
                placeholder="Nama Respo" 
                class="w-full" 
              />
            </div>

            <!-- Unit Bisnis Field -->
            <div class="md:col-span-2">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                :value="values.m_unit_bisnis_id"
                @input="(v: string) => { if (v !== values.m_unit_bisnis_id) { values.m_gudang_id = null; values.m_gudang = null } values.m_unit_bisnis_id = v }"
                @update:valueFull="(obj: any) => values.m_unit_bisnis = obj"
                :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
                :hints="errors.m_unit_bisnis_id"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :clearable="!isReadOnly"
                displayField="nama_comp"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_comp',
                  },
                }"
                placeholder="Pilih Unit Bisnis"
                class="w-full"
              />
            </div>

            <!-- Gudang Field -->
            <div class="md:col-span-2">
              <FieldSelect
                id="m_gudang_id"
                label="Gudang (Opsional)"
                :value="values.m_gudang_id ?? ''"
                @input="(v: string) => values.m_gudang_id = v || null"
                @update:valueFull="(obj: any) => values.m_gudang = obj"
                :required="false"
                :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                :readonly="isReadOnly"
                :clearable="!isReadOnly"
                displayField="nama_gudang"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_gudang`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_gudang,kode_gudang',
                    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                  },
                }"
                :placeholder="values.m_unit_bisnis_id ? 'Pilih Gudang' : 'Pilih Unit Bisnis terlebih dahulu'"
                class="w-full"
              />
            </div>

            <!-- Catatan Field -->
            <div class="md:col-span-2">
              <FieldX 
                id="catatan" 
                type="textarea"
                label="Catatan (Opsional)" 
                v-model="values.catatan" 
                :hints="'Boleh dikosongkan'"
                :required="false"
                :disabled="loading || isReadOnly" 
                :readonly="isReadOnly" 
                placeholder="Catatan tambahan" 
                class="w-full" 
              />
            </div>
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

          <!-- Notifikasi Opname -->
          <FieldStatus
            label="Notifikasi Stock Opname"
            name="is_notification_opname"
            v-model="values.is_notification_opname"
            :disabled="loading"
            :readonly="isReadOnly"
            active-text="Aktif"
            inactive-text="Tidak Aktif"
          />
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="role-assignment" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="role-assignment">Role Assignment</TabsTrigger>
        </TabsList>
        
        <!-- TAB CONTENT: ROLE ASSIGNMENT -->
        <TabsContent value="role-assignment" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Assign Role</CardTitle>
                  <CardDescription>Pilih role yang termasuk dalam respo ini</CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Role"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_role`,
                    headers: { Authorization: `Bearer ${authStore.token}` }
                  }"
                  :columns="[
                    { key: 'kode_role', label: 'Kode', sortable: true, width: '150px' },
                    { key: 'nama_role', label: 'Nama Role', sortable: true, width: '300px' },
                    { key: 'catatan', label: 'Catatan', sortable: true, width: '300px' }
                  ]"
                  searchKey="nama_role"
                  displayKey="nama_role"
                  uniqueKey="id"
                  :excludeIds="excludedRoleIds"
                  @add="handleRoleAdd"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Role</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Status</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada role ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr" :key="index" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.m_role?.nama_role || '-' }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                        {{ detail.m_role?.kode_role || '-' }}
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_active"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_active !== false ? '✓' : '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Trash2 class="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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