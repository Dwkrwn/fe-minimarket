<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Package, User, FileText, AlertCircle, Download, ExternalLink, Ban } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { 
  getMtfNotifications, 
  approveMtf, 
  reviseMtf,
  rejectMtf,
  type MtfNotification 
} from './service.mtf'
import { getMtfById } from '@/views/production/transaksi/t_mtf/service'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'

const { API_BASE_URL } = useApi()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<MtfNotification | null>(null)
const approvalCatatan = ref('')
const detailArr = ref<any[]>([])

// Preview dialog
const showPreviewDialog = ref(false)
const previewImageUrl = ref('')
const previewFileName = ref('')

const notificationId = computed(() => route.params.id as string)

const getFileUrl = (filePath: string | null) => {
  if (!filePath) return null
  const baseUrl = API_BASE_URL.replace('/api', '')
  return `${baseUrl}/${filePath}`
}

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

const fetchNotificationDetail = async () => {
  try {
    loading.value = true
    const response = await getMtfNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)
    
    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }
    
    notification.value = found
    approvalCatatan.value = found.approval_catatan || ''

    if (found.t_mtf_id) {
      const mtfRes = await getMtfById(found.t_mtf_id)
      if (mtfRes?.status === 'success' && mtfRes?.data) {
        found.t_mtf = mtfRes.data
        const rawDetails = mtfRes.data.t_mtf_ds || mtfRes.data.t_mtf_d || mtfRes.data.t_mtf_details || []
        detailArr.value = rawDetails.map((item: any) => ({
          ...item,
          qty_confirm: item.qty_confirm !== undefined && item.qty_confirm !== null ? Number(item.qty_confirm) : Number(item.qty_transfer || 0),
          reason_confirm: item.reason_confirm || ''
        }))
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

  // Catatan is optional

  submitting.value = true
  try {
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) => 
      a.path === '/production/transaksi/t_mtf' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Material Transfer'
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
      await reviseMtf(
        notification.value.t_mtf_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
      toast.success(`Material Transfer revised successfully`)
    } else {
      // Validate detailArr before approval
      for (let i = 0; i < detailArr.value.length; i++) {
        const d = detailArr.value[i]
        const seq = i + 1

        if (d.qty_confirm === undefined || d.qty_confirm === null || String(d.qty_confirm) === "") {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm wajib diisi' })
          submitting.value = false
          return
        }

        const qtyConfVal = Number(d.qty_confirm)
        const qtyTransVal = Number(d.qty_transfer)

        if (qtyConfVal < 0) {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm tidak boleh negatif' })
          submitting.value = false
          return
        }

        if (qtyConfVal > qtyTransVal) {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Confirm tidak boleh melebihi Qty Transfer' })
          submitting.value = false
          return
        }

        if (qtyConfVal < qtyTransVal && !d.reason_confirm?.trim()) {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Reason Confirm wajib diisi jika Qty Confirm kurang dari Qty Transfer' })
          submitting.value = false
          return
        }
      }

      const detailsPayload = detailArr.value.map(d => ({
        id: d.id,
        qty_confirm: Number(d.qty_confirm),
        reason_confirm: d.reason_confirm?.trim() || ''
      }))

      await approveMtf(
        notification.value.t_mtf_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
        detailsPayload
      )
      toast.success(`Material Transfer confirmed successfully`)
    }

    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Failed to submit action', {
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
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) => 
      a.path === '/production/transaksi/t_mtf' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Material Transfer'
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

    await rejectMtf(
      notification.value.t_mtf_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Material Transfer rejected successfully')
    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Failed to reject', {
      description: error.message || 'An error occurred'
    })
  } finally {
    submitting.value = false
  }
}

const getStatusVariant = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'CONFIRM':
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
          <span class="truncate">Material Transfer Confirmation</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and confirm Material Transfer request
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
              <span class="font-medium truncate">{{ notification.tmtf_sender?.name || notification.user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Data Details Card -->
      <Card v-if="notification.t_mtf">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Material Transfer
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap data yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. Material Transfer</Label>
              <p class="text-base md:text-lg font-bold text-primary font-mono break-all">{{ notification.t_mtf.no || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_mtf.status)" class="text-xs md:text-sm">
                  {{ notification.t_mtf.status }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="notification.t_mtf.notes" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ notification.t_mtf.notes }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Materials List Table Card -->
      <Card v-if="notification.t_mtf && detailArr.length > 0">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Package class="h-5 w-5 shrink-0" />
            Daftar Material
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail item material yang ditransfer</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left w-12">No</th>
                  <th class="px-4 py-3 text-left">Kode Material</th>
                  <th class="px-4 py-3 text-left min-w-[200px]">Nama Material</th>
                  <th class="px-4 py-3 text-right w-32">Qty Transfer</th>
                  <th class="px-4 py-3 text-left w-24">Unit</th>
                  <th class="px-4 py-3 text-left min-w-[150px]">Keterangan</th>
                  <th class="px-4 py-3 text-right w-36">Qty Confirm <span class="text-destructive">*</span></th>
                  <th class="px-4 py-3 text-left min-w-[200px]">Reason Confirm <span v-if="detailArr.some(d => d.qty_confirm < d.qty_transfer)" class="text-destructive">*</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(detail, idx) in detailArr" :key="detail.id || idx" class="hover:bg-slate-50/50">
                  <td class="px-4 py-3 text-slate-700">{{ idx + 1 }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900 font-mono">{{ detail.m_item?.kode_item || detail.m_items?.kode_item || '-' }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ detail.m_item?.nama_item || detail.m_items?.nama_item || '-' }}</td>
                  <td class="px-4 py-3 text-right font-medium text-slate-700 font-mono">{{ detail.qty_transfer }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ detail.uom_name || detail.m_item?.mi_uom?.value1 || 'Unit' }}</td>
                  <td class="px-4 py-3 text-slate-500 text-xs">{{ detail.notes || '-' }}</td>
                  
                  <!-- Qty Confirm -->
                  <td class="px-4 py-2 text-right">
                    <input 
                      v-if="!notification.status"
                      type="number"
                      v-model.number="detail.qty_confirm"
                      class="w-24 px-2 py-1 text-right border rounded focus:ring-1 focus:ring-primary font-mono text-sm"
                      :min="0"
                      :max="detail.qty_transfer"
                      step="any"
                      :disabled="submitting"
                    />
                    <span v-else class="font-medium text-slate-900 font-mono">{{ detail.qty_confirm }}</span>
                  </td>

                  <!-- Reason Confirm -->
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-1.5 w-full">
                      <input 
                        v-if="!notification.status"
                        type="text"
                        v-model="detail.reason_confirm"
                        class="flex-1 px-2 py-1 border rounded focus:ring-1 focus:ring-primary text-sm"
                        placeholder="Wajib diisi jika Qty Confirm < Qty Transfer"
                        :disabled="submitting || detail.qty_confirm >= detail.qty_transfer"
                      />
                      <span v-if="!notification.status && detail.qty_confirm < detail.qty_transfer" class="text-destructive font-bold text-base shrink-0" title="Wajib diisi">*</span>
                    </div>
                    <span v-if="notification.status" class="text-slate-600 text-xs">{{ detail.reason_confirm || '-' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
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

      <!-- Approval Section -->
      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Confirmation Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk Material Transfer ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Confirmation"
            placeholder="Masukkan catatan confirmation (opsional)..."
            :rows="3"
            :disabled="submitting"
            :required="false"
          />

          <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end pt-2 md:pt-4">
            <Button 
              @click="() => handleApproval('APPROVED')"
              variant="default"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              <Check class="h-4 w-4" />
              Confirm
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

    <!-- File Preview Dialog -->
    <Dialog :open="showPreviewDialog" @update:open="showPreviewDialog = $event">
      <DialogContent class="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader class="p-3 md:p-4 border-b shrink-0">
          <DialogTitle class="flex items-center gap-2 md:gap-3">
            <span class="truncate flex-1 text-xs md:text-sm">{{ previewFileName }}</span>
          </DialogTitle>
        </DialogHeader>
        <div class="flex-1 p-2 md:p-4 flex items-center justify-center bg-muted/50 overflow-auto min-h-0">
          <img 
            :src="previewImageUrl" 
            :alt="previewFileName"
            class="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
