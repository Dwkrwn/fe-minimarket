<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshCw, X, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, EditButton, CopyButton, ViewButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'
import { getSalesReturnList, deleteSalesReturn, type SalesReturnItem } from './service'
import { formatDate } from '@/lib/date'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<SalesReturnItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<SalesReturnItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<string | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('')
const isSearching = ref(false)

interface ColumnFilters { [key: string]: string }
interface ColumnFilterOperators { [key: string]: string }
interface DateRangeFilter { from: string; to: string }
interface DateRangeFilters { [key: string]: DateRangeFilter }
const tableColumnFilters = ref<ColumnFilters>({})
const tableColumnFilterOperators = ref<ColumnFilterOperators>({})
const tableDateRangeFilters = ref<DateRangeFilters>({})

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: 'code', label: 'No. SR', filterable: true, width: '180px' },
  { key: 'value1', label: 'Tanggal', filterable: true, filterType: 'date' as const, width: '130px' },
  { key: 'value2', label: 'Customer', filterable: true, width: '220px' },
  { key: 'value3', label: 'No. SI', filterable: true, width: '180px' },
  { key: 'value4', label: 'Grand Total', filterable: true, width: '160px' },
  {
    key: 'value5',
    label: 'Status',
    filterable: false,
    width: '130px',
    renderHtml: (item: SalesReturnItem) => {
      const status = item.value5 || 'DRAFT'
      const badgeClass = getApprovalStatusBadgeClass(status)
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`
    }
  }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
const filteredData = computed(() => {
  return menuData.value.filter((item: SalesReturnItem) => {
    if (filterStatus.value === null) return true
    return (item.value5 || 'DRAFT') === filterStatus.value
  })
})

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return ''
  return `Apakah Anda yakin ingin menghapus Sales Return "${itemToDelete.value.code}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = () => {
  if (!canDelete.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk menghapus data' })
    return
  }
  const item = handleDelete()
  if (!item) { toast.error('Pilih item terlebih dahulu'); return }
  itemToDelete.value = item
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!itemToDelete.value) return
  isDeleting.value = true
  try {
    const response = await deleteSalesReturn(itemToDelete.value.id)
    if (response.status === 'success') {
      menuData.value = menuData.value.filter((m: SalesReturnItem) => m.id !== itemToDelete.value!.id)
      toast.success(`Sales Return "${itemToDelete.value.code}" berhasil dihapus`)
      deselectItem()
      isDeleteDialogOpen.value = false
    } else {
      toast.error('Gagal menghapus', { description: response.message || 'Terjadi kesalahan' })
    }
  } catch (error) {
    toast.error('Gagal menghapus', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    isDeleting.value = false
    itemToDelete.value = null
  }
}

const cancelDelete = () => { isDeleteDialogOpen.value = false; itemToDelete.value = null }

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
const viewItem = (item?: any) => {
  if (item) selectItem(item, 0)
  if (!selectedItem.value) { toast.error('Pilih item terlebih dahulu'); return }
  router.push(`/marketing/transaksi/t_sales_return/view/${selectedItem.value.id}`)
}

const editItem = (item?: any) => {
  if (!canUpdate.value) { toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk mengubah data' }); return }
  if (item) selectItem(item, 0)
  const selected = handleEdit(item)
  if (!selected) { toast.error('Pilih item terlebih dahulu'); return }
  router.push(`/marketing/transaksi/t_sales_return/form/${selected.id}`)
}

const copyItem = (item?: any) => {
  if (!canCreate.value) { toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' }); return }
  if (item) selectItem(item, 0)
  const selected = handleCopy(item)
  if (!selected) { toast.error('Pilih item terlebih dahulu'); return }
  router.push({ path: '/marketing/transaksi/t_sales_return/form', query: { action: 'copy', source: selected.id } })
  deselectItem()
}

const createNew = () => {
  if (!canCreate.value) { toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' }); return }
  router.push('/marketing/transaksi/t_sales_return/form')
}

// ============================================================================
// API & DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) { loading.value = true } else { loadingMore.value = true }
  try {
    const apiColumnFilters: ColumnFilters = {}
    const apiColumnFilterOperators: ColumnFilterOperators = {}

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        apiColumnFilters[key] = value
        if (tableColumnFilterOperators.value[key]) {
          apiColumnFilterOperators[key] = tableColumnFilterOperators.value[key]
        }
      }
    })

    // Build where clause for date range filters
    const whereClause = Object.entries(tableDateRangeFilters.value)
      .filter(([, filter]) => filter?.from || filter?.to)
      .map(([key, filter]) => {
        const conditions: string[] = []
        if (filter.from) conditions.push(`${key} >= '${filter.from}'`)
        if (filter.to) conditions.push(`${key} <= '${filter.to}'`)
        return conditions.join("|")
      })
      .filter(Boolean)
      .join("|")

    const response = await getSalesReturnList(
      page,
      pageSize.value,
      'createdAt',
      'DESC',
      searchApiQuery.value || undefined,
      searchApiQuery.value ? 'code,value1,value2,value3' : undefined,
      Object.keys(apiColumnFilters).length > 0 ? apiColumnFilters : undefined,
      Object.keys(apiColumnFilterOperators).length > 0 ? apiColumnFilterOperators : undefined,
      whereClause || undefined
    )
    if (response.status === 'success') {
      if (page === 1 || resetData) { menuData.value = response.data } else { menuData.value.push(...response.data) }
      if (response.pagination) { hasMoreData.value = response.pagination.next_page !== null }
    }
  } catch (error) {
    toast.error('Gagal memuat data Sales Return', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally { loading.value = false; loadingMore.value = false }
}

const handleLoadMore = () => { currentPage.value++; fetchMenuData(currentPage.value) }

const handleApiSearch = async () => {
  if (isSearching.value) return
  isSearching.value = true
  searchApiQuery.value = searchQuery.value
  menuData.value = []; currentPage.value = 1; hasMoreData.value = true
  await fetchMenuData(1, true)
  if (searchQuery.value.trim()) { toast.success('Pencarian selesai', { description: `Ditemukan ${menuData.value.length} hasil` }) }
  isSearching.value = false
}

const clearSearch = async () => { searchQuery.value = ''; searchApiQuery.value = ''; await handleApiSearch() }

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleTableFilterChange = (filters: { column: Record<string, string>; operator: Record<string, string>; dateRange: Record<string, { from: string; to: string }>; where: string }) => {
  tableColumnFilters.value = filters.column
  tableColumnFilterOperators.value = filters.operator
  tableDateRangeFilters.value = filters.dateRange
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(async () => { menuData.value = []; currentPage.value = 1; hasMoreData.value = true; await fetchMenuData(1, true) }, 500)
}

const handleRefresh = async () => {
  searchQuery.value = ''; searchApiQuery.value = ''
  tableColumnFilters.value = {}; tableColumnFilterOperators.value = {}; tableDateRangeFilters.value = {}
  menuData.value = []; currentPage.value = 1; hasMoreData.value = true; deselectItem()
  await fetchMenuData(1, true)
  toast.success('Data berhasil dimuat ulang')
}

// ============================================================================
// LIFECYCLE
// ============================================================================
onMounted(async () => {
  menuData.value = []; currentPage.value = 1; hasMoreData.value = true; deselectItem()
  await fetchMenuData(1)
})
</script>

<template>
  <!-- ================================================================ -->
  <!-- MOBILE VIEW (LG:HIDDEN) -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Sales Return</h1>
            <p class="text-xs text-muted-foreground">Kelola data Sales Return</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status -->
        <div class="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''" @click="filterStatus = null">All</Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">DRAFT</Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')" @click="filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'">IN APPROVAL</Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')" @click="filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'">APPROVED</Button>
        </div>

        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8 h-8 text-sm" @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- CONTENT -->
    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`"><CardContent class="pt-3 space-y-2"><Skeleton class="h-4 w-3/4" /><Skeleton class="h-3 w-full" /><Skeleton class="h-3 w-2/3" /></CardContent></Card>
      </div>
      <div v-else-if="filteredData.length === 0" class="text-center py-8"><p class="text-sm text-muted-foreground">Tidak ada data</p></div>
      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id" class="cursor-pointer hover:shadow-md transition-all" @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.code || '-' }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ item.value2 || '-' }}</div>
              </div>
              <Badge :class="getApprovalStatusBadgeClass(item.value5 || 'DRAFT')" class="text-xs uppercase">{{ item.value5 || 'DRAFT' }}</Badge>
            </div>
            <div class="text-xs space-y-1 text-muted-foreground">
              <div><span class="font-medium">Tanggal:</span> {{ formatDate(item.value1) }}</div>
              <div><span class="font-medium">No. SI:</span> {{ item.value3 || '-' }}</div>
              <div><span class="font-medium">Grand Total:</span> {{ item.value4 || '-' }}</div>
            </div>
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost" size="sm" class="h-7 w-7" 
                :status="item.value5"
                @click.stop="editItem(item)" />
              <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="copyItem(item)" />
              <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" variant="ghost" size="sm" class="h-7 w-7" 
                :status="item.value5"
                @click.stop="() => { selectItem(item, 0); deleteSelected() }" />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>
      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`"><CardContent class="pt-3 space-y-2"><Skeleton class="h-4 w-3/4" /><Skeleton class="h-3 w-full" /></CardContent></Card>
      </div>
    </div>

    <!-- FAB -->
    <teleport to="body">
      <Button v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50" size="icon">
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <!-- ================================================================ -->
  <!-- DESKTOP VIEW (HIDDEN LG:FLEX) -->
  <!-- ================================================================ -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- HEADER -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Sales Return</h1>
        <p class="text-sm text-muted-foreground">Kelola data Sales Return</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="gap-2 whitespace-nowrap shrink-0">Create New</Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">Create New</Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button variant="outline" size="sm" :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''" @click="filterStatus = null">All</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">DRAFT</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')" @click="filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'">IN APPROVAL</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')" @click="filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'">APPROVED</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')" @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'">REJECT</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')" @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'">REVISI</Button>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8" @keyup.enter="handleApiSearch" :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" 
            :status="selectedItem?.value5"
            :disabled="!isActive" @click="deleteSelected" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
            :status="selectedItem?.value5"
            :disabled="!isActive" @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive" @click="copyItem()" />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <DataTable
      :data="filteredData"
      :columns="columns"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMoreData"
      :row-select-mode="true"
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
    >
      <template #empty>Tidak ada data Sales Return</template>
    </DataTable>
  </div>

  <!-- DELETE DIALOG -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Sales Return"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />
</template>

<style scoped>
.list-move { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.list-enter-active { transition: all 0.4s ease-out; }
.list-leave-active { transition: all 0.3s ease-in; position: absolute; }
.list-enter-from { opacity: 0; transform: translateY(20px); }
.list-leave-to { opacity: 0; transform: translateY(-20px); }
</style>
