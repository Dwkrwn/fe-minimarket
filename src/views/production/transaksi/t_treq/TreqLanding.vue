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
import { DeleteButton, EditButton, CopyButton, ViewButton, PostButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'
import { getTreqList, deleteTreq, postTreq, type TreqItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, isSuperAdmin } = usePermission()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<TreqItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false)
const itemToPost = ref<TreqItem | null>(null)
const isPosting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TreqItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'DRAFT' | 'POST' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('')
const isSearching = ref(false)

const tableColumnFilters = ref<Record<string, string>>({})
const tableColumnFilterOperators = ref<Record<string, string>>({})
const tableDateRangeFilters = ref<Record<string, { from: string; to: string }>>({})
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: 'no',
    label: 'No Transfer Request',
    filterable: true,
    width: '200px',
    renderHtml: (item: TreqItem) => item.no || '-'
  },
  {
    key: 'date',
    label: 'Tanggal',
    filterable: true,
    filterType: 'date' as const,
    width: '130px',
    renderHtml: (item: TreqItem) =>
      item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-'
  },
  {
    key: 'as_wo_asal.no',
    label: 'No WO Asal',
    filterable: true,
    width: '160px',
    valueGetter: (item: TreqItem) => item.as_wo_asal?.no || item.t_wo?.no || '',
    renderHtml: (item: TreqItem) => item.as_wo_asal?.no || item.t_wo?.no || '-'
  },
  {
    key: 'as_wo_tujuan.no',
    label: 'No WO Tujuan',
    filterable: true,
    width: '160px',
    valueGetter: (item: TreqItem) => item.as_wo_tujuan?.no || item.to_t_wo?.no || '',
    renderHtml: (item: TreqItem) => item.as_wo_tujuan?.no || item.to_t_wo?.no || '-'
  },
  {
    key: 'as_wo_gudang_asal.nama_gudang',
    label: 'Warehouse Asal',
    filterable: true,
    width: '160px',
    valueGetter: (item: TreqItem) => item.as_wo_gudang_asal?.nama_gudang || item.m_gudang?.nama_gudang || '',
    renderHtml: (item: TreqItem) => item.as_wo_gudang_asal?.nama_gudang || item.m_gudang?.nama_gudang || '-'
  },
  {
    key: 'as_wo_gudang_tujuan.nama_gudang',
    label: 'Warehouse Tujuan',
    filterable: true,
    width: '160px',
    valueGetter: (item: TreqItem) => item.as_wo_gudang_tujuan?.nama_gudang || item.to_m_gudang?.nama_gudang || '',
    renderHtml: (item: TreqItem) => item.as_wo_gudang_tujuan?.nama_gudang || item.to_m_gudang?.nama_gudang || '-'
  },
  {
    key: 'notes',
    label: 'Notes',
    filterable: true,
    width: '180px',
    renderHtml: (item: TreqItem) => item.notes || '-'
  },
  {
    key: 'status',
    label: 'Status',
    filterable: false,
    width: '110px',
    renderHtml: (item: TreqItem) => {
      const status = (item.status || 'DRAFT').toUpperCase()
      const colorClass =
        status === 'POST'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
          : 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}">${status}</span>`
    }
  }
]

// ============================================================================
// HELPERS
// ============================================================================
const getItemStatus = (item: TreqItem) => (item.status || 'DRAFT').toUpperCase()
const isStatusLocked = (item: TreqItem) => getItemStatus(item) === 'POST'

// ============================================================================
// STATUS STYLE HELPER
// ============================================================================
const getStatusStyle = (status: string) => {
  const s = (status || '').toUpperCase()
  switch (s) {
    case 'POST':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
    case 'DRAFT':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  }
}

// ============================================================================
// COMPUTED
// ============================================================================
const filteredData = computed(() => {
  return menuData.value.filter(item => {
    let matchStatus = true;
    if (filterStatus.value) {
      matchStatus = getItemStatus(item) === filterStatus.value
    }

    const colFilters = tableColumnFilters.value;
    const relationParts = Object.entries(colFilters).filter(
        ([key, val]) => key.includes(".") && val?.trim()
    );

    let matchRelations = true;
    if (relationParts.length > 0) {
        matchRelations = relationParts.every(([key, val]) => {
            let objValue: any = item;
            const parts = key.split(".");
            for (const part of parts) {
                objValue = objValue?.[part];
            }
            const strVal = String(objValue || "").toLowerCase();
            return strVal.includes(val.trim().toLowerCase());
        });
    }

    return matchStatus && matchRelations
  })
})

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return ''
  return `Apakah Anda yakin ingin menghapus WO Transfer Request "${itemToDelete.value.no || '-'}"? Tindakan ini tidak dapat dibatalkan.`
})

const postDialogDescription = computed(() => {
  if (!itemToPost.value) return ''
  return `Apakah Anda yakin ingin POST WO Transfer Request "${itemToPost.value.no || '-'}"? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`
})

// ============================================================================
// DELETE
// ============================================================================
const deleteSelected = (item?: TreqItem) => {
  const target = item || (selectedItem.value as TreqItem)
  if (target && isStatusLocked(target)) {
    toast.error('Akses Ditolak', { description: 'Data dengan status POST tidak dapat dihapus.' })
    return
  }
  if (!canDelete.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk menghapus data' })
    return
  }
  if (item) {
    selectItem(item, 0)
    itemToDelete.value = item
  } else {
    const picked = handleDelete()
    if (!picked) { toast.error('Pilih item terlebih dahulu'); return }
    itemToDelete.value = picked
  }
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!itemToDelete.value) return
  isDeleting.value = true
  try {
    const response = await deleteTreq(itemToDelete.value.id)
    if (response.status === 'success') {
      menuData.value = menuData.value.filter(m => m.id !== itemToDelete.value!.id)
      toast.success(`WO Transfer Request "${itemToDelete.value.no}" berhasil dihapus`)
      deselectItem()
      isDeleteDialogOpen.value = false
    } else {
      toast.error('Gagal menghapus', { description: response.message })
    }
  } catch (error) {
    toast.error('Gagal menghapus', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    isDeleting.value = false
    itemToDelete.value = null
  }
}

const cancelDelete = () => {
  isDeleteDialogOpen.value = false
  itemToDelete.value = null
}

// ============================================================================
// POST
// ============================================================================
const postSelected = (item?: TreqItem) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk memposting data' })
    return
  }
  const target = item || (selectedItem.value as TreqItem)
  if (!target) { toast.error('Pilih item terlebih dahulu'); return }
  if (getItemStatus(target) === 'POST') {
    toast.error('Item sudah di-POST')
    return
  }
  if (item) selectItem(item, 0)
  itemToPost.value = target
  isPostDialogOpen.value = true
}

const confirmPost = async () => {
  const item = itemToPost.value
  if (!item) return
  isPosting.value = true
  try {
    const response = await postTreq(item.id)
    if (response.status === 'success') {
      menuData.value = menuData.value.map(m =>
        m.id === item.id ? { ...m, status: 'POST', is_active: true } : m
      )
      toast.success(`WO Transfer Request "${item.no}" berhasil di-POST`, {
        description: 'Data telah dikunci dan tidak dapat diubah lagi.'
      })
      isPostDialogOpen.value = false
      itemToPost.value = null
      deselectItem()
    } else {
      toast.error('Gagal memposting', { description: (response as any).message || 'Terjadi kesalahan' })
    }
  } catch (error) {
    toast.error('Gagal memposting', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    isPosting.value = false
    itemToPost.value = null
  }
}

const cancelPost = () => {
  isPostDialogOpen.value = false
  itemToPost.value = null
}

// ============================================================================
// NAVIGATION
// ============================================================================
const viewItem = (item?: TreqItem) => {
  if (item) selectItem(item, 0)
  if (!selectedItem.value) { toast.error('Pilih item terlebih dahulu'); return }
  router.push(`/production/transaksi/t_treq/view/${selectedItem.value.id}`)
}

const editItem = (item?: TreqItem) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk mengubah data' })
    return
  }
  const target = item || (selectedItem.value as TreqItem)
  if (target && isStatusLocked(target)) {
    toast.error('Akses Ditolak', { description: 'Data dengan status POST tidak dapat diedit.' })
    return
  }
  if (item) selectItem(item, 0)
  const picked = handleEdit(item)
  if (!picked) { toast.error('Pilih item terlebih dahulu'); return }
  router.push(`/production/transaksi/t_treq/form/${picked.id}`)
}

const copyItem = (item?: TreqItem) => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
    return
  }
  if (item) selectItem(item, 0)
  const picked = handleCopy(item)
  if (!picked) { toast.error('Pilih item terlebih dahulu'); return }
  router.push({ path: '/production/transaksi/t_treq/form', query: { action: 'copy', source: picked.id } })
  toast.success(`Menyalin data "${picked.no || '-'}"`)
  deselectItem()
}

const createNew = () => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
    return
  }
  router.push('/production/transaksi/t_treq/form')
}

// ============================================================================
// DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) loading.value = true
  else loadingMore.value = true

  try {
    const colFilters = { ...tableColumnFilters.value }
    let whereClauses: string[] = []
    if (tableWhereClause.value) whereClauses.push(tableWhereClause.value)

    const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined

    const allColumnFilters: Record<string, string> = {};
    Object.entries(colFilters).forEach(([key, value]) => {
        if (value?.trim()) {
            allColumnFilters[`filter_column_${key}`] = value.trim();
        }
    });

    const globalSearchFields = [
        "no",
        "notes",
        "$as_wo_asal.no$",
        "$as_wo_tujuan.no$",
        "$as_wo_gudang_asal.nama_gudang$",
        "$as_wo_gudang_tujuan.nama_gudang$"
    ].join(",");

    let effectiveSearch = searchApiQuery.value || undefined;
    let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

    const response = await getTreqList(
      page,
      pageSize.value,
      'createdAt',
      'DESC',
      effectiveSearch,
      effectiveSearchFields,
      undefined,
      Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined,
      finalWhere
    )
    if (response.status === 'success') {
      if (page === 1 || resetData) menuData.value = response.data
      else menuData.value.push(...response.data)
      if (response.pagination) hasMoreData.value = response.pagination.next_page !== null
    }
  } catch (error) {
    toast.error('Gagal memuat data WO Transfer Request', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const handleLoadMore = () => { currentPage.value++; fetchMenuData(currentPage.value) }

const handleApiSearch = async () => {
  if (isSearching.value) return
  isSearching.value = true
  searchApiQuery.value = searchQuery.value
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  await fetchMenuData(1, true)
  if (searchQuery.value.trim()) {
    toast.success('Pencarian selesai', { description: `Ditemukan ${menuData.value.length} hasil` })
  }
  isSearching.value = false
}

const clearSearch = async () => {
  searchQuery.value = ''
  searchApiQuery.value = ''
  await handleApiSearch()
}

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleTableFilterChange = (filters: {
  column: Record<string, string>
  operator: Record<string, string>
  dateRange: Record<string, { from: string; to: string }>
  where: string
}) => {
  tableColumnFilters.value = filters.column
  tableColumnFilterOperators.value = filters.operator
  tableDateRangeFilters.value = filters.dateRange
  tableWhereClause.value = filters.where
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(async () => {
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    await fetchMenuData(1, true)
  }, 500)
}

const handleRefresh = async () => {
  searchQuery.value = ''
  searchApiQuery.value = ''
  tableColumnFilters.value = {}
  tableColumnFilterOperators.value = {}
  tableDateRangeFilters.value = {}
  tableWhereClause.value = ''
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  deselectItem()
  await fetchMenuData(1, true)
  toast.success('Data berhasil dimuat ulang')
}

const handleWindowScroll = () => {
  if (loadingMore.value || !hasMoreData.value) return
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  if (document.documentElement.scrollHeight - scrollTop - window.innerHeight < 100) {
    currentPage.value++
    fetchMenuData(currentPage.value)
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================
onMounted(async () => {
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  deselectItem()
  await fetchMenuData(1)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
  menuData.value = []
  deselectItem()
})
</script>

<template>
  <!-- ================================================================ -->
  <!-- MOBILE VIEW -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <!-- Title & Refresh -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">WO Transfer Request</h1>
            <p class="text-xs text-muted-foreground">Kelola data WO Transfer Request</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium">Filter Status :</span>
          <Button variant="outline" size="sm" class="text-xs h-7"
            :class="filterStatus === 'DRAFT' ? 'border-primary text-primary' : ''"
            @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
            Draft
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7"
            :class="filterStatus === 'POST' ? 'border-emerald-600 text-emerald-600' : ''"
            @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
            Post
          </Button>
        </div>

        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari no. transfer request..." class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>

      <div v-else-if="filteredData.length === 0" class="text-center py-8">
        <p class="text-sm text-muted-foreground">Tidak ada data WO Transfer Request</p>
      </div>

      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id"
          class="cursor-pointer hover:shadow-md transition-all" @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.no || 'Tanpa Nomor' }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-' }}
                </div>
              </div>
              <Badge
                :class="getStatusStyle(getItemStatus(item))"
                class="text-xs shrink-0 border">
                {{ getItemStatus(item) }}
              </Badge>
            </div>

            <div class="text-xs space-y-1 text-muted-foreground">
              <div><span class="font-medium">WO Asal:</span> {{ item.as_wo_asal?.no || item.t_wo?.no || '-' }}</div>
              <div><span class="font-medium">WO Tujuan:</span> {{ item.as_wo_tujuan?.no || item.to_t_wo?.no || '-' }}</div>
              <div><span class="font-medium">Wh Asal:</span> {{ item.as_wo_gudang_asal?.nama_gudang || item.m_gudang?.nama_gudang || '-' }}</div>
              <div><span class="font-medium">Wh Tujuan:</span> {{ item.as_wo_gudang_tujuan?.nama_gudang || item.to_m_gudang?.nama_gudang || '-' }}</div>
              <div v-if="item.notes" class="truncate">
                <span class="font-medium">Notes:</span> {{ item.notes }}
              </div>
            </div>

            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost" size="sm" class="h-7 w-7"
                :status="item.status"
                :disabled="isStatusLocked(item)"
                @click.stop="() => { selectItem(item, 0); deleteSelected(item) }" />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost" size="sm" class="h-7 w-7"
                :status="item.status"
                :disabled="isStatusLocked(item)"
                @click.stop="editItem(item)" />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost" size="sm" class="h-7 w-7"
                @click.stop="copyItem(item)" />
              <PostButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost" size="sm" class="h-7 w-7"
                :showLabel="false"
                :disabled="isStatusLocked(item)"
                @click.stop="() => { selectItem(item, 0); postSelected(item) }" />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>

      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>

    <teleport to="body">
      <Button
        v-permission="{ menuId: currentMenuId, action: 'create' }"
        @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
        size="icon">
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <!-- ================================================================ -->
  <!-- DESKTOP VIEW -->
  <!-- ================================================================ -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">WO Transfer Request</h1>
        <p class="text-sm text-muted-foreground">Kelola data WO Transfer Request</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0"
          title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Status filters -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Filter Status :</span>
        <Button variant="outline" size="sm"
          :class="filterStatus === 'DRAFT' ? 'border-primary text-primary' : ''"
          @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
          Draft
        </Button>
        <Button variant="outline" size="sm"
          :class="filterStatus === 'POST' ? 'border-emerald-600 text-emerald-600' : ''"
          @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
          Post
        </Button>
      </div>

      <!-- Search & Actions -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Cari no. transfer request..." class="pl-9 pr-8"
              @keyup.enter="handleApiSearch" :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :status="selectedItem?.status"
            :disabled="!isActive"
            @click="deleteSelected()" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="!isActive"
            @click="editItem()" />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()" />
          <PostButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!isActive || (selectedItem && isStatusLocked(selectedItem as TreqItem))"
            @click="postSelected()" />
        </div>
      </div>
    </div>

    <!-- Table -->
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
      @filter-change="handleTableFilterChange">
      <template #empty>
        Tidak ada data WO Transfer Request
      </template>
    </DataTable>
  </div>

  <!-- Delete Dialog -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus WO Transfer Request"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event" />

  <!-- Post Dialog -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="POST WO Transfer Request"
    :description="postDialogDescription"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event" />
</template>

<style scoped>
.list-move { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.list-enter-active { transition: all 0.4s ease-out; }
.list-leave-active { transition: all 0.3s ease-in; position: absolute; }
.list-enter-from { opacity: 0; transform: translateY(20px); }
.list-leave-to { opacity: 0; transform: translateY(-20px); }
</style>
