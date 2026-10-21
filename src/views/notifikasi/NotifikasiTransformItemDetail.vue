<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Package, User, FileText, AlertCircle, Calendar, Ban, Building2, Warehouse, Box } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'vue-sonner'
import {
  getTransformItemNotifications,
  approveTransformItem,
  reviseTransformItem,
  rejectTransformItem,
  type TransformItemNotification
} from './service.transform_item'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'
import { apiCall } from '@/lib/api'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<TransformItemNotification | null>(null)
const approvalCatatan = ref('')

const notificationId = computed(() => route.params.id as string)

const pickFirst = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return null
}

const toBool = (value: any) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value).toLowerCase() === 'true'

const transformItem = computed(() => {
  const tti = (notification.value?.t_transform_item || {}) as any
  return {
    raw: tti,
    noTransform: pickFirst(tti.no_transform_item, tti.no_t_transform_item, '-'),
    status: pickFirst(tti.status, '-') as string,
    companyName: pickFirst(tti.m_unit_bisnis?.nama_comp, tti.m_unit_bisni?.nama_comp, '-'),
    tglTransform: pickFirst(tti.tgl_transform, tti.tgl_t_transform_item, null),
    jenisTransform: pickFirst(
      tti.jenis_trans_item?.value1,
      tti.jenis_transform_general?.value1,
      tti.m_jenis_transform?.value1,
      '-'
    ),
    warehouseName: pickFirst(tti.m_gudang?.nama_gudang, tti.warehouse_transform?.nama_gudang, '-'),
    itemKode: pickFirst(tti.m_item?.kode_item, tti.item?.kode_item, '-'),
    itemNama: pickFirst(tti.m_item?.nama_item, tti.item?.nama_item, '-'),
    qty: Number(tti.qty || 0),
    satuan: pickFirst(
      tti.satuan_trans_item?.value1,
      tti.satuan?.value1,
      tti.m_satuan?.value1,
      tti.m_item?.mi_uom?.value1,
      tti.item?.mi_uom?.value1,
      '-'
    ),
    rakHeader: pickFirst(
      tti.stock_gudang?.m_rak_d?.kode,
      tti.stock_gudang?.kode,
      '-'
    ),
    rakHeaderMaster: pickFirst(
      tti.stock_gudang?.m_rak_d?.m_rak?.nama_rak,
      tti.stock_gudang?.m_rak?.nama_rak,
      ''
    ),
    picName: pickFirst(tti.pic?.nama_kary, tti.m_kary?.nama_kary, '-'),
    catatan: pickFirst(tti.catatan, ''),
    isPemotongan: !!tti.is_pemotongan,
  }
})

const detailRows = computed(() => {
  const tti = transformItem.value.raw
  const rawDetails = Array.isArray(tti?.t_transform_item_ds)
    ? tti.t_transform_item_ds
    : Array.isArray(tti?.t_transform_item_d)
      ? tti.t_transform_item_d
      : []

  return rawDetails.map((detail: any, idx: number) => {
    const rakKode = pickFirst(
      detail?.m_rak_d?.kode,
      detail?.rak_detail?.kode,
      detail?.stock_gudang?.m_rak_d?.kode,
      detail?.rak_info,
      '-'
    )
    const rakMaster = pickFirst(
      detail?.stock_gudang?.m_rak_d?.m_rak?.nama_rak,
      detail?.stock_gudang?.m_rak?.nama_rak,
      ''
    )

    return {
      id: detail?.id || `${idx}`,
      panjang: pickFirst(detail?.panjang, '-'),
      kodeItem: pickFirst(detail?.m_item?.kode_item, detail?.item_transform?.kode_item, detail?.kode_item, '-'),
      namaItem: pickFirst(detail?.m_item?.nama_item, detail?.item_transform?.nama_item, detail?.nama_item, '-'),
      qtyTransform: Number(detail?.qty_transform || 0),
      satuan: pickFirst(
        detail?.m_item?.mi_uom?.value1,
        detail?.item_transform?.mi_uom?.value1,
        detail?.satuan,
        '-'
      ),
      isAcuan: toBool(detail?.is_acuan),
      rakInfo: rakMaster && rakMaster !== '-' ? `${rakKode} (${rakMaster})` : rakKode,
      catatan: pickFirst(detail?.catatan, '-'),
    }
  })
})

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
    const response = await getTransformItemNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)

    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }

    notification.value = found
    approvalCatatan.value = found.approval_catatan || ''

    // Fetch full t_transform_item detail if needed
    if (found.t_transform_item_id) {
      try {
        const detailResponse = await apiCall<any>(
          `/dynamic/t_transform_item/${found.t_transform_item_id}?include=m_unit_bisnis,m_gudang,m_kary,m_items,m_general,stock_gudang>m_rak_d>m_rak,t_transform_item_d>m_items>m_general,t_transform_item_d>m_items>m_general,t_transform_item_d>stock_gudang>m_rak_d>m_rak`,
          { method: 'GET' }
        )
        if (detailResponse.data) {
          notification.value.t_transform_item = detailResponse.data
        }
      } catch (err) {
        console.error('Failed to fetch transform item detail:', err)
      }
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

const handleApproval = async (status: 'APPROVED' | 'REVISI') => {
  if (!notification.value) return

  submitting.value = true
  try {
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) =>
      a.path === '/inventory/transaksi/t_transform_item' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Transform Item'
      })
      return
    }

    const approvalLevel = moduleApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    if (status === 'REVISI') {
      await reviseTransformItem(
        notification.value.t_transform_item_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    } else {
      await approveTransformItem(
        notification.value.t_transform_item_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    }

    toast.success(`Transform Item ${status === 'APPROVED' ? 'approved' : 'revised'} successfully`)
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

  if (!approvalCatatan.value?.trim()) {
    toast.error('Alasan Reject wajib diisi', {
      description: 'Silakan masukkan alasan sebelum melakukan reject'
    })
    return
  }

  submitting.value = true
  try {
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) =>
      a.path === '/inventory/transaksi/t_transform_item' &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Transform Item'
      })
      return
    }

    const approvalLevel = moduleApproval.level

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', {
        description: 'Approval level is missing'
      })
      return
    }

    await rejectTransformItem(
      notification.value.t_transform_item_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Transform Item berhasil di-reject')
    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Gagal reject', {
      description: error.message || 'Terjadi kesalahan'
    })
  } finally {
    submitting.value = false
  }
}

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
          <Package class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Transform Item Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Transform Item request
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
              <span class="font-medium truncate">{{ (notification as any).tti_sender?.name ||
                notification.user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Transform Item Details Card -->
      <Card v-if="notification.t_transform_item">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Transform Item
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap data yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <FileText class="h-3 w-3" />
                No. Transform Item
              </Label>
              <p class="text-base md:text-lg font-bold text-primary font-mono break-all">
                {{ transformItem.noTransform }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <AlertCircle class="h-3 w-3" />
                Status
              </Label>
              <div>
                <Badge :variant="getStatusVariant(transformItem.status)" class="text-xs md:text-sm">
                  {{ transformItem.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Building2 class="h-3 w-3" />
                Company
              </Label>
              <p class="text-sm md:text-base">
                {{ transformItem.companyName }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar class="h-3 w-3" />
                Tanggal Transform
              </Label>
              <p class="text-sm md:text-base">
                {{ transformItem.tglTransform ? formatDate(transformItem.tglTransform) : '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Package class="h-3 w-3" />
                Jenis Transform
              </Label>
              <p class="text-sm md:text-base">
                {{ transformItem.jenisTransform }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Warehouse class="h-3 w-3" />
                Warehouse
              </Label>
              <p class="text-sm md:text-base">
                {{ transformItem.warehouseName }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Main Item Info -->
          <div class="space-y-2">
            <Label class="text-xs md:text-sm font-semibold flex items-center gap-1">
              <Box class="h-4 w-4" />
              Item Utama
            </Label>
            <div class="p-3 md:p-4 bg-muted rounded-md space-y-2">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label class="text-xs text-muted-foreground">Kode Item</Label>
                  <p class="text-sm font-medium">{{ transformItem.itemKode }}</p>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">Nama Item</Label>
                  <p class="text-sm font-medium">{{ transformItem.itemNama }}</p>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">Qty</Label>
                  <p class="text-sm font-medium">{{ transformItem.qty }}</p>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">Satuan</Label>
                  <p class="text-sm font-medium">
                    {{ transformItem.satuan }}
                  </p>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">Rak</Label>
                  <p class="text-sm font-medium">
                    {{ transformItem.rakHeader }}
                    <span v-if="transformItem.rakHeaderMaster" class="text-muted-foreground">
                      ({{ transformItem.rakHeaderMaster }})
                    </span>
                  </p>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">PIC</Label>
                  <p class="text-sm font-medium">{{ transformItem.picName }}</p>
                </div>
              </div>
              <div v-if="transformItem.isPemotongan" class="pt-2 border-t">
                <Badge variant="outline" class="text-xs">
                  <Check class="h-3 w-3 mr-1" />
                  Pemotongan
                </Badge>
              </div>
            </div>
          </div>

          <!-- Detail Items Table -->
          <div v-if="detailRows.length > 0" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Item Detail Transform</Label>
            <div class="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12">No</TableHead>
                    <TableHead>{{ transformItem.isPemotongan ? 'Panjang' : 'Kode' }}</TableHead>
                    <TableHead>{{ transformItem.isPemotongan ? 'Hasil Item' : 'Nama Item' }}</TableHead>
                    <TableHead v-if="!transformItem.isPemotongan" class="w-20">Acuan</TableHead>
                    <TableHead class="w-24">Qty TW</TableHead>
                    <TableHead v-if="!transformItem.isPemotongan" class="w-20">Satuan</TableHead>
                    <TableHead v-if="!transformItem.isPemotongan">Rak</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(detail, idx) in detailRows" :key="detail.id || idx">
                    <TableCell class="font-medium">{{ Number(idx) + 1 }}</TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ transformItem.isPemotongan ? detail.panjang : detail.kodeItem }}
                    </TableCell>
                    <TableCell>
                      {{ transformItem.isPemotongan ? '-' : detail.namaItem }}
                    </TableCell>
                    <TableCell v-if="!transformItem.isPemotongan" class="text-xs">{{ detail.isAcuan ? 'Ya' : 'Tidak' }}</TableCell>
                    <TableCell class="text-right font-medium">{{ detail.qtyTransform }}</TableCell>
                    <TableCell v-if="!transformItem.isPemotongan" class="text-xs">{{ detail.satuan }}</TableCell>
                    <TableCell v-if="!transformItem.isPemotongan" class="text-xs">{{ detail.rakInfo }}</TableCell>
                    <TableCell class="text-xs text-muted-foreground">{{ detail.catatan }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="transformItem.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ transformItem.catatan }}</p>
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
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk Transform Item ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX v-model="approvalCatatan" type="textarea" label="Catatan Approval"
            placeholder="Masukkan catatan approval (opsional)..." hints="Catatan ini opsional" :rows="3"
            :disabled="submitting" :required="false" />

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
  </div>
</template>
