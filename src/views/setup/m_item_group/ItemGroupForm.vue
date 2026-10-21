<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FieldX, FieldStatus } from '@/components/field'
import { createItemGroup, updateItemGroup, getItemGroupById, deleteGroupMerek, deleteGroupTipe, deleteGroupUkuran, deleteGroupBatch, type GroupMerek, type GroupTipe, type GroupUkuran, type GroupBatch } from './service'
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'ItemGroupForm')
const isViewMode = computed(() => route.name === 'ItemGroupView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Item Group'
  if (isCopyMode.value) return 'Salin Item Group'
  if (isEditMode.value) return 'Edit Item Group'
  return 'Tambah Item Group Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Item Group'
  if (isCopyMode.value) return 'Buat Item Group baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Item Group'
  return 'Buat Item Group aplikasi baru'
})

// Reactive form values with nested structure
let values = reactive({
  nama_jenis: '',
  catatan: '',
  is_active: true,
  // Nested arrays - will be managed separately for complex UI
  m_group_mereks: [] as any[]
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// ============================================================================
// DETAIL MANAGEMENT STATE
// ============================================================================
// Expanded state for collapsible sections
const expandedMereks = ref<Set<number>>(new Set())
const expandedTipes = ref<Set<string>>(new Set())
const expandedUkurans = ref<Set<string>>(new Set())

// Toggle functions
const toggleMerek = (idx: number) => {
  if (expandedMereks.value.has(idx)) {
    expandedMereks.value.delete(idx)
  } else {
    expandedMereks.value.add(idx)
  }
}

const toggleTipe = (merekIdx: number, tipeIdx: number) => {
  const key = `${merekIdx}-${tipeIdx}`
  if (expandedTipes.value.has(key)) {
    expandedTipes.value.delete(key)
  } else {
    expandedTipes.value.add(key)
  }
}

const toggleUkuran = (merekIdx: number, tipeIdx: number, ukuranIdx: number) => {
  const key = `${merekIdx}-${tipeIdx}-${ukuranIdx}`
  if (expandedUkurans.value.has(key)) {
    expandedUkurans.value.delete(key)
  } else {
    expandedUkurans.value.add(key)
  }
}

// Editing states
const editingMerek = ref<number | null>(null)
const editingTipe = ref<{ merekIdx: number; tipeIdx: number } | null>(null)
const editingUkuran = ref<{ merekIdx: number; tipeIdx: number; ukuranIdx: number } | null>(null)
const editingBatch = ref<{ merekIdx: number; tipeIdx: number; ukuranIdx: number; batchIdx: number } | null>(null)

// Deleting states for showing loading
const deletingMerek = ref<number | null>(null)
const deletingTipe = ref<string | null>(null)
const deletingUkuran = ref<string | null>(null)
const deletingBatch = ref<string | null>(null)



// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    nama_jenis: '',
    catatan: '',
    is_active: true,
    m_group_mereks: []
  })

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  // Clear expanded states
  expandedMereks.value.clear()
  expandedTipes.value.clear()
  expandedUkurans.value.clear()
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
    const res = await getItemGroupById(sourceId)
    
    if (res.message !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    // Minimal normalisasi (tidak sekompleks normalizeIncoming sebelumnya)
    // Pastikan boolean (API sudah boolean, tapi jaga-jaga kalau 1/0)
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active
      initialValues.is_active = (v === true || v === 1 || v === '1')
    } else {
      initialValues.is_active = true
    }

    // Normalize nested is_active to true by default
    if (initialValues.m_group_mereks && Array.isArray(initialValues.m_group_mereks)) {
      initialValues.m_group_mereks.forEach((merek: any) => {
        if (merek.is_active === undefined || merek.is_active === null) {
          merek.is_active = true
        }
        if (merek.m_group_tipes && Array.isArray(merek.m_group_tipes)) {
          merek.m_group_tipes.forEach((tipe: any) => {
            if (tipe.is_active === undefined || tipe.is_active === null) {
              tipe.is_active = true
            }
            if (tipe.m_group_ukurans && Array.isArray(tipe.m_group_ukurans)) {
              tipe.m_group_ukurans.forEach((ukuran: any) => {
                if (ukuran.is_active === undefined || ukuran.is_active === null) {
                  ukuran.is_active = true
                }
                if (ukuran.m_group_batchs && Array.isArray(ukuran.m_group_batchs)) {
                  ukuran.m_group_batchs.forEach((batch: any) => {
                    if (batch.is_active === undefined || batch.is_active === null) {
                      batch.is_active = true
                    }
                  })
                }
              })
            }
          })
        }
      })
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
    }

    // Transform API response structure to match our UI expectations
    // API returns singular relations (m_group_tipe) but we need arrays (m_group_tipes)
    if (initialValues.m_group_mereks && Array.isArray(initialValues.m_group_mereks)) {
      initialValues.m_group_mereks = initialValues.m_group_mereks.map((merek: any) => {
        // Convert singular m_group_tipe to array m_group_tipes
        if (merek.m_group_tipe && !merek.m_group_tipes) {
          merek.m_group_tipes = [merek.m_group_tipe]
          delete merek.m_group_tipe
        }
        
        // Process tipes array
        if (merek.m_group_tipes && Array.isArray(merek.m_group_tipes)) {
          merek.m_group_tipes = merek.m_group_tipes.map((tipe: any) => {
            // Ensure m_group_ukurans is array
            if (!tipe.m_group_ukurans) {
              tipe.m_group_ukurans = []
            }
            
            // Process ukurans array
            if (Array.isArray(tipe.m_group_ukurans)) {
              tipe.m_group_ukurans = tipe.m_group_ukurans.map((ukuran: any) => {
                // Convert m_group_batches to m_group_batchs
                if (ukuran.m_group_batches && !ukuran.m_group_batchs) {
                  ukuran.m_group_batchs = ukuran.m_group_batches
                  delete ukuran.m_group_batches
                }
                
                // Ensure m_group_batchs is array
                if (!ukuran.m_group_batchs) {
                  ukuran.m_group_batchs = []
                }
                
                // Fix truncated batch property names
                if (Array.isArray(ukuran.m_group_batchs)) {
                  ukuran.m_group_batchs = ukuran.m_group_batchs.map((batch: any) => {
                    return {
                      id: batch.id,
                      nama_batch: batch.nam || batch.nama_batch || '',
                      is_active: batch.is_ !== undefined ? batch.is_ : (batch.is_active !== undefined ? batch.is_active : true),
                      catatan: batch.cat || batch.catatan || '',
                      m_group_ukuran_id: batch.m_g || batch.m_group_ukuran_id || '',
                      createdAt: batch.cre || batch.createdAt,
                      updatedAt: batch.upd || batch.updatedAt
                    }
                  })
                }
                
                return ukuran
              })
            }
            
            return tipe
          })
        }
        
        return merek
      })
    }
    
    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }
    
    console.log('=== TRANSFORMED DATA ===')
    console.log('values.m_group_mereks:', values.m_group_mereks)
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai ItemGroup baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data ItemGroup', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_item_group')
      }
    })
    setTimeout(() => router.push('/setup/m_item_group'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama_jenis: '',
  catatan: ''
})

// ============================================================================
// DETAIL MANAGEMENT FUNCTIONS - MEREK
// ============================================================================
const addMerek = () => {
  const newMerek: any = {
    nama_merek: '',
    catatan: '',
    is_active: true,
    m_group_tipes: []
  }
  values.m_group_mereks.push(newMerek)
  editingMerek.value = values.m_group_mereks.length - 1
  // Auto-expand new merek
  expandedMereks.value.add(values.m_group_mereks.length - 1)
}

const removeMerek = async (index: number) => {
  const merek = values.m_group_mereks[index]
  
  // If has ID, hit API to delete first
  if (merek?.id) {
    deletingMerek.value = index
    try {
      const response = await deleteGroupMerek(merek.id)
      if (response.status !== 'success' && response.status !== 'Success') {
        throw new Error(response.message || 'Gagal menghapus merek')
      }
      toast.success('Merek berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus merek', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan'
      })
      deletingMerek.value = null
      return
    }
    deletingMerek.value = null
  }
  
  // Remove from array
  values.m_group_mereks.splice(index, 1)
  expandedMereks.value.delete(index)
  if (editingMerek.value === index) editingMerek.value = null
}

// ============================================================================
// DETAIL MANAGEMENT FUNCTIONS - TIPE
// ============================================================================
const addTipe = (merekIdx: number) => {
  if (!values.m_group_mereks[merekIdx].m_group_tipes) {
    values.m_group_mereks[merekIdx].m_group_tipes = []
  }
  values.m_group_mereks[merekIdx].m_group_tipes!.push({
    nama_tipe: '',
    catatan: '',
    is_active: true,
    m_group_ukurans: []
  })
  const tipeIdx = values.m_group_mereks[merekIdx].m_group_tipes!.length - 1
  editingTipe.value = { merekIdx, tipeIdx }
  // Auto-expand parent merek and new tipe
  expandedMereks.value.add(merekIdx)
  expandedTipes.value.add(`${merekIdx}-${tipeIdx}`)
}

const removeTipe = async (merekIdx: number, tipeIdx: number) => {
  const tipe = values.m_group_mereks[merekIdx].m_group_tipes?.[tipeIdx]
  const key = `${merekIdx}-${tipeIdx}`
  
  // If has ID, hit API to delete first
  if (tipe?.id) {
    deletingTipe.value = key
    try {
      const response = await deleteGroupTipe(tipe.id)
      if (response.status !== 'success' && response.status !== 'Success') {
        throw new Error(response.message || 'Gagal menghapus tipe')
      }
      toast.success('Tipe berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus tipe', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan'
      })
      deletingTipe.value = null
      return
    }
    deletingTipe.value = null
  }
  
  // Remove from array
  values.m_group_mereks[merekIdx].m_group_tipes!.splice(tipeIdx, 1)
  expandedTipes.value.delete(key)
  if (editingTipe.value?.merekIdx === merekIdx && editingTipe.value?.tipeIdx === tipeIdx) {
    editingTipe.value = null
  }
}

// ============================================================================
// DETAIL MANAGEMENT FUNCTIONS - UKURAN
// ============================================================================
const addUkuran = (merekIdx: number, tipeIdx: number) => {
  if (!values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans) {
    values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans = []
  }
  values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans!.push({
    nama_ukuran: '',
    catatan: '',
    is_active: true,
    m_group_batchs: []
  })
  const ukuranIdx = values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans!.length - 1
  editingUkuran.value = { merekIdx, tipeIdx, ukuranIdx }
  // Auto-expand parents and new ukuran
  expandedMereks.value.add(merekIdx)
  expandedTipes.value.add(`${merekIdx}-${tipeIdx}`)
  expandedUkurans.value.add(`${merekIdx}-${tipeIdx}-${ukuranIdx}`)
}

const removeUkuran = async (merekIdx: number, tipeIdx: number, ukuranIdx: number) => {
  const ukuran = values.m_group_mereks[merekIdx].m_group_tipes?.[tipeIdx]?.m_group_ukurans?.[ukuranIdx]
  const key = `${merekIdx}-${tipeIdx}-${ukuranIdx}`
  
  // If has ID, hit API to delete first
  if (ukuran?.id) {
    deletingUkuran.value = key
    try {
      const response = await deleteGroupUkuran(ukuran.id)
      if (response.status !== 'success' && response.status !== 'Success') {
        throw new Error(response.message || 'Gagal menghapus ukuran')
      }
      toast.success('Ukuran berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus ukuran', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan'
      })
      deletingUkuran.value = null
      return
    }
    deletingUkuran.value = null
  }
  
  // Remove from array
  values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans!.splice(ukuranIdx, 1)
  expandedUkurans.value.delete(key)
  if (editingUkuran.value?.merekIdx === merekIdx && editingUkuran.value?.tipeIdx === tipeIdx && editingUkuran.value?.ukuranIdx === ukuranIdx) {
    editingUkuran.value = null
  }
}

// ============================================================================
// DETAIL MANAGEMENT FUNCTIONS - BATCH
// ============================================================================
const addBatch = (merekIdx: number, tipeIdx: number, ukuranIdx: number) => {
  if (!values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans![ukuranIdx].m_group_batchs) {
    values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans![ukuranIdx].m_group_batchs = []
  }
  values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans![ukuranIdx].m_group_batchs!.push({
    nama_batch: '',
    catatan: '',
    is_active: true
  })
  const batchIdx = values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans![ukuranIdx].m_group_batchs!.length - 1
  editingBatch.value = { merekIdx, tipeIdx, ukuranIdx, batchIdx }
  // Auto-expand all parents
  expandedMereks.value.add(merekIdx)
  expandedTipes.value.add(`${merekIdx}-${tipeIdx}`)
  expandedUkurans.value.add(`${merekIdx}-${tipeIdx}-${ukuranIdx}`)
}

const removeBatch = async (merekIdx: number, tipeIdx: number, ukuranIdx: number, batchIdx: number) => {
  const batch = values.m_group_mereks[merekIdx].m_group_tipes?.[tipeIdx]?.m_group_ukurans?.[ukuranIdx]?.m_group_batchs?.[batchIdx]
  const key = `${merekIdx}-${tipeIdx}-${ukuranIdx}-${batchIdx}`
  
  // If has ID, hit API to delete first
  if (batch?.id) {
    deletingBatch.value = key
    try {
      const response = await deleteGroupBatch(batch.id)
      if (response.status !== 'success' && response.status !== 'Success') {
        throw new Error(response.message || 'Gagal menghapus batch')
      }
      toast.success('Batch berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus batch', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan'
      })
      deletingBatch.value = null
      return
    }
    deletingBatch.value = null
  }
  
  // Remove from array
  values.m_group_mereks[merekIdx].m_group_tipes![tipeIdx].m_group_ukurans![ukuranIdx].m_group_batchs!.splice(batchIdx, 1)
  if (editingBatch.value?.merekIdx === merekIdx && editingBatch.value?.tipeIdx === tipeIdx && editingBatch.value?.ukuranIdx === ukuranIdx && editingBatch.value?.batchIdx === batchIdx) {
    editingBatch.value = null
  }
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  if (!values.nama_jenis?.trim()) {
    errors.nama_jenis = 'Nama jenis wajib diisi'
    invalid = true
  }

  // Validate Nested Items
  for (let m = 0; m < values.m_group_mereks.length; m++) {
    const merek = values.m_group_mereks[m]
    if (!merek.nama_merek?.trim()) {
      toast.error(`Validasi Gagal: Merek #${m + 1}`, { description: 'Nama Merek wajib diisi' })
      // Expand accordion
      expandedMereks.value.add(m)
      return
    }

    if (merek.m_group_tipes) {
      for (let t = 0; t < merek.m_group_tipes.length; t++) {
        const tipe = merek.m_group_tipes[t]
        if (!tipe.nama_tipe?.trim()) {
          toast.error(`Validasi Gagal: Merek "${merek.nama_merek}" -> Tipe #${t + 1}`, { description: 'Nama Tipe wajib diisi' })
          expandedMereks.value.add(m)
          expandedTipes.value.add(`${m}-${t}`)
          return
        }

        if (tipe.m_group_ukurans) {
          for (let u = 0; u < tipe.m_group_ukurans.length; u++) {
            const ukuran = tipe.m_group_ukurans[u]
            if (!ukuran.nama_ukuran?.trim()) {
              toast.error(`Validasi Gagal: Tipe "${tipe.nama_tipe}" -> Ukuran #${u + 1}`, { description: 'Nama Ukuran wajib diisi' })
              expandedMereks.value.add(m)
              expandedTipes.value.add(`${m}-${t}`)
              expandedUkurans.value.add(`${m}-${t}-${u}`)
              return
            }

            if (ukuran.m_group_batchs) {
              for (let b = 0; b < ukuran.m_group_batchs.length; b++) {
                const batch = ukuran.m_group_batchs[b]
                if (!batch.nama_batch?.trim()) {
                  toast.error(`Validasi Gagal: Ukuran "${ukuran.nama_ukuran}" -> Batch #${b + 1}`, { description: 'Nama Batch wajib diisi' })
                  expandedMereks.value.add(m)
                  expandedTipes.value.add(`${m}-${t}`)
                  expandedUkurans.value.add(`${m}-${t}-${u}`)
                  return
                }
              }
            }
          }
        }
      }
    }
  }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    const toNull = (val: any) => (val?.trim() ? val.trim() : null)
    
    const payload: any = {
      nama_jenis: toNull(values.nama_jenis),
      catatan: toNull(values.catatan),
      is_active: values.is_active,
      m_group_mereks: values.m_group_mereks.map(merek => ({
        ...(merek.id && { id: merek.id }),
        m_group_jenis_id: merek.m_group_jenis_id,
        nama_merek: toNull(merek.nama_merek),
        catatan: toNull(merek.catatan),
        is_active: merek.is_active,
        m_group_tipes: (merek.m_group_tipes || []).map((tipe: any) => ({
          ...(tipe.id && { id: tipe.id }),
          m_group_merek_id: tipe.m_group_merek_id,
          nama_tipe: toNull(tipe.nama_tipe),
          catatan: toNull(tipe.catatan),
          is_active: tipe.is_active,
          m_group_ukurans: (tipe.m_group_ukurans || []).map((ukuran: any) => ({
            ...(ukuran.id && { id: ukuran.id }),
            m_group_tipe_id: ukuran.m_group_tipe_id,
            nama_ukuran: toNull(ukuran.nama_ukuran),
            catatan: toNull(ukuran.catatan),
            is_active: ukuran.is_active,
            m_group_batchs: (ukuran.m_group_batchs || []).map((batch: any) => ({
              ...(batch.id && { id: batch.id }),
              m_group_ukuran_id: batch.m_group_ukuran_id,
              nama_batch: toNull(batch.nama_batch),
              catatan: toNull(batch.catatan),
              is_active: batch.is_active
            }))
          }))
        }))
      }))
    }
    
    if (isEditMode.value) {
      await updateItemGroup(menuId.value, payload)
      toast.success('Group Jenis berhasil diperbarui', { description: 'Data dan semua detail telah diperbarui' })
    } else {
      await createItemGroup(payload)
      toast.success('Group Jenis berhasil dibuat', { description: 'Data dan semua detail telah ditambahkan' })
    }
    router.replace('/setup/m_item_group?reload=' + Date.now())
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
    
    // Handle unique constraint error (server returns 500 with "Validation error")
    if (errorMessage === 'Validation error' || errorMessage === 'API request failed') {
      errorMessage = `Jenis "${values.nama_jenis}" sudah tersedia.`
    }
    
    toast.error(isEditMode.value ? 'Gagal memperbarui Group Jenis' : 'Gagal membuat Group Jenis', { description: errorMessage })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/setup/m_item_group')
}


</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- HEADER -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- FORM -->
    <form class="space-y-6" @submit.prevent>
      <!-- INFO JENIS -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Group Jenis</CardTitle>
          <CardDescription>Isi informasi utama group jenis</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Nama Jenis Field -->
          <FieldX 
            id="nama_jenis" 
            label="Nama Jenis" 
            v-model="values.nama_jenis" 
            :errorname="errors.nama_jenis ? 'failed' : ''"
            :hints="errors.nama_jenis || 'Nama jenis group (wajib diisi)'"
            :required="true"
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Contoh: Elektronik, Furniture, dll" 
            class="w-full" 
          />

          <!-- Catatan Field -->
          <FieldX 
            id="catatan" 
            type="textarea"
            label="Catatan" 
            v-model="values.catatan" 
            :hints="'Catatan tambahan (opsional)'"
            :required="false"
            :disabled="loading || isReadOnly" 
            :readonly="isReadOnly" 
            placeholder="Masukkan catatan jika diperlukan" 
            :rows="4"
            class="w-full" 
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

      <!-- DETAIL NESTED -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Detail Nested (Merek → Tipe → Ukuran → Batch)</CardTitle>
              <CardDescription>Kelola detail nested dari Jenis ini. Klik header untuk expand/collapse.</CardDescription>
            </div>
            <Button 
              v-if="!isReadOnly"
              type="button" 
              size="sm" 
              @click="addMerek" 
              :disabled="loading"
              class="gap-2"
            >
              <Plus class="h-4 w-4" />
              Tambah Merek
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <!-- Empty State -->
          <div v-if="!values.m_group_mereks || values.m_group_mereks.length === 0" class="text-center py-8 text-muted-foreground">
            Belum ada data merek. Klik "Tambah Merek" untuk memulai.
          </div>

          <!-- Merek Cards dengan Collapsible dan Scroll -->
          <div v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            <div 
              v-for="(merek, merekIdx) in values.m_group_mereks" 
              :key="`merek-${merekIdx}`"
              class="relative"
            >
              <!-- MEREK CARD -->
              <Collapsible :open="expandedMereks.has(merekIdx)" @update:open="toggleMerek(merekIdx)">
                <Card class="border-2 border-primary/30 bg-primary/5">
                  <CollapsibleTrigger class="w-full">
                    <CardHeader class="pb-3 cursor-pointer hover:bg-primary/10 transition-colors rounded-t-lg">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <ChevronRight v-if="!expandedMereks.has(merekIdx)" class="h-4 w-4 text-muted-foreground" />
                          <ChevronDown v-else class="h-4 w-4 text-muted-foreground" />
                          <div class="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                            M{{ merekIdx + 1 }}
                          </div>
                          <span class="font-semibold">{{ merek.nama_merek || 'Merek Baru' }}</span>
                          <span v-if="merek.m_group_tipes?.length" class="text-xs text-muted-foreground">
                            ({{ merek.m_group_tipes.length }} tipe)
                          </span>
                        </div>
                        <div class="flex items-center gap-2" @click.stop>
                          <Button 
                            v-if="!isReadOnly"
                            size="sm"
                            variant="outline"
                            @click="addTipe(merekIdx)"
                            :disabled="loading"
                            class="gap-1 h-7 text-xs"
                          >
                            <Plus class="h-3 w-3" />
                            Tipe
                          </Button>
                          <Button 
                            v-if="!isReadOnly"
                            variant="destructive" 
                            size="icon"
                            class="h-7 w-7"
                            @click="removeMerek(merekIdx)"
                            :disabled="loading || deletingMerek === merekIdx"
                          >
                            <Loader2 v-if="deletingMerek === merekIdx" class="h-3 w-3 animate-spin" />
                            <Trash2 v-else class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-0 border-t">
                      <FieldX 
                        v-model="merek.nama_merek"
                        label="Nama Merek"
                        placeholder="Nama merek"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                      />
                      <FieldX 
                        v-model="merek.catatan"
                        label="Catatan"
                        placeholder="Catatan merek"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                      />
                      <FieldStatus 
                        label="Status"
                        v-model="merek.is_active"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                      />
                    </CardContent>

                    <!-- TIPE Cards (children of Merek) -->
                    <div 
                      v-if="merek.m_group_tipes && merek.m_group_tipes.length > 0"
                      class="mx-4 mb-4 space-y-2 pl-4 border-l-2 border-primary/30"
                    >
                      <div 
                        v-for="(tipe, tipeIdx) in merek.m_group_tipes" 
                        :key="`tipe-${merekIdx}-${tipeIdx}`"
                      >
                        <!-- TIPE CARD -->
                        <Collapsible :open="expandedTipes.has(`${merekIdx}-${tipeIdx}`)" @update:open="toggleTipe(merekIdx, tipeIdx as number)">
                          <Card class="border border-blue-500/30 bg-blue-500/5">
                            <CollapsibleTrigger class="w-full">
                              <CardHeader class="py-2 px-3 cursor-pointer hover:bg-blue-500/10 transition-colors rounded-t-lg">
                                <div class="flex items-center justify-between">
                                  <div class="flex items-center gap-2">
                                    <ChevronRight v-if="!expandedTipes.has(`${merekIdx}-${tipeIdx}`)" class="h-3 w-3 text-muted-foreground" />
                                    <ChevronDown v-else class="h-3 w-3 text-muted-foreground" />
                                    <div class="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                                      T{{ (tipeIdx as number) + 1 }}
                                    </div>
                                    <span class="text-sm font-medium">{{ tipe.nama_tipe || 'Tipe Baru' }}</span>
                                    <span v-if="tipe.m_group_ukurans?.length" class="text-xs text-muted-foreground">
                                      ({{ tipe.m_group_ukurans.length }} ukuran)
                                    </span>
                                  </div>
                                  <div class="flex items-center gap-1" @click.stop>
                                    <Button 
                                      v-if="!isReadOnly"
                                      size="sm"
                                      variant="outline"
                                      @click="addUkuran(merekIdx, tipeIdx as number)"
                                      :disabled="loading"
                                      class="gap-1 h-6 text-[10px]"
                                    >
                                      <Plus class="h-3 w-3" />
                                      Ukuran
                                    </Button>
                                    <Button 
                                      v-if="!isReadOnly"
                                      variant="destructive" 
                                      size="icon"
                                      class="h-6 w-6"
                                      @click="removeTipe(merekIdx, tipeIdx as number)"
                                      :disabled="loading || deletingTipe === `${merekIdx}-${tipeIdx}`"
                                    >
                                      <Loader2 v-if="deletingTipe === `${merekIdx}-${tipeIdx}`" class="h-3 w-3 animate-spin" />
                                      <Trash2 v-else class="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent class="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-3 border-t">
                                <FieldX 
                                  v-model="tipe.nama_tipe"
                                  label="Nama Tipe"
                                  placeholder="Nama tipe"
                                  :disabled="loading || isReadOnly"
                                  :readonly="isReadOnly"
                                />
                                <FieldX 
                                  v-model="tipe.catatan"
                                  label="Catatan"
                                  placeholder="Catatan tipe"
                                  :disabled="loading || isReadOnly"
                                  :readonly="isReadOnly"
                                />
                                <FieldStatus 
                                  label="Status"
                                  v-model="tipe.is_active"
                                  :disabled="loading || isReadOnly"
                                  :readonly="isReadOnly"
                                />
                              </CardContent>

                              <!-- UKURAN Cards (children of Tipe) -->
                              <div 
                                v-if="tipe.m_group_ukurans && tipe.m_group_ukurans.length > 0"
                                class="mx-3 mb-3 space-y-2 pl-3 border-l-2 border-blue-500/30"
                              >
                                <div 
                                  v-for="(ukuran, ukuranIdx) in tipe.m_group_ukurans" 
                                  :key="`ukuran-${merekIdx}-${tipeIdx}-${ukuranIdx}`"
                                >
                                  <!-- UKURAN CARD -->
                                  <Collapsible :open="expandedUkurans.has(`${merekIdx}-${tipeIdx}-${ukuranIdx}`)" @update:open="toggleUkuran(merekIdx, tipeIdx as number, ukuranIdx as number)">
                                    <Card class="border border-green-500/30 bg-green-500/5">
                                      <CollapsibleTrigger class="w-full">
                                        <CardHeader class="py-2 px-3 cursor-pointer hover:bg-green-500/10 transition-colors rounded-t-lg">
                                          <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                              <ChevronRight v-if="!expandedUkurans.has(`${merekIdx}-${tipeIdx}-${ukuranIdx}`)" class="h-3 w-3 text-muted-foreground" />
                                              <ChevronDown v-else class="h-3 w-3 text-muted-foreground" />
                                              <div class="h-5 w-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">
                                                U{{ (ukuranIdx as number) + 1 }}
                                              </div>
                                              <span class="text-sm font-medium">{{ ukuran.nama_ukuran || 'Ukuran Baru' }}</span>
                                              <span v-if="ukuran.m_group_batchs?.length" class="text-xs text-muted-foreground">
                                                ({{ ukuran.m_group_batchs.length }} batch)
                                              </span>
                                            </div>
                                            <div class="flex items-center gap-1" @click.stop>
                                              <Button 
                                                v-if="!isReadOnly"
                                                size="sm"
                                                variant="outline"
                                                @click="addBatch(merekIdx, tipeIdx as number, ukuranIdx as number)"
                                                :disabled="loading"
                                                class="gap-1 h-5 text-[10px]"
                                              >
                                                <Plus class="h-3 w-3" />
                                                Batch
                                              </Button>
                                              <Button 
                                                v-if="!isReadOnly"
                                                variant="destructive" 
                                                size="icon"
                                                class="h-5 w-5"
                                                @click="removeUkuran(merekIdx, tipeIdx as number, ukuranIdx as number)"
                                                :disabled="loading || deletingUkuran === `${merekIdx}-${tipeIdx}-${ukuranIdx}`"
                                              >
                                                <Loader2 v-if="deletingUkuran === `${merekIdx}-${tipeIdx}-${ukuranIdx}`" class="h-3 w-3 animate-spin" />
                                                <Trash2 v-else class="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </CardHeader>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <CardContent class="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-3 border-t">
                                          <FieldX 
                                            v-model="ukuran.nama_ukuran"
                                            label="Nama Ukuran"
                                            placeholder="Nama ukuran"
                                            :disabled="loading || isReadOnly"
                                            :readonly="isReadOnly"
                                          />
                                          <FieldX 
                                            v-model="ukuran.catatan"
                                            label="Catatan"
                                            placeholder="Catatan ukuran"
                                            :disabled="loading || isReadOnly"
                                            :readonly="isReadOnly"
                                          />
                                          <FieldStatus 
                                            label="Status"
                                            v-model="ukuran.is_active"
                                            :disabled="loading || isReadOnly"
                                            :readonly="isReadOnly"
                                          />
                                        </CardContent>

                                        <!-- BATCH Cards (children of Ukuran) -->
                                        <div 
                                          v-if="ukuran.m_group_batchs && ukuran.m_group_batchs.length > 0"
                                          class="mx-3 mb-3 space-y-1 pl-3 border-l-2 border-green-500/30"
                                        >
                                          <div 
                                            v-for="(batch, batchIdx) in ukuran.m_group_batchs" 
                                            :key="`batch-${merekIdx}-${tipeIdx}-${ukuranIdx}-${batchIdx}`"
                                          >
                                            <!-- BATCH CARD - No collapsible, always expanded -->
                                            <Card class="border border-orange-500/30 bg-orange-500/5">
                                              <CardHeader class="py-1 px-2">
                                                <div class="flex items-center justify-between">
                                                  <div class="flex items-center gap-2">
                                                    <div class="h-4 w-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[8px] font-bold">
                                                      B{{ (batchIdx as number) + 1 }}
                                                    </div>
                                                    <span class="text-xs font-medium">{{ batch.nama_batch || 'Batch Baru' }}</span>
                                                  </div>
                                                  <Button 
                                                    v-if="!isReadOnly"
                                                    variant="destructive" 
                                                    size="icon"
                                                    class="h-5 w-5"
                                                    @click="removeBatch(merekIdx, tipeIdx as number, ukuranIdx as number, batchIdx as number)"
                                                    :disabled="loading || deletingBatch === `${merekIdx}-${tipeIdx}-${ukuranIdx}-${batchIdx}`"
                                                  >
                                                    <Loader2 v-if="deletingBatch === `${merekIdx}-${tipeIdx}-${ukuranIdx}-${batchIdx}`" class="h-3 w-3 animate-spin" />
                                                    <Trash2 v-else class="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </CardHeader>
                                              <CardContent class="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-2 border-t">
                                                <FieldX 
                                                  v-model="batch.nama_batch"
                                                  label="Nama Batch"
                                                  placeholder="Nama batch"
                                                  :disabled="loading || isReadOnly"
                                                  :readonly="isReadOnly"
                                                />
                                                <FieldX 
                                                  v-model="batch.catatan"
                                                  label="Catatan"
                                                  placeholder="Catatan batch"
                                                  :disabled="loading || isReadOnly"
                                                  :readonly="isReadOnly"
                                                />
                                                <FieldStatus 
                                                  label="Status"
                                                  v-model="batch.is_active"
                                                  :disabled="loading || isReadOnly"
                                                  :readonly="isReadOnly"
                                                />
                                              </CardContent>
                                            </Card>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Card>
                                  </Collapsible>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
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
