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
import { getCategoryList, deleteCategory, type CategoryItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } =
  useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete } = usePermission()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<CategoryItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<CategoryItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: 'code', label: 'Kode', filterable: true, width: '150px' },
  { key: 'name', label: 'Nama Category', filterable: true, width: '220px' },
  { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' },
  {
    key: 'item_count',
    label: 'Jumlah Barang',
    filterable: false,
    width: '140px',
    valueGetter: (item: CategoryItem) => item._count?.items ?? 0,
    renderHtml: (item: CategoryItem) => String(item._count?.items ?? 0),
  },
  {
    key: 'is_active',
    label: 'Status',
    filterable: false,
    width: '120px',
    renderHtml: (item: CategoryItem) => {
      const aktif = item.is_active !== false
      const text = aktif ? 'Aktif' : 'Nonaktif'
      const colorClass = aktif
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400'
      return `<span class="font-bold ${colorClass}">${text}</span>`
    },
  },
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return ''
  return `Apakah Anda yakin ingin menghapus Category "${itemToDelete.value.name}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Filter yang dikirim ke API (hanya field yang didukung backend) */
const apiFilters = computed<Record<string, string>>(() => {
  const filters: Record<string, string> = {}
  if (filterStatus.value === 'Aktif') filters.filter_column_is_active = 'true'
  if (filterStatus.value === 'Nonaktif') filters.filter_column_is_active = 'false'
  return filters
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = () => {
  if (!canDelete.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk menghapus data',
    })
    return
  }

  const item = handleDelete()
  if (!item) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  itemToDelete.value = item
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!itemToDelete.value) return

  isDeleting.value = true
  try {
    const response = await deleteCategory(itemToDelete.value.id)

    if (response.status === 'success') {
      menuData.value = menuData.value.filter((m) => m.id !== itemToDelete.value!.id)
      toast.success(`Category "${itemToDelete.value.name}" berhasil dihapus`, {
        description: response.message || 'Item telah dihapus dari database',
      })
      deselectItem()
      isDeleteDialogOpen.value = false
    } else {
      toast.error('Gagal menghapus Category', {
        description: response.message || 'Terjadi kesalahan saat menghapus',
      })
    }
  } catch (error) {
    toast.error('Gagal menghapus Category', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  } finally {
    isDeleting.value = false
    isDeleteDialogOpen.value = false
    itemToDelete.value = null
  }
}

const cancelDelete = () => {
  isDeleteDialogOpen.value = false
  itemToDelete.value = null
}

// ============================================================================
// VIEW / EDIT / COPY / CREATE
// ============================================================================
const viewItem = (item?: CategoryItem) => {
  if (item) selectItem(item, 0)

  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  router.push(`/inventory/master/m_category/view/${(selectedItem.value as CategoryItem).id}`)
}

const editItem = (item?: CategoryItem) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk mengubah data',
    })
    return
  }

  if (item) selectItem(item, 0)
  const selectedItemData = handleEdit(item) as CategoryItem | null | undefined
  if (!selectedItemData) {
    toast.error('Pilih item terlebih dahulu')
    return
  }
  router.push(`/inventory/master/m_category/form/${selectedItemData.id}`)
}

const copyItem = (item?: CategoryItem) => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk membuat data baru',
    })
    return
  }

  if (item) selectItem(item, 0)
  const selectedItemData = handleCopy(item) as CategoryItem | null | undefined
  if (!selectedItemData) {
    toast.error('Pilih item terlebih dahulu')
    return
  }

  router.push({
    path: '/inventory/master/m_category/form',
    query: { action: 'copy', source: selectedItemData.id },
  })
  toast.success(`Menyalin data "${selectedItemData.name}"`, {
    description: 'Silakan edit dan simpan sebagai Category baru',
  })
  deselectItem()
}

const createNew = () => {
  if (!canCreate.value) {
    toast.error('Akses Ditolak', {
      description: 'Anda tidak memiliki izin untuk membuat data baru',
    })
    return
  }

  router.push('/inventory/master/m_category/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await getCategoryList(
      page,
      pageSize.value,
      'createdAt',
      'DESC',
      searchApiQuery.value || undefined,
      apiFilters.value,
    )

    if (response.status === 'success') {
      if (page === 1 || resetData) {
        menuData.value = response.data
      } else {
        menuData.value.push(...response.data)
      }

      if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null
      }
    }
  } catch (error) {
    toast.error('Gagal memuat data Category', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
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
      description: `Ditemukan ${menuData.value.length} hasil`,
    })
  }

  isSearching.value = false
}

const clearSearch = async () => {
  searchQuery.value = ''
  searchApiQuery.value = ''
  await handleApiSearch()
}

/** Ubah filter status dan reload dari server (filter_column_is_active) */
const setFilterStatus = async (value: 'Aktif' | 'Nonaktif' | null) => {
  filterStatus.value = value
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  deselectItem()
  await fetchMenuData(1, true)
}

const handleRefresh = async () => {
  searchQuery.value = ''
  searchApiQuery.value = ''
  filterStatus.value = null
  menuData.value = []
  currentPage.value = 1
  hasMoreData.value = true
  deselectItem()

  await fetchMenuData(1, true)

  toast.success('Data berhasil dimuat ulang')
}

/** Infinite scroll handler untuk mobile (window scroll) */
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
// LIFECYCLE HOOKS
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
  <!-- MOBILE VIEW (LG:HIDDEN) -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <!-- STICKY HEADER -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <!-- Title & Refresh -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Master Category</h1>
            <p class="text-xs text-muted-foreground">Kelola data Category</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            @click="handleRefresh"
            :disabled="loading"
            class="h-8 w-8"
          >
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="setFilterStatus(null)"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
            @click="setFilterStatus(filterStatus === 'Aktif' ? null : 'Aktif')"
          >
            Aktif
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
            @click="setFilterStatus(filterStatus === 'Nonaktif' ? null : 'Nonaktif')"
          >
            Nonaktif
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search..."
            class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch"
            :disabled="isSearching"
          />
          <Button
            v-if="searchQuery"
            @click="clearSearch"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- CONTENT AREA -->
    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <!-- Loading Skeletons -->
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>

      <!-- Empty State -->
      <div v-else-if="menuData.length === 0" class="text-center py-8">
        <p class="text-sm text-muted-foreground">Tidak ada data</p>
      </div>

      <!-- Card List with Animation -->
      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card
          v-for="item in menuData"
          :key="item.id"
          class="cursor-pointer hover:shadow-md transition-all"
          @click="selectItem(item, 0)"
        >
          <CardContent class="pt-3 pb-2 space-y-2">
            <!-- Name & Status Row -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.name || '-' }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ item.code || '-' }}</div>
              </div>
              <Badge
                :variant="item.is_active !== false ? 'default' : 'secondary'"
                class="text-xs shrink-0"
              >
                {{ item.is_active !== false ? 'Aktif' : 'Nonaktif' }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.catatan">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
              </div>
              <div>
                <span class="font-medium">Jumlah Barang:</span> {{ item._count?.items ?? 0 }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="() => { selectItem(item, 0); deleteSelected() }"
              />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
              />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>

      <!-- Load More Indicator -->
      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- FAB Button - Teleport -->
    <teleport to="body">
      <Button
        v-permission="{ menuId: currentMenuId, action: 'create' }"
        @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
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
        <h1 class="text-2xl font-bold">Master Category</h1>
        <p class="text-sm text-muted-foreground">Kelola data Category</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="handleRefresh"
          :disabled="loading"
          class="shrink-0"
          title="Refresh data"
        >
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button
          v-if="currentMenuId"
          v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          Create New
        </Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Filter Status Row -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="setFilterStatus(null)"
        >
          All
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
          @click="setFilterStatus(filterStatus === 'Aktif' ? null : 'Aktif')"
        >
          Aktif
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
          @click="setFilterStatus(filterStatus === 'Nonaktif' ? null : 'Nonaktif')"
        >
          Nonaktif
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search..."
              class="pl-9 pr-8"
              @keyup.enter="handleApiSearch"
              :disabled="isSearching"
            />
            <Button
              v-if="searchQuery"
              @click="clearSearch"
              size="icon"
              variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :disabled="!isActive"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!isActive"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <DataTable
      :data="menuData"
      :columns="columns"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMoreData"
      :row-select-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
    >
      <template #empty> Tidak ada data Category </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Category"
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
/* TransitionGroup animations for list items */
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
