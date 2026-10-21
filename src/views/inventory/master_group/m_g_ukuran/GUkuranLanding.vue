<script setup lang="ts">
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
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, PostButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'
import { getGUkuranList, deleteGUkuran, postGUkuran, type GUkuranItem } from './service'

const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete } = usePermission()

const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<GUkuranItem | null>(null)
const isDeleting = ref(false)

const menuData = ref<GUkuranItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const filterPostingStatus = ref<'DRAFT' | 'POST' | null>(null)
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

const isPosted = (item?: GUkuranItem | null) => {
  if (!item) return false
  if (typeof item.status === 'string') return item.status.trim().toUpperCase() === 'POST'
  if (typeof item.is_active === 'boolean') return item.is_active
  if (typeof item.is_active === 'number') return (item.is_active as unknown as number) === 1
  if (typeof item.status === 'boolean') return item.status
  if (typeof item.status === 'number') return (item.status as unknown as number) === 1
  return false
}
const getActiveFlag = (item?: GUkuranItem | null) => {
  if (!item) return false
  if (typeof item.is_active === 'boolean') return item.is_active
  if (typeof item.is_active === 'number') return (item.is_active as unknown as number) === 1
  return true
}
const getPostingStatusBadgeClass = (posted: boolean) => posted
  ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300'
  : getApprovalStatusBadgeClass('DRAFT')
const columns = [
  { key: 'code', label: 'Code', filterable: true, width: '160px' },
  { key: 'name', label: 'Name', filterable: true, width: '220px' },
  { key: 'panjang', label: 'Panjang', filterable: true, width: '140px' },
  { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' },
  {
    key: 'is_active',
    label: 'Status Aktif',
    filterable: false,
    width: '120px',
    renderHtml: (item: GUkuranItem) => {
      const active = getActiveFlag(item)
      const text = active ? 'Aktif' : 'Nonaktif'
      const colorClass = active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      return `<span class="font-bold ${colorClass}">${text}</span>`
    }
  },
  {
    key: 'status',
    label: 'Status',
    filterable: false,
    width: '120px',
    renderHtml: (item: GUkuranItem) => {
      const posted = isPosted(item)
      const text = posted ? 'POST' : 'DRAFT'
      const badgeClass = getPostingStatusBadgeClass(posted)
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${text}</span>`
    }
  }
]

const filteredData = computed(() => {
  return menuData.value.filter((item: GUkuranItem) => {
    const matchStatus = filterStatus.value === null
      ? true
      : filterStatus.value === 'Aktif'
        ? getActiveFlag(item) === true
        : getActiveFlag(item) === false

    const matchPosting = filterPostingStatus.value === null
      ? true
      : isPosted(item) === (filterPostingStatus.value === 'POST')

    return matchStatus && matchPosting
  })
})

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return ''
  return `Apakah Anda yakin ingin menghapus G Ukuran "${itemToDelete.value.name || itemToDelete.value.code}"? Tindakan ini tidak dapat dibatalkan.`
})

const deleteSelected = () => {
  if (!canDelete.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk menghapus data' })
    return
  }

  const item = handleDelete()
  if (!item) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  if (isPosted(item)) {
    toast.error('Tidak dapat menghapus', {
      description: 'Data yang sudah Post hanya bisa diedit, tidak bisa dihapus'
    })
    return
  }

  itemToDelete.value = item
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!itemToDelete.value) return

  isDeleting.value = true
  try {
    const response = await deleteGUkuran(itemToDelete.value.id)

    if (response.status === 'success') {
      menuData.value = menuData.value.filter((m: GUkuranItem) => m.id !== itemToDelete.value!.id)

      toast.success(`G Ukuran "${itemToDelete.value.name || itemToDelete.value.code}" berhasil dihapus`, {
        description: response.message || 'Item telah dihapus dari database'
      })

      deselectItem()
      isDeleteDialogOpen.value = false
    } else {
      toast.error('Gagal menghapus G Ukuran', {
        description: response.message || 'Terjadi kesalahan saat menghapus'
      })
    }
  } catch (error) {
    toast.error('Gagal menghapus G Ukuran', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    isDeleting.value = false
    itemToDelete.value = null
  }
}

const cancelDelete = () => {
  isDeleteDialogOpen.value = false
  itemToDelete.value = null
}

const isPostDialogOpen = ref(false)
const itemToPost = ref<GUkuranItem | null>(null)
const isPosting = ref(false)

const postDialogDescription = computed(() => {
  if (!itemToPost.value) return ''
  return `Apakah Anda yakin ingin memposting G Ukuran "${itemToPost.value.name || itemToPost.value.code || 'Tanpa Nama'}"? Setelah diposting, data tidak dapat dihapus.`
})

const postSelected = (item?: GUkuranItem) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk mem-Post data' })
    return
  }
  const targetItem = item || selectedItem.value
  if (!targetItem) {
    toast.error('Pilih item terlebih dahulu')
    return
  }
  if (isPosted(targetItem)) {
    toast.error('Item sudah di-POST', { description: 'Data yang sudah POST tidak bisa diubah lagi' })
    return
  }
  itemToPost.value = targetItem
  isPostDialogOpen.value = true
}

const confirmPost = async () => {
  if (!itemToPost.value?.id) return
  isPosting.value = true
  try {
    const response = await postGUkuran(itemToPost.value.id)
    if (response.status === 'success') {
      const targetId = itemToPost.value.id
      menuData.value = menuData.value.map((m: GUkuranItem) =>
        m.id === targetId ? { ...m, status: 'POST' } : m
      )
      toast.success(`G Ukuran "${itemToPost.value.name || itemToPost.value.code}" berhasil di-POST`, {
        description: 'Data tidak bisa dihapus lagi'
      })
      deselectItem()
      isPostDialogOpen.value = false
    } else {
      toast.error('Gagal mem-Post G Ukuran', { description: (response as any).message || 'Terjadi kesalahan' })
    }
  } catch (error) {
    toast.error('Gagal mem-Post G Ukuran', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
  } finally {
    isPosting.value = false
    itemToPost.value = null
  }
}

const cancelPost = () => {
  isPostDialogOpen.value = false
  itemToPost.value = null
}

const viewItem = (item?: any) => {
  if (item) selectItem(item, 0)
  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu')
    return
  }
  router.push(`/inventory/master_group/m_g_ukuran/view/${selectedItem.value.id}`)
}

const editItem = (item?: any) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk mengubah data' })
    return
  }
  if (item) selectItem(item, 0)
  const selectedItemData = handleEdit(item)
  if (!selectedItemData) {
    toast.error('Pilih item terlebih dahulu')
    return
  }
  router.push(`/inventory/master_group/m_g_ukuran/form/${selectedItemData.id}`)
}

const copyItem = (item?: any) => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
    return
  }
  if (item) selectItem(item, 0)
  const selectedItemData = handleCopy(item)
  if (!selectedItemData) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  router.push({
    path: '/inventory/master_group/m_g_ukuran/form',
    query: { action: 'copy', source: selectedItemData.id }
  })

  toast.success(`Menyalin data "${selectedItemData.name || selectedItemData.code}"`, {
    description: 'Silakan edit dan simpan sebagai G Ukuran baru'
  })
  deselectItem()
}

const createNew = () => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
    return
  }
  router.push('/inventory/master_group/m_g_ukuran/form')
}

const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) loading.value = true
  else loadingMore.value = true

  try {
    const response = await getGUkuranList(
      page,
      pageSize.value,
      'createdAt',
      'DESC',
      searchApiQuery.value || undefined,
      searchApiQuery.value ? 'code,name,panjang,catatan' : undefined,
      tableColumnFilters.value
    )

    if (response.status === 'success') {
      if (page === 1 || resetData) menuData.value = response.data
      else menuData.value.push(...response.data)

      if (response.pagination) hasMoreData.value = response.pagination.next_page !== null
    }
  } catch (error) {
    toast.error('Gagal memuat data G Ukuran', {
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
  if (searchQuery.value.trim()) {
    toast.success('Pencarian selesai', {
      description: `Ditemukan ${menuData.value.length} hasil`
    })
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
  dateRange: Record<string, { from: string, to: string }>
  where: string
}) => {
  tableColumnFilters.value = filters.column
  tableColumnFilterOperators.value = filters.operator
  tableDateRangeFilters.value = filters.dateRange

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
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Master Group G Ukuran</h1>
            <p class="text-xs text-muted-foreground">Kelola data G Ukuran</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterStatus === null ? 'border-primary text-primary' : ''" @click="filterStatus = null">
            All
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterStatus === 'Aktif' ? 'border-primary text-primary' : ''" @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">
            Aktif
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterStatus === 'Nonaktif' ? 'border-primary text-primary' : ''" @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">
            Nonaktif
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterPostingStatus === null ? 'border-primary text-primary' : ''" @click="filterPostingStatus = null">
            Semua Status
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="getApprovalStatusFilterClass('DRAFT', filterPostingStatus === 'DRAFT')" @click="filterPostingStatus = filterPostingStatus === 'DRAFT' ? null : 'DRAFT'">
            DRAFT
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7" :class="filterPostingStatus === 'POST' ? 'bg-cyan-100 text-cyan-800 border-cyan-500 hover:bg-cyan-200' : ''" @click="filterPostingStatus = filterPostingStatus === 'POST' ? null : 'POST'">
            POST
          </Button>
        </div>

        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8 h-8 text-sm" @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
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
        <p class="text-sm text-muted-foreground">Tidak ada data</p>
      </div>

      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id" class="cursor-pointer hover:shadow-md transition-all" @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.name || '-' }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ item.code || '-' }}</div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <Badge :variant="getActiveFlag(item) ? 'default' : 'secondary'" class="text-xs">
                  {{ getActiveFlag(item) ? 'Aktif' : 'Nonaktif' }}
                </Badge>
                <Badge :class="getPostingStatusBadgeClass(isPosted(item))" class="text-xs uppercase">
                  {{ isPosted(item) ? 'POST' : 'DRAFT' }}
                </Badge>
              </div>
            </div>

            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.panjang !== null && item.panjang !== undefined">
                <span class="font-medium">Panjang:</span> {{ item.panjang }}
              </div>
              <div v-if="item.catatan">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
              </div>
            </div>

            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" variant="ghost" size="sm" class="h-7 w-7" :disabled="isPosted(item)" @click.stop="() => { selectItem(item, 0); deleteSelected() }" />
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="editItem(item)" />
              <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="copyItem(item)" />
              <PostButton :menu-id="currentMenuId" variant="ghost" size="sm" :show-label="false" class="h-7 w-7 text-blue-600" :disabled="isPosted(item)" @click.stop="postSelected(item)" />
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
      <Button v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50" size="icon">
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Master Group G Ukuran</h1>
        <p class="text-sm text-muted-foreground">Kelola data G Ukuran</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button variant="outline" size="sm" :class="filterStatus === null ? 'border-primary text-primary' : ''" @click="filterStatus = null">All</Button>
        <Button variant="outline" size="sm" :class="filterStatus === 'Aktif' ? 'border-primary text-primary' : ''" @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">Aktif</Button>
        <Button variant="outline" size="sm" :class="filterStatus === 'Nonaktif' ? 'border-primary text-primary' : ''" @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">Nonaktif</Button>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status Pencatatan:</span>
        <Button variant="outline" size="sm" :class="filterPostingStatus === null ? 'border-primary text-primary' : ''" @click="filterPostingStatus = null">All</Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('DRAFT', filterPostingStatus === 'DRAFT')" @click="filterPostingStatus = filterPostingStatus === 'DRAFT' ? null : 'DRAFT'">DRAFT</Button>
        <Button variant="outline" size="sm" :class="filterPostingStatus === 'POST' ? 'bg-cyan-100 text-cyan-800 border-cyan-500 hover:bg-cyan-200' : ''" @click="filterPostingStatus = filterPostingStatus === 'POST' ? null : 'POST'">POST</Button>
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
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" :disabled="!isActive || isPosted(selectedItem)" @click="deleteSelected" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" :disabled="!isActive" @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive" @click="copyItem()" />
          <PostButton :menu-id="currentMenuId" :disabled="!isActive || isPosted(selectedItem)" @click="postSelected()" />
        </div>
      </div>
    </div>

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
      <template #empty>
        Tidak ada data G Ukuran
      </template>
    </DataTable>

    <GlobalDialog
      v-model:open="isDeleteDialogOpen"
      title="Hapus G Ukuran"
      :description="deleteDialogDescription"
      confirm-text="Hapus"
      cancel-text="Batal"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <GlobalDialog
      v-model:open="isPostDialogOpen"
      title="Post G Ukuran"
      :description="postDialogDescription"
      confirm-text="Post"
      cancel-text="Batal"
      :loading="isPosting"
      @confirm="confirmPost"
      @cancel="cancelPost"
    />
  </div>
</template>
