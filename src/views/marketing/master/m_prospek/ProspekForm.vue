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
import { FieldX, FieldStatus, FieldPopup, FieldTextarea } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { Trash2 } from 'lucide-vue-next'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createProspek,
  updateProspek,
  getProspekById,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'ProspekForm')
const isViewMode = computed(() => route.name === 'ProspekView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const isSuperAdmin = computed(() => authStore.isSuperAdmin)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Prospek'
  if (isCopyMode.value) return 'Salin Prospek'
  if (isEditMode.value) return 'Edit Prospek'
  return 'Tambah Prospek Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Prospek'
  if (isCopyMode.value) return 'Buat Prospek baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Prospek'
  return 'Buat Prospek baru'
})

// Computed untuk company name dari SelectRespo (untuk user non-super admin)
const companyNameDisplay = computed(() => {
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        return parsed.companyName || ''
      }
    } catch (e) {
      console.error('Failed to parse SelectRespo:', e)
    }
  }
  return ''
})

// Get m_unit_bisnis_id for non-super admin
const currentUnitBisnisId = computed(() => {
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        // Try both companyId and m_unit_bisnis_id
        return parsed.companyId || parsed.m_unit_bisnis_id || ''
      }
    } catch (e) {
      console.error('Failed to parse SelectRespo:', e)
    }
  }
  return values.m_unit_bisnis_id
})

// Form values sesuai wireframe
let values = reactive({
  m_unit_bisnis_id: '',
  sales_id: '',
  catatan: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// Detail arrays - m_prospek_ds (dari m_customer)
const detailArr = ref<any[]>([])

// ============================================================================
// DETAIL METHODS
// ============================================================================

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Customer dihapus dari prospek')
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Preserve m_unit_bisnis_id for non-super admin
  const preservedUnitBisnisId = authStore.isSuperAdmin ? '' : values.m_unit_bisnis_id
  
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: preservedUnitBisnisId,
    sales_id: '',
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
  
  // Auto-fill unit bisnis dari SelectRespo untuk non-super admin
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        // Try both companyId and m_unit_bisnis_id
        const unitBisnisId = parsed.companyId || parsed.m_unit_bisnis_id
        if (unitBisnisId) {
          values.m_unit_bisnis_id = unitBisnisId
        }
      }
    } catch (e) {
      console.error('Failed to parse SelectRespo:', e)
    }
  }
  
  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }
  
  loading.value = true
  try {
    const res = await getProspekById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Load detail items (plural form from API)
    if (initialValues.m_prospek_ds) {
      detailArr.value = initialValues.m_prospek_ds.map((d: any) => ({
        m_customer_id: d.m_customer_id,
        kode_customer: d.m_customer?.kode_customer || d.kode_customer || '',
        nama_customer: d.m_customer?.nama_customer || d.nama_customer || '',
        alamat: d.m_customer?.alamat || d.alamat || '',
        no_ktp: d.m_customer?.no_ktp || d.no_ktp || '',
        catatan: d.catatan || ''
      }))
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
        description: 'Silakan edit dan simpan sebagai Prospek baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Prospek', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/marketing/master/m_prospek')
      }
    })
    setTimeout(() => router.push('/marketing/master/m_prospek'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  m_unit_bisnis_id: '',
  sales_id: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  // Validasi m_unit_bisnis_id - wajib untuk super admin
  if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) { 
    errors.m_unit_bisnis_id = 'Unit Bisnis wajib dipilih'
    invalid = true 
  }
  
  // Validasi sales_id wajib diisi
  if (!values.sales_id?.trim()) { 
    errors.sales_id = 'Sales wajib dipilih'
    invalid = true 
  }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Helper to convert empty strings to null
    const toNull = (val?: string | null) => (val?.trim() ? val.trim() : null)
    
    // Get m_unit_bisnis_id from SelectRespo for non-super admin
    let unitBisnisId = values.m_unit_bisnis_id
    if (!isSuperAdmin.value) {
      try {
        const selectRespo = localStorage.getItem('SelectRespo')
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo)
          // Try both companyId and m_unit_bisnis_id
          unitBisnisId = parsed.companyId || parsed.m_unit_bisnis_id || ''
        }
      } catch (e) {
        console.error('Failed to parse SelectRespo:', e)
      }
    }
    
    // Clean payload
    const payload: any = {
      m_unit_bisnis_id: toNull(unitBisnisId),
      sales_id: toNull(values.sales_id),
      catatan: toNull(values.catatan),
      is_active: Boolean(values.is_active),
      // Detail fields - m_prospek_ds (plural form to match API)
      m_prospek_ds: detailArr.value.map((d: any) => ({
        m_customer_id: d.m_customer_id,
        catatan: d.catatan?.trim() || null
      })),
    }
    
    if (isEditMode.value) {
      await updateProspek(menuId.value, payload as any)
      toast.success('Prospek berhasil diperbarui')
    } else {
      await createProspek(payload as any)
      toast.success('Prospek berhasil dibuat')
    }
    router.replace('/marketing/master/m_prospek?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Prospek' : 'Gagal membuat Prospek', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/marketing/master/m_prospek')
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
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Prospek</CardTitle>
          <CardDescription>
            Isi data Prospek dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Unit Bisnis - Super Admin: Popup Select, User Biasa: Auto dari SelectRespo -->
            <div v-if="!isSuperAdmin" class="w-full">
              <FieldX
                id="m_unit_bisnis_display"
                label="Unit Bisnis"
                :value="companyNameDisplay"
                :disabled="true"
                :readonly="true"
                placeholder="Unit bisnis dari respo"
                class="w-full"
                hints="Unit bisnis otomatis dari respo yang dipilih"
              />
            </div>
            <FieldPopup
              v-else
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => values.m_unit_bisnis_id = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :clearable="!isReadOnly"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              displayField="nama_comp"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'kode_unit_bisnis,nama_comp,pic',
                  filter_column_is_active: true
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                { key: 'kode_unit_bisnis', label: 'Kode', filterable: true },
                { key: 'nama_comp', label: 'Nama Company', filterable: true },
                { key: 'kota', label: 'Kota', filterable: false }
              ]"
              placeholder="Pilih unit bisnis"
              class="w-full"
            />

            <!-- Sales (Required) - FieldPopup ke m_kary dengan filter sales -->
            <FieldPopup
              id="sales_id"
              label="Sales"
              :value="values.sales_id"
              @input="(v: string) => values.sales_id = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :clearable="!isReadOnly"
              :errorname="errors.sales_id ? 'failed' : ''"
              :hints="errors.sales_id || 'Pilih sales yang bertanggung jawab'"
              displayField="nama_kary"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'kode_kary,nama_kary',
                  filter_column_is_sales: true,
                  filter_column_is_active: true,
                  ...(currentUnitBisnisId ? { filter_column_m_unit_bisnis_id: currentUnitBisnisId } : {})
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                { key: 'kode_kary', label: 'Kode', filterable: true },
                { key: 'nama_kary', label: 'Nama Karyawan', filterable: true },
                { key: 'no_tlp', label: 'No Telp', filterable: false }
              ]"
              placeholder="Pilih sales"
              class="w-full"
            />
          </div>

          <!-- Catatan (Textarea full width) -->
          <FieldX 
            id="catatan" 
            type="textarea"
            label="Catatan" 
            :value="values.catatan" 
            @input="v => values.catatan = v" 
            :required="false"
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Catatan tambahan..." 
            :rows="3"
            class="w-full"
          />

          <!-- Status Aktif -->
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
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="detail1">Daftar Customer Prospek</TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: DETAIL 1 - Customer Prospek (ButtonMultiSelect dari m_customer) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Prospek</CardTitle>
                  <CardDescription>Pilih customer yang menjadi prospek</CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Customer"
                  @add="(items: any[]) => {
                    items.forEach(item => {
                      if (!detailArr.find((d: any) => d.m_customer_id === item.id)) {
                        detailArr.push({
                          m_customer_id: item.id,
                          kode_customer: item.kode_customer,
                          nama_customer: item.nama_customer,
                          alamat : item.alamat,
                          no_ktp : item.no_ktp,
                          catatan: ''
                        })
                      }
                    })
                  }"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_customer`,
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authStore.token}`
                    },
                    params: {
                      searchfield: 'kode_customer,nama_customer,alamat',
                      filter_column_is_active: true,
                      ...(currentUnitBisnisId ? { filter_column_m_unit_bisnis_id: currentUnitBisnisId } : {})
                    },
                    onsuccess: (response: any) => {
                      response.hasNext = response.pagination?.next_page ? true : false
                      return response
                    }
                  }"
                  :columns="[
                    {
                      field: 'kode_customer',
                      headerName: 'Kode Customer',
                      width: '150px',
                      sortable: true,
                      filterable: true
                    },
                    {
                      field: 'nama_customer',
                      headerName: 'Nama Customer',
                      width: '250px',
                      sortable: true,
                      filterable: true
                    },
                    {
                      field: 'alamat',
                      headerName: 'Alamat',
                      flex: 1,
                      sortable: false,
                      filterable: false
                    },
                                        {
                      field: 'no_ktp',
                      headerName: 'No KTP',
                      flex: 1,
                      sortable: false,
                      filterable: false
                    }
                  ]"
                  :disabled="loading"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode Customer</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Customer</th>
                         <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Alamat</th>
                         <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No KTP</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td colspan="7" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada customer dipilih. Klik "Pilih Customer" untuk menambahkan.
                      </td>
                    </tr>
                    <tr v-for="(detail, idx) in detailArr" :key="detail.m_customer_id || idx" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.kode_customer }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.nama_customer }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.alamat }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.no_ktp }}</td>
                      <td class="px-3 py-2">
                        <FieldX
                          v-if="!isReadOnly"
                          :id="`catatan_${idx}`"
                          :value="detail.catatan"
                          @input="v => detail.catatan = v"
                          placeholder="Catatan..."
                          :disabled="loading"
                          class="w-full"
                        />
                        <span v-else class="text-xs">{{ detail.catatan || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr(idx)"
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