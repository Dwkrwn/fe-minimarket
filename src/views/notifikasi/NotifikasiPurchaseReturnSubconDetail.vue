<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Check, X, Clock, Package, User, FileText, AlertCircle, Download, Eye, ExternalLink, Calendar, Ban } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { 
  getPurchaseReturnSubconNotifications, 
  approvePurchaseReturnSubcon, 
  revisePurchaseReturnSubcon,
  rejectPurchaseReturnSubcon,
  type PurchaseReturnSubconNotification 
} from './service.purchase_return_subcon'
import { getPurchaseReturnSubconById } from '@/views/purchasing/subcon/t_purchase_return_subcon/service'
import { getPurchaseInvoiceSubconPopulateByPi } from '@/views/purchasing/subcon/t_purchase_invoice_subcon/service'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import FieldX from '@/components/field/FieldX.vue'
import { apiCall } from '@/lib/api'

const { API_BASE_URL } = useApi()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const notification = ref<PurchaseReturnSubconNotification | null>(null)
const approvalCatatan = ref('')

// Preview dialog
const showPreviewDialog = ref(false)
const previewImageUrl = ref('')
const previewFileName = ref('')

const notificationId = computed(() => route.params.id as string)
const detailFg = ref<any[]>([])
const detailJasa = ref<any[]>([])
const detailMapPI = ref<Map<string, any>>(new Map())
const detailMapPI2 = ref<Map<string, any>>(new Map())
const returDetail = ref<any | null>(null)

const getArray = (source: any, keys: string[]) => {
  for (const key of keys) {
    const val = source?.[key]
    if (Array.isArray(val)) return val
  }
  return []
}

const getPbDetailId = (row: any, type: 'jadi' | 'jasa') => {
  if (type === 'jadi') {
    return row?.t_penerimaan_barang_subcon_jadi_id || row?.t_penerimaan_barang_subcon_jadi_ || null
  }
  return row?.t_penerimaan_barang_subcon_jasa_id || row?.t_penerimaan_barang_subcon_jasa_ || null
}

const fetchPbDetailSource = async (type: 'jadi' | 'jasa', id: string) => {
  const endpoint = type === 'jadi' ? 't_penerimaan_barang_subcon_jadi' : 't_penerimaan_barang_subcon_jasa'
  const include = type === 'jadi'
    ? 't_purchase_order_subcon_jadi>t_purchase_order_subcon,m_items,m_general,t_penerimaan_barang_subcon'
    : 't_purchase_order_subcon_jasa>t_purchase_order_subcon,m_items,m_general,t_penerimaan_barang_subcon'
  try {
    console.log('[PR Subcon Notif PB Enrich] fetch detail', { type, id, endpoint, include })
    const response = await apiCall<any>(`/dynamic/${endpoint}/${id}?include=${encodeURIComponent(include)}`, { method: 'GET' })
    console.log('[PR Subcon Notif PB Enrich] fetch success', { type, id, data: response?.data })
    return response?.data || null
  } catch (error) {
    console.log('[PR Subcon Notif PB Enrich] fetch failed', { type, id, error })
    return null
  }
}

const mergePbDisplay = (row: any, src: any, type: 'jadi' | 'jasa') => {
  const po = type === 'jadi'
    ? src?.t_purchase_order_subcon_jadi?.t_purchase_order_subcon
    : src?.t_purchase_order_subcon_jasa?.t_purchase_order_subcon
  const merged = {
    ...row,
    t_penerimaan_barang_subcon_id: row.t_penerimaan_barang_subcon_id || src?.t_penerimaan_barang_subcon_id || src?.t_penerimaan_barang_subcon?.id || null,
    no_po: row.no_po || po?.no_po || '-',
    no_penerimaan: row.no_penerimaan || src?.t_penerimaan_barang_subcon?.no_penerimaan || '-',
    kode: row.kode || src?.m_item?.kode_item || src?.m_items?.kode_item || '-',
    nama_item: row.nama_item || row.material || row.jasa || src?.m_item?.nama_item || src?.m_items?.nama_item || '-',
    finish_goods: row.finish_goods || src?.m_item?.nama_item || src?.m_items?.nama_item || '-',
    material: row.material || src?.m_item?.nama_item || src?.m_items?.nama_item || '-',
    qty_pb: Number(row.qty_pb ?? src?.qty_diterima ?? 0),
    uom: row.uom || src?.m_general?.value1 || '-',
    harga: Number(row.harga ?? src?.harga ?? 0),
  }
  console.log('[PR Subcon Notif PB Enrich] merged', {
    type,
    detailId: getPbDetailId(row, type),
    before: { no_po: row.no_po, no_penerimaan: row.no_penerimaan, kode: row.kode, nama_item: row.nama_item || row.material || row.jasa, uom: row.uom },
    after: { no_po: merged.no_po, no_penerimaan: merged.no_penerimaan, kode: merged.kode, nama_item: merged.nama_item, uom: merged.uom },
  })
  return merged
}

const enrichPbNotificationDetails = async () => {
  console.log('[PR Subcon Notif PB Enrich] start', {
    fgCount: detailFg.value.length,
    jasaCount: detailJasa.value.length,
    fgIds: detailFg.value.map((row: any) => getPbDetailId(row, 'jadi')),
    jasaIds: detailJasa.value.map((row: any) => getPbDetailId(row, 'jasa')),
  })
  detailFg.value = await Promise.all(detailFg.value.map(async (row: any) => {
    const id = getPbDetailId(row, 'jadi')
    if (!id) return row
    const src = await fetchPbDetailSource('jadi', id)
    return src ? mergePbDisplay(row, src, 'jadi') : row
  }))
  detailJasa.value = await Promise.all(detailJasa.value.map(async (row: any) => {
    const id = getPbDetailId(row, 'jasa')
    if (!id) return row
    const src = await fetchPbDetailSource('jasa', id)
    return src ? mergePbDisplay(row, src, 'jasa') : row
  }))
}

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
    console.log('[PR Subcon Notif] start fetch', { notificationId: notificationId.value })
    const response = await getPurchaseReturnSubconNotifications(1, 100)
    const found = response.data.find(n => n.id === notificationId.value)
    
    if (!found) {
      toast.error('Notification not found')
      router.push('/notifikasi')
      return
    }
    
    notification.value = found
    approvalCatatan.value = found.approval_catatan || ''
    console.log('[PR Subcon Notif] found notif', {
      notifId: found.id,
      returId: found.t_purchase_return_subcon_id
    })

    if (found.t_purchase_return_subcon_id) {
      const res = await getPurchaseReturnSubconById(found.t_purchase_return_subcon_id)
      console.log('[PR Subcon Notif] retur by id response', {
        status: res?.status,
        hasData: !!res?.data
      })
      if (res?.status === 'success') {
        returDetail.value = res.data as any
        ;(notification.value as any).t_purchase_return_subcon = res.data as any
        const fgFromRetur = getArray(res.data, ['t_purchase_return_subcon_jadis', 't_purchase_return_subcon_jadi'])
        const jasaFromRetur = getArray(res.data, ['t_purchase_return_subcon_jasas', 't_purchase_return_subcon_jasa'])
        if (fgFromRetur.length > 0) detailFg.value = fgFromRetur
        if (jasaFromRetur.length > 0) detailJasa.value = jasaFromRetur
        console.log('[PR Subcon Notif] detail from retur', {
          fg: fgFromRetur.length,
          jasa: jasaFromRetur.length
        })

        // Hard fallback: fetch detail tables directly if include response does not provide arrays
        if (detailFg.value.length === 0) {
          try {
            const fgRes = await apiCall<any>(
              `/dynamic/t_purchase_return_subcon_jadi?no_pagination=true&filter_column_t_purchase_return_subcon_id=${found.t_purchase_return_subcon_id}`,
              { method: 'GET' }
            )
            const fgFallback = Array.isArray(fgRes?.data) ? fgRes.data : []
            if (fgFallback.length > 0) detailFg.value = fgFallback
            console.log('[PR Subcon Notif] detail fg fallback', { count: fgFallback.length })
          } catch {}
        }
        if (detailJasa.value.length === 0) {
          try {
            const jasaRes = await apiCall<any>(
              `/dynamic/t_purchase_return_subcon_jasa?no_pagination=true&filter_column_t_purchase_return_subcon_id=${found.t_purchase_return_subcon_id}`,
              { method: 'GET' }
            )
            const jasaFallback = Array.isArray(jasaRes?.data) ? jasaRes.data : []
            if (jasaFallback.length > 0) detailJasa.value = jasaFallback
            console.log('[PR Subcon Notif] detail jasa fallback', { count: jasaFallback.length })
          } catch {}
        }

        await enrichPbNotificationDetails()

        const piId = (res.data as any)?.t_purchase_invoice_subcon_id || (res.data as any)?.pi_sc?.id
        if (piId) {
          const piRes = await getPurchaseInvoiceSubconPopulateByPi(piId)
          if (piRes?.status === 'success') {
            const jadi = getArray(piRes.data, ['t_purchase_invoice_subcon_jadis', 't_purchase_invoice_subcon_jadi'])
            const jasa = getArray(piRes.data, ['t_purchase_invoice_subcon_jasas', 't_purchase_invoice_subcon_jasa'])
            detailMapPI.value = new Map(jadi.map((d: any) => [d.id, d]))
            detailMapPI2.value = new Map(jasa.map((d: any) => [d.id, d]))
            console.log('[PR Subcon Notif] PI source loaded', { jadi: jadi.length, jasa: jasa.length, piId })
          }
        }
      }
    }
  } catch (error: any) {
    toast.error('Failed to load notification', {
      description: error.message || 'An error occurred'
    })
    router.push('/notifikasi')
  } finally {
    console.log('[PR Subcon Notif] end fetch state', {
      fg: detailFg.value.length,
      jasa: detailJasa.value.length,
      hasReturDetail: !!returDetail.value
    })
    loading.value = false
  }
}

const fgDisplay = computed(() => detailFg.value.map((row: any) => {
  const srcId = row.t_purchase_invoice_subcon_jadi_id || row.t_purchase_invoice_subcon_jadi_i
  const src = detailMapPI.value.get(srcId) || {}
  return {
    no_po: src.t_purchase_order_subcon?.no_po || row.no_po || '-',
    no_pb: src.t_penerimaan_barang_subcon?.no_penerimaan || row.no_penerimaan || '-',
    kode: src.m_item?.kode_item || src.m_items?.kode_item || row.kode || row.kode_item || row.m_item?.kode_item || row.m_items?.kode_item || '-',
    nama: src.m_item?.nama_item || src.m_items?.nama_item || row.finish_goods || row.nama_item || row.m_item?.nama_item || row.m_items?.nama_item || '-',
    qty_pi: Number(row.qty_pi ?? src.qty ?? 0),
    qty_retur: Number(row.qty_retur ?? 0),
    uom: src.m_general?.value1 || row.uom || row.m_general?.value1 || '-',
    harga: Number(row.harga ?? src.harga ?? 0),
  }
}))

const jasaDisplay = computed(() => detailJasa.value.map((row: any) => {
  const srcId = row.t_purchase_invoice_subcon_jasa_id || row.t_purchase_invoice_subcon_jasa_i
  const src = detailMapPI2.value.get(srcId) || {}
  return {
    no_po: src.t_purchase_order_subcon?.no_po || row.no_po || '-',
    no_pb: src.t_penerimaan_barang_subcon?.no_penerimaan || row.no_penerimaan || '-',
    kode: src.m_item?.kode_item || src.m_items?.kode_item || row.kode || row.kode_item || row.m_item?.kode_item || row.m_items?.kode_item || '-',
    nama: src.m_item?.nama_item || src.m_items?.nama_item || row.material || row.nama_item || row.jasa || row.m_item?.nama_item || row.m_items?.nama_item || '-',
    qty_pi: Number(row.qty_pi ?? src.qty_jasa ?? 0),
    qty_retur: Number(row.qty_retur ?? 0),
    uom: src.m_general?.value1 || row.uom || row.m_general?.value1 || '-',
    harga: Number(row.harga ?? src.harga ?? 0),
  }
}))

const fmtNum = (n: number) => n.toLocaleString('id-ID')

const handleApproval = async (status: 'APPROVED' | 'REVISI') => {
  if (!notification.value) return

  // Catatan wajib hanya untuk revisi
  if (status === 'REVISI' && !approvalCatatan.value?.trim()) {
    toast.error('Catatan Approval wajib diisi', {
      description: 'Silakan masukkan catatan sebelum melakukan approval'
    })
    return
  }

  submitting.value = true
  try {
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) => 
      a.path === '/purchasing/subcon/t_purchase_return_subcon' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk menyetujui Purchase Return Subcon'
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
      await revisePurchaseReturnSubcon(
        notification.value.t_purchase_return_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    } else {
      await approvePurchaseReturnSubcon(
        notification.value.t_purchase_return_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value
      )
    }

    toast.success(`Purchase Return Subcon ${status === 'APPROVED' ? 'approved' : 'revised'} successfully`)
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
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList()
    const moduleApproval = approvalList.find((a: any) => 
      a.path === '/purchasing/subcon/t_purchase_return_subcon' && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )

    if (!moduleApproval) {
      toast.error('Approval level not found', {
        description: 'Anda tidak memiliki hak untuk reject Purchase Return Subcon'
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

    await rejectPurchaseReturnSubcon(
      notification.value.t_purchase_return_subcon_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value
    )

    toast.success('Purchase Return Subcon berhasil di-reject')
    router.push('/notifikasi')
  } catch (error: any) {
    toast.error('Gagal reject', {
      description: error.message || 'Terjadi kesalahan'
    })
  } finally {
    submitting.value = false
  }
}

// Preview file
const openFilePreview = (filePath: string) => {
  const url = getFileUrl(filePath)
  if (url) {
    previewImageUrl.value = url
    previewFileName.value = filePath.split('/').pop() || 'file'
    showPreviewDialog.value = true
  }
}

const openPreviewInNewTab = () => {
  window.open(previewImageUrl.value, '_blank')
}

const downloadPreviewFile = () => {
  const link = document.createElement('a')
  link.href = previewImageUrl.value
  link.download = previewFileName.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
          <span class="truncate">Purchase Return Subcon Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Return Subcon request
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
              <span class="font-medium truncate">{{ (notification as any).tpr_sender?.name || notification.user_default?.name || 'N/A' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{ formatDateTime(notification.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="returDetail">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg">
            Detail Purchase Return
            <span class="ml-2 text-xs text-muted-foreground font-normal">
              (FG: {{ detailFg.length }}, Jasa: {{ detailJasa.length }})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div v-if="fgDisplay.length" class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium">No. PO</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Finish Goods</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Qty PI</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, i) in fgDisplay" :key="`fg-${i}`" class="border-t">
                  <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.no_pb }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.nama }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.qty_pi) }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.qty_retur) }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.harga) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="jasaDisplay.length" class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium">No. PO</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Material/Jasa</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Qty PI</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                  <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, i) in jasaDisplay" :key="`jasa-${i}`" class="border-t">
                  <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.no_pb }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.nama }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.qty_pi) }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.qty_retur) }}</td>
                  <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                  <td class="px-3 py-2 text-xs text-right">{{ fmtNum(d.harga) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="fgDisplay.length === 0 && jasaDisplay.length === 0" class="text-xs text-muted-foreground">
            Data detail ada, tetapi mapping tampilan kosong. Lihat console debug `[PR Subcon Notif]`.
          </div>
        </CardContent>
      </Card>

      <!-- Data Details Card -->
      <Card v-if="returDetail">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Return Subcon
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail lengkap data yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid - Customize based on your fields -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">ID</Label>
              <p class="text-base md:text-lg font-bold text-primary font-mono break-all">{{ returDetail.id || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">Status</Label>
              <div>
                <Badge :variant="getStatusVariant(returDetail.status)" class="text-xs md:text-sm">
                  {{ returDetail.status }}
                </Badge>
              </div>
            </div>
            <!-- Add more fields as needed -->
          </div>

          <!-- Catatan -->
          <div v-if="returDetail.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">{{ returDetail.catatan }}</p>
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
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk Purchase Return Subcon ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            hints="Catatan ini wajib diisi"
            :rows="3"
            :disabled="submitting"
            :required="true"
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

    <!-- File Preview Dialog -->
    <Dialog :open="showPreviewDialog" @update:open="showPreviewDialog = $event">
      <DialogContent class="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader class="p-3 md:p-4 border-b shrink-0">
          <DialogTitle class="flex items-center gap-2 md:gap-3">
            <span class="truncate flex-1 text-xs md:text-sm">{{ previewFileName }}</span>
            <div class="flex items-center gap-1 md:gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                class="gap-1 h-7 md:h-8 px-2"
                @click="openPreviewInNewTab"
              >
                <ExternalLink class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Buka</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                class="gap-1 h-7 md:h-8 px-2"
                @click="downloadPreviewFile"
              >
                <Download class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Unduh</span>
              </Button>
            </div>
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
