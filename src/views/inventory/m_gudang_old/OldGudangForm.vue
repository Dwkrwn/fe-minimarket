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
  createGudang,
  updateGudang,
  getGudangById,
} from '../master/m_gudang/service'

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
const isEditMode = computed(() => !!route.params.id && route.name === 'GudangForm')
const isViewMode = computed(() => route.name === 'GudangView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Gudang'
  if (isCopyMode.value) return 'Salin Gudang'
  if (isEditMode.value) return 'Edit Gudang'
  return 'Tambah Gudang Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Gudang'
  if (isCopyMode.value) return 'Buat Gudang baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Gudang'
  return 'Buat Gudang baru'
})

// Form values - SAMA SEPERTI Form.txt
let values = reactive({
  group: '',
  key1: '',
  code: '',
  value1: '',
  value2: '',
  value3: '',
  value4: '',
  value5: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// Detail arrays - DYNAMIC GENERATION
const detailArr = ref<any[]>([])

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    name: '',
    value: 0,
    is_active: true,
  })
}

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail dihapus')
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    group: '',
    key1: '',
    code: '',
    value1: '',
    value2: '',
    value3: '',
    value4: '',
    value5: '',
    is_active: true
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  // Reset detail arrays - DYNAMIC
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
    const res = await getGudangById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Load detail items - DYNAMIC
    
    if (initialValues.m_gudang_details) {
      detailArr.value = initialValues.m_gudang_details
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
        description: 'Silakan edit dan simpan sebagai Gudang baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Gudang', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_gudang')
      }
    })
    setTimeout(() => router.push('/setup/m_gudang'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation) - SAMA SEPERTI Form.txt
const errors = reactive({
  group: '',
  key1: '',
  code: '',
  value1: '',
  value2: '',
  value3: '',
  value4: '',
  value5: ''
})

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.group?.trim()) { errors.group = 'Group wajib diisi'; invalid = true }
  if (!values.key1?.trim()) { errors.key1 = 'Key1 wajib diisi'; invalid = true }
  if (!values.code?.trim()) { errors.code = 'Code wajib diisi'; invalid = true }
  if (!values.value1?.trim()) { errors.value1 = 'Value1 wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload: convert empty strings to null + TAMBAH DETAIL
    const payload: any = {
      group: values.group?.trim() || null,
      key1: values.key1?.trim() || null,
      code: values.code?.trim() || null,
      value1: values.value1?.trim() || null,
      value2: values.value2?.trim() || null,
      value3: values.value3?.trim() || null,
      value4: values.value4?.trim() || null,
      value5: values.value5?.trim() || null,
      is_active: values.is_active,
      // Detail fields - DYNAMIC
            m_gudang_details: detailArr.value,
    }
    
    if (isEditMode.value) {
      await updateGudang(menuId.value, payload as any)
      toast.success('Gudang berhasil diperbarui', { description: `Gudang code "${values.code}" telah diperbarui` })
    } else {
      await createGudang(payload as any)
      toast.success('Gudang berhasil dibuat', { description: `Gudang code "${values.code}" telah ditambahkan` })
    }
    router.replace('/setup/m_gudang?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Gudang' : 'Gagal membuat Gudang', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_gudang')
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
          <CardTitle>Informasi Gudang</CardTitle>
          <CardDescription>
            Isi data Gudang dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Group Field -->
                <FieldX 
                  id="group" 
                  label="Group" 
                  :value="values.group" 
                  :errorname="errors.group ? 'failed' : ''"
                  @input="v => values.group = v" 
                  :hints="errors.group" 
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Contoh: GENDER" 
                  class="w-full" 
                />

                <!-- Key1 Field -->
                <FieldX 
                  id="key1" 
                  label="Key1" 
                  :value="values.key1" 
                  :errorname="errors.key1 ? 'failed' : ''"
                  @input="v => values.key1 = v" 
                  :hints="errors.key1" 
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Contoh: MALE" 
                  class="w-full" 
                />

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
                  placeholder="Contoh: M" 
                  class="w-full" 
                />

                <!-- Value1 Field -->
                <FieldX 
                  id="value1" 
                  label="Value1" 
                  :value="values.value1" 
                  :errorname="errors.value1 ? 'failed' : ''"
                  @input="v => values.value1 = v" 
                  :hints="errors.value1 "
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Nilai tambahan 1" 
                  class="w-full" 
                />

                <!-- Value2 Field -->
                <FieldX 
                  id="value2" 
                  label="Value2 (Opsional)" 
                  :value="values.value2" 
                  :errorname="errors.value2 ? 'failed' : ''"
                  @input="v => values.value2 = v" 
                  :hints="errors.value2 || 'Boleh dikosongkan'"
                  :required="false"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Nilai tambahan 2" 
                  class="w-full" 
                />

                <!-- Value3 Field -->
                <FieldX 
                  id="value3" 
                  label="Value3 (Opsional)" 
                  :value="values.value3" 
                  :errorname="errors.value3 ? 'failed' : ''"
                  @input="v => values.value3 = v" 
                  :hints="errors.value3 || 'Boleh dikosongkan'"
                  :required="false"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Nilai tambahan 3" 
                  class="w-full" 
                />

                <!-- Value4 Field -->
                <FieldX 
                  id="value4" 
                  label="Value4 (Opsional)" 
                  :value="values.value4" 
                  :errorname="errors.value4 ? 'failed' : ''"
                  @input="v => values.value4 = v" 
                  :hints="errors.value4 || 'Boleh dikosongkan'"
                  :required="false"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Nilai tambahan 4" 
                  class="w-full" 
                />

                <!-- Value5 Field -->
                <FieldX 
                  id="value5" 
                  label="Value5 (Opsional)" 
                  :value="values.value5" 
                  :errorname="errors.value5 ? 'failed' : ''"
                  @input="v => values.value5 = v" 
                  :hints="errors.value5 || 'Boleh dikosongkan'"
                  :required="false"
                  :disabled="loading || isReadOnly" 
                  :readonly="isReadOnly" 
                  placeholder="Nilai tambahan 5" 
                  class="w-full" 
                />
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


        </CardContent>
      </Card>

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
                    <TabsTrigger value="detail1">Detail 1</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->
        
        <!-- TAB CONTENT: DETAIL 1 (ADD-TO-LIST) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Tabel 1</CardTitle>
                  <CardDescription>Kelola item detail m_gudang_details</CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  @click="addDetailArr"
                  size="sm"
                  variant="outline"
                >
                  + Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama</th>
                      <th class="px-3 py-2 text-center font-medium text-xs sm:text-sm">Nilai</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aktif</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr" :key="index" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.name"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Nama"
                        />
                        <span v-else>{{ detail.name }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input
                          v-if="!isReadOnly"
                          v-model.number="detail.value"
                          type="number"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm text-center"
                          placeholder="0"
                        />
                        <span v-else class="block text-center">{{ detail.value }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_active"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_active ? '✓' : '-' }}</span>
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