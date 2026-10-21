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
import { getMrpList, deleteMrp, postMrp, type MrpItem } from './service'

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
const itemToDelete = ref<MrpItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false)
const itemToPost = ref<MrpItem | null>(null)
const isPosting = ref(false)

// Check if item has locked status (POST)
const isStatusLocked = (item?: MrpItem | null) => {
  if (!item) return false
  return (item.status || '').toUpperCase() === 'POST'
}

// Super Admin can edit/delete anytime, otherwise only DRAFT
const canEditOrDelete = computed(() => {
  if (isSuperAdmin.value) return isActive.value
  return isActive.value && !isStatusLocked(selectedItem.value)
})

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<MrpItem[]>([])
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
    label: 'No. MRP', 
    filterable: true, 
    width: '180px',
    renderHtml: (item: MrpItem) => item.no || '-'
  },
  { 
    key: 'date', 
    label: 'Tanggal', 
    filterable: true, 
    filterType: 'date' as const,
    width: '130px',
    renderHtml: (item: MrpItem) => item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-'
  },
  { 
    key: 'm_unit_bisnis.nama_comp', 
    label: 'Unit Bisnis', 
    filterable: true, 
    width: '200px',
    valueGetter: (item: MrpItem) => item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama_comp || '',
    renderHtml: (item: MrpItem) => item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama_comp || '-'
  },
  { 
    key: 'note', 
    label: 'Notes', 
    filterable: true, 
    width: '240px',
    renderHtml: (item: MrpItem) => item.note || '-'
  },
  {
    key: 'status',
    label: 'Status',
    filterable: false,
    width: '110px',
    renderHtml: (item: MrpItem) => {
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
// COMPUTED PROPERTIES
// ============================================================================
const filteredData = computed(() => {
  return menuData.value.filter((item: MrpItem) => {
    if (!filterStatus.value) return true
    return (item.status || 'DRAFT').toUpperCase() === filterStatus.value.toUpperCase()
  })
})

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return ''
  return `Apakah Anda yakin ingin menghapus MRP "${itemToDelete.value.no || 'ini'}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = (item?: MrpItem) => {
  const target = item || selectedItem.value
  if (!target) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  if (!isSuperAdmin.value && isStatusLocked(target)) {
    toast.error('Akses Ditolak', {
      description: 'Data dengan status POST tidak dapat dihapus'
    })
    return
  }

  if (!canDelete.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk menghapus data'
    })
    return
  }

  itemToDelete.value = target
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!itemToDelete.value) return
  isDeleting.value = true
  try {
    const response = await deleteMrp(itemToDelete.value.id)
    if (response.status === 'success') {
      menuData.value = menuData.value.filter((m: MrpItem) => m.id !== itemToDelete.value!.id)
      toast.success(`MRP "${itemToDelete.value.no || ''}" berhasil dihapus`)
      deselectItem()
      isDeleteDialogOpen.value = false
    } else {
      toast.error('Gagal menghapus MRP', { description: response.message || 'Terjadi kesalahan' })
    }
  } catch (error) {
    toast.error('Gagal menghapus MRP', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    isDeleting.value = false
  }
}

const cancelDelete = () => {
  itemToDelete.value = null
  isDeleteDialogOpen.value = false
}

// ============================================================================
// POST FUNCTIONS
// ============================================================================
const postSelected = (item?: MrpItem) => {
  const target = item || selectedItem.value
  if (!target) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  if ((target.status || '').toUpperCase() === 'POST') {
    toast.info('Item sudah berstatus POST')
    return
  }

  itemToPost.value = target
  isPostDialogOpen.value = true
}

const confirmPost = async () => {
  if (!itemToPost.value) return
  isPosting.value = true
  try {
    const res = await postMrp(itemToPost.value.id)
    if (res.status === 'success') {
      itemToPost.value.status = 'POST'
      toast.success(`MRP "${itemToPost.value.no || ''}" berhasil di-POST`)
      isPostDialogOpen.value = false
      deselectItem()
      await fetchMenuData(1, true)
    } else {
      toast.error('Gagal mem-POST MRP')
    }
  } catch (err: any) {
    toast.error('Gagal mem-POST MRP', {
      description: err?.message || 'Terjadi kesalahan'
    })
  } finally {
    isPosting.value = false
  }
}

const cancelPost = () => {
  itemToPost.value = null
  isPostDialogOpen.value = false
}

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
const viewItem = (item?: any) => {
  if (item) selectItem(item, 0)
  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu')
    return
  }
  router.push(`/production/transaksi/t_mrp/view/${selectedItem.value.id}`)
}

const editItem = (item?: any) => {
  const target = item || selectedItem.value
  if (!target) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  if (!isSuperAdmin.value && isStatusLocked(target)) {
    toast.error('Akses Ditolak', {
      description: 'Data dengan status POST tidak dapat diubah'
    })
    return
  }

  if (!canUpdate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk mengubah data'
    })
    return
  }

  if (item) selectItem(item, 0)
  router.push(`/production/transaksi/t_mrp/form/${target.id}`)
}

const copyItem = (item?: any) => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk membuat data baru'
    })
    return
  }

  if (item) selectItem(item, 0)
  const target = handleCopy(item) || selectedItem.value
  if (!target) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  router.push({
    path: '/production/transaksi/t_mrp/form',
    query: { 
      action: 'copy',
      source: target.id 
    }
  })

  toast.success(`Menyalin data "${target.no || ''}"`, {
    description: 'Silakan edit dan simpan sebagai MRP baru'
  })
  deselectItem()
}

const createNew = () => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk membuat data baru'
    })
    return
  }
  router.push('/production/transaksi/t_mrp/form')
}

// ============================================================================
// API & DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const extraParams: Record<string, string> = {}
    if (tableWhereClause.value) extraParams['where'] = tableWhereClause.value
    Object.entries(tableColumnFilters.value).forEach(([col, val]) => {
      if (val) extraParams[`filter_column_${col}`] = val
    })

    const response = await getMrpList(
      page, 
      pageSize.value, 
      'createdAt', 
      'DESC',
      searchApiQuery.value || undefined,
      searchApiQuery.value ? 'no,note' : undefined,
      extraParams
    )

    if (response.status === 'success') {
      if (page === 1 || resetData) {
        menuData.value = response.data || []
      } else {
        menuData.value.push(...(response.data || []))
      }

      if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null
      }
    }
  } catch (error) {
    toast.error('Gagal memuat data MRP', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const handleLoadMore = () => {
  currentPage.value++
  fetchMenuData(currentPage.value)
}

const handleApiSearch = async () => {
  if (isSearching.value) return
  isSearching.value = true
  searchApiQuery.value = searchQuery.value
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  await fetchMenuData(1, true)
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
  dateRange: Record<string, { from: string, to: string }>
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
  filterStatus.value = null
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
  const windowHeight = window.innerHeight
  const docHeight = document.documentElement.scrollHeight
  if (docHeight - scrollTop - windowHeight < 100) {
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
            <h1 class="text-lg font-bold">MRP</h1>
            <p class="text-xs text-muted-foreground">Kelola data MRP</p>
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
          <Input v-model="searchQuery" placeholder="Cari no. mrp..." class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Content Area -->
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
        <p class="text-sm text-muted-foreground">Tidak ada data MRP</p>
      </div>

      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id"
          class="cursor-pointer hover:shadow-md transition-all" @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.no || 'Tanpa Nomor' }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-' }} • {{ item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama_comp || '-' }}
                </div>
              </div>
              <Badge
                :class="(item.status || 'DRAFT').toUpperCase() === 'POST' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-800 border-gray-200'"
                class="text-xs shrink-0 border">
                {{ (item.status || 'DRAFT').toUpperCase() }}
              </Badge>
            </div>

            <div v-if="item.note" class="text-xs text-muted-foreground truncate">
              <span class="font-medium">Notes:</span> {{ item.note }}
            </div>

            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost" size="sm" class="h-7 w-7"
                :status="item.status"
                :disabled="!isSuperAdmin && isStatusLocked(item)"
                @click.stop="() => { selectItem(item, 0); deleteSelected(item) }" />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost" size="sm" class="h-7 w-7"
                :status="item.status"
                :disabled="!isSuperAdmin && isStatusLocked(item)"
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
        <h1 class="text-2xl font-bold">MRP</h1>
        <p class="text-sm text-muted-foreground">Kelola data MRP</p>
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

      <!-- Search & Actions -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Cari no. mrp..." class="pl-9 pr-8"
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
            :disabled="!canEditOrDelete"
            @click="deleteSelected()" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete"
            @click="editItem()" />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()" />
          <PostButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT')"
            @click="() => postSelected()" />
        </div>
      </div>
    </div>

    <!-- Table -->
    <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
      :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange">
      <template #empty>
        Tidak ada data MRP
      </template>
    </DataTable>
  </div>

  <!-- Delete Dialog -->
  <GlobalDialog 
    :open="isDeleteDialogOpen" 
    title="Hapus MRP" 
    :description="deleteDialogDescription" 
    type="danger"
    confirm-text="Hapus" 
    cancel-text="Batal" 
    :is-loading="isDeleting" 
    @confirm="confirmDelete"
    @cancel="cancelDelete" 
    @update:open="isDeleteDialogOpen = $event" 
  />

  <!-- Post Dialog -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="POST MRP"
    :description="`Apakah Anda yakin ingin POST MRP &quot;${itemToPost?.no || 'ini'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />
</template>

<style scoped>
.list-move {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-active {
  transition: all 0.4s ease-out;
}
.list-leave-active {
  transition: all 0.3s ease-in;
  position: absolute;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
