<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldStatus, FieldPopup } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { 
  createFormatNomor, 
  updateFormatNomor, 
  getFormatNomorById, 
  type FormatNomorDetail 
} from './service'
import { ArrowLeft, Save, Loader2, Trash2, GripVertical } from 'lucide-vue-next'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'FormatNomorForm')
const isViewMode = computed(() => route.name === 'FormatNomorView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Format Nomor'
  if (isCopyMode.value) return 'Salin Format Nomor'
  if (isEditMode.value) return 'Edit Format Nomor'
  return 'Tambah Format Nomor Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Format Nomor'
  if (isCopyMode.value) return 'Buat Format Nomor baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Format Nomor'
  return 'Buat Format Nomor aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  m_unit_bisnis_id: '',
  m_menu_id: '',
  pertinjau: '',
  is_active: true
})

// Temp penampung data API mentah sebelum dimasukkan
let initialValues: Record<string, any> = {}

// Detail array untuk m_format_nomor_ds
const detailArr = ref<FormatNomorDetail[]>([])

// Display names for FieldPopup
const unitBisnisDisplayName = ref('')
const menuDisplayName = ref('')

// Track company prefix detail for auto-management
const companyPrefixIndex = ref<number>(-1)

// ============================================================================
// COMPANY ABBREVIATION GENERATOR
// ============================================================================
const generateCompanyAbbreviation = (companyName: string): string => {
  if (!companyName) return ''
  
  // Words to skip (common business entity types)
  const skipWords = ['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI', 'YAYASAN', 'PERSEROAN', 'TERBATAS']
  
  // Split by space and filter
  const words = companyName
    .toUpperCase()
    .split(/\s+/)
    .filter(word => {
      // Remove empty strings
      if (!word) return false
      // Skip common business entity words
      if (skipWords.includes(word)) return false
      // Skip single character words (except if it's the only word)
      return true
    })
  
  // If no words left after filtering, use original name first letters
  if (words.length === 0) {
    return companyName
      .toUpperCase()
      .split(/\s+/)
      .map(w => w.charAt(0))
      .join('')
      .slice(0, 5) // Max 5 characters
  }
  
  // Generate abbreviation from first letter of each word
  const abbreviation = words
    .map(word => word.charAt(0))
    .join('')
  
  return abbreviation
}

// ============================================================================
// COMPUTED - PERTINJAU
// ============================================================================
/** Helper function to format prefix value based on type */
const formatPrefixValue = (value: string | number, tipePrefix: string): string => {
  if (tipePrefix === 'SEQ') {
    const numValue = parseInt(String(value))
    if (!isNaN(numValue) && numValue > 0) {
      // Create a string of zeros with the specified length
      // For example: value=4 → "0000", value=2 → "00"
      const placeholder = Array(numValue).fill('0').join('')
      return placeholder
    }
  } else if (tipePrefix === 'DAY') {
    return new Date().getDate().toString().padStart(2, '0')
  } else if (tipePrefix === 'MONTH') {
    return (new Date().getMonth() + 1).toString().padStart(2, '0')
  } else if (tipePrefix === 'YEAR') {
    return new Date().getFullYear().toString().slice(-2)
  }
  
  // Handle text-based formats like "ddmmyy"
  if (typeof value === 'string') {
    let result = value
    const today = new Date()
    const day = today.getDate().toString().padStart(2, '0')
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const year = today.getFullYear().toString().slice(-2)
    const fullYear = today.getFullYear().toString()
    
    // Replace format codes with actual values (case-insensitive matching, preserve original case)
    result = result.replace(/yyyy/gi, fullYear)
    result = result.replace(/yy/gi, year)
    result = result.replace(/mm/gi, month)
    result = result.replace(/dd/gi, day)
    
    return result
  }
  
  return String(value)
}

const computedPertinjau = computed(() => {
  if (detailArr.value.length === 0) return ''
  
  return detailArr.value.map(detail => detail.prefix_value).join('')
})

// Auto update pertinjau saat detail berubah
import { watch } from 'vue'
watch(() => detailArr.value.length, () => {
  values.pertinjau = computedPertinjau.value
}, { immediate: true })

watch(() => detailArr.value, () => {
  values.pertinjau = computedPertinjau.value
}, { deep: true })

// Watch company selection to auto-add/update company prefix
watch(() => values.m_unit_bisnis_id, (newValue, oldValue) => {
  // Only trigger if value actually changed and component is mounted
  if (newValue === oldValue) return
  
  if (newValue && unitBisnisDisplayName.value) {
    // Generate company abbreviation
    const abbreviation = generateCompanyAbbreviation(unitBisnisDisplayName.value)
    
    if (abbreviation) {
      // Check if there's already a company prefix in the list
      const existingIndex = detailArr.value.findIndex(
        detail => detail.m_prefix?.tipe_prefix === 'COMPANY_AUTO' || detail.isCompanyPrefix
      )
      
      const companyDetail: FormatNomorDetail = {
        m_prefix_id: 'auto-company', // Special ID for auto-generated company prefix
        prefix_value: abbreviation,
        isCompanyPrefix: true, // Mark as company prefix
        m_prefix: {
          id: 'auto-company',
          nama_prefx: `Company - ${unitBisnisDisplayName.value}`,
          value: abbreviation,
          tipe_prefix: 'COMPANY_AUTO'
        }
      }
      
      if (existingIndex >= 0) {
        // Update existing company prefix
        detailArr.value[existingIndex] = companyDetail
        companyPrefixIndex.value = existingIndex
        toast.info(`Singkatan company diperbarui: ${abbreviation}`)
      } else {
        // Add new company prefix at the beginning
        detailArr.value.unshift(companyDetail)
        companyPrefixIndex.value = 0
        toast.success(`Singkatan company ditambahkan: ${abbreviation}`, {
          description: `${abbreviation} = ${unitBisnisDisplayName.value}`
        })
      }
    }
  } else if (!newValue) {
    // Company cleared, remove company prefix if exists
    const existingIndex = detailArr.value.findIndex(
      detail => detail.m_prefix?.tipe_prefix === 'COMPANY_AUTO' || detail.isCompanyPrefix
    )
    
    if (existingIndex >= 0) {
      const removedDetail = detailArr.value[existingIndex]
      const removedAbbr = removedDetail?.prefix_value || ''
      detailArr.value.splice(existingIndex, 1)
      companyPrefixIndex.value = -1
      if (removedAbbr) {
        toast.info(`Singkatan company dihapus: ${removedAbbr}`)
      }
    }
  }
})

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: '',
    m_menu_id: '',
    pertinjau: '',
    is_active: true
  })
  detailArr.value = []
  unitBisnisDisplayName.value = ''
  menuDisplayName.value = ''
}

// ============================================================================
// DETAIL HANDLERS
// ============================================================================
const onDetailAdd = async (items: any[]) => {
  // Tambahkan item-item ke detailArr
  items.forEach(row => {
    const tipePrefix = row.tipe_prefix || ''
    const rawValue = row.value || ''
    const formattedValue = formatPrefixValue(rawValue, tipePrefix)
    
    const detail: FormatNomorDetail = {
      m_prefix_id: row.id,
      prefix_value: formattedValue,
      m_prefix: {
        id: row.id,
        nama_prefx: row.nama_prefx || '',
        value: rawValue,
        tipe_prefix: tipePrefix
      }
    }
    detailArr.value.push(detail)
  })
  
  toast.success(`${items.length} prefix ditambahkan`)
}

const removeDetail = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Item dihapus dari list')
}

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

// Handle drag start
const onDragStart = (index: number) => {
  draggedIndex.value = index
}

// Handle drag over
const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  dropTargetIndex.value = index
}

// Handle drag leave
const onDragLeave = () => {
  dropTargetIndex.value = null
}

// Handle drop
const onDrop = (targetIndex: number) => {
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    draggedIndex.value = null
    dropTargetIndex.value = null
    return
  }
  
  const items = [...detailArr.value]
  const draggedItem = items[draggedIndex.value]
  if (!draggedItem) {
    draggedIndex.value = null
    dropTargetIndex.value = null
    return
  }
  
  // Remove item from old position
  items.splice(draggedIndex.value, 1)
  
  // Calculate new target index (if dragging from above, target shifts down by 1)
  const adjustedTargetIndex = draggedIndex.value < targetIndex ? targetIndex - 1 : targetIndex
  
  // Insert item at new position
  items.splice(adjustedTargetIndex, 0, draggedItem)
  
  // Update array
  detailArr.value = items
  draggedIndex.value = null
  dropTargetIndex.value = null
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
    const res = await getFormatNomorById(sourceId)
    
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Normalisasi is_active
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Mode copy: hapus id dan timestamps
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore
        values[key] = initialValues[key]
      }
    }
    
    // Set display names - support both m_unit_bisnis and company
    // Note: Backend has typo 'm_unit_bisni' (without 's')
    if ((initialValues as any).m_unit_bisni?.nama_comp) {
      unitBisnisDisplayName.value = (initialValues as any).m_unit_bisni.nama_comp
    } else if (initialValues.m_unit_bisnis?.nama_comp) {
      unitBisnisDisplayName.value = initialValues.m_unit_bisnis.nama_comp
    } else if (initialValues.company?.nama_comp) {
      unitBisnisDisplayName.value = initialValues.company.nama_comp
    }
    
    // Support both m_menu and menu, and check both name and label
    if (initialValues.m_menu?.name) {
      menuDisplayName.value = initialValues.m_menu.name
    } else if (initialValues.m_menu?.label) {
      menuDisplayName.value = initialValues.m_menu.label
    } else if (initialValues.menu?.label) {
      menuDisplayName.value = initialValues.menu.label
    }

    // Load details - support both m_format_nomor_d and m_format_nomor_ds
    const details = initialValues.m_format_nomor_ds || initialValues.m_format_nomor_d
    if (details && Array.isArray(details)) {
      // Sort by index to maintain correct order
      const sortedDetails = [...details].sort((a: any, b: any) => {
        const indexA = a.index !== null && a.index !== undefined ? a.index : 999
        const indexB = b.index !== null && b.index !== undefined ? b.index : 999
        return indexA - indexB
      })
      
      detailArr.value = sortedDetails.map((detail: any) => {
        const tipePrefix = detail.m_prefix?.tipe_prefix || ''
        const rawValue = detail.m_prefix?.value || detail.prefix_value || ''
        const formattedValue = formatPrefixValue(rawValue, tipePrefix)
        
        return {
          id: isCopyModeLocal ? undefined : detail.id,
          m_format_nomor_id: isCopyModeLocal ? undefined : detail.m_format_nomor_id,
          m_prefix_id: detail.m_prefix_id,
          prefix_value: formattedValue,
          m_prefix: detail.m_prefix
        }
      })
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Format Nomor baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Format Nomor', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_prefix')
      }
    })
  } finally {
    loading.value = false
  }
})

// ============================================================================
// VALIDATION & SAVE HANDLER
// ============================================================================
const errors = reactive({
  m_unit_bisnis_id: '',
  m_menu_id: ''
})

const onSave = async () => {
  // Reset errors
  Object.keys(errors).forEach(key => {
    // @ts-ignore
    errors[key] = ''
  })

  let hasError = false

  // Required field validation - only m_menu_id is required
  if (!values.m_menu_id?.trim()) {
    errors.m_menu_id = 'Menu wajib dipilih'
    hasError = true
  }

  if (hasError) {
    toast.error('Validasi Gagal', {
      description: 'Periksa kembali form Anda'
    })
    return
  }

  loading.value = true

  try {
    const payload: any = {
      m_menu_id: values.m_menu_id,
      pertinjau: values.pertinjau || '',
      is_active: values.is_active
    }

    // For m_unit_bisnis_id: send null if empty, otherwise send the value
    if (values.m_unit_bisnis_id && values.m_unit_bisnis_id.trim() !== '') {
      payload.m_unit_bisnis_id = values.m_unit_bisnis_id
    } else {
      // Explicitly set to null when empty (especially for update mode)
      payload.m_unit_bisnis_id = null
    }

    // Add details if any with index for ordering
    if (detailArr.value.length > 0) {
      payload.m_format_nomor_ds = detailArr.value
        .filter(detail => !detail.isCompanyPrefix) // Exclude auto-generated company prefix from save
        .map((detail, index) => ({
          m_prefix_id: detail.m_prefix_id,
          prefix_value: detail.prefix_value,
          index: index // Add index to maintain order
        }))
    }

    let response
    if (isEditMode.value) {
      response = await updateFormatNomor(menuId.value, payload)
    } else {
      response = await createFormatNomor(payload)
    }

    if (response.status === 'success') {
      toast.success(`Format Nomor berhasil ${isEditMode.value ? 'diperbarui' : 'ditambahkan'}`, {
        description: response.message
      })

      setTimeout(() => {
        router.replace('/setup/m_prefix?reload=' + Date.now())
      }, 500)
    } else {
      toast.error('Gagal menyimpan', {
        description: response.message || 'Terjadi kesalahan'
      })
    }
  } catch (error) {
    toast.error('Gagal menyimpan Format Nomor', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const onCancel = () => {
  router.push('/setup/m_prefix')
}
</script>

<template>
  <div class="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="onCancel" :disabled="loading">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ pageTitle }}</h1>
            <p class="text-muted-foreground">{{ pageDescription }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Form Card -->
    <form @submit.prevent="onSave">
      <Card>
        <CardHeader>
          <CardTitle>Informasi Format Nomor</CardTitle>
          <CardDescription>
            Isi data Format Nomor dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis -->
            <FieldPopup
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => { 
                values.m_unit_bisnis_id = v
                // If cleared, also clear display name
                if (!v) unitBisnisDisplayName = ''
              }"
              @update:valueFull="(obj: any) => { unitBisnisDisplayName = obj?.nama_comp || '' }"
              displayField="nama_comp"
              valueField="id"
              :clearable="true"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'kode_unit_bisnis,nama_comp,provinsi',
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
                { key: 'provinsi', label: 'Provinsi', filterable: true }
              ]"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full md:col-span-2"
            />

            <!-- Menu -->
            <FieldPopup
              id="m_menu_id"
              label="Menu"
              :value="values.m_menu_id"
              @input="(v: string) => values.m_menu_id = v"
              @update:valueFull="(obj: any) => { menuDisplayName = obj?.name || obj?.label || '' }"
              displayField="path"
              valueField="id"
              :clearable="true"
              :errorname="errors.m_menu_id ? 'failed' : ''"
              :hints="errors.m_menu_id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_menu`,
                headers: { 
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  // backend m_menu does not have 'label' column in some deployments; use 'desc' instead
                  searchfield: 'name,desc,path',
                  filter_column_is_active: true
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                { key: 'name', label: 'Name', filterable: true },
                { key: 'desc', label: 'Description', filterable: true },
                { key: 'sub_modul', label: 'Sub Modul', filterable: true },
                { key: 'modul', label: 'Modul', filterable: true },
                { key: 'path', label: 'Path', filterable: true },
              ]"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              class="w-full md:col-span-2"
            />

            <!-- Pertinjau (Readonly, Auto-generated) -->
            <FieldX
              id="pertinjau"
              label="Pertinjau Format"
              :value="values.pertinjau"
              @input="(v: any) => values.pertinjau = v"
              :disabled="true"
              :readonly="true"
              placeholder="Format nomor akan muncul di sini..."
              class="w-full md:col-span-2"
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

      <!-- Details Card -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Detail Prefix</CardTitle>
          <CardDescription>
            Pilih urutan prefix untuk membentuk format nomor
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Button Multi Select - Hidden in view mode -->
          <div v-if="!isReadOnly">
            <ButtonMultiSelect 
              title="Pilih Prefix" 
              @add="onDetailAdd"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_prefix`,
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: { 
                  searchfield: 'nama_prefx,value,tipe_prefix',
                  filter_column_is_active: true
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                {
                  field: 'nama_prefx',
                  headerName: 'Nama Prefix',
                  flex: 1,
                  sortable: true
                },
                {
                  field: 'value',
                  headerName: 'Value',
                  width: '150px',
                  sortable: true
                },
                {
                  field: 'tipe_prefix',
                  headerName: 'Tipe',
                  width: '120px',
                  sortable: true
                }
              ]"
              :disabled="loading"
            />
          </div>

          <!-- Details Table -->
          <div class="rounded-md border overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr class="border-b">
                  <th class="text-left p-3 font-semibold w-12" v-if="!isReadOnly">Drag</th>
                  <th class="text-left p-3 font-semibold w-12" v-else>No</th>
                  <th class="text-left p-3 font-semibold">Nama Prefix</th>
                  <th class="text-left p-3 font-semibold">Value</th>
                  <th class="text-left p-3 font-semibold">Tipe</th>
                  <th class="text-center p-3 font-semibold w-20" v-if="!isReadOnly">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailArr.length === 0">
                  <td colspan="5" class="text-center p-8 text-muted-foreground">
                    <div class="flex flex-col items-center gap-2">
                      <span class="text-4xl">📋</span>
                      <p>Belum ada prefix dipilih</p>
                      <p class="text-xs" v-if="!isReadOnly">Klik tombol "Pilih Prefix" untuk menambahkan</p>
                    </div>
                  </td>
                </tr>
                <tr v-else v-for="(detail, index) in detailArr" :key="index" 
                  class="border-t hover:bg-muted/50 transition-colors cursor-move"
                  :class="{ 
                    'bg-primary/5': draggedIndex === index,
                    'opacity-50': draggedIndex === index,
                    'border-t-4 border-t-primary': dropTargetIndex === index && draggedIndex !== index
                  }"
                  :draggable="!isReadOnly"
                  @dragstart="onDragStart(index)"
                  @dragover="onDragOver($event, index)"
                  @dragleave="onDragLeave"
                  @drop="onDrop(index)"
                >
                  <td class="p-3 text-center" v-if="!isReadOnly">
                    <GripVertical class="h-4 w-4 text-muted-foreground inline" title="Drag to reorder" />
                  </td>
                  <td class="p-3 text-center" v-else>{{ index + 1 }}</td>
                  <td class="p-3">
                    <div class="font-medium">{{ detail.m_prefix?.nama_prefx || '-' }}</div>
                  </td>
                  <td class="p-3">
                    <code class="bg-muted px-2 py-1 rounded text-xs">{{ detail.prefix_value }}</code>
                  </td>
                  <td class="p-3">
                    <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {{ detail.m_prefix?.tipe_prefix || '-' }}
                    </span>
                  </td>
                  <td class="p-3" v-if="!isReadOnly">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      @click="removeDetail(index)"
                      :disabled="loading"
                      class="h-8 w-8 text-destructive hover:text-destructive"
                      title="Hapus item"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Action Buttons -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static mt-6">
        <Button type="button" variant="outline" @click="onCancel" :disabled="loading" class="w-full sm:w-auto">
          Batal
        </Button>
        <Button v-if="!isReadOnly" type="submit" :disabled="loading" class="w-full sm:w-auto">
          <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
          <Save v-else class="mr-2 h-4 w-4" />
          {{ isEditMode ? 'Simpan Perubahan' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>
</template>
