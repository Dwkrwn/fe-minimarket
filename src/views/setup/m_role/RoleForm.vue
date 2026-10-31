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
import { FieldX, FieldNumber, FieldStatus } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { Trash2 } from 'lucide-vue-next'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createRole,
  updateRole,
  getRoleById,
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
const systemRole = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'RoleForm')
const isViewMode = computed(() => route.name === 'RoleView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || systemRole.value)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Role'
  if (isCopyMode.value) return 'Salin Role'
  if (isEditMode.value) return 'Edit Role'
  return 'Tambah Role Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Role'
  if (isCopyMode.value) return 'Buat Role baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Role'
  return 'Buat Role aplikasi baru'
})

// Selected menu IDs untuk exclude dari ButtonMultiSelect
const selectedMenuIds = computed(() => {
  return detailArr.value.map(d => d.m_menu_id)
})

// Form values
let values = reactive({
  nama_role: '',
  kode_role: '',
  catatan: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// Detail arrays - menu permissions
const detailArr = ref<any[]>([])

// ============================================================================
// DETAIL METHODS
// ============================================================================

// Handler ketika menu dipilih dari ButtonMultiSelect
const handleMenuAdd = (selectedMenus: any[]) => {
  if (!selectedMenus || selectedMenus.length === 0) return
  
  let addedCount = 0
  let skippedCount = 0
  
  selectedMenus.forEach(menu => {
    // Cek apakah menu sudah ada
    const exists = detailArr.value.some(d => d.m_menu_id === menu.id)
    if (exists) {
      skippedCount++
      return
    }
    
    detailArr.value.push({
      m_menu_id: menu.id,
      m_menu: {
        id: menu.id,
        name: menu.name,
        path: menu.path
      },
      is_read: true,
      is_create: false,
      is_update: false,
      is_delete: false,
      is_print: false
    })
    
    addedCount++
  })
  
  if (addedCount > 0) {
    toast.success(`${addedCount} menu ditambahkan`)
  }
  if (skippedCount > 0) {
    toast.warning(`${skippedCount} menu sudah ada`, { description: 'Menu yang sudah ditambahkan dilewati' })
  }
}

const removeDetailArr = (index: number) => {
  const menuName = detailArr.value[index]?.m_menu?.name || 'Item'
  detailArr.value.splice(index, 1)
  toast.info(`${menuName} dihapus dari daftar`)
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    nama_role: '',
    kode_role: '',
    catatan: '',
    is_active: true
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  // Reset detail arrays
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
    const res = await getRoleById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data
    systemRole.value = !!(res.data as any).system_key && !isCopyModeLocal
    


    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Load detail items (Backend returns m_role_ds, but we send m_role_d)
    if (initialValues.m_role_ds) {

      detailArr.value = initialValues.m_role_ds.map((detail: any) => ({
        m_menu_id: detail.m_menu_id,
        m_menu: detail.m_menu || null,
        is_read: detail.is_read !== undefined ? detail.is_read : true,
        is_create: detail.is_create !== undefined ? detail.is_create : true,
        is_update: detail.is_update !== undefined ? detail.is_update : true,
        is_delete: detail.is_delete !== undefined ? detail.is_delete : true,
        is_print: detail.is_print !== undefined ? detail.is_print : true
      }))
    } else {
      console.log('No m_role_ds found in response')
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
        description: 'Silakan edit dan simpan sebagai Role baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Role', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_role')
      }
    })
    setTimeout(() => router.push('/setup/m_role'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama_role: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.nama_role?.trim()) { errors.nama_role = 'Nama Role wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload
    const payload: any = {
      nama_role: values.nama_role?.trim() || null,
      kode_role: values.kode_role?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      m_role_d: detailArr.value.map(d => ({
        m_menu_id: d.m_menu_id,
        is_read: d.is_read !== undefined ? d.is_read : true,
        is_create: d.is_create !== undefined ? d.is_create : true,
        is_update: d.is_update !== undefined ? d.is_update : true,
        is_delete: d.is_delete !== undefined ? d.is_delete : true,
        is_print: d.is_print !== undefined ? d.is_print : true
      }))
    }
    
    if (isEditMode.value) {
      await updateRole(menuId.value, payload as any)
      toast.success('Role berhasil diperbarui', { description: `Role \"${values.nama_role}\" telah diperbarui` })
    } else {
      await createRole(payload as any)
      toast.success('Role berhasil dibuat', { description: `Role \"${values.nama_role}\" telah ditambahkan` })
    }
    router.replace('/setup/m_role?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Role' : 'Gagal membuat Role', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_role')
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
          <CardTitle>Informasi Role</CardTitle>
          <CardDescription>
            Isi data Role dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">


            <!-- Kode Role Field (readonly) -->
            <FieldX 
              id="kode_role" 
              label="Kode Role (Opsional)" 
              :value="values.kode_role" 
              @input="v => values.kode_role = v" 
              :disabled="loading || isReadOnly" 
              :readonly="true" 
              placeholder="Kode akan digenerate otomatis" 
              class="w-full" 
            />

                        <!-- Nama Role Field -->
            <FieldX 
              id="nama_role" 
              label="Nama Role" 
              :value="values.nama_role" 
              :errorname="errors.nama_role ? 'failed' : ''"
              @input="v => values.nama_role = v" 
              :hints="errors.nama_role" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly" 
              placeholder="Contoh: Administrator" 
              class="w-full" 
            />


            <!-- Catatan Field (full width) -->
          </div>
          
          <!-- Catatan textarea -->
          <FieldX 
            id="catatan" 
            type="textarea"
            label="Catatan (Opsional)" 
            v-model="values.catatan" 
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Catatan atau deskripsi role"
            :rows="3"
          />

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

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="menu-permissions" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="menu-permissions">Menu & Permissions</TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: MENU PERMISSIONS (MULTI-SELECT) -->
        <TabsContent value="menu-permissions" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Menu Permissions</CardTitle>
                  <CardDescription>Pilih menu dan atur hak akses</CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Menu"
                  :api="{
                    url: `${API_BASE_URL}/auth/menu-options`,
                    headers: { Authorization: `Bearer ${authStore.token}` }
                  }"
                  :columns="[
                    { key: 'modul', label: 'Modul', sortable: true, width: '150px' },
                    { key: 'sub_modul', label: 'Submodul', sortable: true, width: '150px' },
                    { key: 'name', label: 'Nama', sortable: true, width: '200px' },
                    { key: 'path', label: 'Path', sortable: true, width: '200px' }
                  ]"
                  searchKey="modul,sub_modul,name,path"
                  displayKey="name"
                  uniqueKey="id"
                  :excludeIds="selectedMenuIds"
                  @add="handleMenuAdd"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Menu</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Path</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Read</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Create</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Update</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Delete</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Print</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td colspan="9" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada menu ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr" :key="index" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.m_menu?.label || detail.m_menu?.name || '-' }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                        {{ detail.m_menu?.path || '-' }}
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_read"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_read ? '✓' : '-' }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_create"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_create ? '✓' : '-' }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_update"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_update ? '✓' : '-' }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_delete"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_delete ? '✓' : '-' }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_print"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_print ? '✓' : '-' }}</span>
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