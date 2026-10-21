<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Package, User, FileText, AlertCircle, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from 'vue-sonner'
import { 
  getRcNotifications, 
  receiveRc, 
  reviseRc,
  rejectRc,
  type RcNotification 
} from './service.rc'
import { getRcById } from '@/views/production/transaksi/t_rc/service'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<RcNotification | null>(null)
const approvalCatatan = ref('')
const detailArr = ref<any[]>([])

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

const formatDate = (dateString?: string) => {
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
    const response = await getRcNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)
    
    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }
    
    notification.value = found
    approvalCatatan.value = found.approval_catatan || ''

    if (found.t_rc_id) {
      const rcRes = await getRcById(found.t_rc_id)
      if (rcRes?.status === 'success' && rcRes?.data) {
        found.t_rc = rcRes.data
        const rawDetails = rcRes.data.t_rc_ds || rcRes.data.t_rc_d || rcRes.data.t_rc_details || []
        detailArr.value = rawDetails.map((item: any) => ({
          ...item,
          qty_received: item.qty_received !== undefined && item.qty_received !== null ? Number(item.qty_received) : Number(item.qty_confirm || 0),
          notes: item.notes || ''
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

  submitting.value = true
  try {
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList() || []
    const moduleApproval = approvalList.find((a: any) => 
      a && a.path && typeof a.path === 'string' && a.path.includes('t_rc') && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    // Fallback: If no approval configuration exists, use notification's current approval_level
    const approvalLevel = moduleApproval ? moduleApproval.level : (notification.value.approval_level || 0)

    if (status === 'REVISI') {
      await reviseRc(
        notification.value.t_rc_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
      toast.success(`Result Confirmation revised successfully`)
    } else {
      // Validate detailArr before approval
      for (let i = 0; i < detailArr.value.length; i++) {
        const d = detailArr.value[i]
        const seq = i + 1

        if (d.qty_received === undefined || d.qty_received === null || String(d.qty_received) === "") {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Received wajib diisi' })
          submitting.value = false
          return
        }

        const qtyRecVal = Number(d.qty_received)
        const qtyConfVal = Number(d.qty_confirm)

        if (qtyRecVal <= 0) {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: 'Qty Received harus bernilai positif' })
          submitting.value = false
          return
        }

        if (qtyRecVal > qtyConfVal) {
          toast.error(`Validasi Baris #${seq} Gagal`, { description: `Qty Received tidak boleh melebihi Qty Confirm (${qtyConfVal})` })
          submitting.value = false
          return
        }

        // Business Logic Validation: Notes is mandatory if Qty Received is not equal to Qty Confirm
        if (qtyRecVal !== qtyConfVal && (!d.notes || !d.notes.trim())) {
          toast.error(`Validasi Baris #${seq} Gagal`, { 
            description: 'Catatan (Notes) pada baris material wajib diisi jika Qty Received tidak sama dengan Qty Confirm' 
          })
          submitting.value = false
          return
        }
      }

      const detailsPayload = detailArr.value.map(d => ({
        id: d.id,
        qty_received: Number(d.qty_received),
        notes: d.notes?.trim() || ''
      }))

      await receiveRc(
        notification.value.t_rc_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
        detailsPayload
      )
      toast.success(`Result Confirmation received successfully`)
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

  if (!approvalCatatan.value?.trim()) {
    toast.error('Alasan Reject wajib diisi', {
      description: 'Silakan masukkan alasan sebelum melakukan reject'
    })
    return
  }

  submitting.value = true
  try {
    const approvalList = authStore.getApprovalList() || []
    const moduleApproval = approvalList.find((a: any) => 
      a && a.path && typeof a.path === 'string' && a.path.includes('t_rc') && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    // Fallback: If no approval configuration exists, use notification's current approval_level
    const approvalLevel = moduleApproval ? moduleApproval.level : (notification.value.approval_level || 0)

    await rejectRc(
      notification.value.t_rc_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Result Confirmation rejected successfully')
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
    case 'RECEIVED':
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
          <span class="truncate">Result Confirmation Receive</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and receive Result Confirmation request
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
              <span class="font-medium truncate">{{ notification.trc_sender?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Data Details Card -->
      <Card v-if="notification.t_rc">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Result Confirmation
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap data yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">No. Confirmation</Label>
              <p class="text-sm md:text-base font-bold text-primary font-mono break-all">{{ notification.t_rc.no || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Flag / Tipe</Label>
              <div>
                <Badge variant="outline" class="text-xs font-semibold">
                  {{ notification.t_rc.flag || '-' }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Warehouse Asal (PROD)</Label>
              <p class="text-sm md:text-base font-medium">{{ notification.t_rc.m_gudang_prod?.nama_gudang || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Warehouse Tujuan (INV)</Label>
              <p class="text-sm md:text-base font-medium">{{ notification.t_rc.m_gudang_confirm?.nama_gudang || '-' }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-2">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Tanggal Dokumen</Label>
              <p class="text-sm md:text-base">{{ formatDate(notification.t_rc.date) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status Transaksi</Label>
              <div>
                <Badge :variant="getStatusVariant(notification.t_rc.status)" class="text-xs md:text-sm">
                  {{ notification.t_rc.status }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="notification.t_rc.notes" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ notification.t_rc.notes }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Materials List Table Card -->
      <Card v-if="notification.t_rc && detailArr.length > 0">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Package class="h-5 w-5 shrink-0" />
            Daftar Material Hasil Produksi
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail item hasil produksi yang diterima</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left w-12">No</th>
                  <th class="px-4 py-3 text-left">No WO</th>
                  <th class="px-4 py-3 text-left">No Result</th>
                  <th class="px-4 py-3 text-left">Kode Material</th>
                  <th class="px-4 py-3 text-left min-w-[150px]">Nama Material</th>
                  <th class="px-4 py-3 text-left">Batch</th>
                  <th class="px-4 py-3 text-right">Qty Confirm</th>
                  <th class="px-4 py-3 text-left w-20">Unit</th>
                  <th class="px-4 py-3 text-right w-36">Qty Received <span class="text-destructive">*</span></th>
                  <th class="px-4 py-3 text-left min-w-[180px]">Notes <span v-if="detailArr.some(d => Number(d.qty_received) !== Number(d.qty_confirm))" class="text-destructive font-bold">*</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(detail, idx) in detailArr" :key="detail.id || idx" class="hover:bg-slate-50/50">
                  <td class="px-4 py-3 text-slate-700">{{ idx + 1 }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900 font-mono">{{ detail.t_pre?.t_wo?.no || detail.t_pres?.t_wo?.no || '-' }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900 font-mono">{{ detail.t_pre?.no || detail.t_pres?.no || '-' }}</td>
                  <td class="px-4 py-3 font-mono text-slate-700">{{ detail.m_item?.kode_item || detail.m_items?.kode_item || detail.t_pres_d_item?.m_item?.kode_item || '-' }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ detail.m_item?.nama_item || detail.m_items?.nama_item || detail.t_pres_d_item?.m_item?.nama_item || '-' }}</td>
                  <td class="px-4 py-3 text-slate-700 font-mono">{{ detail.batch || '-' }}</td>
                  <td class="px-4 py-3 text-right font-medium text-slate-700 font-mono">{{ detail.qty_confirm }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ detail.unit_id_pres?.value1 || 'Unit' }}</td>
                  
                  <!-- Qty Received -->
                  <td class="px-4 py-2 text-right">
                    <input 
                      v-if="!notification.status"
                      type="number"
                      v-model.number="detail.qty_received"
                      class="w-24 px-2 py-1 text-right border rounded focus:ring-1 focus:ring-primary font-mono text-sm"
                      :min="0.01"
                      :max="detail.qty_confirm"
                      step="any"
                      :disabled="submitting"
                    />
                    <span v-else class="font-medium text-slate-900 font-mono">{{ detail.qty_received }}</span>
                  </td>

                  <!-- Notes -->
                  <td class="px-4 py-2">
                    <input 
                      v-if="!notification.status"
                      type="text"
                      v-model="detail.notes"
                      class="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-primary text-sm transition-all"
                      :class="{ 'border-destructive focus:ring-destructive bg-destructive/5': Number(detail.qty_received) !== Number(detail.qty_confirm) && (!detail.notes || !detail.notes.trim()) }"
                      :placeholder="Number(detail.qty_received) !== Number(detail.qty_confirm) ? 'Catatan wajib diisi...' : 'Masukkan catatan...'"
                      :disabled="submitting"
                    />
                    <span v-else class="text-slate-600 text-xs">{{ detail.notes || '-' }}</span>
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
            Receive Confirmation Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Konfirmasi penerimaan barang hasil produksi ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Penerimaan"
            placeholder="Masukkan catatan penerimaan (opsional)..."
            :rows="3"
            :disabled="submitting"
            :required="false"
          />

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end pt-2 md:pt-4">
            <Button 
              @click="() => handleApproval('APPROVED')"
              variant="default"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              <Check class="h-4 w-4" />
              Receive
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
