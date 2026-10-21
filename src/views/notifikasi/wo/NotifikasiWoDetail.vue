<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Wrench, User, FileText, AlertCircle, Calendar, Ban } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'vue-sonner'
import {
  getWoNotifications,
  approveWo,
  reviseWo,
  rejectWo,
  type WoNotification
} from './service.wo'
import { getWoById } from '@/views/production/transaksi/t_wo/service'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<WoNotification | null>(null)
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
  if (!dateString) return '-'
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
    const response = await getWoNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)

    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }

    let hydratedNotification: any = { ...found }
    if (found.t_wo_id) {
      try {
        const woRes = await getWoById(found.t_wo_id)
        if (woRes?.status === 'success' && woRes?.data) {
          hydratedNotification.t_wo = woRes.data
        }
      } catch (err) {
        console.warn('Failed to hydrate WO details:', err)
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

  if (status === 'REVISI' && !approvalCatatan.value?.trim()) {
    toast.error('Alasan Revisi wajib diisi', {
      description: 'Silakan masukkan alasan sebelum melakukan revisi'
    })
    return
  }

  submitting.value = true
  try {
    const approvalList = authStore.getApprovalList()
    const woPath = (notification.value?.t_wo as any)?.flag === 'WIP'
      ? '/production/transaksi/t_wo_wip'
      : '/production/transaksi/t_wo'

    const woApproval = approvalList.find((a: any) =>
      a.path === woPath &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!woApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Work Order'
      })
      return
    }

    const approvalLevel = woApproval.level
    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', { description: 'Approval level is missing' })
      return
    }

    if (status === 'REVISI') {
      await reviseWo(
        notification.value.t_wo_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    } else {
      await approveWo(
        notification.value.t_wo_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    }

    toast.success(`Work Order ${status === 'APPROVED' ? 'berhasil disetujui' : 'berhasil direvisi'}`)
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
    const woPath = (notification.value?.t_wo as any)?.flag === 'WIP'
      ? '/production/transaksi/t_wo_wip'
      : '/production/transaksi/t_wo'

    const woApproval = approvalList.find((a: any) =>
      a.path === woPath &&
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!woApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Work Order'
      })
      return
    }

    const approvalLevel = woApproval.level
    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error('Invalid approval level', { description: 'Approval level is missing' })
      return
    }

    await rejectWo(
      notification.value.t_wo_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Work Order berhasil di-reject')
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
    case 'POST': return 'default'
    case 'CONFIRM': return 'secondary'
    default: return 'secondary'
  }
}

const getFlagLabel = (flag: string) => {
  switch (flag?.toUpperCase()) {
    case 'FG': return 'Finish Good'
    case 'WIP': return 'Work In Progress'
    default: return flag || '-'
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
          <Wrench class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Work Order Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve work order
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
              <span class="font-medium truncate">
                {{ (notification as any).two_sender?.name || notification.user_default?.name || 'N/A' }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Work Order Details Card -->
      <Card v-if="notification.t_wo">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Work Order
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap Work Order yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">

          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. Work Order</Label>
              <p class="text-base md:text-lg font-bold text-primary break-all">{{ (notification.t_wo as any).no || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_wo.status)" class="text-xs md:text-sm">
                  {{ notification.t_wo.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal WO
              </Label>
              <p class="text-sm md:text-base">{{ formatDate((notification.t_wo as any).date) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Flag / Tipe</Label>
              <div>
                <Badge variant="outline" class="text-xs">
                  {{ getFlagLabel((notification.t_wo as any).flag) }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Unit Bisnis</Label>
              <p class="text-sm md:text-base font-medium">
                {{ (notification.t_wo as any).m_unit_bisni?.nama_comp || '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Customer</Label>
              <p class="text-sm md:text-base font-medium">
                {{ (notification.t_wo as any).m_customer?.nama || '-' }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Ref. Type</Label>
              <p class="text-sm md:text-base">{{ (notification.t_wo as any).ref_type || '-' }}</p>
            </div>
          </div>

           <!-- Creator Info -->
          <Separator />
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <User class="h-4 w-4" />
              Informasi Pembuat
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Dibuat Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ (notification.t_wo as any).wo_ctr?.name || '-' }}</p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs md:text-sm font-medium text-muted-foreground">Diupdate Oleh</Label>
                <p class="text-sm md:text-base truncate">{{ (notification.t_wo as any).wo_updt?.name || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- Catatan WO -->
          <template v-if="(notification.t_wo as any).notes">
            <Separator />
            <div class="space-y-2">
              <Label class="text-xs md:text-sm font-semibold">Catatan Work Order</Label>
              <div class="p-3 md:p-4 bg-muted rounded-md">
                <p class="text-sm md:text-base whitespace-pre-wrap">{{ (notification.t_wo as any).notes }}</p>
              </div>
            </div>
          </template>

        </CardContent>
      </Card>

      <!-- WO Detail Items Card -->
      <Card v-if="(notification.t_wo as any).t_wo_d_items?.length > 0">
        <CardHeader class="p-4 md:p-6">
          <div class="flex items-center gap-2">
            <Package class="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle class="text-base md:text-lg">Detail Items</CardTitle>
              <CardDescription class="text-xs md:text-sm mt-0.5">Daftar item yang diproduksi</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-md overflow-hidden overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[50px] text-center">No</TableHead>
                  <TableHead class="min-w-[150px]">Kode Item</TableHead>
                  <TableHead class="min-w-[200px]">Nama Item</TableHead>
                  <TableHead class="w-[80px] text-center">Qty</TableHead>
                  <TableHead class="w-[80px] text-center">Satuan</TableHead>
                  <TableHead class="min-w-[120px]">Finish Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="(item, idx) in (notification.t_wo as any).t_wo_d_items"
                  :key="item.id || idx"
                >
                  <TableCell class="text-center">{{ Number(idx) + 1 }}</TableCell>
                  <TableCell>
                    <span class="font-medium">{{ item.m_item?.kode_item || '-' }}</span>
                  </TableCell>
                  <TableCell>
                    <span>{{ item.m_item?.nama_item || '-' }}</span>
                    <div v-if="item.notes" class="text-xs text-muted-foreground mt-1">{{ item.notes }}</div>
                  </TableCell>
                  <TableCell class="text-center font-medium">{{ item.qty || 0 }}</TableCell>
                  <TableCell class="text-center">{{ item.m_general_unit?.value1 || '-' }}</TableCell>
                  <TableCell>{{ formatDate(item.finish_date) }}</TableCell>
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
            <AlertCircle class="h-5 w-5 shrink-0" />
            Informasi Approval
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4 bg-primary/10 dark:bg-primary/10 rounded-md">
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

      <!-- Approval Action Card -->
      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk Work Order ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            hints=""
            :rows="3"
            :disabled="submitting"
            :required="false"
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
