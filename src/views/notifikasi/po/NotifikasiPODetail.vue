<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, ShoppingCart, User, FileText, Calendar, AlertCircle, Package, Paperclip, Download, Eye, ExternalLink, Ban } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import {
  getPurchaseOrderNotifications,
  revisePurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  type PONotification
} from './service.po'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { finalizeNotificationAction } from '@/lib/notificationState'
import FieldX from '@/components/field/FieldX.vue'
import { getPurchaseOrder } from '@/views/purchasing/order/purchase_orders/purchaseOrderService'


const { API_BASE_URL } = useApi()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<PONotification | null>(null)
const approvalCatatan = ref('')

// PO details
const poDetails = ref<any[]>([])
const loadingDetails = ref(false)

// Preview image dialog
const showPreviewDialog = ref(false)
const previewImageUrl = ref('')
const previewFileName = ref('')

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

const fetchNotificationDetail = async () => {
  try {
    loading.value = true
    const response = await getPurchaseOrderNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)

    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }

    notification.value = found
    approvalCatatan.value = found.approval_catatan || ''

    if (found.t_purchase_order_id) {
      await fetchItemDetails(found.t_purchase_order_id)
    }
  } catch (error: any) {
    toast.error('Failed to load notification', {
      description: error.message || 'An error occurred'
    })
    router.push('/notifikasi')
  } finally {
    loading.value = false
  }
}

const fetchItemDetails = async (poId: string) => {
  try {
    loadingDetails.value = true
    const po = await getPurchaseOrder(poId)
    poDetails.value = (po.details || []).map((detail) => ({
      id: detail.id || detail.item_id,
      kode_item: detail.item?.barcode || '-',
      nama_item: detail.item?.nama_barang || '-',
      qty_po: detail.qty_order_beli,
      uom: detail.uom?.satuan_beli || detail.item?.uom?.satuan_beli || 'Pcs',
      harga: Number(detail.harga_satuan || 0),
      sub_total: Number(detail.subtotal || 0),
      catatan: null,
    }))
  } catch (error) {
    console.error('Failed to fetch PO details:', error)
  } finally {
    loadingDetails.value = false
  }
}

const handleApproval = async (status: 'APPROVED' | 'REVISI') => {
  if (!notification.value) return



  if (status === 'REVISI' && !approvalCatatan.value?.trim()) {
    toast.error('Alasan Revisi wajib diisi', {
      description: 'Silakan masukkan alasan sebelum melakukan revisi'
    })
    return
  }

  submitting.value = true
  try {
    // Get approval info from localStorage
    const approvalList = authStore.getApprovalList()
    const poApproval = approvalList.find((a: any) =>
      a.path === '/purchasing/order/purchase-orders' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!poApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Purchase Order'
      })
      return
    }

    const approvalLevel = poApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    if (status === 'REVISI') {
      // Use revisi function from service
      await revisePurchaseOrder(
        notification.value.t_purchase_order_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    } else {
      // APPROVED - Use approve function from service
      await approvePurchaseOrder(
        notification.value.t_purchase_order_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    }

    finalizeNotificationAction(notification.value.id)
    toast.success(`Purchase Order ${status === 'APPROVED' ? 'approved' : 'revised'} successfully`)
    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Failed to submit approval', {
      description: error.message || 'An error occurred'
    })
  } finally {
    submitting.value = false
  }
}

const handleReject = async () => {
  if (!notification.value) return

  // Validate catatan is required
  if (!approvalCatatan.value?.trim()) {
    toast.error('Alasan Reject wajib diisi', {
      description: 'Silakan masukkan alasan sebelum melakukan reject'
    })
    return
  }

  submitting.value = true
  try {
    // Get approval info from localStorage
    const approvalList = authStore.getApprovalList()
    const poApproval = approvalList.find((a: any) =>
      a.path === '/purchasing/order/purchase-orders' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!poApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Purchase Order'
      })
      return
    }

    const approvalLevel = poApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    await rejectPurchaseOrder(
      notification.value.t_purchase_order_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    finalizeNotificationAction(notification.value.id)
    toast.success('Purchase Order berhasil di-reject')
    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Gagal reject', {
      description: error.message || 'Terjadi kesalahan'
    })
  } finally {
    submitting.value = false
  }
}

// Get status badge variant
const getStatusVariant = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED': return 'default'
    case 'IN APPROVAL': return 'secondary'
    case 'REVISI': return 'destructive'
    case 'REJECT': return 'destructive'
    case 'DRAFT': return 'outline'
    default: return 'secondary'
  }
}

// Get priority badge variant
const getPriorityVariant = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case 'URGENT': return 'destructive'
    case 'HIGH': return 'destructive'
    case 'NORMAL': return 'secondary'
    case 'LOW': return 'outline'
    default: return 'secondary'
  }
}

// File helpers
const getFileUrl = (path: string) => {
  if (!path) return ''
  const baseUrl = API_BASE_URL.replace('/api', '')
  return `${baseUrl}/${path}`
}

const getFileName = (path: string) => {
  if (!path) return 'Unknown file'
  return path.split('/').pop() || path
}

// Check if file is an image
const isImageFile = (path: string) => {
  if (!path) return false
  const ext = path.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(ext || '')
}

// Check if file is PDF
const isPdfFile = (path: string) => {
  if (!path) return false
  return path.toLowerCase().endsWith('.pdf')
}

const openFile = (path: string) => {
  if (!path) return
  const url = getFileUrl(path)

  // If it's an image, show in preview dialog
  if (isImageFile(path)) {
    previewImageUrl.value = url
    previewFileName.value = getFileName(path)
    showPreviewDialog.value = true
  } else {
    // For PDF and other files, open in new tab
    window.open(url, '_blank')
  }
}

const openPreviewInNewTab = () => {
  window.open(previewImageUrl.value, '_blank')
}

const downloadPreviewImage = () => {
  const link = document.createElement('a')
  link.href = previewImageUrl.value
  link.download = previewFileName.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const downloadFile = (path: string) => {
  if (!path) return
  const url = getFileUrl(path)
  const link = document.createElement('a')
  link.href = url
  link.download = getFileName(path)
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
          <ShoppingCart class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Purchase Order Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve purchase order
        </p>
      </div>
    </div>

    <Separator />

    <!-- Loading State -->
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
            <Badge :variant="getStatusVariant(notification.status_name || '')" class="shrink-0 self-start">
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
              <span class="font-medium truncate">{{ (notification as any).tpo_sender?.name || (notification as
                any).user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Purchase Order Details Card -->
      <Card v-if="notification.t_purchase_order">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Order
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap Purchase Order yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. PO</Label>
              <p class="text-base md:text-lg font-bold text-primary break-all">{{ notification.t_purchase_order.no_po ||
                '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_purchase_order.status)" class="text-xs md:text-sm">
                  {{ notification.t_purchase_order.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal PO
              </Label>
              <p class="text-sm md:text-base">{{ formatDate(notification.t_purchase_order.tgl_po) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Supplier</Label>
              <p class="text-sm md:text-base font-medium">{{ notification.t_purchase_order.m_supplier?.nama_supp || '-'
              }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Kode Supplier</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier?.kode_supplier || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">TOP (Termin)</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_order.top_po?.value1 || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Kategori Item</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_order.kategori_item || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status Transaksi</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_purchase_order.status_transaksi)" class="text-xs">
                  {{ notification.t_purchase_order.status_transaksi || '-' }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Import</Label>
              <Badge :variant="notification.t_purchase_order.is_import ? 'default' : 'secondary'" class="text-xs">
                {{ notification.t_purchase_order.is_import ? 'YA' : 'TIDAK' }}
              </Badge>
            </div>
          </div>

          <Separator />
          <!-- PO Items Table -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <Package class="h-4 w-4" />
              Daftar Barang
            </h4>
            <div v-if="loadingDetails" class="space-y-2">
              <Skeleton class="h-10 w-full" />
              <Skeleton class="h-12 w-full" />
              <Skeleton class="h-12 w-full" />
            </div>
            <div v-else-if="poDetails.length > 0" class="border rounded-md overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader class="bg-muted">
                  <TableRow>
                    <TableHead class="w-[50px] text-center">No</TableHead>
                    <TableHead class="min-w-[150px]">Kode Barang</TableHead>
                    <TableHead class="min-w-[200px]">Nama Barang</TableHead>
                    <TableHead class="w-[80px] text-center">Qty</TableHead>
                    <TableHead class="w-[80px] text-center">Satuan</TableHead>
                    <TableHead class="min-w-[120px] text-right">Harga</TableHead>
                    <TableHead class="min-w-[150px] text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(item, idx) in poDetails" :key="item.id || idx">
                    <TableCell class="text-center">{{ idx + 1 }}</TableCell>
                    <TableCell>
                      <span class="font-medium">{{ (item as any).m_item?.kode_item || (item as any).m_items?.kode_item
                        || item.kode_item || '-' }}</span>
                    </TableCell>
                    <TableCell>
                      <span>{{ (item as any).m_item?.nama_item || (item as any).m_items?.nama_item || item.nama_item ||
                        '-' }}</span>
                      <div v-if="item.catatan" class="text-xs text-muted-foreground mt-1">{{ item.catatan }}</div>
                    </TableCell>
                    <TableCell class="text-center font-medium">{{ item.qty_po || 0 }}</TableCell>
                    <TableCell class="text-center">{{ (item as any).t_purchase_request_d?.prqd_uom?.value1 || (item as
                      any).m_item?.m_general?.value1 || (item as any).m_items?.m_general?.value1 || item.uom || '-' }}
                    </TableCell>
                    <TableCell class="text-right whitespace-nowrap">
                      {{ Number(item.harga || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) }}
                    </TableCell>
                    <TableCell class="text-right font-medium whitespace-nowrap text-primary">
                      {{ Number(item.sub_total || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div v-else class="text-center py-6 border rounded-md bg-muted/20">
              <Package class="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p class="text-sm text-muted-foreground">Tidak ada detail barang</p>
            </div>
          </div>

          <Separator />

          <!-- Financial Info -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <FileText class="h-4 w-4" />
              Informasi Keuangan
            </h4>

            <!-- Currency Info -->
            <div v-if="notification.t_purchase_order.uang_po" class="p-3 md:p-4 bg-primary/5 rounded-md border">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="space-y-1">
                  <Label class="text-xs font-medium text-muted-foreground">Mata Uang</Label>
                  <p class="text-sm md:text-base font-semibold flex items-center gap-2">
                    <span class="text-lg">{{ notification.t_purchase_order.uang_po.money?.value2 || '' }}</span>
                    <span>{{ notification.t_purchase_order.uang_po.nama_currency }}</span>
                    <Badge variant="outline" class="text-xs">{{ notification.t_purchase_order.uang_po.money?.value5 ||
                      notification.t_purchase_order.uang_po.money?.code }}</Badge>
                  </p>
                </div>
                <!-- Exchange Rate (Hidden for IDR/Rupiah) -->
                <div v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po.nama_currency?.toLowerCase().includes('rupiah')"
                  class="space-y-1">
                  <Label class="text-xs font-medium text-muted-foreground">Kurs / Rate</Label>
                  <p class="text-sm md:text-base font-semibold text-primary">
                    Rp {{ Number(notification.t_purchase_order.det_uang_po.rate || 0).toLocaleString('id-ID') }}
                  </p>
                  <p v-if="notification.t_purchase_order.det_uang_po.tgl_mulai" class="text-xs text-muted-foreground">
                    Per {{ formatDate(notification.t_purchase_order.det_uang_po.tgl_mulai) }}
                  </p>
                </div>
              </div>
              <div v-if="notification.t_purchase_order.det_uang_po?.catatan &&
                notification.t_purchase_order.uang_po.money?.code !== 'IDR' &&
                !notification.t_purchase_order.uang_po.nama_currency?.toLowerCase().includes('rupiah')"
                class="mt-2 pt-2 border-t">
                <Label class="text-xs font-medium text-muted-foreground">Catatan Kurs</Label>
                <p class="text-xs md:text-sm mt-1">{{ notification.t_purchase_order.det_uang_po.catatan }}</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Total</Label>
                <p class="text-sm md:text-base font-medium">
                  <span v-if="notification.t_purchase_order.uang_po?.money?.value2" class="mr-1">{{
                    notification.t_purchase_order.uang_po.money.value2 }}</span>{{
                      Number(notification.t_purchase_order.total || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) }}
                </p>
                <p v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po?.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po?.nama_currency?.toLowerCase().includes('rupiah')"
                  class="text-xs text-muted-foreground">
                  Rp {{ (Number(notification.t_purchase_order.total || 0) *
                    Number(notification.t_purchase_order.det_uang_po.rate || 0)).toLocaleString('id-ID', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2
                    }) }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Total Diskon</Label>
                <p class="text-sm md:text-base">
                  <span v-if="notification.t_purchase_order.uang_po?.money?.value2" class="mr-1">{{
                    notification.t_purchase_order.uang_po.money.value2 }}</span>{{
                      Number(notification.t_purchase_order.total_diskon || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2
                      }) }}
                </p>
                <p v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po?.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po?.nama_currency?.toLowerCase().includes('rupiah')"
                  class="text-xs text-muted-foreground">
                  Rp {{ (Number(notification.t_purchase_order.total_diskon || 0) *
                    Number(notification.t_purchase_order.det_uang_po.rate || 0)).toLocaleString('id-ID', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2
                    }) }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Total PPN</Label>
                <p class="text-sm md:text-base">
                  <span v-if="notification.t_purchase_order.uang_po?.money?.value2" class="mr-1">{{
                    notification.t_purchase_order.uang_po.money.value2 }}</span>{{
                      Number(notification.t_purchase_order.total_ppn || 0).toLocaleString('id-ID', {
                        minimumFractionDigits:
                          2, maximumFractionDigits: 2
                      }) }}
                </p>
                <p v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po?.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po?.nama_currency?.toLowerCase().includes('rupiah')"
                  class="text-xs text-muted-foreground">
                  Rp {{ (Number(notification.t_purchase_order.total_ppn || 0) *
                    Number(notification.t_purchase_order.det_uang_po.rate || 0)).toLocaleString('id-ID', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2
                    }) }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Total PPh</Label>
                <p class="text-sm md:text-base">
                  <span v-if="notification.t_purchase_order.uang_po?.money?.value2" class="mr-1">{{
                    notification.t_purchase_order.uang_po.money.value2 }}</span>{{
                      Number(notification.t_purchase_order.total_pph || 0).toLocaleString('id-ID', {
                        minimumFractionDigits:
                          2, maximumFractionDigits: 2
                      }) }}
                </p>
                <p v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po?.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po?.nama_currency?.toLowerCase().includes('rupiah')"
                  class="text-xs text-muted-foreground">
                  Rp {{ (Number(notification.t_purchase_order.total_pph || 0) *
                    Number(notification.t_purchase_order.det_uang_po.rate || 0)).toLocaleString('id-ID', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2
                    }) }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Grand Total</Label>
                <p class="text-base md:text-lg font-bold text-primary">
                  <span v-if="notification.t_purchase_order.uang_po?.money?.value2" class="mr-1">{{
                    notification.t_purchase_order.uang_po.money.value2 }}</span>{{
                      Number(notification.t_purchase_order.grand_total || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2
                      }) }}
                </p>
                <p v-if="notification.t_purchase_order.det_uang_po &&
                  notification.t_purchase_order.uang_po?.money?.code !== 'IDR' &&
                  !notification.t_purchase_order.uang_po?.nama_currency?.toLowerCase().includes('rupiah')"
                  class="text-sm font-semibold text-primary">
                  Rp {{ (Number(notification.t_purchase_order.grand_total || 0) *
                    Number(notification.t_purchase_order.det_uang_po.rate || 0)).toLocaleString('id-ID', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2
                    }) }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Creator Info -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Informasi Pembuat
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Dibuat Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ notification.t_purchase_order.po_ctr?.name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Diupdate Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ notification.t_purchase_order.po_updt?.name || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="notification.t_purchase_order.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan Purchase Order</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ notification.t_purchase_order.catatan }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Supplier Details Card -->
      <Card v-if="notification.t_purchase_order?.m_supplier">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <User class="h-5 w-5 shrink-0" />
            Detail Supplier
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Informasi lengkap supplier</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Nama Supplier</Label>
                <p class="text-sm md:text-base font-medium">{{ notification.t_purchase_order.m_supplier.nama_supp }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Kode Supplier</Label>
                <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.kode_supplier }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">NPWP</Label>
                <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.npwp_supp || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Email</Label>
                <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.email || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. Telp</Label>
                <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.no_telp || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Contact Person 1</Label>
                <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.cp1 || '-' }} {{
                  notification.t_purchase_order.m_supplier.no_cp1 ?
                    `(${notification.t_purchase_order.m_supplier.no_cp1})` : '' }}</p>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Alamat</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_order.m_supplier.alamat_supp || '-' }}</p>
              <p class="text-xs text-muted-foreground">
                {{ notification.t_purchase_order.m_supplier.kecamatan_supp }},
                {{ notification.t_purchase_order.m_supplier.kota_supp }},
                {{ notification.t_purchase_order.m_supplier.provinsi_supp }},
                {{ notification.t_purchase_order.m_supplier.negara_supp }}
                {{ notification.t_purchase_order.m_supplier.kodepos ? ` -
                ${notification.t_purchase_order.m_supplier.kodepos}` : '' }}
              </p>
            </div>
            <div v-if="notification.t_purchase_order.m_supplier.catatan" class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Catatan Supplier</Label>
              <div class="p-3 bg-muted rounded-md">
                <p class="text-sm">{{ notification.t_purchase_order.m_supplier.catatan }}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Approval Info Card -->
      <Card v-if="notification.menu_info">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <AlertCircle class="h-5 w-5 shrink-0" />
            Informasi Approval
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4 bg-primary/10 dark:bg-primary/10 rounded-md">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Nama Approval</Label>
              <p class="text-sm md:text-base font-medium">{{ notification.menu_info.approval_name }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Level</Label>
              <Badge variant="outline" class="text-xs">Level {{ notification.menu_info.level }}</Badge>
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
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX v-model="approvalCatatan" type="textarea" label="Catatan Approval"
            placeholder="Masukkan catatan approval..." hints="" :rows="3" :disabled="submitting" :required="false" />

          <div
            class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end pt-2 md:pt-4">
            <Button @click="handleReject" variant="outline" :disabled="submitting"
              class="gap-2 w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Ban class="h-4 w-4" />
              Reject
            </Button>
            <Button @click="() => handleApproval('REVISI')" variant="destructive" :disabled="submitting"
              class="gap-2 w-full sm:w-auto">
              <X class="h-4 w-4" />
              Revisi
            </Button>
            <Button @click="() => handleApproval('APPROVED')" variant="default" :disabled="submitting"
              class="gap-2 w-full sm:w-auto">
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

    <!-- Image Preview Dialog -->
    <Dialog :open="showPreviewDialog" @update:open="showPreviewDialog = $event">
      <DialogContent class="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader class="p-3 md:p-4 border-b shrink-0">
          <DialogTitle class="flex items-center gap-2 md:gap-3">
            <span class="truncate flex-1 text-xs md:text-sm">{{ previewFileName }}</span>
            <div class="flex items-center gap-1 md:gap-2 shrink-0">
              <Button variant="outline" size="sm" class="gap-1 h-7 md:h-8 px-2" @click="openPreviewInNewTab">
                <ExternalLink class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Buka</span>
              </Button>
              <Button variant="outline" size="sm" class="gap-1 h-7 md:h-8 px-2" @click="downloadPreviewImage">
                <Download class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Unduh</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div class="flex-1 p-2 md:p-4 flex items-center justify-center bg-muted/50 overflow-auto min-h-0">
          <img :src="previewImageUrl" :alt="previewFileName"
            class="max-w-full max-h-[70vh] object-contain rounded-lg" />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>