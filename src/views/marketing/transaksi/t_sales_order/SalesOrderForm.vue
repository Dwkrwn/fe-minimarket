<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FieldStatus } from '@/components/field'
import { createSalesOrder, updateSalesOrder, getSalesOrderById } from './service'
import { ArrowLeft, Save, Loader2, Search, Plus, Star, Trash2, SendHorizonal } from 'lucide-vue-next'
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
const isEditMode = computed(() => !!route.params.id && route.name === 'SalesOrderForm')
const isViewMode = computed(() => route.name === 'SalesOrderView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Sales Order'
  if (isCopyMode.value) return 'Salin Sales Order'
  if (isEditMode.value) return 'Edit Sales Order'
  return 'Tambah Sales Order'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Sales Order'
  if (isCopyMode.value) return 'Buat Sales Order baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Sales Order'
  return 'Buat data Sales Order baru'
})

// ============================================================================
// FORM VALUES
// ============================================================================
const values = reactive({
  unit_bisnis: '',
  tanggal_so: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
  no_so: '',
  no_sq: '',
  customer: '',
  alamat_kirim: '',
  tipe_ppn: '',
  ppn_persen: 11,
  ppn_value: 0,
  top: '',
  cara_bayar: '',
  dp_persen: 0,
  dp_rp: 0,
  ekspedisi: '',
  batas_kirim: '',
  total_berat: 0,
  sales: '',
  catatan: '',
  keterangan_packing: '',
  is_active: true,
})

// ============================================================================
// DETAIL ITEMS (TABLE)
// ============================================================================
interface DetailItem {
  id: number
  kode: string
  nama_item: string
  nama_alias: string
  free_stok: number
  qty_sq: number
  qty_so: number
  uom: string
  harga: number
  sub_total: number
  disc_1: number
  disc_2: number
  disc_3: number
  disc_amt: number
  total_disc: number
  total_ppn: number
  total: number
  catatan: string
}

const detailItems = ref<DetailItem[]>([
  {
    id: 1,
    kode: 'ITEM-0001',
    nama_item: 'SET L S304',
    nama_alias: 'SET L S304',
    free_stok: 100,
    qty_sq: 100,
    qty_so: 100,
    uom: 'PCS',
    harga: 35000,
    sub_total: 3500000,
    disc_1: 0,
    disc_2: 0,
    disc_3: 0,
    disc_amt: 0,
    total_disc: 0,
    total_ppn: 385000,
    total: 3885000,
    catatan: 'Catatan',
  },
  {
    id: 2,
    kode: 'ITEM-0002',
    nama_item: 'NUT NYLON SS304',
    nama_alias: 'NUT NYLON SS304',
    free_stok: 100,
    qty_sq: 100,
    qty_so: 100,
    uom: 'PCS',
    harga: 10000,
    sub_total: 1000000,
    disc_1: 0,
    disc_2: 0,
    disc_3: 0,
    disc_amt: 0,
    total_disc: 0,
    total_ppn: 110000,
    total: 1110000,
    catatan: 'Catatan',
  },
])

// ============================================================================
// COMPUTED - SUMMARY
// ============================================================================
const dpp = computed(() =>
  detailItems.value.reduce((sum, item) => sum + item.sub_total - item.total_disc, 0)
)
const dppLainLain = computed(() => Math.round(dpp.value * 0.9167))
const ppn11 = computed(() => Math.round(dppLainLain.value * 0.11))
const grandTotal = computed(() => dpp.value + ppn11.value)

// ============================================================================
// HELPERS
// ============================================================================
const formatNumber = (n: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 0 })

const statusLabel = computed(() => {
  if (isEditMode.value) return 'EDIT'
  if (isViewMode.value) return 'VIEW'
  return 'DRAFT'
})
const statusVariant = computed<'default' | 'secondary' | 'outline'>(() => {
  if (isEditMode.value) return 'default'
  if (isViewMode.value) return 'secondary'
  return 'outline'
})

// ============================================================================
// ERRORS
// ============================================================================
const errors = reactive({
  unit_bisnis: '',
  no_sq: '',
  customer: '',
  tipe_ppn: '',
  top: '',
  cara_bayar: '',
  ekspedisi: '',
})

// ============================================================================
// LIFECYCLE
// ============================================================================
let initialValues: Record<string, any> = {}

onBeforeMount(async () => {
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return

  loading.value = true
  try {
    const res = await getSalesOrderById(sourceId)
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active as unknown
      initialValues.is_active = v === true || v === 1 || v === '1'
    } else {
      initialValues.is_active = true
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
    }

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore
        values[key] = initialValues[key]
      }
    }

    if (res.data.detail_items) {
      detailItems.value = res.data.detail_items
    }

    toast.success(isCopyModeLocal ? 'Data berhasil disalin' : 'Data berhasil dimuat')
  } catch (error) {
    toast.error('Gagal memuat data Sales Order', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: { label: 'Kembali', onClick: () => router.push('/marketing/transaksi/t_sales_order') },
    })
    setTimeout(() => router.push('/marketing/transaksi/t_sales_order'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach(k => { errors[k as keyof typeof errors] = '' })
  let invalid = false
  if (!values.unit_bisnis?.trim()) { errors.unit_bisnis = 'Unit Bisnis wajib diisi'; invalid = true }
  if (!values.customer?.trim()) { errors.customer = 'Customer wajib diisi'; invalid = true }
  if (!values.top?.trim()) { errors.top = 'ToP wajib diisi'; invalid = true }
  if (!values.cara_bayar?.trim()) { errors.cara_bayar = 'Cara Bayar wajib diisi'; invalid = true }
  if (!values.ekspedisi?.trim()) { errors.ekspedisi = 'Ekspedisi wajib diisi'; invalid = true }
  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  loading.value = true
  try {
    const payload = { ...values, detail_items: detailItems.value }
    if (isEditMode.value) {
      await updateSalesOrder(menuId.value, payload as any)
      toast.success('Sales Order berhasil diperbarui')
    } else {
      await createSalesOrder(payload as any)
      toast.success('Sales Order berhasil dibuat')
    }
    router.replace('/marketing/transaksi/t_sales_order?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Sales Order' : 'Gagal membuat Sales Order', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  } finally {
    loading.value = false
  }
}

const onSendApproval = async () => {
  await onSave()
  toast.info('Dikirim ke approval')
}

const handleCancel = () => {
  router.push('/marketing/transaksi/t_sales_order')
}

// ============================================================================
// DETAIL TABLE HANDLERS
// ============================================================================
const addItem = () => {
  detailItems.value.push({
    id: Date.now(),
    kode: '',
    nama_item: '',
    nama_alias: '',
    free_stok: 0,
    qty_sq: 0,
    qty_so: 0,
    uom: 'PCS',
    harga: 0,
    sub_total: 0,
    disc_1: 0,
    disc_2: 0,
    disc_3: 0,
    disc_amt: 0,
    total_disc: 0,
    total_ppn: 0,
    total: 0,
    catatan: '',
  })
}

const removeItem = (id: number) => {
  detailItems.value = detailItems.value.filter(i => i.id !== id)
}

const recalcItem = (item: DetailItem) => {
  item.sub_total = item.qty_so * item.harga
  const discTotal = item.sub_total * (item.disc_1 / 100) + item.sub_total * (item.disc_2 / 100) + item.sub_total * (item.disc_3 / 100) + item.disc_amt
  item.total_disc = Math.round(discTotal)
  const dppItem = item.sub_total - item.total_disc
  item.total_ppn = Math.round(dppItem * 0.11)
  item.total = dppItem + item.total_ppn
}
</script>

<template>
  <div class="min-h-screen bg-muted/30">
    <!-- ================================================================ -->
    <!-- TOP BAR -->
    <!-- ================================================================ -->
    <div class="sticky top-0 z-30 bg-background border-b shadow-sm">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="handleCancel" class="h-8 w-8">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-bold leading-none">{{ pageTitle }}</h1>
              <Badge :variant="statusVariant" class="text-[10px] uppercase tracking-wider px-2 py-0.5">
                {{ statusLabel }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">{{ pageDescription }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6 space-y-4 max-w-[1400px] mx-auto">
      <!-- ================================================================ -->
      <!-- CARD: HEADER SALES ORDER -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="pb-3 pt-4 px-6">
          <CardTitle class="text-base font-semibold">Informasi Sales Order</CardTitle>
        </CardHeader>
        <CardContent class="px-6 pb-6">
          <!-- 2-column layout: left col & right col -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0">

            <!-- ===================== KOLOM KIRI ===================== -->
            <div class="space-y-4">

              <!-- Row 1: Unit Bisnis + Tanggal SO -->
              <div class="grid grid-cols-2 gap-4">
                <!-- Unit Bisnis -->
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Unit Bisnis
                  </Label>
                  <Select v-model="values.unit_bisnis" :disabled="loading || isReadOnly">
                    <SelectTrigger :class="['h-9 text-sm', errors.unit_bisnis ? 'border-destructive' : '']">
                      <SelectValue placeholder="Pilih Unit Bisnis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raden_saleh">Raden Saleh</SelectItem>
                      <SelectItem value="cabang_a">Cabang A</SelectItem>
                      <SelectItem value="cabang_b">Cabang B</SelectItem>
                    </SelectContent>
                  </Select>
                  <p v-if="errors.unit_bisnis" class="text-xs text-destructive">{{ errors.unit_bisnis }}</p>
                </div>

                <!-- Tanggal SO -->
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tanggal SO
                  </Label>
                  <Input
                    v-model="values.tanggal_so"
                    type="date"
                    class="h-9 text-sm"
                    :disabled="loading || isReadOnly"
                  />
                </div>
              </div>

              <!-- Row 2: No. SQ (full left col width) -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  No. SQ <span class="text-destructive">*</span>
                </Label>
                <div class="relative">
                  <Input
                    v-model="values.no_sq"
                    class="h-9 text-sm pr-9"
                    placeholder="Pilih No. SQ"
                    :disabled="loading || isReadOnly"
                    :class="errors.no_sq ? 'border-destructive' : ''"
                  />
                  <Button
                    v-if="!isReadOnly"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Search class="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p v-if="errors.no_sq" class="text-xs text-destructive">{{ errors.no_sq }}</p>
              </div>

              <!-- Row 3: Tipe PPN (full left col width) -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tipe PPN <span class="text-destructive">*</span>
                </Label>
                <!-- Grid: dropdown flex-1 | angka w-14 | % | nilai w-16 — semua dalam 1 baris terkontrol -->
                <div class="grid gap-1.5 overflow-hidden" style="grid-template-columns: 1fr 3.5rem auto 4rem;">
                  <Select v-model="values.tipe_ppn" :disabled="loading || isReadOnly">
                    <SelectTrigger class="h-9 text-sm min-w-0">
                      <SelectValue placeholder="Pilih Tipe PPN" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclude_11">Exclude 11%</SelectItem>
                      <SelectItem value="include_11">Include 11%</SelectItem>
                      <SelectItem value="non_ppn">Non PPN</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    v-model.number="values.ppn_persen"
                    type="number"
                    class="h-9 text-sm text-center px-1 w-full"
                    :disabled="loading || isReadOnly"
                  />
                  <div class="flex items-center text-sm text-muted-foreground px-0.5">%</div>
                  <Input
                    v-model.number="values.ppn_value"
                    type="number"
                    class="h-9 text-sm text-right px-2 w-full bg-muted/40"
                    :disabled="true"
                    :readonly="true"
                  />
                </div>
              </div>

              <!-- Row 4: ToP + Cara Bayar -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    ToP <span class="text-destructive">*</span>
                  </Label>
                  <Select v-model="values.top" :disabled="loading || isReadOnly">
                    <SelectTrigger :class="['h-9 text-sm', errors.top ? 'border-destructive' : '']">
                      <SelectValue placeholder="Pilih ToP" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7_hari">7 Hari</SelectItem>
                      <SelectItem value="14_hari">14 Hari</SelectItem>
                      <SelectItem value="30_hari">30 Hari</SelectItem>
                      <SelectItem value="cod">COD</SelectItem>
                    </SelectContent>
                  </Select>
                  <p v-if="errors.top" class="text-xs text-destructive">{{ errors.top }}</p>
                </div>

                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cara Bayar <span class="text-destructive">*</span>
                  </Label>
                  <Select v-model="values.cara_bayar" :disabled="loading || isReadOnly">
                    <SelectTrigger :class="['h-9 text-sm', errors.cara_bayar ? 'border-destructive' : '']">
                      <SelectValue placeholder="Pilih Cara Bayar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="tunai">Tunai</SelectItem>
                      <SelectItem value="giro">Giro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p v-if="errors.cara_bayar" class="text-xs text-destructive">{{ errors.cara_bayar }}</p>
                </div>
              </div>

              <!-- Row 5: Ekspedisi + Batas Kirim -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ekspedisi <span class="text-destructive">*</span>
                  </Label>
                  <Select v-model="values.ekspedisi" :disabled="loading || isReadOnly">
                    <SelectTrigger :class="['h-9 text-sm', errors.ekspedisi ? 'border-destructive' : '']">
                      <SelectValue placeholder="Pilih Ekspedisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jnt">JnT</SelectItem>
                      <SelectItem value="jne">JNE</SelectItem>
                      <SelectItem value="sicepat">SiCepat</SelectItem>
                      <SelectItem value="grab">Grab Express</SelectItem>
                      <SelectItem value="gojek">Gojek</SelectItem>
                      <SelectItem value="pickup">Pick Up</SelectItem>
                    </SelectContent>
                  </Select>
                  <p v-if="errors.ekspedisi" class="text-xs text-destructive">{{ errors.ekspedisi }}</p>
                </div>

                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Batas Kirim</Label>
                  <Input
                    v-model="values.batas_kirim"
                    type="date"
                    class="h-9 text-sm"
                    :disabled="loading || isReadOnly"
                  />
                </div>
              </div>

              <!-- Row 6: Catatan -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Catatan</Label>
                <Textarea
                  v-model="values.catatan"
                  placeholder="Catatan"
                  class="text-sm min-h-[80px] resize-none"
                  :disabled="loading || isReadOnly"
                />
              </div>

            </div>
            <!-- ===================== END KOLOM KIRI ===================== -->

            <!-- ===================== KOLOM KANAN ===================== -->
            <div class="space-y-4 mt-4 lg:mt-0">

              <!-- Row 1: No. SO (full right col width) -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  No. SO
                </Label>
                <Input
                  v-model="values.no_so"
                  class="h-9 text-sm bg-muted/40"
                  placeholder="Auto-generated"
                  :disabled="true"
                  :readonly="true"
                />
              </div>

              <!-- Row 2: Customer (full right col width) -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Customer <span class="text-destructive">*</span>
                </Label>
                <div class="relative">
                  <Input
                    v-model="values.customer"
                    class="h-9 text-sm pr-9"
                    placeholder="Pilih Customer"
                    :disabled="loading || isReadOnly"
                    :class="errors.customer ? 'border-destructive' : ''"
                  />
                  <Button
                    v-if="!isReadOnly"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Search class="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p v-if="errors.customer" class="text-xs text-destructive">{{ errors.customer }}</p>
              </div>

              <!-- Row 3: Alamat Kirim (full right col width) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Alamat Kirim
                  </Label>
                  <button
                    v-if="!isReadOnly"
                    type="button"
                    class="text-xs text-primary hover:underline font-medium"
                  >
                    Change Default
                  </button>
                </div>
                <Select v-model="values.alamat_kirim" :disabled="loading || isReadOnly">
                  <SelectTrigger class="h-9 text-sm">
                    <SelectValue placeholder="Pilih Alamat Kirim" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kantor">Kantor - Jl. Ngagel Selatan No. 14, Surabaya</SelectItem>
                    <SelectItem value="gudang">Gudang - Jl. Rungkut Industri No. 5, Surabaya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Row 4: DP (%) + DP (Rp) -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">DP (%)</Label>
                  <Input
                    v-model.number="values.dp_persen"
                    type="number"
                    class="h-9 text-sm text-right"
                    :disabled="loading || isReadOnly"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">DP (Rp)</Label>
                  <Input
                    v-model.number="values.dp_rp"
                    type="number"
                    class="h-9 text-sm text-right"
                    :disabled="loading || isReadOnly"
                  />
                </div>
              </div>

              <!-- Row 5: Total Berat (Kg) + Sales -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Berat (Kg)</Label>
                  <Input
                    v-model.number="values.total_berat"
                    type="number"
                    class="h-9 text-sm text-right"
                    :disabled="loading || isReadOnly"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sales</Label>
                  <Select v-model="values.sales" :disabled="loading || isReadOnly">
                    <SelectTrigger class="h-9 text-sm">
                      <SelectValue placeholder="Pilih Sales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diana">Diana</SelectItem>
                      <SelectItem value="budi">Budi</SelectItem>
                      <SelectItem value="sari">Sari</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- Row 6: Keterangan Packing -->
              <div class="space-y-1.5">
                <Label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Keterangan Packing</Label>
                <Textarea
                  v-model="values.keterangan_packing"
                  placeholder="Catatan"
                  class="text-sm min-h-[80px] resize-none"
                  :disabled="loading || isReadOnly"
                />
              </div>

            </div>
            <!-- ===================== END KOLOM KANAN ===================== -->

          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- CARD: DETAIL SALES ORDER (TABLE) -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="pb-3 pt-4 px-6">
          <div class="flex items-center justify-between">
            <CardTitle class="text-base font-semibold">Detail Sales Order</CardTitle>
            <div v-if="!isReadOnly" class="flex items-center gap-2">
              <Button type="button" size="sm" class="h-8 gap-1.5 text-xs" @click="addItem">
                <Plus class="h-3.5 w-3.5" />
                Add to List
              </Button>
              <Button type="button" size="sm" variant="secondary" class="h-8 gap-1.5 text-xs bg-amber-400 hover:bg-amber-500 text-amber-950 border-0">
                <Star class="h-3.5 w-3.5" />
                From Favorit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent class="px-0 pb-0">
          <!-- Scrollable table wrapper -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse min-w-[1400px]">
              <!-- HEAD -->
              <thead>
                <tr class="bg-muted/60 border-y">
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-8">No</th>
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-28">Kode</th>
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-40">Nama Item</th>
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-36">Nama Alias</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-24">Free Stok</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-20">Qty SQ</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-20">Qty SO</th>
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-20">UoM</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-28">Harga</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-28">Sub Total</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-20">Disc. 1 (%)</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-20">Disc. 2 (%)</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-20">Disc. 3 (%)</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-24">Disc. Amt.</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-24">Total Disc.</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-24">Total PPN</th>
                  <th class="px-3 py-2 text-right font-semibold text-muted-foreground w-28">Total</th>
                  <th class="px-3 py-2 text-left font-semibold text-muted-foreground w-28">Catatan</th>
                  <th v-if="!isReadOnly" class="px-3 py-2 w-10"></th>
                </tr>
                <!-- Filter row — icon ▼ di setiap kolom -->
                <tr class="border-b bg-background">
                  <td class="px-3 py-1"></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td class="px-2 py-1 text-center"><button type="button" class="text-muted-foreground hover:text-foreground"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 2.5h10L6 7.5H4L0 2.5z"/></svg></button></td>
                  <td v-if="!isReadOnly" class="px-2 py-1"></td>
                </tr>
              </thead>

              <!-- BODY -->
              <tbody>
                <tr
                  v-for="(item, idx) in detailItems"
                  :key="item.id"
                  class="border-b hover:bg-muted/30 transition-colors"
                >
                  <td class="px-3 py-2 text-muted-foreground">{{ idx + 1 }}</td>
                  <!-- Kode -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model="item.kode"
                      class="h-7 text-xs px-2"
                      :disabled="loading"
                    />
                    <span v-else>{{ item.kode }}</span>
                  </td>
                  <!-- Nama Item -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model="item.nama_item"
                      class="h-7 text-xs px-2"
                      :disabled="loading"
                    />
                    <span v-else>{{ item.nama_item }}</span>
                  </td>
                  <!-- Nama Alias -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model="item.nama_alias"
                      class="h-7 text-xs px-2"
                      :disabled="loading"
                    />
                    <span v-else>{{ item.nama_alias }}</span>
                  </td>
                  <!-- Free Stok -->
                  <td class="px-2 py-1.5 text-right">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.free_stok"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                    />
                    <span v-else>{{ formatNumber(item.free_stok) }}</span>
                  </td>
                  <!-- Qty SQ -->
                  <td class="px-2 py-1.5 text-right">
                    <span>{{ formatNumber(item.qty_sq) }}</span>
                  </td>
                  <!-- Qty SO -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.qty_so"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :class="item.qty_so > item.qty_sq ? 'border-destructive text-destructive' : ''"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else :class="item.qty_so > item.qty_sq ? 'text-destructive font-medium' : ''">
                      {{ formatNumber(item.qty_so) }}
                    </span>
                  </td>
                  <!-- UoM -->
                  <td class="px-2 py-1.5">
                    <select
                      v-if="!isReadOnly"
                      v-model="item.uom"
                      :disabled="loading"
                      class="h-7 text-xs border border-border rounded px-1.5 bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="KG">KG</option>
                      <option value="SET">SET</option>
                    </select>
                    <span v-else>{{ item.uom }}</span>
                  </td>
                  <!-- Harga -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.harga"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else class="text-right block">{{ formatNumber(item.harga) }}</span>
                  </td>
                  <!-- Sub Total (readonly) -->
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.sub_total) }}</td>
                  <!-- Disc 1 -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.disc_1"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else class="text-right block">{{ item.disc_1 }}</span>
                  </td>
                  <!-- Disc 2 -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.disc_2"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else class="text-right block">{{ item.disc_2 }}</span>
                  </td>
                  <!-- Disc 3 -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.disc_3"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else class="text-right block">{{ item.disc_3 }}</span>
                  </td>
                  <!-- Disc Amt -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model.number="item.disc_amt"
                      type="number"
                      class="h-7 text-xs px-2 text-right"
                      :disabled="loading"
                      @input="recalcItem(item)"
                    />
                    <span v-else class="text-right block">{{ formatNumber(item.disc_amt) }}</span>
                  </td>
                  <!-- Total Disc (readonly) -->
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.total_disc) }}</td>
                  <!-- Total PPN (readonly) -->
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.total_ppn) }}</td>
                  <!-- Total (readonly) -->
                  <td class="px-3 py-2 text-right font-medium">{{ formatNumber(item.total) }}</td>
                  <!-- Catatan -->
                  <td class="px-2 py-1.5">
                    <Input
                      v-if="!isReadOnly"
                      v-model="item.catatan"
                      class="h-7 text-xs px-2"
                      :disabled="loading"
                    />
                    <span v-else>{{ item.catatan }}</span>
                  </td>
                  <!-- Delete button — kotak merah solid -->
                  <td v-if="!isReadOnly" class="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-red-600 hover:bg-red-700 text-white transition-colors"
                      @click="removeItem(item.id)"
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                  </td>
                </tr>

                <!-- Empty state -->
                <tr v-if="detailItems.length === 0">
                  <td :colspan="isReadOnly ? 18 : 19" class="px-4 py-8 text-center text-muted-foreground text-xs">
                    Belum ada item. Klik "Add to List" untuk menambahkan item.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- ============================================================ -->
          <!-- SUMMARY TOTALS — rata kiri, format tabel kecil seperti desain -->
          <!-- ============================================================ -->
          <div class="px-6 py-4 border-t">
            <table class="text-sm">
              <tbody>
                <tr>
                  <td class="pr-16 py-0.5 text-foreground w-40">DPP</td>
                  <td class="text-right font-semibold tabular-nums">{{ formatNumber(dpp) }}</td>
                </tr>
                <tr>
                  <td class="pr-16 py-0.5 text-foreground">DPP Lain-lain</td>
                  <td class="text-right font-semibold tabular-nums">{{ formatNumber(dppLainLain) }}</td>
                </tr>
                <tr>
                  <td class="pr-16 py-0.5 text-foreground">PPN 11%</td>
                  <td class="text-right font-semibold tabular-nums">{{ formatNumber(ppn11) }}</td>
                </tr>
                <tr>
                  <td class="pr-16 py-0.5 text-foreground font-semibold">Grand Total</td>
                  <td class="text-right font-bold tabular-nums">{{ formatNumber(grandTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- FOOTER: ACTION BUTTONS + AUDIT INFO -->
      <!-- ================================================================ -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
        <!-- Audit info -->
        <p class="text-xs text-muted-foreground">
          <span v-if="isEditMode || isViewMode">Created By admin On 1/16/2026 8:42:53 AM</span>
        </p>

        <!-- Buttons -->
        <div class="flex items-center gap-2">
          <Button type="button" variant="outline" @click="handleCancel" :disabled="loading">
            {{ isReadOnly ? 'Kembali' : 'Batal' }}
          </Button>

          <template v-if="!isReadOnly">
            <Button
              type="button"
              @click="onSave"
              :disabled="loading"
              class="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              <Save v-else class="h-4 w-4" />
              {{ isEditMode ? 'Perbarui' : 'Simpan' }}
            </Button>

            <Button
              type="button"
              @click="onSendApproval"
              :disabled="loading"
              class="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <SendHorizonal class="h-4 w-4" />
              Send Approval
            </Button>
          </template>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Make number inputs right-aligned and hide spin buttons */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}

/* Table hover row highlight */
tbody tr:hover td {
  background-color: hsl(var(--muted) / 0.4);
}
</style>
