<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldX, FieldStatus, FieldMultiUpload, FieldSelect, FieldNumber } from '@/components/field'
import { 
  createItems, 
  updateItems, 
  getItemsById,
  getGroupJenisList,
  getGroupMerekByJenis,
  getGroupTipeByMerek,
  getGroupUkuranByTipe,
  getGroupBatchByUkuran,
  type GroupJenis,
  type GroupMerek,
  type GroupTipe,
  type GroupUkuran,
  type GroupBatch
} from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

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
const isRevisiDialogOpen = ref(false)
const isSuperAdminDialogOpen = ref(false)
const approvalMessage = ref('')
const isEditMode = computed(() => !!route.params.id && route.name === 'ItemsForm')
const isViewMode = computed(() => route.name === 'ItemsView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

// Check if current user is Super Admin
const isSuperAdmin = computed(() => {
  const user = authStore.user
  if (!user || !user.tipe) return false
  return user.tipe.value1?.toUpperCase() === 'SUPER ADMIN'
})
const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Items'
  if (isCopyMode.value) return 'Salin Items'
  if (isEditMode.value) return 'Edit Items'
  return 'Tambah Items Baru'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Items'
  if (isCopyMode.value) return 'Buat Items baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Items'
  return 'Buat Items aplikasi baru'
})

// Reactive form values with defaults
let values = reactive({
  kode_item: '',
  nama_item: '',
  nama_singkat: '',
  tipe_barang: 'barang dagang', // Default: barang dagang
  spesifikasi: '',
  min_stock: 0,
  max_stock: 0,
  // Fields for barang dagang (FieldSelect)
  group_jenis_id: '',
  group_merek_id: '',
  group_tipe_id: '',
  group_ukuran_id: '',
  group_batch_id: '',
  satuan_id: '',
  // Fields for non dagang (FieldX - string)
  group_jenis: '',
  group_merek: '',
  group_tipe: '',
  group_ukuran: '',
  group_batch: '',
  m_items_images: [] as { id?: string; m_items_id?: string; gambar: string }[],
  catatan: '',
  status: 'DRAFT', // Default: DRAFT
  is_active: false, // Default: true
  is_skip: false // Default: false
})

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {}

// ============================================================================
// CASCADE DROPDOWN STATE (NOT NEEDED - using :api now)
// ============================================================================
// FieldSelect with :api handles cascade automatically via reactive params
// No need to manage local state arrays or watch for changes


// ============================================================================
// WATCH TIPE BARANG - Clear fields when switching (only in create mode)
// ============================================================================
watch(() => values.tipe_barang, (newType, oldType) => {
  // Skip if first initialization (oldType undefined)
  if (oldType === undefined) {
    return
  }
  
  // Skip if in edit/view mode - don't clear gambar on existing data
  if (isEditMode.value || isViewMode.value) {
    // Only clear opposite type fields, keep gambar
    if (newType === 'barang dagang') {
      values.group_jenis = ''
      values.group_merek = ''
      values.group_tipe = ''
      values.group_ukuran = ''
      values.group_batch = ''
    } else {
      // non dagang or barang produksi - clear UUID fields
      values.group_jenis_id = ''
      values.group_merek_id = ''
      values.group_tipe_id = ''
      values.group_ukuran_id = ''
      values.group_batch_id = ''
      values.satuan_id = ''
    }
    return
  }
  
  // Create mode: clear all group-related fields and images when switching tipe barang
  if (newType === 'barang dagang') {
    // Clear non-dagang string fields
    values.group_jenis = ''
    values.group_merek = ''
    values.group_tipe = ''
    values.group_ukuran = ''
    values.group_batch = ''
  } else {
    // non dagang or barang produksi - clear UUID fields
    values.group_jenis_id = ''
    values.group_merek_id = ''
    values.group_tipe_id = ''
    values.group_ukuran_id = ''
    values.group_batch_id = ''
    values.satuan_id = ''
  }
  
  // Clear images only in create mode when manually switching
  values.m_items_images = []
})

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_item: '',
    nama_item: '',
    nama_singkat: '',
    tipe_barang: 'barang dagang',
    spesifikasi: '',
    min_stock: 0,
    max_stock: 0,
    group_jenis_id: '',
    group_merek_id: '',
    group_tipe_id: '',
    group_ukuran_id: '',
    group_batch_id: '',
    satuan_id: '',
    group_jenis: '',
    group_merek: '',
    group_tipe: '',
    group_ukuran: '',
    group_batch: '',
    m_items_images: [],
    catatan: '',
    status: 'DRAFT',
    is_active: false,
    is_skip: false
  })

  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
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
    const res = await getItemsById(sourceId)
    
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
      // Reset kode_item to empty for copy mode (auto-generated)
      initialValues.kode_item = ''
      // Reset status to DRAFT for copy mode
      initialValues.status = 'DRAFT'
      initialValues.is_skip = false
      // Remove id and m_items_id from images for copy mode
      if (initialValues.m_items_images) {
        initialValues.m_items_images = initialValues.m_items_images.map((img: any) => ({
          gambar: img.gambar
        }))
      }
    }

    // Assign values from API response
    values.kode_item = initialValues.kode_item || ''
    values.nama_item = initialValues.nama_item || ''
    values.nama_singkat = initialValues.nama_singkat || ''
    values.tipe_barang = initialValues.tipe_barang || 'barang dagang'
    values.spesifikasi = initialValues.spesifikasi || ''
    // Parse min_stock and max_stock (API returns as string)
    values.min_stock = typeof initialValues.min_stock === 'string' 
      ? parseInt(initialValues.min_stock) || 0 
      : initialValues.min_stock || 0
    values.max_stock = typeof initialValues.max_stock === 'string' 
      ? parseInt(initialValues.max_stock) || 0 
      : initialValues.max_stock || 0
    values.m_items_images = initialValues.m_items_images || []
    values.catatan = initialValues.catatan || ''
    values.status = initialValues.status || 'DRAFT'
    values.is_active = initialValues.is_active ?? true
    values.is_skip = initialValues.is_skip ?? false
    
    // Assign group fields based on tipe_barang
    if (initialValues.tipe_barang === 'barang dagang') {
      values.group_jenis_id = initialValues.m_group_jenis_id || ''
      values.group_merek_id = initialValues.m_group_merek_id || ''
      values.group_tipe_id = initialValues.m_group_tipe_id || ''
      values.group_ukuran_id = initialValues.m_group_ukuran_id || ''
      values.group_batch_id = initialValues.m_group_batch_id || ''
      values.satuan_id = initialValues.satuan_id || ''
      
      // FieldSelect with :api will automatically fetch and display data
      // No need to manually populate options - just set the value IDs above
    } else {
      // Non-dagang & Barang Produksi: load string fields (manual input)
      values.group_jenis = initialValues.group_jenis || ''
      values.group_merek = initialValues.group_merek || ''
      values.group_tipe = initialValues.group_tipe || ''
      values.group_ukuran = initialValues.group_ukuran || ''
      values.group_batch = initialValues.group_batch || ''
    }
    
    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Items baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Items', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/inventory/m_items')
      }
    })
    setTimeout(() => router.push('/inventory/m_items'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation)
const errors = reactive({
  nama_item: '',
  spesifikasi: '',
  tipe_barang: '',
  min_stock: '',
  catatan: ''
})

// ============================================================================
// AUTO SEND APPROVAL FUNCTION
// ============================================================================
const autoSendApproval = async (itemId: string, itemName: string, message?: string) => {
  try {
    // Check if user is SUPER ADMIN - skip approval for SUPER ADMIN
    const userTipe = authStore.user?.tipe?.value1?.toUpperCase()
    if (userTipe === 'SUPER ADMIN') {
      console.log('⚡ User is SUPER ADMIN - skipping approval submission')
      return // SUPER ADMIN doesn't need to submit approval
    }
    
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList()
    
    if (!approvalList || approvalList.length === 0) {
      throw new Error('Data approval tidak ditemukan. Silakan login ulang.')
    }
    
    const currentApproval = approvalList.find((approval: any) => 
      approval.path === '/inventory/m_items' && 
      approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
    )
    
    if (!currentApproval) {
      throw new Error('Anda tidak memiliki hak untuk mengajukan approval pada halaman ini. Tipe approval yang dibutuhkan: MENGAJUKAN')
    }
    
    // Validate required approval fields
    if (currentApproval.level === null || currentApproval.level === undefined || !currentApproval.sender_id) {
      throw new Error('Data approval tidak lengkap. Silakan hubungi administrator.')
    }
    
    // Prepare payload - same as ItemsLanding
    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      m_items_id: itemId,
      approval_message: message?.trim() || null
    }
    
    // Call API POST /dynamic/m_items_notifikasi
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_items_notifikasi`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify(payload)
      }
    )
    
    const result = await response.json()
    
    if (result.status === 'success') {
      toast.success('Approval berhasil dikirim', {
        description: `Item "${itemName}" telah dikirim untuk approval`
      })
    } else {
      throw new Error(result.message || 'Terjadi kesalahan saat mengirim approval')
    }
  } catch (error) {
    console.error('❌ Auto send approval error:', error)
    // Re-throw error to be caught by performSave
    throw error
  }
}

const validateApprovalData = () => {
  // Get approval data from localStorage
  const approvalList = authStore.getApprovalList()
  
  if (!approvalList || approvalList.length === 0) {
    return {
      valid: false,
      error: 'Data approval tidak ditemukan di sistem',
      detail: 'Silakan logout dan login kembali untuk memuat ulang data approval Anda.'
    }
  }
  
  const currentApproval = approvalList.find((approval: any) => 
    approval.path === '/inventory/m_items' && 
    approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
  )
  
  if (!currentApproval) {
    return {
      valid: false,
      error: 'Hak akses approval tidak ditemukan',
      detail: 'Anda tidak memiliki hak untuk mengajukan approval pada halaman Items. Tipe approval yang dibutuhkan: MENGAJUKAN'
    }
  }
  
  // Validate required approval fields
  const missingFields = []
  if (currentApproval.level === null || currentApproval.level === undefined) missingFields.push('Level')
  if (!currentApproval.sender_id) missingFields.push('Sender ID')
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: 'Data approval tidak lengkap',
      detail: `Field yang hilang: ${missingFields.join(', ')}. Silakan hubungi administrator untuk melengkapi data approval Anda.`
    }
  }
  
  return { valid: true }
}

const confirmRevisiSave = async () => {
  isRevisiDialogOpen.value = false
  await performSave()
}

const cancelRevisiSave = () => {
  isRevisiDialogOpen.value = false
  approvalMessage.value = ''
}

const confirmSuperAdminSave = async () => {
  isSuperAdminDialogOpen.value = false
  // Super Admin langsung APPROVED tanpa mengubah is_skip
  // is_skip tetap false, tapi status jadi APPROVED
  await performSave()
}

const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  
  if (!values.nama_item?.trim()) { errors.nama_item = 'Nama item wajib diisi'; invalid = true }
  if (!values.spesifikasi?.trim()) { errors.spesifikasi = 'Spesifikasi wajib diisi'; invalid = true }
  if (!values.tipe_barang?.trim()) { errors.tipe_barang = 'Tipe barang wajib dipilih'; invalid = true }
  if (!values.min_stock || values.min_stock < 0) { errors.min_stock = 'Min stock wajib diisi'; invalid = true }
  if (!values.catatan?.trim()) { errors.catatan = 'Catatan wajib diisi'; invalid = true }
  
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Check if user is Super Admin and is_skip is false
  if (isSuperAdmin.value && !values.is_skip) {
    isSuperAdminDialogOpen.value = true
    return
  }

  // Check if editing APPROVED or REVISI status - show confirmation dialog
  const currentStatus = values.status?.toUpperCase()
  if (isEditMode.value && (currentStatus === 'APPROVED' || currentStatus === 'REVISI') && !values.is_skip) {
    // Validate approval data BEFORE showing dialog
    const approvalValidation = validateApprovalData()
    if (!approvalValidation.valid) {
      toast.error(approvalValidation.error || 'Validasi approval gagal', {
        description: approvalValidation.detail,
        duration: 6000
      })
      return
    }
    
    isRevisiDialogOpen.value = true
    return
  }

  // Proceed with save
  await performSave()
}

const performSave = async () => {

  loading.value = true
  try {
    // Get user ID from localStorage (authStore)
    const userId = authStore.user?.id || ''
    
    // Clean payload: convert empty strings to null
    const payload: any = {
      kode_item: values.kode_item?.trim() || null,
      nama_item: values.nama_item?.trim() || null,
      nama_singkat: values.nama_singkat?.trim() || null,
      tipe_barang: values.tipe_barang,
      spesifikasi: values.spesifikasi?.trim() || null,
      min_stock: values.min_stock,
      max_stock: values.max_stock,
      // Handle m_items_images differently for POST vs PUT
      m_items_images: isEditMode.value 
        ? (values.m_items_images || []).map(img => ({
            ...(img.id && { id: img.id }),
            ...(img.m_items_id && { m_items_id: img.m_items_id }),
            gambar: img.gambar
          }))
        : (values.m_items_images || []).map(img => ({ gambar: img.gambar })),
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      is_skip: values.is_skip
    }
    
    // Determine status based on is_skip OR Super Admin
    if (isSuperAdmin.value) {
      // Super Admin always APPROVED (tanpa mengubah is_skip)
      payload.status = 'APPROVED'
    } else if (values.is_skip) {
      payload.status = 'APPROVED'
    } else {
      // For edit mode with is_skip=false:
      // If current status is APPROVED or IN APPROVAL, change to IN APPROVAL
      // If DRAFT, keep DRAFT
      // For create/copy, always DRAFT
      if (isEditMode.value && !isCopyMode.value) {
        const currentStatus = (values.status || 'DRAFT').toUpperCase()
        if (currentStatus === 'APPROVED' || currentStatus === 'IN APPROVAL') {
          payload.status = 'IN APPROVAL'
        } else {
          payload.status = values.status || 'DRAFT'
        }
      } else {
        payload.status = 'DRAFT'
      }
    }
    
    // Add fields based on tipe_barang
    if (values.tipe_barang === 'barang dagang') {
      // Use UUID fields for barang dagang (cascade from dropdown)
      payload.m_group_jenis_id = values.group_jenis_id || null
      payload.m_group_merek_id = values.group_merek_id || null
      payload.m_group_tipe_id = values.group_tipe_id || null
      payload.m_group_ukuran_id = values.group_ukuran_id || null
      payload.m_group_batch_id = values.group_batch_id || null
      payload.satuan_id = values.satuan_id || null
      // Clear string fields for barang dagang
      payload.group_jenis = null
      payload.group_merek = null
      payload.group_tipe = null
      payload.group_ukuran = null
      payload.group_batch = null
    } else {
      // Use string fields for non-dagang & barang produksi (manual input)
      payload.group_jenis = values.group_jenis?.trim() || null
      payload.group_merek = values.group_merek?.trim() || null
      payload.group_tipe = values.group_tipe?.trim() || null
      payload.group_ukuran = values.group_ukuran?.trim() || null
      payload.group_batch = values.group_batch?.trim() || null
      // Clear UUID fields for non-dagang & barang produksi
      payload.m_group_jenis_id = null
      payload.m_group_merek_id = null
      payload.m_group_tipe_id = null
      payload.m_group_ukuran_id = null
      payload.m_group_batch_id = null
      payload.satuan_id = null
    }
    
    // Add created_by/updated_by
    if (isEditMode.value) {
      // Store original status before update
      const originalStatus = (values.status || '').toUpperCase()
      
      payload.updated_by = userId
      console.log('🔄 PUT Payload:', JSON.stringify(payload, null, 2))
      await updateItems(menuId.value, payload)
      toast.success('Items berhasil diperbarui', { description: `Item "${values.nama_item}" telah diperbarui` })
      
      // Auto send approval if original status was APPROVED or REVISI and is_skip is false
      if ((originalStatus === 'APPROVED' || originalStatus === 'REVISI') && !values.is_skip) {
        try {
          await autoSendApproval(menuId.value, values.nama_item, approvalMessage.value)
          approvalMessage.value = '' // Clear message after sending
        } catch (approvalError) {
          // If approval fails, show error with specific reason
          const errorMessage = approvalError instanceof Error ? approvalError.message : 'Terjadi kesalahan saat mengirim approval'
          toast.error('Data berhasil disimpan tetapi gagal mengirim approval', {
            description: errorMessage,
            duration: 6000
          })
          console.error('❌ Approval send failed:', approvalError)
        }
      }
      
      // FieldSelect with :api will automatically refresh and display updated data
      // No need to manually reload - the component handles it
    } else {
      payload.created_by = userId
      payload.updated_by = userId
      console.log('✨ POST Payload:', JSON.stringify(payload, null, 2))
      await createItems(payload)
      toast.success('Items berhasil dibuat', { description: `Item \"${values.nama_item}\" telah ditambahkan` })
    }
    
    // Redirect to landing after short delay to show toast
    setTimeout(() => {
      router.replace('/inventory/m_items?reload=' + Date.now())
    }, 1000)
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Items' : 'Gagal membuat Items', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}



// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/inventory/m_items')
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
          <CardTitle>Informasi Items</CardTitle>
          <CardDescription>
            Isi data Items dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Item Field (Auto-generated, readonly) -->
            <FieldX 
              id="kode_item" 
              label="Kode Item" 
              :value="values.kode_item"
              @input="v => values.kode_item = v"
              :errorname="''"
              :hints="'Auto-generated by system'"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full"
            />

            <!-- Nama Item Field (Required) -->
            <FieldX 
              id="nama_item" 
              label="Nama Item" 
              :value="values.nama_item"
              @input="v => values.nama_item = v"
              :errorname="errors.nama_item ? 'failed' : ''"
              :hints="errors.nama_item || 'Nama lengkap item'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Paku Beton 10cm"
              class="w-full"
            />

            <!-- Nama Singkat Field (Optional) -->
            <FieldX 
              id="nama_singkat" 
              label="Nama Singkat (Opsional)" 
              :value="values.nama_singkat"
              @input="v => values.nama_singkat = v"
              :hints="'Nama singkat untuk display'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Paku 10"
              class="w-full"
            />

            <!-- Min Stock Field (Required) -->
            <FieldNumber 
              id="min_stock" 
              label="Min Stock" 
              :value="values.min_stock"
              @input="v => values.min_stock = Number(v)"
              :errorname="errors.min_stock ? 'failed' : ''"
              :hints="errors.min_stock || 'Minimum stok untuk warning'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />

            <!-- Max Stock Field (Optional) -->
            <FieldNumber 
              id="max_stock" 
              label="Max Stock (Opsional)" 
              :value="values.max_stock"
              @input="v => values.max_stock = Number(v)"
              :hints="'Maximum stok ideal'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />
                      <!-- Tipe Barang Radio Button -->

            <FieldSelect
              id="tipe_barang"
              label="Tipe Barang"
              :value="values.tipe_barang"
              @input="v => values.tipe_barang = v"
              :options="[
                { label: 'Barang Dagang', value: 'barang dagang' },
                { label: 'Barang Non Dagang', value: 'non dagang' },
                { label: 'Barang Produksi', value: 'barang produksi' }
              ]"
              displayField="label"
              valueField="value"
              :errorname="errors.tipe_barang ? 'failed' : ''"
              :hints="errors.tipe_barang || 'Pilih tipe barang'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tipe barang"
              class="w-full"
            />

          </div>



          <!-- Conditional Fields: Barang Dagang (FieldSelect with UUID Cascading) -->
          <div v-if="values.tipe_barang === 'barang dagang'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Group Jenis (Parent) -->
            <FieldSelect 
              id="group_jenis_id" 
              label="Group Jenis" 
              :value="values.group_jenis_id"
              @input="v => values.group_jenis_id = v"
              :hints="'Pilih jenis item'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              displayField="nama_jenis"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_group_jenis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_jenis',
                  filter_column_is_active: 'true',
                  no_pagination: 'true'
                }
              }"
              placeholder="Pilih jenis"
              class="w-full"
            />

            <!-- Group Merek (Child of Jenis) -->
            <FieldSelect 
              id="group_merek_id" 
              label="Group Merek" 
              :value="values.group_merek_id"
              @input="v => values.group_merek_id = v"
              :hints="values.group_jenis_id ? `Merek untuk jenis terpilih` : 'Pilih jenis terlebih dahulu'"
              :required="false"
              :disabled="loading || isReadOnly || !values.group_jenis_id"
              :readonly="isReadOnly"
              displayField="nama_merek"
              valueField="id"
              :api="values.group_jenis_id ? {
                url: `${API_BASE_URL}/dynamic/m_group_merek`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_merek',
                  filter_column_is_active: 'true',
                  filter_column_m_group_jenis_id: values.group_jenis_id,
                  no_pagination: 'true'
                }
              } : undefined"
              placeholder="Pilih merek"
              class="w-full"
            />

            <!-- Group Tipe (Child of Merek) -->
            <FieldSelect 
              id="group_tipe_id" 
              label="Group Tipe" 
              :value="values.group_tipe_id"
              @input="v => values.group_tipe_id = v"
              :hints="values.group_merek_id ? `Tipe untuk merek terpilih` : 'Pilih merek terlebih dahulu'"
              :required="false"
              :disabled="loading || isReadOnly || !values.group_merek_id"
              :readonly="isReadOnly"
              displayField="nama_tipe"
              valueField="id"
              :api="values.group_merek_id ? {
                url: `${API_BASE_URL}/dynamic/m_group_tipe`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_tipe',
                  filter_column_is_active: 'true',
                  filter_column_m_group_merek_id: values.group_merek_id,
                  no_pagination: 'true'
                }
              } : undefined"
              placeholder="Pilih tipe"
              class="w-full"
            />

            <!-- Group Ukuran (Child of Tipe) -->
            <FieldSelect 
              id="group_ukuran_id" 
              label="Group Ukuran" 
              :value="values.group_ukuran_id"
              @input="v => values.group_ukuran_id = v"
              :hints="values.group_tipe_id ? `Ukuran untuk tipe terpilih` : 'Pilih tipe terlebih dahulu'"
              :required="false"
              :disabled="loading || isReadOnly || !values.group_tipe_id"
              :readonly="isReadOnly"
              displayField="nama_ukuran"
              valueField="id"
              :api="values.group_tipe_id ? {
                url: `${API_BASE_URL}/dynamic/m_group_ukuran`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_ukuran',
                  filter_column_is_active: 'true',
                  filter_column_m_group_tipe_id: values.group_tipe_id,
                  no_pagination: 'true'
                }
              } : undefined"
              placeholder="Pilih ukuran"
              class="w-full"
            />

            <!-- Group Batch (Child of Ukuran) -->
            <FieldSelect 
              id="group_batch_id" 
              label="Group Batch" 
              :value="values.group_batch_id"
              @input="v => values.group_batch_id = v"
              :hints="values.group_ukuran_id ? `Batch untuk ukuran terpilih` : 'Pilih ukuran terlebih dahulu'"
              :required="false"
              :disabled="loading || isReadOnly || !values.group_ukuran_id"
              :readonly="isReadOnly"
              displayField="nama_batch"
              valueField="id"
              :api="values.group_ukuran_id ? {
                url: `${API_BASE_URL}/dynamic/m_group_batch`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_batch',
                  filter_column_is_active: 'true',
                  filter_column_m_group_ukuran_id: values.group_ukuran_id,
                  no_pagination: 'true'
                }
              } : undefined"
              placeholder="Pilih batch"
              class="w-full"
            />

            <!-- Satuan (FieldSelect) -->
            <FieldSelect 
              id="satuan_id" 
              label="Satuan" 
              :value="values.satuan_id"
              @input="v => values.satuan_id = v"
              :hints="'Pilih satuan dari m_general (UOM)'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,code',
                  filter_column_group: 'UOM',
                  filter_column_is_active: 'true',
                }
              }"
              placeholder="Pilih satuan"
              class="w-full"
            />

          </div>

          <!-- Conditional Fields: Non Dagang & Barang Produksi (FieldX string - manual input) -->
          <div v-if="values.tipe_barang === 'non dagang' || values.tipe_barang === 'barang produksi'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Group Jenis (FieldX) -->
            <FieldX 
              id="group_jenis" 
              label="Group Jenis" 
              :value="values.group_jenis"
              @input="v => values.group_jenis = v"
              :hints="'Input manual untuk non dagang'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: ATK"
              class="w-full"
            />

            <!-- Group Merek (FieldX) -->
            <FieldX 
              id="group_merek" 
              label="Group Merek" 
              :value="values.group_merek"
              @input="v => values.group_merek = v"
              :hints="'Input manual untuk non dagang'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Sinar Dunia"
              class="w-full"
            />

            <!-- Group Tipe (FieldX) -->
            <FieldX 
              id="group_tipe" 
              label="Group Tipe" 
              :value="values.group_tipe"
              @input="v => values.group_tipe = v"
              :hints="'Input manual untuk non dagang'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Pen"
              class="w-full"
            />

            <!-- Group Ukuran (FieldX) -->
            <FieldX 
              id="group_ukuran" 
              label="Group Ukuran" 
              :value="values.group_ukuran"
              @input="v => values.group_ukuran = v"
              :hints="'Input manual untuk non dagang'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Medium"
              class="w-full"
            />

            <!-- Group Batch (FieldX) -->
            <FieldX 
              id="group_batch" 
              label="Group Batch" 
              :value="values.group_batch"
              @input="v => values.group_batch = v"
              :hints="'Input manual untuk non dagang'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Batch A"
              class="w-full"
            />

          </div>

          <!-- Spesifikasi Field (Required, Textarea) -->
          <FieldX 
            id="spesifikasi" 
            type="textarea"
            label="Spesifikasi" 
            :value="values.spesifikasi"
            @input="v => values.spesifikasi = v"
            :errorname="errors.spesifikasi ? 'failed' : ''"
            :hints="errors.spesifikasi || 'Deskripsi lengkap item'"
            :required="!isReadOnly"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Masukkan spesifikasi item"
            :rows="4"
            class="w-full"
          />



          <!-- Multi Gambar Field (Upload with Carousel) - Available for both Barang Dagang & Non Dagang -->
          <FieldMultiUpload 
            id="m_items_images" 
            label="Gambar Item (Opsional)" 
            :value="values.m_items_images" 
            @input="v => values.m_items_images = v"
            :hints="'Upload gambar item (jpg, png, max 5MB per gambar, maksimal 10 gambar)'"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            accept="image/*"
            :maxImages="10"
            class="w-full"
          />

          <!-- Catatan Field (Required, Textarea) -->
          <FieldX 
            id="catatan" 
            type="textarea"
            label="Catatan" 
            :value="values.catatan"
            @input="v => values.catatan = v"
            :errorname="errors.catatan ? 'failed' : ''"
            :hints="errors.catatan || 'Catatan tambahan'"
            :required="!isReadOnly"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Masukkan catatan"
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

          <!-- Is Skip (untuk auto set status POST) -->
          <FieldStatus 
            label="Langsung APPROVED" 
            name="is_skip" 
            v-model="values.is_skip" 
            :disabled="loading"
            :readonly="isReadOnly" 
            active-text="APPROVED" 
            inactive-text="DRAFT"
            :hints="isSuperAdmin ? 'Super Admin selalu APPROVED (tanpa perlu mengaktifkan)' : 'Jika aktif, status akan otomatis APPROVED (melewati draft)'" 
          />

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

    <!-- ================================================================ -->
    <!-- REVISI CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isRevisiDialogOpen" @update:open="isRevisiDialogOpen = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Penyimpanan</DialogTitle>
          <DialogDescription>
            <template v-if="values.status?.toUpperCase() === 'REVISI'">
              Item ini memiliki status <span class="font-semibold text-yellow-600">REVISI</span>. 
              Perubahan yang Anda simpan akan otomatis mengirim item ini ke proses approval kembali 
              dan status akan berubah menjadi <span class="font-semibold text-blue-600">IN APPROVAL</span>.
            </template>
            <template v-else>
              Item ini memiliki status <span class="font-semibold text-green-600">APPROVED</span>. 
              Perubahan yang Anda simpan akan otomatis mengirim item ini ke proses approval kembali 
              dan status akan berubah menjadi <span class="font-semibold text-blue-600">IN APPROVAL</span>.
            </template>
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <!-- Information List -->
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Setelah menyimpan:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>Perubahan data akan tersimpan</li>
              <li>Status berubah menjadi IN APPROVAL</li>
              <li>Notifikasi approval akan terkirim otomatis</li>
            </ul>
          </div>

          <!-- Approval Message Field -->
          <div class="border-t pt-4">
            <FieldX 
              id="approval-message"
              type="textarea"
              v-model="approvalMessage"
              label="Pesan Approval"
              placeholder="Masukkan pesan untuk approval (opsional)"
              hints="Pesan ini akan dikirim ke penerima approval"
              :disabled="loading"
              :rows="3"
            />
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button 
            variant="outline"
            @click="cancelRevisiSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button 
            variant="default"
            @click="confirmRevisiSave"
            :disabled="loading"
            class="gap-2"
          >
            <Save class="h-4 w-4" />
            <span>{{ loading ? 'Menyimpan...' : 'Simpan & Kirim Approval' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isSuperAdminDialogOpen" @update:open="isSuperAdminDialogOpen = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <span>Akses Super Admin</span>
          </DialogTitle>
          <DialogDescription class="pt-2">
            Anda login sebagai <span class="font-semibold text-green-600">SUPER ADMIN</span>. 
            Dengan hak akses ini, transaksi yang Anda simpan akan langsung berstatus 
            <span class="font-semibold text-green-600">APPROVED</span> tanpa melalui proses approval.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <!-- Information Box -->
          <div class="rounded-lg bg-green-50 p-4 space-y-3">
            <div class="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="space-y-2 text-sm text-green-800">
                <p class="font-medium">Privilege Super Admin:</p>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li>Status otomatis: <strong>APPROVED</strong></li>
                  <li>Tidak memerlukan proses approval</li>
                  <li>Tidak perlu mengaktifkan switch "Langsung APPROVED"</li>
                  <li>Data langsung tersimpan dan siap digunakan</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Warning Note -->
          <div class="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3 py-2">
            <p class="font-medium text-amber-700">Catatan:</p>
            <p>Pastikan data yang Anda input sudah benar karena akan langsung approved dan dapat digunakan dalam sistem.</p>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button 
            variant="outline"
            @click="cancelSuperAdminSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button 
            variant="default"
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save class="h-4 w-4" />
            <span>{{ loading ? 'Menyimpan...' : 'Simpan sebagai APPROVED' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}
</style>
