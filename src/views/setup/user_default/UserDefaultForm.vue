<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldSelect, FieldPopup } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { createUserDefault, updateUserDefault, getUserDefaultById, type UserDetailItem } from './service'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

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
const isEditMode = computed(() => !!route.params.id && route.name === 'UserDefaultForm')
const isViewMode = computed(() => route.name === 'UserDefaultView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail UserDefault'
  if (isCopyMode.value) return 'Salin UserDefault'
  if (isEditMode.value) return 'Edit UserDefault'
  return 'Tambah UserDefault Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data UserDefault'
  if (isCopyMode.value) return 'Buat UserDefault baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data UserDefault'
  return 'Buat UserDefault aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  name: '',
  username: '',
  password: '',
  confirm_password: '',
  // COMMENTED [tipe_user_id]: tipe_user_id: '',
  m_kary_id: '',
  catatan: '',
  is_active: true // Default true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// Simpan password hash dari API (untuk dikirim kembali jika tidak diubah)
let originalPasswordHash = ref<string>('')

// Detail array untuk user_details (respo)
const detailArr = ref<UserDetailItem[]>([])

// Computed: IDs dari detail yang sudah ditambahkan
const selectedRespoIds = computed(() => {
  return detailArr.value.map(detail => detail.m_respo_id).filter((id): id is string => !!id)
})

// ============================================================================
// WATCH USERNAME - AUTO REMOVE SPACES & AUTO FILL NAME
// ============================================================================
watch(() => values.username, (newValue, oldValue) => {
  if (newValue && newValue.includes(' ')) {
    // Hapus semua spasi
    values.username = newValue.replace(/\s/g, '')

    // Tampilkan notifikasi
    toast.warning('Spasi tidak diperbolehkan', {
      description: 'Username tidak boleh mengandung spasi. Spasi telah dihapus otomatis.'
    })
  }

  // Auto fill nama dengan username jika karyawan tidak dipilih
  if (!values.m_kary_id) {
    values.name = values.username?.replace(/\s/g, '') || ''
  }
})

// ============================================================================
// HELPER FUNCTION - Get Company ID from SelectRespo
// ============================================================================
/** Get company ID from SelectRespo for filtering karyawan */
const getCompanyIdFromSelectRespo = (): string | undefined => {
  // Super admin tidak perlu filter company
  if (authStore.isSuperAdmin) return undefined

  try {
    const selectRespo = localStorage.getItem('SelectRespo')
    if (selectRespo) {
      const parsed = JSON.parse(selectRespo)
      return parsed.companyId || undefined
    }
  } catch (e) {
    console.error('Failed to parse SelectRespo:', e)
  }
  return undefined
}

// ============================================================================
// KARYAWAN DATA HANDLER
// ============================================================================
const selectedKaryawan = ref<any>(null)

const handleKaryawanSelect = (karyawanData: any) => {
  if (karyawanData) {
    selectedKaryawan.value = karyawanData
    // Auto-fill nama dari nama_kary
    values.name = karyawanData.nama_kary || ''
  } else {
    // Jika karyawan di-clear, isi nama dengan username
    selectedKaryawan.value = null
    values.name = values.username || ''
  }
}


// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    name: '',
    username: '',
    password: '',
    confirm_password: '',
    // COMMENTED [tipe_user_id]: tipe_user_id: '',
    m_kary_id: '',
    catatan: '',
    is_active: true // Default true
  })

  // Reset password hash
  originalPasswordHash.value = ''

  // Reset detail array
  detailArr.value = []

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

// ============================================================================
// DETAIL HANDLERS
// ============================================================================

const onDetailAdd = async (items: any[]) => {

  const hasPrimary = detailArr.value.some(detail => detail.is_primary === true)


  items.forEach((row, index) => {
    const detail: UserDetailItem = {
      m_respo_id: row.id,
      is_primary: !hasPrimary && index === 0,
      is_active: true,
      m_respo: {
        id: row.id,
        name: row.nama || row.name || '-'
      }
    }
    detailArr.value.push(detail)
  })

  toast.success(`${items.length} respo ditambahkan`)
}
const removeDetail = (index: number) => {
  if (index < 0 || index >= detailArr.value.length) return

  const removedItem = detailArr.value[index]
  const wasPrimary = removedItem?.is_primary || false
  detailArr.value.splice(index, 1)
  if (wasPrimary && detailArr.value.length > 0) {
    const firstItem = detailArr.value[0]
    if (firstItem) {
      firstItem.is_primary = true
      toast.info('Item dihapus. Primary dipindahkan ke item pertama.')
    }
  } else {
    toast.info('Item dihapus dari list')
  }
}

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  // Jangan reset untuk mode create karena values sudah memiliki default yang benar
  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  // Jika mode create (bukan edit/view/copy), langsung return
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  // Reset hanya jika mode edit/view/copy
  onReset()

  loading.value = true
  try {
    const res = await getUserDefaultById(sourceId)

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
      // Juga hapus password untuk mode copy (user harus set ulang)
      delete (initialValues as any).password
    } else {
      // Simpan password hash asli untuk dikirim kembali jika tidak diubah
      originalPasswordHash.value = initialValues.password || ''
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }

    // Untuk mode edit/view, kosongkan password field (user tidak perlu lihat password hash)
    // Password hash asli sudah disimpan di originalPasswordHash
    values.password = ''
    values.confirm_password = ''

    // Load user_details jika ada
    const detailsArray = initialValues.user_details || initialValues.user_detail || []

    if (Array.isArray(detailsArray)) {
      detailsArray.forEach((item: any) => {
        detailArr.value.push({
          ...item,
          m_respo: {
            id: item.m_respo?.id || item.m_respo_id,
            name: item.m_respo?.nama || item.m_respo?.name || '-' // API pakai 'nama' bukan 'name'
          }
        })
      })
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai User baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data User', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/user_default')
      }
    })
    setTimeout(() => router.push('/setup/user_default'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  name: '',
  username: '',
  password: '',
  confirm_password: '',
  // COMMENTED [tipe_user_id]: tipe_user_id: '',
  m_kary_id: '',
  catatan: ''
})

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false

  if (!values.username?.trim()) {
    errors.username = 'Username wajib diisi';
    invalid = true
  }

  // Password hanya required untuk mode CREATE, tidak untuk EDIT
  if (!isEditMode.value && !values.password?.trim()) {
    errors.password = 'Password wajib diisi';
    invalid = true
  }

  // Jika password diisi, harus cocok dengan confirm password
  if (values.password?.trim() && values.password !== values.confirm_password) {
    errors.confirm_password = 'Password tidak cocok';
    invalid = true
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Validasi detail: jika ada detail, minimal harus ada 1 primary
  if (detailArr.value.length > 0) {
    const hasPrimary = detailArr.value.some(detail => detail.is_primary === true)
    if (!hasPrimary) {
      toast.error('Validasi gagal', {
        description: 'Minimal harus ada satu respo yang ditandai sebagai Primary'
      })
      return
    }
  }

  loading.value = true
  try {
    const payload: any = {
      name: values.name?.trim() || null,
      username: values.username?.trim() || null,
      // COMMENTED [tipe_user_id]: tipe_user_id: values.tipe_user_id?.trim() || null,
      m_kary_id: values.m_kary_id?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active
    }

    // Password handling:
    // - Untuk CREATE: password wajib (sudah divalidasi)
    // - Untuk EDIT: 
    //   * Jika user mengisi password baru → kirim password baru
    //   * Jika user tidak mengisi → jangan kirim field password sama sekali
    if (values.password?.trim()) {
      // User mengisi password baru (create atau edit)
      payload.password = values.password.trim()
    } else if (!isEditMode.value) {
      // Create mode dan password kosong (sudah dicegah di validasi)
      payload.password = null
    }
    // Untuk edit mode dengan password kosong: jangan tambahkan field password ke payload

    // Include user_details if array has items
    const hasDetails = detailArr.value.length > 0
    if (hasDetails) {
      payload.user_details = detailArr.value.map(detail => ({
        m_respo_id: detail.m_respo_id,
        is_primary: detail.is_primary || false,
        is_active: detail.is_active !== false // default true
      }))
    }

    console.log('=== DEBUG SAVE ===')
    console.log('Has details:', hasDetails)
    console.log('Payload:', payload)
    console.log('====================')

    if (isEditMode.value) {
      await updateUserDefault(menuId.value, payload as any, hasDetails)
      toast.success('User berhasil diperbarui', { description: `User "${values.username}" telah diperbarui` })
    } else {
      await createUserDefault(payload as any, hasDetails)
      toast.success('User berhasil dibuat', { description: `User "${values.username}" telah ditambahkan` })
    }
    router.replace('/setup/user_default?reload=' + Date.now())
  } catch (error: any) {
    console.log('Error caught:', error)

    // Check if error message is "Validation error" - kemungkinan karyawan duplicate
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage === 'Validation error' && values.m_kary_id) {
      // Kemungkinan besar ini error karyawan duplicate
      toast.error('Gagal menyimpan User', {
        description: 'Karyawan tersebut sudah memiliki default user'
      })
      return
    }

    // Handle generic error
    toast.error(isEditMode.value ? 'Gagal memperbarui User' : 'Gagal membuat User', {
      description: errorMessage
    })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/user_default')
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
          <CardTitle>Informasi User</CardTitle>
          <CardDescription>
            Isi data user dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- M_Kary_ID Field (FieldPopup dari m_kary) -->
            <FieldPopup id="m_kary_id" label="Karyawan (Opsional)" :value="values.m_kary_id"
              @input="(v: string) => values.m_kary_id = v" @update:valueFull="handleKaryawanSelect"
              :errorText="errors.m_kary_id ? 'failed' : ''" :hints="errors.m_kary_id || 'Pilih karyawan terkait'"
              :required="false" :clearable="true" displayField="nama_kary" valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: (() => {
                  const params: any = {
                    searchfield: 'nama_kary,no_ktp,email',
                    include: 'm_unit_bisnis:nama_comp|id'
                  }
                  const companyId = getCompanyIdFromSelectRespo()
                  if (companyId) {
                    params.filter_column_m_unit_bisnis_id = companyId
                  }
                  return params
                })(),
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                {
                  field: 'no_ktp',
                  headerName: 'NIK',
                  sortable: true,
                  filterable: true,
                  width: '120px'
                },
                {
                  field: 'nama_kary',
                  headerName: 'Nama',
                  flex: 1,
                  sortable: true,
                  filterable: true
                },
                {
                  field: 'm_unit_bisni.nama_comp',
                  headerName: 'Company',
                  sortable: true,
                  filterable: true,
                  width: '200px',
                  render: (item: any) => item?.m_unit_bisni?.nama_comp || '-'
                },
                {
                  field: 'email',
                  headerName: 'Email',
                  sortable: true,
                  filterable: true,
                  width: '180px'
                }
              ]" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Pilih karyawan"
              class="w-full" />
            <!-- Name Field - Auto filled from Karyawan -->
            <FieldX id="name" label="Nama" :value="values.name" :errorname="errors.name ? 'failed' : ''"
              @input="v => values.name = v" :hints="errors.name || 'Nama lengkap user'" :required="false"
              :disabled="loading || isReadOnly" placeholder="Masukkan nama lengkap" class="w-full" />

            <!-- Username Field -->
            <FieldX id="username" label="Username" :value="values.username" :errorname="errors.username ? 'failed' : ''"
              @input="v => values.username = v" :hints="errors.username || 'Username untuk login'"
              :required="!isReadOnly" :disabled="loading || isReadOnly" :readonly="isReadOnly"
              placeholder="Masukkan username" class="w-full" />

            <!-- Password Field - Hidden in view mode -->
            <FieldX v-if="!isViewMode" id="password" label="Password" type="password" :value="values.password"
              :errorname="errors.password ? 'failed' : ''" @input="v => values.password = v"
              :hints="errors.password || (isEditMode ? 'Kosongkan jika tidak ingin mengubah password' : '')"
              :required="!isEditMode" :disabled="loading" placeholder="Masukkan password" class="w-full" />

            <!-- Confirm Password Field - Hidden in view mode -->
            <FieldX v-if="!isViewMode" id="confirm_password" label="Konfirmasi Password" type="password"
              :value="values.confirm_password" :errorname="errors.confirm_password ? 'failed' : ''"
              @input="v => values.confirm_password = v" :hints="errors.confirm_password || 'Ulangi password'"
              :required="!isEditMode" :disabled="loading" placeholder="Ulangi password" class="w-full" />

            <!-- COMMENTED [tipe_user_id]: start -->
            <!-- Tipe User Field (FieldSelect dari m_general dengan group TIPE USER) -->
            <!-- <FieldSelect id="tipe_user_id" label="Tipe User (Opsional)" :value="values.tipe_user_id"
              @input="(v: string) => values.tipe_user_id = v" :errorText="errors.tipe_user_id ? 'failed' : ''"
              :hints="errors.tipe_user_id || 'Pilih tipe user dari data master'" :required="false" :clearable="true"
              displayField="value1" valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,value1',
                  filter_column_group: 'TIPE USER',
                  filter_column_is_active: 'true'
                },
              }" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Pilih tipe user"
              class="w-full" /> -->
            <!-- COMMENTED [tipe_user_id]: end -->


          </div>

          <!-- Catatan Field (Full Width Textarea) -->
          <FieldX id="catatan" type="textarea" label="Catatan (Opsional)" v-model="values.catatan"
            :hints="errors.catatan || 'Tambahan informasi atau catatan'" :required="false" :rows="4"
            :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Masukkan catatan jika diperlukan" />

          <!-- Status Aktif -->
          <FieldStatus label="Status Aktif" name="is_active" v-model="values.is_active" :disabled="loading"
            :readonly="isReadOnly" active-text="Aktif" inactive-text="Tidak Aktif" />

        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL SECTION (RESPO) -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader>
          <CardTitle>Detail Respo</CardTitle>
          <p class="text-sm text-muted-foreground">
            {{ isReadOnly ? 'Respo yang terkait dengan user ini' : 'Pilih respo yang terkait dengan user ini' }}
          </p>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Button Multi Select - Hidden in view mode -->
          <div v-if="!isReadOnly">
            <ButtonMultiSelect title="Pilih Respo" @add="onDetailAdd" :excludeIds="selectedRespoIds" :api="{
              url: `${API_BASE_URL}/dynamic/m_respo`,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authStore.token}`
              },
              params: {
                include: 'm_respo_d,m_unit_bisnis',
                searchfield: 'nama,catatan',
                filter_column_is_active: true
              },
              onsuccess: (response: any) => {
                response.hasNext = response.pagination?.next_page ? true : false
                return response
              }
            }" :columns="[
                {
                  field: 'nama',
                  headerName: 'Nama Respo',
                  flex: 1,
                  sortable: true,
                  filterable: true
                },
                {
                  field: 'unit_bisnis',
                  headerName: 'Company',
                  width: '200px',
                  sortable: false,
                  filterable: false,
                  render: (item: any) => item.unit_bisnis?.nama_comp || '-'
                },
                {
                  field: 'catatan',
                  headerName: 'Catatan',
                  width: '250px',
                  sortable: false,
                  filterable: false
                }
              ]" :disabled="loading" />
          </div>

          <!-- Detail Table - Responsive -->
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                  <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Respo</th>
                  <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Primary</th>
                  <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Active</th>
                  <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <!-- Empty State -->
                <tr v-if="detailArr.length === 0">
                  <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                    <p>{{ isReadOnly ? 'Tidak ada respo terkait' : 'Belum ada respo dipilih' }}</p>
                    <p v-if="!isReadOnly" class="text-xs mt-1">Klik tombol "Pilih Respo" untuk menambahkan</p>
                  </td>
                </tr>

                <!-- Data Rows -->
                <tr v-else v-for="(detail, index) in detailArr" :key="index" class="border-t hover:bg-muted/50">
                  <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                  <td class="px-3 py-2 text-xs sm:text-sm truncate max-w-xs sm:max-w-sm">{{ detail.m_respo?.name || '-'
                    }}</td>
                  <td class="px-2 py-2 text-center">
                    <input type="checkbox" v-model="detail.is_primary" :disabled="isReadOnly" @change="(event: Event) => {
                      const target = event.target as HTMLInputElement
                      if (target.checked) {
                        // Jika dicheck, uncheck semua primary lainnya
                        detailArr.forEach((d, i) => {
                          if (i !== index) d.is_primary = false
                        })
                      } else {
                        // Jika di-uncheck, cek apakah masih ada primary lain
                        const otherPrimary = detailArr.some((d, i) => i !== index && d.is_primary)
                        if (!otherPrimary) {
                          // Jika tidak ada primary lain, batalkan uncheck
                          detail.is_primary = true
                          toast.warning('Minimal satu respo harus menjadi Primary')
                        }
                      }
                    }" class="rounded cursor-pointer" />
                  </td>
                  <td class="px-2 py-2 text-center">
                    <input type="checkbox" v-model="detail.is_active" :disabled="isReadOnly"
                      class="rounded cursor-pointer" />
                  </td>
                  <td class="px-2 py-2 text-center">
                    <Button v-if="!isReadOnly" variant="ghost" size="icon" @click="removeDetail(index)"
                      class="h-7 w-7 sm:h-8 sm:w-8">
                      <Trash2 class="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                    </Button>
                    <span v-else class="text-muted-foreground text-xs">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
