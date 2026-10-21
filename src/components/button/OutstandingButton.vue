<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'vue-sonner'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

interface OutstandingButtonProps {
  /** API endpoint untuk fetch data (tanpa /dynamic/) */
  endpoint: string
  /** Base path untuk view redirect (contoh: '/purchasing/transaksi/t_purchase_request') */
  viewPath?: string
  /** Field untuk filter status_transaksi */
  statusField?: string
  /** Label untuk dialog */
  title?: string
  /** Columns untuk ditampilkan di dialog */
  columns?: Array<{
    key: string
    label: string
    width?: string
    fallbackKeys?: string[]
    render?: (item: any) => string
  }>
  /** Include untuk API call */
  include?: string
  /** Tambahkan join=true untuk endpoint yang butuh relasi */
  join?: boolean
  /** Jumlah data yang diambil */
  paginate?: number
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Whether button is disabled */
  disabled?: boolean
}

const props = withDefaults(defineProps<OutstandingButtonProps>(), {
  statusField: 'status_transaksi',
  title: 'Data Outstanding',
  size: 'default',
  variant: 'outline',
  disabled: false,
  join: false,
  paginate: 100,
  columns: () => [
    { key: 'no', label: 'No', width: '60px' },
    { key: 'created_at', label: 'Tanggal', width: '120px' }
  ]
})

const router = useRouter()
const { API_BASE_URL } = useApi()
const authStore = useAuthStore()

const isDialogOpen = ref(false)
const loading = ref(false)
const outstandingData = ref<any[]>([])

const openDialog = async () => {
  isDialogOpen.value = true
  await fetchOutstandingData()
}

const fetchOutstandingData = async () => {
  loading.value = true
  outstandingData.value = []
  
  try {
    const params = new URLSearchParams()
    params.append(`filter_column_${props.statusField}`, 'OUTSTANDING')
    params.append('page', '1')
    params.append('paginate', String(props.paginate))
    params.append('order_by', 'createdAt')
    params.append('order_type', 'DESC')
    
    if (props.join) {
      params.append('join', 'true')
    }
    
    if (props.include) {
      params.append('include', props.include)
    }
    
    const response = await fetch(
      `${API_BASE_URL}/dynamic/${props.endpoint}?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )
    
    const result = await response.json()
    
    if (result.status === 'success') {
      const data = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.data?.rows)
          ? result.data.rows
          : []
      outstandingData.value = data
    } else {
      toast.error('Gagal memuat data', {
        description: result.message || 'Terjadi kesalahan'
      })
    }
  } catch (error) {
    toast.error('Gagal memuat data', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID')
}

const getCellValue = (item: any, column: any) => {
  if (column.render) {
    return column.render(item)
  }
  
  // Handle nested keys like 'm_supplier.nama_supp'
  const resolveValue = (keyPath: string) => {
    const keys = keyPath.split('.')
    let value = item
    for (const key of keys) {
      value = value?.[key]
    }
    return value
  }

  let value = resolveValue(column.key)

  if ((value === undefined || value === null || value === '') && column.fallbackKeys?.length) {
    for (const fallbackKey of column.fallbackKeys) {
      const fallbackValue = resolveValue(fallbackKey)
      if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '') {
        value = fallbackValue
        break
      }
    }
  }
  
  // Format date if it looks like a date
  if (typeof value === 'string' && (column.key.includes('tgl') || column.key.includes('date') || column.key === 'createdAt')) {
    return formatDate(value)
  }
  
  return value ?? '-'
}

/** Handle row click - redirect to view page */
const handleRowClick = (item: any) => {
  if (!item.id || !props.viewPath) return
  
  // Close dialog first
  isDialogOpen.value = false
  
  // Navigate to view page
  router.push(`${props.viewPath}/view/${item.id}`)
}
</script>

<template>
  <Button
    :variant="variant"
    :size="size"
    :disabled="disabled"
    class="gap-2"
    @click="openDialog"
  >
    <AlertCircle class="h-4 w-4" />
    <span>OUTSTANDING</span>
  </Button>

  <!-- OUTSTANDING DIALOG -->
  <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
    <DialogContent class="w-[calc(100vw-2rem)] sm:w-[95vw] !max-w-6xl max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <AlertCircle class="h-5 w-5 text-orange-500" />
          {{ title }}
        </DialogTitle>
        <DialogDescription>
          Menampilkan data dengan status transaksi OUTSTANDING
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-hidden">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-3 p-4">
          <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
        </div>

        <!-- Empty State -->
        <div v-else-if="outstandingData.length === 0" class="text-center py-12">
          <AlertCircle class="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p class="text-muted-foreground">Tidak ada data outstanding</p>
        </div>

        <!-- Data Table -->
        <div v-else class="border rounded-lg overflow-auto max-h-[calc(85vh-180px)]">
          <Table class="min-w-[720px]">
            <TableHeader>
              <TableRow class="bg-muted">
                <TableHead class="w-[50px] text-center">No</TableHead>
                <TableHead 
                  v-for="col in columns" 
                  :key="col.key"
                  :style="col.width ? { width: col.width } : {}"
                >
                  {{ col.label }}
                </TableHead>
                <TableHead class="w-[120px] text-center">Status Transaksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow 
                v-for="(item, index) in outstandingData" 
                :key="item.id || index"
                class="cursor-pointer hover:bg-muted/50 transition-colors"
                @click="handleRowClick(item)"
              >
                <TableCell class="text-center">{{ index + 1 }}</TableCell>
                <TableCell v-for="col in columns" :key="col.key">
                  {{ getCellValue(item, col) }}
                </TableCell>
                <TableCell class="text-center">
                  <Badge class="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                    OUTSTANDING
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Total Count -->
        <div v-if="!loading && outstandingData.length > 0" class="mt-4 text-sm text-muted-foreground text-right">
          Total: {{ outstandingData.length }} data outstanding
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
