<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Package, User, FileText, AlertCircle, Calendar, Ban } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'vue-sonner'
import { 
  getPrecostNotificationById, 
  approvePrecost, 
  revisePrecost,
  rejectPrecost,
  type PrecostNotification 
} from './service.precost'
import { getPrecostById } from '@/views/production/transaksi/t_precost/service'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'

const { API_BASE_URL } = useApi()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<PrecostNotification | null>(null)
const approvalCatatan = ref('')

const notificationId = computed(() => route.params.id as string)

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatRupiah = (value?: number | string | null) => {
  if (value === undefined || value === null) return 'Rp 0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num)
}

const fetchNotificationDetail = async () => {
  try {
    loading.value = true
    const found = await getPrecostNotificationById(notificationId.value)
    
    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }

    let hydratedNotification: any = { ...found }
    if (found.t_precost_id) {
      try {
        const precostRes = await getPrecostById(found.t_precost_id)
        if (precostRes?.status === 'success' && precostRes?.data) {
          hydratedNotification.t_precost = precostRes.data
        }
      } catch (err) {
        console.warn('Failed to hydrate Precost details:', err)
      }
    }
    
    notification.value = hydratedNotification
    approvalCatatan.value = hydratedNotification.approval_catatan || ''
  } catch (error: any) {
    toast.error('Failed to load notification', {
      description: error.message || 'An error occurred'
    })
    router.push('/notifikasi')
  } finally {
    loading.value = false
  }
}

const handleApproval = async (status: 'APPROVED' | 'REVISI') => {
  if (!notification.value) return

  try {
    submitting.value = true
    const t_precost_id = notification.value.t_precost_id || ''
    const t_precosting_notifikasi_id = notification.value.id
    
    const precostApproval = authStore.getApprovalList()?.find((a: any) => 
      a.path === '/production/transaksi/t_precost' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )
    const level = precostApproval?.level ?? (notification.value.approval_level ? notification.value.approval_level + 1 : 1)

    let res
    if (status === 'APPROVED') {
      res = await approvePrecost(t_precost_id, t_precosting_notifikasi_id, level, approvalCatatan.value)
    } else {
      res = await revisePrecost(t_precost_id, t_precosting_notifikasi_id, level, approvalCatatan.value)
    }

    if (res.status === 'success') {
      toast.success(status === 'APPROVED' ? 'Precost approved successfully' : 'Precost revision requested')
      router.push('/notifikasi')
    } else {
      throw new Error(res.message || 'Action failed')
    }
  } catch (error: any) {
    toast.error('Operation failed', {
      description: error.message || 'An error occurred'
    })
  } finally {
    submitting.value = false
  }
}

const handleReject = async () => {
  if (!notification.value) return

  try {
    submitting.value = true
    const t_precost_id = notification.value.t_precost_id || ''
    const t_precosting_notifikasi_id = notification.value.id
    
    const precostApproval = authStore.getApprovalList()?.find((a: any) => 
      a.path === '/production/transaksi/t_precost' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )
    const level = precostApproval?.level ?? (notification.value.approval_level ? notification.value.approval_level + 1 : 1)

    const res = await rejectPrecost(t_precost_id, t_precosting_notifikasi_id, level, approvalCatatan.value)

    if (res.status === 'success') {
      toast.success('Precost rejected successfully')
      router.push('/notifikasi')
    } else {
      throw new Error(res.message || 'Action failed')
    }
  } catch (error: any) {
    toast.error('Operation failed', {
      description: error.message || 'An error occurred'
    })
  } finally {
    submitting.value = false
  }
}

const getStatusVariant = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'APPROVED' || s === 'TRUE') return 'success'
  if (s === 'REVISI') return 'warning'
  if (s === 'REJECT' || s === 'REJECTED') return 'destructive'
  return 'secondary'
}

onMounted(() => {
  fetchNotificationDetail()
})
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <!-- Header -->
    <div class="flex items-start gap-3 md:gap-4">
      <Button variant="ghost" size="icon" class="shrink-0 mt-1" @click="router.push('/notifikasi')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="min-w-0">
        <h1 class="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Precost Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Pre-Costing request
        </p>
      </div>
    </div>

    <Separator />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <Skeleton class="h-6 w-64" />
          <Skeleton class="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent class="space-y-4">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-32 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Content -->
    <div v-else-if="notification" class="space-y-4 md:space-y-6">
      <!-- Notification Info Card -->
      <Card class="border-l-4 border-l-primary">
        <CardHeader class="p-4 md:p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="min-w-0">
              <CardTitle class="text-base md:text-lg flex items-center gap-2 flex-wrap">
                <span class="wrap-break-word">{{ notification.title }}</span>
              </CardTitle>
              <CardDescription class="mt-1 text-sm">{{ notification.approval_message }}</CardDescription>
            </div>
            <Badge :variant="getStatusVariant(notification.status_name || '') as any" class="shrink-0 self-start">
              {{ notification.status_name || 'PENDING' }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div v-if="notification.approval_catatan" class="p-3 bg-muted rounded-md">
            <Label class="text-xs md:text-sm font-medium text-muted-foreground">Catatan dari Pengaju</Label>
            <p class="text-sm md:text-base mt-1">{{ notification.approval_catatan }}</p>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
            <div class="flex items-center gap-2">
              <User class="h-4 w-4 text-muted-foreground shrink-0" />
              <Label class="text-muted-foreground shrink-0">Pengaju:</Label>
              <span class="font-medium truncate">{{ (notification as any).tprecost_sender?.name || notification.user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Precost Data Details Card -->
      <Card v-if="notification.t_precost">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0 text-primary" />
            Informasi Pre-Costing
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap data yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. Transaksi</Label>
              <p class="text-sm md:text-base font-bold text-primary font-mono break-all">{{ (notification.t_precost as any).no || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_precost.status) as any" class="text-xs md:text-sm">
                  {{ notification.t_precost.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Tanggal</Label>
              <p class="text-sm md:text-base font-medium flex items-center gap-1">
                <Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
                {{ (notification.t_precost as any).date ? formatDate((notification.t_precost as any).date) : '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Unit Bisnis</Label>
              <p class="text-sm md:text-base font-medium">{{ (notification.t_precost as any).m_unit_bisni?.nama_comp || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Customer</Label>
              <p class="text-sm md:text-base font-medium">{{ (notification.t_precost as any).m_customer?.nama_customer || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Item Finish Good</Label>
              <p class="text-sm md:text-base font-medium max-w-[200px] truncate" :title="(notification.t_precost as any).m_item?.nama_item">
                {{ (notification.t_precost as any).m_item?.nama_item || '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Quantity</Label>
              <p class="text-sm md:text-base font-medium">{{ (notification.t_precost as any).qty || 0 }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Harga Jual Netto</Label>
              <p class="text-sm md:text-base font-bold text-primary">{{ formatRupiah((notification.t_precost as any).price) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Total Nilai Netto</Label>
              <p class="text-sm md:text-base font-bold text-primary">{{ formatRupiah((notification.t_precost as any).tot_netto) }}</p>
            </div>
          </div>

          <!-- Requester Info -->
          <Separator />
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Informasi Pengaju
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Dibuat Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ (notification.t_precost as any).precost_ctr?.name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Diupdate Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ (notification.t_precost as any).precost_updt?.name || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="(notification.t_precost as any).notes" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ (notification.t_precost as any).notes }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Items Card -->
      <Card v-if="(notification.t_precost as any).t_precost_ds && (notification.t_precost as any).t_precost_ds.length > 0">
        <CardHeader class="p-4 md:p-6">
          <div class="flex items-center gap-2">
            <Package class="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle class="text-base md:text-lg">Detail Bahan & Biaya</CardTitle>
              <CardDescription class="text-xs md:text-sm mt-0.5">Detail komponen bahan penyusun precosting</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-md overflow-hidden w-full">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12 text-center">No</TableHead>
                    <TableHead class="w-16 text-center">Main</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead class="text-right">Qty</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead class="text-right">Price</TableHead>
                    <TableHead class="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(row, idx) in (notification.t_precost as any).t_precost_ds" :key="row.id || idx">
                    <TableCell class="text-center font-medium">{{ Number(idx) + 1 }}</TableCell>
                    <TableCell class="text-center">
                      <Badge :variant="(row.is_main ? 'success' : 'secondary') as any">
                        {{ row.is_main ? 'YA' : 'TIDAK' }}
                      </Badge>
                    </TableCell>
                    <TableCell>{{ row.item_type_precost?.value1 || '-' }}</TableCell>
                    <TableCell class="max-w-[200px] truncate" :title="row.m_item?.nama_item">
                      <span class="block font-semibold font-mono text-xs">{{ row.m_item?.kode_item || '-' }}</span>
                      <span>{{ row.m_item?.nama_item || '-' }}</span>
                    </TableCell>
                    <TableCell class="text-right font-medium">{{ row.qty }}</TableCell>
                    <TableCell>{{ row.unit_precost?.value1 || '-' }}</TableCell>
                    <TableCell class="text-right font-mono text-xs">{{ formatRupiah(row.price) }}</TableCell>
                    <TableCell class="text-right font-mono text-xs font-semibold">{{ formatRupiah(row.amount) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Cost Summary Card -->
      <Card v-if="notification.t_precost">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0 text-primary" />
            Cost Summary &amp; Selling Price
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Rincian perhitungan biaya dan harga jual</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-md overflow-hidden w-full">
            <Table>
              <TableHeader class="bg-muted text-muted-foreground">
                <TableRow>
                  <TableHead class="pl-4">Komponen Biaya</TableHead>
                  <TableHead class="text-center w-32">% / Input</TableHead>
                  <TableHead class="text-right pr-4">Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <!-- Material -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Total Material</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono font-semibold py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).mtr_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Overhead -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Overhead Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm">{{ (notification.t_precost as any).ohd_pct || 0 }}%</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).ohd_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Direct Labor -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Direct Labor Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm">{{ (notification.t_precost as any).dl_pct || 0 }}%</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).dl_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Total COGM -->
                <TableRow class="bg-muted/50 font-semibold border-t-2">
                  <TableCell class="py-3 pl-4">Total COGM (Netto)</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).tot_cogm) }}
                  </TableCell>
                </TableRow>
                <!-- Marketing -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Marketing Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm">{{ (notification.t_precost as any).mkt_pct || 0 }}%</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).mkt_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Administration -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Administration Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm">{{ (notification.t_precost as any).adm_pct || 0 }}%</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).adm_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Total Unit Cost -->
                <TableRow class="bg-muted/50 font-semibold border-t-2">
                  <TableCell class="py-3 pl-4">Total Unit Cost</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).tot_unit_cost) }}
                  </TableCell>
                </TableRow>
                <!-- Packing -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Packing Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm font-mono">
                    {{ formatRupiah((notification.t_precost as any).pack_amt) }}
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).pack_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Delivery -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Delivery Cost</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm font-mono">
                    {{ formatRupiah((notification.t_precost as any).dlv_amt) }}
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).dlv_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Total Other Cost -->
                <TableRow class="bg-muted/50 font-semibold border-t-2">
                  <TableCell class="py-3 pl-4">Total Other Cost</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).tot_other_cost) }}
                  </TableCell>
                </TableRow>
                <!-- Total Brutto -->
                <TableRow class="bg-muted/50 font-semibold">
                  <TableCell class="py-3 pl-4">Total Brutto</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).tot_brutto) }}
                  </TableCell>
                </TableRow>
                <!-- Profit -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Profit</TableCell>
                  <TableCell class="text-center text-muted-foreground text-sm">{{ (notification.t_precost as any).profit_pct || 0 }}%</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).profit_amt) }}
                  </TableCell>
                </TableRow>
                <!-- Total COGS / Netto -->
                <TableRow class="bg-muted/50 font-semibold border-t-2">
                  <TableCell class="py-3 pl-4">Total COGS (Netto)</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).tot_netto) }}
                  </TableCell>
                </TableRow>
                <!-- Selling Price -->
                <TableRow class="bg-primary/5 font-bold border-t-2 text-primary border-primary/20">
                  <TableCell class="py-4 text-base pl-4">Selling Price / Unit</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono text-lg py-4 pr-4 font-bold">
                    {{ formatRupiah((notification.t_precost as any).price) }}
                  </TableCell>
                </TableRow>
                <!-- Benchmark -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Benchmark</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    {{ formatRupiah((notification.t_precost as any).benchmark) }}
                  </TableCell>
                </TableRow>
                <!-- Selisih dari Benchmark -->
                <TableRow class="bg-muted/50 font-semibold border-t-2">
                  <TableCell class="py-3 pl-4">Selisih dari Benchmark</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 font-bold"
                    :class="(notification.t_precost as any).selisih >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                    {{ ((notification.t_precost as any).selisih >= 0 ? '+' : '') + 'Rp ' + Number((notification.t_precost as any).selisih || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>
                <!-- % Profit dari Benchmark -->
                <TableRow class="bg-primary/5 font-bold border-t-2 text-primary border-primary/20">
                  <TableCell class="py-4 text-base pl-4">% Profit dari Benchmark</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono text-lg py-4 pr-4 font-bold"
                    :class="(notification.t_precost as any).profit_bmk >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                    {{ ((notification.t_precost as any).profit_bmk >= 0 ? '+' : '') + Number((notification.t_precost as any).profit_bmk || 0).toLocaleString('id-ID') + '%' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <!-- Approval Info Card -->
      <Card v-if="notification.menu_info">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <AlertCircle class="h-5 w-5 shrink-0 text-primary" />
            Informasi Approval
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4 bg-primary/10 dark:bg-primary/10 rounded-md">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Nama Approval</Label>
              <p class="text-sm md:text-base font-medium">{{ notification.menu_info.approval_name }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Level</Label>
              <div>
                <Badge variant="outline" class="text-xs">Level {{ notification.menu_info.level }}</Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Menu</Label>
              <p class="text-sm md:text-base">{{ notification.menu_info.menu_name }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Path</Label>
              <p class="text-xs text-muted-foreground font-mono break-all">{{ notification.menu_info.menu_path }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Approval Section -->
      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk Precost ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            :rows="3"
            :disabled="submitting"
          />

          <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end pt-2 md:pt-4">
            <Button 
              @click="handleReject"
              variant="outline"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Ban class="h-4 w-4" />
              Reject
            </Button>
            <Button 
              @click="() => handleApproval('REVISI')"
              variant="destructive"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto"
            >
              <X class="h-4 w-4" />
              Revisi
            </Button>
            <Button 
              @click="() => handleApproval('APPROVED')"
              variant="default"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto"
            >
              <Check class="h-4 w-4" />
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Already Processed -->
      <Card v-else class="border-primary/30 bg-primary/10">
        <CardContent class="py-4 md:py-6">
          <div class="flex items-center justify-center gap-2 md:gap-3 text-primary">
            <Check class="h-5 w-5 md:h-6 md:w-6" />
            <span class="text-sm md:text-lg font-medium">Notifikasi ini sudah diproses</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
