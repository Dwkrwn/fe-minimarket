<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, ShoppingCart, User, FileText, Calendar, AlertCircle, Package, Paperclip, Eye, Ban, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'vue-sonner'
import {
  getPurchaseRequestNotifications,
  revisePurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  type PRNotification
} from './service.pr'
import { getTPurchaseRequestById } from '@/views/purchasing/transaksi/t_purchase_request/service'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'

const { API_BASE_URL } = useApi()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<PRNotification | null>(null)
const approvalCatatan = ref('')

// Image preview state (multiple images)
const showImagePreview = ref(false)
const previewImages = ref<any[]>([])
const currentPreviewIndex = ref(0)
const previewTitle = ref('')

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

const normalizePrDetails = (prData: any) => {
  if (!prData) return prData

  const rawDetails = prData.t_purchase_request_ds || prData.t_purchase_request_d || []
  const normalizedDetails = rawDetails.map((d: any) => {
    const item = d.m_item || d.m_items || null
    const images = item?.m_items_images || item?.m_items_image || []

    return {
      ...d,
      m_item: item
        ? {
            ...item,
            m_items_images: images
          }
        : null
    }
  })

  return {
    ...prData,
    t_purchase_request_ds: normalizedDetails
  }
}

const fetchNotificationDetail = async () => {
  try {
    loading.value = true
    const response = await getPurchaseRequestNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)

    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }

    let hydratedNotification: any = { ...found }

    // Re-fetch full PR detail using same source as PurchaseRequestForm,
    // so detail items/UOM/images are consistent and complete.
    if (found.t_purchase_request_id) {
      try {
        const prRes = await getTPurchaseRequestById(found.t_purchase_request_id)
        if (prRes?.status === 'success' && prRes?.data) {
          hydratedNotification.t_purchase_request = normalizePrDetails(prRes.data)
        } else if (found.t_purchase_request) {
          hydratedNotification.t_purchase_request = normalizePrDetails(found.t_purchase_request)
        }
      } catch (err) {
        console.warn('Failed to hydrate PR detail from t_purchase_request service:', err)
        if (found.t_purchase_request) {
          hydratedNotification.t_purchase_request = normalizePrDetails(found.t_purchase_request)
        }
      }
    } else if (found.t_purchase_request) {
      hydratedNotification.t_purchase_request = normalizePrDetails(found.t_purchase_request)
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
    const prApproval = approvalList.find((a: any) =>
      a.path === '/purchasing/transaksi/t_purchase_request' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!prApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Purchase Request'
      })
      return
    }

    const approvalLevel = prApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    if (status === 'REVISI') {
      // Use revisi function from service
      await revisePurchaseRequest(
        notification.value.t_purchase_request_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    } else {
      // APPROVED - Use approve function from service
      await approvePurchaseRequest(
        notification.value.t_purchase_request_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    }

    toast.success(`Purchase Request ${status === 'APPROVED' ? 'approved' : 'revised'} successfully`)
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
    const prApproval = approvalList.find((a: any) =>
      a.path === '/purchasing/transaksi/t_purchase_request' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!prApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Purchase Request'
      })
      return
    }

    const approvalLevel = prApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    await rejectPurchaseRequest(
      notification.value.t_purchase_request_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Purchase Request berhasil di-reject')
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
  if (path.startsWith('http')) return path
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  if (path.startsWith('uploads/')) {
    return `${baseUrl}/${path}`
  }
  return `${baseUrl}/uploads/${path}`
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
  // If it's an image, show in preview dialog
  if (isImageFile(path)) {
    previewImages.value = [{ gambar: path }]
    previewTitle.value = getFileName(path)
    currentPreviewIndex.value = 0
    showImagePreview.value = true
  } else {
    // For PDF and other files, open in new tab
    window.open(getFileUrl(path), '_blank')
  }
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

const getDetailItem = (detail: any) => detail?.m_item || detail?.m_items || null

const getItemUom = (detail: any) => {
  const item = getDetailItem(detail)
  return item?.mi_uom?.value1 || item?.uom?.value1 || item?.m_general?.value1 || detail?.m_general?.value1 || '-'
}

const getItemOptimumStock = (detail: any) => {
  const item = getDetailItem(detail)
  return Number(
    item?.optimum_stock ??
    item?.stok_optimum ??
    item?.m_items_gudangs?.[0]?.stok_optimum ??
    detail?.stok_optimum ??
    0
  ) || 0
}

const getItemSafetyStock = (detail: any) => {
  const item = getDetailItem(detail)
  return Number(
    item?.safety_stok ??
    item?.safety_stock ??
    item?.m_items_gudangs?.[0]?.safety_stok ??
    detail?.safety_stok ??
    0
  ) || 0
}

const getItemImages = (detail: any) => {
  const item = getDetailItem(detail)
  return item?.m_items_images || item?.m_items_image || detail?.m_items_images || []
}

const getItemFreeStock = (detail: any) => {
  return detail?.qty_free_stok || 0
}

const getItemQtyOts = (detail: any) => {
  return detail?.qty_ots || 0
}

const closeImagePreview = () => {
  showImagePreview.value = false
  previewImages.value = []
}

const nextPreviewImage = () => {
  if (currentPreviewIndex.value < previewImages.value.length - 1) {
    currentPreviewIndex.value++
  } else {
    currentPreviewIndex.value = 0
  }
}

const prevPreviewImage = () => {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--
  } else {
    currentPreviewIndex.value = previewImages.value.length - 1
  }
}

const handlePreviewKeyPress = (event: KeyboardEvent) => {
  if (!showImagePreview.value) return

  if (event.key === 'ArrowRight') {
    nextPreviewImage()
  } else if (event.key === 'ArrowLeft') {
    prevPreviewImage()
  } else if (event.key === 'Escape') {
    showImagePreview.value = false
  }
}

const openItemImages = (detail: any) => {
  const images = getItemImages(detail)
  if (images.length > 0) {
    previewImages.value = images.map((img: any) => ({
      gambar: img.gambar,
      id: img.id
    }))
    previewTitle.value = getDetailItem(detail)?.nama_item || 'Item Image'
    currentPreviewIndex.value = 0
    showImagePreview.value = true
  } else {
    toast.info('Tidak ada foto untuk item ini')
  }
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
          <span class="truncate">Purchase Request Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve purchase request
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
              <span class="font-medium truncate">{{ (notification as any).tpr_sender?.name ||
                notification.user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Purchase Request Details Card -->
      <Card v-if="notification.t_purchase_request">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Request
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap Purchase Request yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. PR</Label>
              <p class="text-base md:text-lg font-bold text-primary break-all">{{ notification.t_purchase_request.no_pr
                || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_purchase_request.status)" class="text-xs md:text-sm">
                  {{ notification.t_purchase_request.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal PR
              </Label>
              <p class="text-sm md:text-base">{{ formatDate(notification.t_purchase_request.tgl_pr) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal Butuh
              </Label>
              <p class="text-sm md:text-base font-medium">{{ formatDate(notification.t_purchase_request.tgl_butuh) }}
              </p>
            </div>
            <!-- <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Prioritas</Label>
              <div>
                <Badge :variant="getPriorityVariant(notification.t_purchase_request.m_general?.value1 || '')"
                  class="text-xs">
                  {{ notification.t_purchase_request.m_general?.value1 || 'NORMAL' }}
                </Badge>
              </div>
            </div> -->
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Unit Bisnis</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_request.m_unit_bisni?.nama_comp || '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Gudang</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_request.m_gudang?.nama_gudang || '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Tipe User</Label>
              <p class="text-sm md:text-base">{{ notification.t_purchase_request.req_type_user || '-' }}</p>
            </div>
          </div>

          <Separator />

          <!-- Requester Info -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Informasi Pengaju
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Dibuat Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ notification.t_purchase_request.req_user_by ||
                  notification.t_purchase_request.prq_ctr?.name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Diupdate Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ notification.t_purchase_request.prq_update?.name || '-' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="notification.t_purchase_request.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan Purchase Request</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ notification.t_purchase_request.catatan }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Items -->
      <Card v-if="notification.t_purchase_request">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Package class="h-5 w-5 shrink-0" />
            Detail Items
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Daftar item yang diminta</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <!-- Mobile Card View -->
          <div class="md:hidden space-y-3">
            <div v-if="!notification.t_purchase_request.t_purchase_request_ds?.length"
              class="text-center py-8 text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Package class="h-8 w-8 opacity-50" />
                <p class="text-sm">Tidak ada item</p>
              </div>
            </div>
            <div v-for="(detail, idx) in notification.t_purchase_request.t_purchase_request_ds" :key="detail.id"
              class="border rounded-lg p-3 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-sm truncate">{{ getDetailItem(detail)?.nama_item || '-' }}</p>
                  <p class="text-xs text-muted-foreground font-mono">{{ getDetailItem(detail)?.kode_item || '-' }}</p>
                </div>
                <Badge variant="secondary" class="shrink-0 font-bold">{{ detail.qty_pr }}</Badge>
              </div>
              <div class="text-xs grid grid-cols-2 gap-2 text-muted-foreground">
                <div>UoM: <span class="text-foreground">{{ getItemUom(detail) }}</span></div>
                <div>Free Stock: <span class="text-foreground">{{ getItemFreeStock(detail) }}</span></div>
                <div>Safety Stock: <span class="text-foreground">{{ getItemSafetyStock(detail) }}</span></div>
                <div>Qty Ots: <span class="text-foreground">{{ getItemQtyOts(detail) }}</span></div>
                <div>Opt. Stock: <span class="text-foreground">{{ getItemOptimumStock(detail) }}</span></div>
              </div>
              <div v-if="detail.catatan" class="text-xs text-muted-foreground">
                <span>Catatan: </span>{{ detail.catatan }}
              </div>
            </div>
          </div>

          <!-- Desktop Table View -->
          <div class="hidden md:block border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12">No</TableHead>
                  <TableHead>Kode Item</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead class="w-24 text-center">Qty</TableHead>
                  <TableHead class="w-24">UoM</TableHead>
                  <TableHead class="w-24">Free Stock</TableHead>
                  <TableHead class="w-24">Safety Stock</TableHead>
                  <TableHead class="w-24">Opt. Stock</TableHead>
                  <TableHead class="w-20 text-center">Foto Item</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!notification.t_purchase_request.t_purchase_request_ds?.length">
                  <TableCell colspan="10" class="text-center py-8 text-muted-foreground">
                    <div class="flex flex-col items-center gap-2">
                      <Package class="h-8 w-8 opacity-50" />
                      <p class="text-sm">Tidak ada item dalam Purchase Request ini</p>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-for="(detail, idx) in notification.t_purchase_request.t_purchase_request_ds"
                  :key="detail.id" class="hover:bg-muted/50">
                  <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                  <TableCell>
                    <span class="font-mono text-sm">{{ getDetailItem(detail)?.kode_item || '-' }}</span>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1">
                      <p class="font-medium">{{ getDetailItem(detail)?.nama_item || '-' }}</p>
                      <p v-if="getDetailItem(detail)?.nama_singkat" class="text-xs text-muted-foreground">
                        {{ getDetailItem(detail)?.nama_singkat }}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <Badge variant="secondary" class="font-bold">{{ detail.qty_pr }}</Badge>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm">{{ getItemUom(detail) }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm">{{ getItemFreeStock(detail) }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm">{{ getItemSafetyStock(detail) }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm">{{ getItemOptimumStock(detail) }}</span>
                  </TableCell>
                  <TableCell class="text-center">
                    <Button variant="ghost" size="icon" @click="openItemImages(detail)"
                      :disabled="!getItemImages(detail)?.length">
                      <Eye class="h-4 w-4 text-primary" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <p class="text-sm text-muted-foreground">{{ detail.catatan || '-' }}</p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Summary -->
          <div v-if="notification.t_purchase_request.t_purchase_request_ds?.length"
            class="mt-4 p-3 bg-muted rounded-md">
            <div class="flex items-center justify-between text-xs md:text-sm">
              <span class="text-muted-foreground">Total Items:</span>
              <span class="font-bold">{{ notification.t_purchase_request.t_purchase_request_ds.length }}
                item(s)</span>
            </div>
            <div class="flex items-center justify-between text-xs md:text-sm mt-1">
              <span class="text-muted-foreground">Total Qty:</span>
              <span class="font-bold">{{notification.t_purchase_request.t_purchase_request_ds.reduce((sum: number,
                d: any) => sum + (d.qty_pr || 0), 0)}}</span>
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

    <!-- Image Preview (Multiple) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showImagePreview"
          class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          @click="closeImagePreview" @keydown="handlePreviewKeyPress" tabindex="0">

          <div class="relative w-full h-full max-w-6xl max-h-[95vh] flex items-center justify-center" @click.stop>
            <Button variant="ghost" size="icon"
              class="absolute top-4 right-4 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click="closeImagePreview">
              <X class="h-6 w-6" />
            </Button>

            <Button v-if="previewImages.length > 1" variant="ghost" size="icon"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="prevPreviewImage">
              <ChevronLeft class="h-8 w-8" />
            </Button>

            <Button v-if="previewImages.length > 1" variant="ghost" size="icon"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="nextPreviewImage">
              <ChevronRight class="h-8 w-8" />
            </Button>

            <div class="flex flex-col items-center justify-center gap-3 w-full h-full px-4 pb-4">
              <h3 class="text-white text-xl font-semibold">{{ previewTitle }}</h3>

              <div class="flex items-center justify-center rounded-lg bg-white dark:bg-gray-900 p-4 max-w-full"
                style="max-height: calc(95vh - 200px);">
                <img :src="getFileUrl(previewImages[currentPreviewIndex]?.gambar)"
                  :alt="`Image ${currentPreviewIndex + 1}`" class="max-w-[85vw] w-auto h-auto object-contain"
                  style="max-height: calc(95vh - 220px);" @click.stop @error="() => toast.error('Gagal memuat gambar')" />
              </div>

              <div class="flex items-center gap-2">
                <div class="text-white text-sm bg-black/60 px-4 py-2 rounded-full">
                  {{ currentPreviewIndex + 1 }} / {{ previewImages.length }}
                </div>
              </div>

              <div v-if="previewImages.length > 1" class="flex gap-2 overflow-x-auto max-w-full px-4">
                <button v-for="(img, index) in previewImages" :key="index" type="button"
                  class="shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all flex items-center justify-center bg-muted"
                  :class="index === currentPreviewIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'"
                  @click.stop="currentPreviewIndex = index">
                  <img :src="getFileUrl(img.gambar)" :alt="`Thumbnail ${index + 1}`" class="w-full h-full object-cover" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
