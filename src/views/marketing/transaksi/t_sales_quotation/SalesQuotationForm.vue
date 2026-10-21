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
import { FieldX, FieldNumber, FieldStatus, FieldDate, FieldTextarea, FieldPopup, FieldSelect, FieldUpload } from '@/components/field'
import { ButtonMultiSelect } from '@/components/button'
import { DeleteButton } from '@/components/button'
import { Trash2 } from 'lucide-vue-next'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createSalesQuotation,
  updateSalesQuotation,
  getSalesQuotationById,
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
const isEditMode = computed(() => !!route.params.id && route.name === 'SalesQuotationForm')
const isViewMode = computed(() => route.name === 'SalesQuotationView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

// Company options
const companyOptions = ref<{ value: string; label: string }[]>([])

// Sales options
const salesOptions = ref<{ value: string; label: string }[]>([])

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Sales Quotation'
  if (isCopyMode.value) return 'Salin Sales Quotation'
  if (isEditMode.value) return 'Edit Sales Quotation'
  return 'Tambah Sales Quotation Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Sales Quotation'
  if (isCopyMode.value) return 'Buat Sales Quotation baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Sales Quotation'
  return 'Buat Sales Quotation baru'
})

// Form values - Sales Quotation Fields
let values = reactive({
  transaction_type: 'Jual', // Jual or Rental
  company_id: '',
  company_name: '',
  no_sq: '',
  status: 'DRAFT',
  tanggal_sq: new Date().toISOString().split('T')[0],
  customer_id: '',
  customer_name: '',
  top: '',
  ship_to_id: '',
  ship_to_name: '',
  ppn_type: 'EXCLUDE', // EXCLUDE or INCLUDE
  ppn_percentage: 11,
  change_default: false,
  alamat: '',
  attachment: '',
  sales_id: '',
  sales_name: '',
  dp_percentage: 0,
  dp_amount: 0,
  catatan: '',
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
    kode: '',
    nama_item: '',
    satuan: '',
    qty: 0,
    harga: 0,
    disc_percentage: 0,
    disc_amount: 0,
    total_diskon: 0,
    total: 0,
    catatan_detail: '',
    is_active: true,
  })
}

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail dihapus')
}

// ============================================================================
// CALCULATION METHODS
// ============================================================================
const calculateDetailTotal = (detail: any) => {
  const subtotal = (detail.qty || 0) * (detail.harga || 0)
  const discFromPercentage = subtotal * ((detail.disc_percentage || 0) / 100)
  const totalDiskon = discFromPercentage + (detail.disc_amount || 0)
  detail.total_diskon = totalDiskon
  detail.total = subtotal - totalDiskon
}

const calculateGrandTotal = () => {
  return detailArr.value.reduce((sum, detail) => sum + (detail.total || 0), 0)
}

const calculateTotalDiskon = () => {
  return detailArr.value.reduce((sum, detail) => sum + (detail.total_diskon || 0), 0)
}

const calculatePPN = () => {
  const total = calculateGrandTotal()
  if (values.ppn_type === 'EXCLUDE') {
    return total * (values.ppn_percentage / 100)
  }
  return 0
}

const calculateGrandTotalWithPPN = () => {
  const total = calculateGrandTotal()
  const ppn = calculatePPN()
  return total + ppn
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    transaction_type: 'Jual',
    company_id: '',
    company_name: '',
    no_sq: '',
    status: 'DRAFT',
    tanggal_sq: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    top: '',
    ship_to_id: '',
    ship_to_name: '',
    ppn_type: 'EXCLUDE',
    ppn_percentage: 11,
    change_default: false,
    alamat: '',
    attachment: '',
    sales_id: '',
    sales_name: '',
    dp_percentage: 0,
    dp_amount: 0,
    catatan: '',
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
  
  // Load company options
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_company?filter_column_is_active=true`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    const res = await response.json()
    if (res.status === 'success' && res.data) {
      companyOptions.value = res.data.map((c: any) => ({
        value: c.id,
        label: c.name
      }))
    }
  } catch (error) {
    console.error('Failed to load unit bisnis options:', error)
  }
  
  // Load sales options
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_employee?filter_column_is_active=true`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    const res = await response.json()
    if (res.status === 'success' && res.data) {
      salesOptions.value = res.data.map((s: any) => ({
        value: s.id,
        label: s.name
      }))
    }
  } catch (error) {
    console.error('Failed to load sales options:', error)
  }
  
  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }
  
  loading.value = true
  try {
    const res = await getSalesQuotationById(sourceId)
    
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
    
    if (initialValues.t_sales_quotation_details) {
      detailArr.value = initialValues.t_sales_quotation_details
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
        description: 'Silakan edit dan simpan sebagai Sales Quotation baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Sales Quotation', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/marketing/transaksi/t_sales_quotation')
      }
    })
    setTimeout(() => router.push('/marketing/transaksi/t_sales_quotation'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object (manual validation) - Sales Quotation Fields
const errors = reactive({
  transaction_type: '',
  company_id: '',
  no_sq: '',
  status: '',
  tanggal_sq: '',
  customer_id: '',
  top: '',
  ship_to_id: '',
  ppn_type: '',
  ppn_percentage: '',
  sales_id: '',
  dp_percentage: '',
  catatan: ''
})

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.company_id) { errors.company_id = 'Unit bisnis wajib diisi'; invalid = true }
  if (!values.tanggal_sq) { errors.tanggal_sq = 'Tanggal SQ wajib diisi'; invalid = true }
  if (!values.customer_id) { errors.customer_id = 'Customer wajib diisi'; invalid = true }
  if (!values.top) { errors.top = 'ToP wajib diisi'; invalid = true }
  if (!values.ship_to_id) { errors.ship_to_id = 'Ship To wajib diisi'; invalid = true }
  if (!values.ppn_type) { errors.ppn_type = 'PPN Type wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    // Clean payload
    const payload: any = {
      transaction_type: values.transaction_type,
      company_id: values.company_id || null,
      no_sq: values.no_sq || null,
      status: values.status,
      tanggal_sq: values.tanggal_sq || null,
      customer_id: values.customer_id || null,
      top: values.top || null,
      ship_to_id: values.ship_to_id || null,
      ppn_type: values.ppn_type,
      ppn_percentage: values.ppn_percentage,
      change_default: values.change_default,
      alamat: values.alamat?.trim() || null,
      attachment: values.attachment || null,
      sales_id: values.sales_id || null,
      dp_percentage: values.dp_percentage,
      dp_amount: values.dp_amount,
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      // Detail fields - DYNAMIC
      t_sales_quotation_details: detailArr.value,
    }
    
    if (isEditMode.value) {
      await updateSalesQuotation(menuId.value, payload as any)
      toast.success('Sales Quotation berhasil diperbarui', { description: `Sales Quotation No "${values.no_sq}" telah diperbarui` })
    } else {
      await createSalesQuotation(payload as any)
      toast.success('Sales Quotation berhasil dibuat', { description: `Sales Quotation No "${values.no_sq}" telah ditambahkan` })
    }
    router.replace('/marketing/transaksi/t_sales_quotation?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Sales Quotation' : 'Gagal membuat Sales Quotation', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/marketing/transaksi/t_sales_quotation')
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
          <CardTitle>Informasi Sales Quotation</CardTitle>
          <CardDescription>
            Isi data TSalesQuotation dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Transaction Type Radio Buttons -->
          <div class="space-y-2">
            <label class="text-sm font-medium">Tipe Transaksi</label>
            <div class="flex gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="Jual" 
                  v-model="values.transaction_type" 
                  :disabled="loading || isReadOnly"
                  class="w-4 h-4"
                />
                <span class="text-sm">Jual</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="Rental" 
                  v-model="values.transaction_type" 
                  :disabled="loading || isReadOnly"
                  class="w-4 h-4"
                />
                <span class="text-sm">Rental</span>
              </label>
            </div>
          </div>

          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Company Field -->
            <FieldSelect
              id="company_id"
              label="Unit Bisnis"
              :value="values.company_id"
              @update:value="(v: string) => {
                values.company_id = v
                const company = companyOptions.find((c: any) => c.value === v)
                values.company_name = company?.label || ''
              }"
              :errorname="errors.company_id ? 'failed' : ''"
              :hints="errors.company_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="true"
              :options="companyOptions"
              placeholder="Pilih Unit Bisnis"
              class="w-full"
            />

            <!-- Status Field -->
            <FieldSelect
              id="status"
              label="Status"
              :value="values.status"
              @update:value="(v: string) => values.status = v"
              :errorname="errors.status ? 'failed' : ''"
              :hints="errors.status"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="true"
              :options="[
                { value: 'DRAFT', label: 'DRAFT' },
                { value: 'PENDING', label: 'PENDING' },
                { value: 'APPROVED', label: 'APPROVED' },
                { value: 'REJECTED', label: 'REJECTED' }
              ]"
              placeholder="Pilih Status"
              class="w-full"
            />

            <!-- No. SQ Field -->
            <FieldX 
              id="no_sq" 
              label="No. SQ" 
              :value="values.no_sq" 
              :errorname="errors.no_sq ? 'failed' : ''"
              @input="v => values.no_sq = v" 
              :hints="errors.no_sq || 'Auto-generated jika kosong'" 
              :required="false"
              :disabled="loading || isReadOnly" 
              :readonly="true" 
              placeholder="SQ-XXXX-XXXX" 
              class="w-full" 
            />

            <!-- Tanggal SQ Field -->
            <FieldDate
              id="tanggal_sq"
              label="Tanggal SQ"
              :value="values.tanggal_sq"
              @update:value="(v: string) => values.tanggal_sq = v"
              :errorname="errors.tanggal_sq ? 'failed' : ''"
              :hints="errors.tanggal_sq"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="true"
              placeholder="Pilih Tanggal"
              class="w-full"
            />

            <!-- Customer Field -->
            <FieldPopup 
              id="customer_id" 
              label="Customer" 
              :value="values.customer_id"
              :display-value="values.customer_name"
              :errorname="errors.customer_id ? 'failed' : ''"
              @update:value="(v: any) => {
                values.customer_id = v?.id || ''
                values.customer_name = v?.name || ''
              }"
              :hints="errors.customer_id" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_customer`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'name,code',
                  filter_column_is_active: true
                }
              }"
              :columns="[
                { field: 'code', headerName: 'Code', width: '150px' },
                { field: 'name', headerName: 'Name', flex: 1 }
              ]"
              display-field="name"
              placeholder="Pilih Customer"
              class="w-full" 
            />

            <!-- ToP (Terms of Payment) Field -->
            <FieldSelect
              id="top"
              label="ToP"
              :value="values.top"
              @update:value="(v: string) => values.top = v"
              :errorname="errors.top ? 'failed' : ''"
              :hints="errors.top"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :options="[
                { value: '7', label: '7 Hari' },
                { value: '14', label: '14 Hari' },
                { value: '30', label: '30 Hari' },
                { value: '45', label: '45 Hari' },
                { value: '60', label: '60 Hari' }
              ]"
              placeholder="Pilih ToP"
              class="w-full"
            />

            <!-- Ship To Field -->
            <FieldPopup 
              id="ship_to_id" 
              label="Ship To" 
              :value="values.ship_to_id"
              :display-value="values.ship_to_name"
              :errorname="errors.ship_to_id ? 'failed' : ''"
              @update:value="(v: any) => {
                values.ship_to_id = v?.id || ''
                values.ship_to_name = v?.name || ''
              }"
              :hints="errors.ship_to_id" 
              :required="!isReadOnly"
              :disabled="loading || isReadOnly" 
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_ship_to`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'name',
                  filter_column_is_active: true
                }
              }"
              :columns="[
                { field: 'name', headerName: 'Name', flex: 1 }
              ]"
              display-field="name"
              placeholder="Pilih Penerima"
              class="w-full" 
            />

            <!-- PPN Type and Percentage -->
            <div class="grid grid-cols-2 gap-3">
              <FieldSelect
                id="ppn_type"
                label="PPN"
                :value="values.ppn_type"
                @update:value="(v: string) => values.ppn_type = v"
                :errorname="errors.ppn_type ? 'failed' : ''"
                :hints="errors.ppn_type"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :options="[
                  { value: 'EXCLUDE', label: 'EXCLUDE' },
                  { value: 'INCLUDE', label: 'INCLUDE' }
                ]"
                placeholder="PPN Type"
                class="w-full"
              />
              <FieldNumber
                id="ppn_percentage"
                label="PPN %"
                :value="values.ppn_percentage"
                @update:value="(v: number) => values.ppn_percentage = v"
                :errorname="errors.ppn_percentage ? 'failed' : ''"
                :hints="errors.ppn_percentage"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="true"
                placeholder="11"
                suffix="%"
                class="w-full"
              />
            </div>
          </div>

          <!-- Change Default Checkbox -->
          <div class="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="change_default"
              v-model="values.change_default" 
              :disabled="loading || isReadOnly"
              class="w-4 h-4"
            />
            <label for="change_default" class="text-sm font-medium cursor-pointer">
              Change Default
            </label>
          </div>

          <!-- Alamat -->
          <FieldTextarea
            id="alamat"
            label="Alamat"
            :value="values.alamat"
            @input="(v: string) => values.alamat = v"
            :disabled="loading || isReadOnly"
            :readonly="true"
            placeholder="Alamat otomatis dari Customer/Ship To"
            :rows="3"
            class="w-full"
          />

          <!-- Grid for Attachment, Sales, DP, Catatan -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Attachment -->
            <FieldUpload
              id="attachment"
              label="Attachment"
              :value="values.attachment"
              @update:value="(v: string) => values.attachment = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              placeholder="Choose File"
              class="w-full"
            />

            <!-- Sales Field -->
            <FieldSelect
              id="sales_id"
              label="Sales"
              :value="values.sales_id"
              @update:value="(v: string) => {
                values.sales_id = v
                const sales = salesOptions.find((s: any) => s.value === v)
                values.sales_name = sales?.label || ''
              }"
              :errorname="errors.sales_id ? 'failed' : ''"
              :hints="errors.sales_id"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="true"
              :options="salesOptions"
              placeholder="Pilih Sales"
              class="w-full"
            />

            <!-- DP Percentage and Amount -->
            <div class="grid grid-cols-2 gap-3">
              <FieldNumber
                id="dp_percentage"
                label="DP"
                :value="values.dp_percentage"
                @update:value="(v: number) => {
                  values.dp_percentage = v
                  // Calculate dp_amount based on total (you'll need to compute this)
                }"
                :errorname="errors.dp_percentage ? 'failed' : ''"
                :hints="errors.dp_percentage"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="0"
                suffix="%"
                class="w-full"
              />
              <FieldNumber
                id="dp_amount"
                label="DP Amount"
                :value="values.dp_amount"
                @update:value="(v: number) => values.dp_amount = v"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="0.0"
                :format="true"
                prefix="Rp"
                class="w-full"
              />
            </div>

            <!-- Catatan -->
            <FieldTextarea
              id="catatan"
              label="Catatan"
              :value="values.catatan"
              @input="(v: string) => values.catatan = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan catatan"
              :rows="3"
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

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
                    <TabsTrigger value="detail1">Detail 1</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->
        
        <!-- TAB CONTENT: DETAIL 1 (MULTI-SELECT) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Quotation Detail</CardTitle>
                  <CardDescription>Kelola item detail sales quotation</CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  @click="addDetailArr"
                  class="gap-2"
                  :disabled="loading"
                >
                  + Add to List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Item</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Satuan</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Qty</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Harga</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Disc. %</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Disc. Amt.</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Total Diskon</th>
                      <th class="px-3 py-2 text-right font-medium text-xs sm:text-sm">Total</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan Detail</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td colspan="12" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada item. Klik "Add to List" untuk menambahkan.
                      </td>
                    </tr>
                    <tr v-for="(detail, idx) in detailArr" :key="detail.id || idx" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model="detail.kode" 
                          type="text" 
                          class="w-24 px-2 py-1 border rounded text-xs"
                          :disabled="loading"
                        />
                        <span v-else>{{ detail.kode }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model="detail.nama_item" 
                          type="text" 
                          class="w-40 px-2 py-1 border rounded text-xs"
                          :disabled="loading"
                        />
                        <span v-else>{{ detail.nama_item }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model="detail.satuan" 
                          type="text" 
                          class="w-20 px-2 py-1 border rounded text-xs"
                          :disabled="loading"
                        />
                        <span v-else>{{ detail.satuan }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model.number="detail.qty" 
                          type="number" 
                          class="w-20 px-2 py-1 border rounded text-xs text-right"
                          :disabled="loading"
                          @input="calculateDetailTotal(detail)"
                        />
                        <span v-else>{{ detail.qty }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model.number="detail.harga" 
                          type="number" 
                          class="w-28 px-2 py-1 border rounded text-xs text-right"
                          :disabled="loading"
                          @input="calculateDetailTotal(detail)"
                        />
                        <span v-else>{{ detail.harga?.toLocaleString('id-ID') }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model.number="detail.disc_percentage" 
                          type="number" 
                          class="w-16 px-2 py-1 border rounded text-xs text-right"
                          :disabled="loading"
                          @input="calculateDetailTotal(detail)"
                        />
                        <span v-else>{{ detail.disc_percentage }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model.number="detail.disc_amount" 
                          type="number" 
                          class="w-24 px-2 py-1 border rounded text-xs text-right"
                          :disabled="loading"
                          @input="calculateDetailTotal(detail)"
                        />
                        <span v-else>{{ detail.disc_amount?.toLocaleString('id-ID') }}</span>
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm">
                        {{ detail.total_diskon?.toLocaleString('id-ID') || 0 }}
                      </td>
                      <td class="px-3 py-2 text-right text-xs sm:text-sm font-medium">
                        {{ detail.total?.toLocaleString('id-ID') || 0 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input 
                          v-if="!isReadOnly"
                          v-model="detail.catatan_detail" 
                          type="text" 
                          class="w-32 px-2 py-1 border rounded text-xs"
                          :disabled="loading"
                        />
                        <span v-else>{{ detail.catatan_detail }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                  <tfoot class="border-t bg-muted/30">
                    <tr>
                      <td colspan="9" class="px-3 py-2 text-right font-medium text-sm">Total</td>
                      <td class="px-3 py-2 text-right font-bold text-sm">
                        {{ calculateGrandTotal().toLocaleString('id-ID') }}
                      </td>
                      <td colspan="2"></td>
                    </tr>
                    <tr>
                      <td colspan="9" class="px-3 py-2 text-right font-medium text-sm">Total Diskon</td>
                      <td class="px-3 py-2 text-right font-bold text-sm">
                        {{ calculateTotalDiskon().toLocaleString('id-ID') }}
                      </td>
                      <td colspan="2"></td>
                    </tr>
                    <tr>
                      <td colspan="9" class="px-3 py-2 text-right font-medium text-sm">Total PPN ({{ values.ppn_percentage }}%)</td>
                      <td class="px-3 py-2 text-right font-bold text-sm">
                        {{ calculatePPN().toLocaleString('id-ID') }}
                      </td>
                      <td colspan="2"></td>
                    </tr>
                    <tr class="bg-muted">
                      <td colspan="9" class="px-3 py-2 text-right font-bold text-base">Grand Total</td>
                      <td class="px-3 py-2 text-right font-bold text-base">
                        {{ calculateGrandTotalWithPPN().toLocaleString('id-ID') }}
                      </td>
                      <td colspan="2"></td>
                    </tr>
                  </tfoot>
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