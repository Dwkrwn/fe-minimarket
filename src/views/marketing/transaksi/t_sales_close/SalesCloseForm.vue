<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Loader2, Plus, Trash2, Send } from 'lucide-vue-next'
import { useRouter as useVueRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { FieldX, FieldStatus } from '@/components/field'
import {
  createSalesClose,
  updateSalesClose,
  getSalesCloseById,
  type SalesCloseItem
} from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()

// ============================================================================
// MODE COMPUTED
// ============================================================================
const isEditMode = computed(() => !!route.params.id && route.name === 'SalesCloseForm')
const isViewMode = computed(() => route.name === 'SalesCloseView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Sales Order Closing'
  if (isCopyMode.value) return 'Salin Sales Order Closing'
  if (isEditMode.value) return 'Edit Sales Order Closing'
  return 'Tambah Sales Order Closing'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Sales Order Closing'
  if (isCopyMode.value) return 'Buat Sales Order Closing baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Sales Order Closing'
  return 'Buat data Sales Order Closing baru'
})

// ============================================================================
// DOCUMENT STATUS
// ============================================================================
type DocStatus = 'DRAFT' | 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED'
const docStatus = ref<DocStatus>('DRAFT')

const statusConfig: Record<DocStatus, { label: string; class: string }> = {
  DRAFT: { label: 'DRAFT', class: 'bg-gray-100 text-gray-600 border-gray-300' },
  WAITING_APPROVAL: { label: 'WAITING APPROVAL', class: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  APPROVED: { label: 'APPROVED', class: 'bg-green-100 text-green-700 border-green-300' },
  REJECTED: { label: 'REJECTED', class: 'bg-red-100 text-red-700 border-red-300' }
}

// ============================================================================
// FORM STATE — HEADER
// ============================================================================
const loading = ref(false)

const values = reactive({
  unit_bisnis: '',
  tanggal_so_closing: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  no_so_closing: '',
  no_so: '',
  customer: '',
  alasan: '',
  catatan: '',
  is_active: true
})

const errors = reactive({
  unit_bisnis: '',
  no_so: '',
  alasan: '',
  tanggal_so_closing: '',
  no_so_closing: '',
  customer: '',
  catatan: ''
})

// ============================================================================
// DETAIL TABLE STATE
// ============================================================================
interface DetailRow {
  id: string
  kode: string
  nama_item: string
  qty_so: number | ''
  qty_reservasi: number | ''
  qty_sj: number | ''
  qty_os: number | ''
  qty_closing: number | ''
  uom: string
  catatan: string
}

const detailRows = ref<DetailRow[]>([
  {
    id: crypto.randomUUID(),
    kode: 'ITEM-0001',
    nama_item: 'SET L S304',
    qty_so: 100,
    qty_reservasi: 90,
    qty_sj: 90,
    qty_os: 10,
    qty_closing: 10,
    uom: 'PCS',
    catatan: ''
  },
  {
    id: crypto.randomUUID(),
    kode: 'ITEM-0002',
    nama_item: 'NUT NYLON SS304',
    qty_so: 100,
    qty_reservasi: 85,
    qty_sj: 85,
    qty_os: 15,
    qty_closing: 15,
    uom: 'PCS',
    catatan: ''
  }
])

// ============================================================================
// DETAIL TABLE METHODS
// ============================================================================
const addDetailRow = () => {
  detailRows.value.push({
    id: crypto.randomUUID(),
    kode: '',
    nama_item: '',
    qty_so: '',
    qty_reservasi: '',
    qty_sj: '',
    qty_os: '',
    qty_closing: '',
    uom: 'PCS',
    catatan: ''
  })
}

const removeDetailRow = (id: string) => {
  detailRows.value = detailRows.value.filter(row => row.id !== id)
}

// ============================================================================
// RESET FORM
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    unit_bisnis: '',
    tanggal_so_closing: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    no_so_closing: '',
    no_so: '',
    customer: '',
    alasan: '',
    catatan: '',
    is_active: true
  })
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  detailRows.value = []
  docStatus.value = 'DRAFT'
}

// ============================================================================
// LOAD DATA (EDIT / VIEW / COPY)
// ============================================================================
onBeforeMount(async () => {
  onReset()

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return

  loading.value = true
  try {
    const res = await getSalesCloseById(sourceId)
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    const raw = res.data

    if (raw.is_active !== undefined) {
      const v = raw.is_active as unknown
      raw.is_active = (v === true || v === 1 || v === '1')
    } else {
      raw.is_active = true
    }

    if (isCopyModeLocal) {
      delete (raw as Partial<SalesCloseItem>).id
      delete (raw as Partial<SalesCloseItem>).createdAt
      delete (raw as Partial<SalesCloseItem>).updatedAt
    }

    for (const key in raw) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore
        values[key] = raw[key]
      }
    }

    if (raw.status) docStatus.value = raw.status as DocStatus
    if (raw.details) detailRows.value = raw.details as unknown as DetailRow[]

    toast.success(isCopyModeLocal ? 'Data berhasil disalin' : 'Data berhasil dimuat')
  } catch (error) {
    toast.error('Gagal memuat data Sales Order Closing', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    setTimeout(() => router.push('/marketing/transaksi/t_sales_close'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// VALIDATE
// ============================================================================
const validate = (): boolean => {
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false
  if (!values.no_so?.trim()) { errors.no_so = 'No. SO wajib diisi'; invalid = true }
  if (!values.alasan?.trim()) { errors.alasan = 'Alasan wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
  }
  return !invalid
}

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  if (!validate()) return

  loading.value = true
  try {
    const payload = {
      unit_bisnis: values.unit_bisnis?.trim() || null,
      tanggal_so_closing: values.tanggal_so_closing || null,
      no_so_closing: values.no_so_closing?.trim() || null,
      no_so: values.no_so?.trim() || null,
      customer: values.customer?.trim() || null,
      alasan: values.alasan?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      details: detailRows.value
    }

    if (isEditMode.value) {
      await updateSalesClose(menuId.value, payload as any)
      toast.success('Sales Order Closing berhasil diperbarui')
    } else {
      await createSalesClose(payload as any)
      toast.success('Sales Order Closing berhasil dibuat')
    }
    router.replace('/marketing/transaksi/t_sales_close?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui' : 'Gagal membuat Sales Order Closing', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// SEND APPROVAL
// ============================================================================
const onSendApproval = async () => {
  if (!validate()) return
  toast.info('Mengirim untuk approval...', { description: 'Fitur Send Approval sedang diproses' })
  docStatus.value = 'WAITING_APPROVAL'
}

// ============================================================================
// CANCEL
// ============================================================================
const handleCancel = () => {
  router.push('/marketing/transaksi/t_sales_close')
}

// ============================================================================
// CREATED BY INFO
// ============================================================================
const createdBy = computed(() => {
  const user = authStore?.user?.name || 'admin'
  const now = new Date()
  return `Created By ${user} On ${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US')}`
})
</script>

<template>
  <div class="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">

    <!-- ================================================================ -->
    <!-- HEADER -->
    <!-- ================================================================ -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="handleCancel" class="shrink-0">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="flex-1 min-w-0">
        <h1 class="text-xl md:text-2xl font-bold text-foreground leading-tight">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground mt-0.5">{{ pageDescription }}</p>
      </div>
      <!-- Status Badge -->
      <span
        :class="['px-3 py-1 rounded text-xs font-semibold border tracking-wide shrink-0', statusConfig[docStatus].class]"
      >
        {{ statusConfig[docStatus].label }}
      </span>
    </div>

    <!-- ================================================================ -->
    <!-- MAIN FORM CARD -->
    <!-- ================================================================ -->
    <form @submit.prevent class="space-y-5">
      <Card class="shadow-sm">
        <CardContent class="pt-5 pb-5">

          <!-- Grid Header Fields: 3 columns -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">

            <!-- Unit Bisnis -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">Unit Bisnis</label>
              <div class="relative">
                <select
                  v-model="values.unit_bisnis"
                  :disabled="loading || isReadOnly"
                  class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-8"
                >
                  <option value="">Pilih Unit Bisnis</option>
                  <option value="Raden Saleh">Raden Saleh</option>
                  <option value="Pusat">Pusat</option>
                </select>
                <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>

            <!-- Tanggal SO Closing -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">Tanggal SO Closing</label>
              <div class="relative">
                <input
                  v-model="values.tanggal_so_closing"
                  type="text"
                  :disabled="loading || isReadOnly"
                  placeholder="DD/MM/YYYY"
                  class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-9"
                />
                <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </div>
            </div>

            <!-- No. SO Closing -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">No. SO Closing</label>
              <input
                v-model="values.no_so_closing"
                type="text"
                :disabled="loading || isReadOnly"
                placeholder="SOC-260116-0005"
                class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <!-- No. SO (required) -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">
                No. SO
                <span v-if="!isReadOnly" class="text-destructive ml-0.5">*</span>
              </label>
              <div class="relative">
                <input
                  v-model="values.no_so"
                  type="text"
                  :disabled="loading || isReadOnly"
                  placeholder="SO-260101-0001"
                  :class="[
                    'w-full h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 pr-9',
                    errors.no_so ? 'border-destructive focus:ring-destructive' : 'border-input focus:ring-ring',
                    (loading || isReadOnly) && 'cursor-not-allowed opacity-50'
                  ]"
                />
                <!-- Search icon -->
                <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                </button>
              </div>
              <p v-if="errors.no_so" class="text-xs text-destructive">{{ errors.no_so }}</p>
            </div>

            <!-- Customer -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">Customer</label>
              <div class="relative">
                <input
                  v-model="values.customer"
                  type="text"
                  :disabled="loading || isReadOnly"
                  placeholder="Customer A"
                  class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-9"
                />
                <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                </button>
              </div>
            </div>

            <!-- Alasan (required) -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-foreground">
                Alasan
                <span v-if="!isReadOnly" class="text-destructive ml-0.5">*</span>
              </label>
              <div class="relative">
                <select
                  v-model="values.alasan"
                  :disabled="loading || isReadOnly"
                  :class="[
                    'w-full h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 appearance-none pr-8',
                    errors.alasan ? 'border-destructive focus:ring-destructive' : 'border-input focus:ring-ring',
                    (loading || isReadOnly) && 'cursor-not-allowed opacity-50'
                  ]"
                >
                  <option value="">Pilih Alasan</option>
                  <option value="Sold Out">Sold Out</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Customer Request">Customer Request</option>
                  <option value="Other">Other</option>
                </select>
                <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <p v-if="errors.alasan" class="text-xs text-destructive">{{ errors.alasan }}</p>
            </div>

            <!-- Catatan (spans full width) -->
            <div class="flex flex-col gap-1.5 md:col-span-3">
              <label class="text-sm font-medium text-foreground">Catatan</label>
              <textarea
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                placeholder="Catatan"
                rows="3"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL TABLE CARD -->
      <!-- ================================================================ -->
      <Card class="shadow-sm">
        <CardHeader class="pb-3 pt-5">
          <CardTitle class="text-base font-semibold">Detail Sales Order Closing</CardTitle>
        </CardHeader>
        <CardContent class="pt-0 pb-5">

          <!-- Add to List button -->
          <div class="mb-3" v-if="!isReadOnly">
            <Button
              type="button"
              size="sm"
              class="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              @click="addDetailRow"
              :disabled="loading"
            >
              <Plus class="h-4 w-4" />
              Add to List
            </Button>
          </div>

          <!-- Table Wrapper -->
          <div class="rounded-md border overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-muted/40">
                  <th class="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">No</th>
                  <th class="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[110px]">Kode</th>
                  <th class="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[160px]">Nama Item</th>
                  <th class="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[80px]">Qty SO</th>
                  <th class="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[100px]">Qty Reservasi</th>
                  <th class="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[80px]">Qty SJ</th>
                  <th class="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[80px]">Qty O/S</th>
                  <th class="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[100px]">Qty Closing</th>
                  <th class="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[80px]">UoM</th>
                  <th class="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[140px]">Catatan</th>
                  <th v-if="!isReadOnly" class="px-3 py-2.5 w-10"></th>
                </tr>
                <!-- Column filter row -->
                <tr class="border-b bg-background">
                  <td class="px-3 py-1.5"></td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td class="px-2 py-1.5">
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
                    </div>
                  </td>
                  <td v-if="!isReadOnly" class="px-2 py-1.5"></td>
                </tr>
              </thead>
              <tbody>
                <!-- Empty state -->
                <tr v-if="detailRows.length === 0">
                  <td :colspan="isReadOnly ? 10 : 11" class="px-4 py-8 text-center text-sm text-muted-foreground">
                    Belum ada item. Klik "+ Add to List" untuk menambahkan.
                  </td>
                </tr>

                <!-- Data rows -->
                <tr
                  v-for="(row, index) in detailRows"
                  :key="row.id"
                  class="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <!-- No -->
                  <td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>

                  <!-- Kode -->
                  <td class="px-2 py-2">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.kode"
                      type="text"
                      placeholder="ITEM-000X"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.kode }}</span>
                  </td>

                  <!-- Nama Item -->
                  <td class="px-2 py-2">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.nama_item"
                      type="text"
                      placeholder="Nama item"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.nama_item }}</span>
                  </td>

                  <!-- Qty SO -->
                  <td class="px-2 py-2 text-right">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.qty_so"
                      type="number"
                      placeholder="0"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.qty_so }}</span>
                  </td>

                  <!-- Qty Reservasi -->
                  <td class="px-2 py-2 text-right">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.qty_reservasi"
                      type="number"
                      placeholder="0"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.qty_reservasi }}</span>
                  </td>

                  <!-- Qty SJ -->
                  <td class="px-2 py-2 text-right">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.qty_sj"
                      type="number"
                      placeholder="0"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.qty_sj }}</span>
                  </td>

                  <!-- Qty O/S -->
                  <td class="px-2 py-2 text-right">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.qty_os"
                      type="number"
                      placeholder="0"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.qty_os }}</span>
                  </td>

                  <!-- Qty Closing -->
                  <td class="px-2 py-2 text-right">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.qty_closing"
                      type="number"
                      placeholder="0"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.qty_closing }}</span>
                  </td>

                  <!-- UoM -->
                  <td class="px-2 py-2">
                    <div class="relative" v-if="!isReadOnly">
                      <select
                        v-model="row.uom"
                        class="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring appearance-none pr-5"
                      >
                        <option value="PCS">PCS</option>
                        <option value="KG">KG</option>
                        <option value="BOX">BOX</option>
                        <option value="SET">SET</option>
                      </select>
                      <svg class="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <span v-else class="text-sm">{{ row.uom }}</span>
                  </td>

                  <!-- Catatan -->
                  <td class="px-2 py-2">
                    <input
                      v-if="!isReadOnly"
                      v-model="row.catatan"
                      type="text"
                      placeholder="Catatan"
                      class="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span v-else class="text-sm">{{ row.catatan || '-' }}</span>
                  </td>

                  <!-- Delete -->
                  <td v-if="!isReadOnly" class="px-2 py-2">
                    <button
                      type="button"
                      @click="removeDetailRow(row.id)"
                      class="text-destructive hover:text-destructive/80 transition-colors p-1 rounded hover:bg-destructive/10"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- FOOTER / ACTION BAR -->
      <!-- ================================================================ -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3.5 shadow-sm">
        <!-- Created by info -->
        <p class="text-xs text-muted-foreground">{{ createdBy }}</p>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <!-- Batal -->
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
            :disabled="loading"
            class="h-9"
          >
            {{ isReadOnly ? 'Kembali' : 'Batal' }}
          </Button>

          <!-- Simpan -->
          <Button
            v-if="!isReadOnly"
            type="button"
            variant="default"
            @click="onSave"
            :disabled="loading"
            class="h-9 gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            Simpan
          </Button>

          <!-- Send Approval -->
          <Button
            v-if="!isReadOnly"
            type="button"
            @click="onSendApproval"
            :disabled="loading"
            class="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Send class="h-4 w-4" />
            Send Approval
          </Button>
        </div>
      </div>

    </form>
  </div>
</template>

<style scoped>
/* Ensure number inputs hide spin buttons for cleaner look */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
