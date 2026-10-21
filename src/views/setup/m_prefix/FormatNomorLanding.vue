<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, EditButton, CopyButton, ViewButton } from '@/components/button'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { Search, RefreshCw, X, Plus, Loader2 } from 'lucide-vue-next'
import { getFormatNomorList, deleteFormatNomor, type FormatNomorItem } from './service'
import { useActionButtons } from '@/composables/useActionButtons'
import { useSidebarRefresh } from '@/composables/useSidebarRefresh'
import { usePermission } from '@/composables/usePermission'

// ============================================================================
// COMPOSABLES
// ============================================================================
const router = useRouter()
const route = useRoute()
const { triggerRefresh } = useSidebarRefresh()
const { selectedItem, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()

// Custom isActive function
const isActive = computed(() => !!selectedItem.value)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Format preview text dengan substitusi tanggal untuk readability */
const formatPreviewText = (pertinjau: string): string => {
  if (!pertinjau) return '-'
  
  let result = pertinjau
  
  // Get current date
  const today = new Date()
  const day = today.getDate().toString().padStart(2, '0')
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  const year = today.getFullYear().toString().slice(-2)
  const fullYear = today.getFullYear().toString()
  
  // Step 1: Replace format codes with actual values (case-insensitive matching)
  result = result.replace(/yyyy/gi, fullYear)
  result = result.replace(/yy/gi, year)
  result = result.replace(/mm/gi, month)
  result = result.replace(/dd/gi, day)
  
  // Step 2: Replace sequence of 0s (4+ digits) dengan nomor urut contoh
  // Only replace sequences of 4+ zeros to avoid replacing date values
  let seqCount = 0
  result = result.replace(/0{4,}/g, () => {
    seqCount++
    const padding = Math.max(0, 5 - seqCount.toString().length)
    return '0'.repeat(padding) + seqCount
  })
  
  return result
}

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<FormatNomorItem[]>([])
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

// Table filter state
const tableColumnFilters = ref<Record<string, string>>({})
const tableWhere = ref<string>('')
let filterTimeout: ReturnType<typeof setTimeout> | null = null

const handleTableFilterChange = (payload: { column: Record<string, string>; operator: Record<string, string>; dateRange: Record<string, {from: string; to: string}>; where: string }) => {
    tableColumnFilters.value = { ...payload.column }
    tableWhere.value = payload.where
    
    if (filterTimeout) clearTimeout(filterTimeout)
    filterTimeout = setTimeout(() => {
        currentPage.value = 1
        hasMoreData.value = true
        fetchMenuData(1, true)
    }, 500)
}

// Delete dialog
const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const itemToDelete = ref<FormatNomorItem | null>(null)

// ============================================================================
// COMPUTED
// ============================================================================
const columns = [
    { 
      key: 'pertinjau', 
      label: 'Format Preview', 
      filterable: true, 
      width: '250px',
      render: (item: FormatNomorItem) => formatPreviewText(item.pertinjau)
    },
    { 
        key: 'company.nama_comp', 
        label: 'Unit Bisnis', 
        filterable: true, 
        width: '200px',
        render: (item: FormatNomorItem) => {
            // Support multiple field names due to backend inconsistency
            return (item as any).m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.company?.nama_comp || '-'
        }
    },
    { 
        key: 'menu.label', 
        label: 'Menu', 
        filterable: true, 
        width: '200px',
        render: (item: FormatNomorItem) => item.m_menu?.name || item.m_menu?.label || item.menu?.label || '-'
    },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: FormatNomorItem) => {
            const isActive = item.is_active
            const text = isActive ? 'Aktif' : 'Nonaktif'
            const colorClass = isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            return `<span class="font-bold ${colorClass}">${text}</span>`
        }
    }
]

/** Filter data by status */
const filteredData = computed(() => {
    if (!filterStatus.value) return menuData.value

    return menuData.value.filter(item => {
        const matchStatus = filterStatus.value === 'Aktif' ? item.is_active : !item.is_active
        return matchStatus
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    const menuLabel = itemToDelete.value.m_menu?.name || itemToDelete.value.m_menu?.label || itemToDelete.value.menu?.label || '-'
    return `Apakah Anda yakin ingin menghapus Format Nomor untuk menu "${menuLabel}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
    // Check permission
    if (!canDelete.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk menghapus data'
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

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
    if (!itemToDelete.value) return

    isDeleting.value = true
    try {
        const response = await deleteFormatNomor(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: FormatNomorItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Format Nomor berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Format Nomor', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Format Nomor', {
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

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate ke form view (readonly) */
const viewSelected = () => {
    const item = selectedItem.value
    if (!item) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    router.push(`/setup/m_format_nomor/view/${item.id}`)
    deselectItem()
}

/** Navigate ke form edit */
const editSelected = () => {
    // Check permission
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengubah data'
        })
        return
    }
    
    const item = handleEdit()
    if (!item) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    router.push(`/setup/m_format_nomor/form/${item.id}`)
    deselectItem()
}

/** Copy item - duplicate dengan action=copy */
const copySelected = () => {
    // Check permission (copy requires create permission)
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat data baru'
        })
        return
    }
    
    const item = handleCopy()
    if (!item) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    router.push({
        path: '/setup/m_format_nomor/form',
        query: { 
            action: 'copy',
            source: item.id 
        }
    })
    
    toast.success(`Menyalin data format nomor`, {
        description: 'Silakan edit dan simpan sebagai Format Nomor baru'
    })
    deselectItem()
}

const copyItem = (item: FormatNomorItem) => {
    selectItem(item, 0)
    copySelected()
}

/** Navigasi ke form create baru */
const createNew = () => {
    // Check permission
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat data baru'
        })
        return
    }
    
    router.push('/setup/m_format_nomor/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Handle search input dengan debounce */
const handleApiSearch = () => {
    isSearching.value = true
    searchApiQuery.value = searchQuery.value.trim()
    currentPage.value = 1
    hasMoreData.value = true
    fetchMenuData(1, true)
}

/** Clear search */
const clearSearch = () => {
    searchQuery.value = ''
    searchApiQuery.value = ''
    currentPage.value = 1
    hasMoreData.value = true
    fetchMenuData(1, true)
}

/** Handle refresh */
const handleRefresh = () => {
    fetchMenuData(1, true)
    triggerRefresh()
}

/** Fetch format nomor data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    // Separate direct filters and relation filters
    const directFilters: Record<string, string> = {}
    let currentSearch = searchApiQuery.value || ''
    let currentSearchField = searchApiQuery.value ? 'pertinjau,m_menu.name' : ''

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
        if (!value) return
        
        let mappedKey = key
        if (key === 'menu.label' || key === 'm_menu.label') mappedKey = 'm_menu.name'
        if (key === 'company.nama_comp') mappedKey = 'm_unit_bisnis.nama_comp'

        if (mappedKey.includes('.')) {
            // Relation field: append to search and searchfield
            currentSearch = currentSearch ? `${currentSearch},${value}` : value
            currentSearchField = currentSearchField ? `${currentSearchField},${mappedKey}` : mappedKey
        } else {
            directFilters[mappedKey] = value
        }
    })

    try {
        const response = await getFormatNomorList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            currentSearch || undefined,
            currentSearchField || undefined,
            tableWhere.value || undefined,
            Object.keys(directFilters).length > 0 ? directFilters : undefined
        )
        
        if (response.status === 'success') {
            if (page === 1 || resetData) {
                menuData.value = response.data
            } else {
                menuData.value.push(...response.data)
            }

            if (response.pagination) {
                hasMoreData.value = !!response.pagination.next_page
                currentPage.value = response.pagination.page
            } else {
                hasMoreData.value = false
            }
        } else {
            toast.error('Gagal memuat data', {
                description: 'Terjadi kesalahan saat mengambil data'
            })
        }
    } catch (error) {
        toast.error('Gagal memuat data Format Nomor', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        loading.value = false
        loadingMore.value = false
        isSearching.value = false
    }
}

/** Handle search input dengan debounce */
const onSearch = () => {
    handleApiSearch()
}

/** Load more data untuk infinite scroll */
const handleLoadMore = () => {
    if (!loadingMore.value && hasMoreData.value) {
        fetchMenuData(currentPage.value + 1, false)
    }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
const activeTab = ref<'prefix' | 'format'>('format')

const switchTab = (tab: 'prefix' | 'format') => {
  activeTab.value = tab
  if (tab === 'prefix') {
    router.push('/setup/m_prefix')
  } else {
    router.push('/setup/m_format_nomor')
  }
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onMounted(async () => {
    await fetchMenuData(1, true)
    
    // Watch route query untuk reload
    const stopWatch = () => {
        if (route.query.reload) {
            fetchMenuData(1, true)
            triggerRefresh()
        }
    }
    
    // Cleanup
    onUnmounted(() => {
        menuData.value = []
        deselectItem()
    })
})
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- ================================================================ -->
    <!-- MOBILE LAYOUT - lg:hidden -->
    <!-- ================================================================ -->
    <div class="lg:hidden flex flex-col min-h-screen relative">
      <!-- Mobile Header -->
      <div class="flex-none border-b bg-background sticky top-0 z-40 space-y-4 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold">Format Nomor</h2>
            <p class="text-xs text-muted-foreground">Kelola format nomor</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            @click="handleRefresh"
            :disabled="loading"
            title="Refresh data"
            class="shrink-0"
          >
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Mobile Tabs - Compact -->
        <div class="flex gap-1 border-b overflow-x-auto -mx-4 px-4">
          <Button
            :variant="activeTab === 'prefix' ? 'default' : 'ghost'"
            @click="switchTab('prefix')"
            class="rounded-b-none text-xs h-7 shrink-0"
          >
            Master Prefix
          </Button>
          <Button
            :variant="activeTab === 'format' ? 'default' : 'ghost'"
            @click="switchTab('format')"
            class="rounded-b-none text-xs h-7 shrink-0"
          >
            Format Nomor
          </Button>
        </div>

        <!-- Filter Status -->
        <div class="flex items-center gap-2 text-xs font-medium">
          <span>Filter:</span>
          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterStatus = null"
            class="text-xs h-7"
          >
            All
          </Button>

          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
            @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
            class="text-xs h-7"
          >
            Aktif
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
            @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'"
            class="text-xs h-7"
          >
            Nonaktif
          </Button>
        </div>

        <!-- Search -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
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
              :disabled="isSearching"
              class="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            >
              <X class="h-3 w-3" />
            </Button>
          </div>
          <Button
            @click="handleApiSearch"
            size="icon"
            variant="secondary"
            :disabled="isSearching"
            title="Search"
            class="h-8 w-8"
          >
            <Search class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Mobile Content Area -->
      <div class="flex-1 overflow-y-auto p-4 pt-5 pb-28">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="filteredData.length === 0" class="text-center py-12">
          <p class="text-sm text-muted-foreground">Tidak ada data Format Nomor</p>
        </div>

        <TransitionGroup v-else name="list" tag="div" class="space-y-3">
          <Card
            v-for="(item, index) in filteredData"
            :key="item.id"
            @click="selectItem(item, index)"
            :class="{
              'cursor-pointer transition-all hover:shadow-md': true,
              'ring-2 ring-primary': selectedItem?.id === item.id
            }"
          >
            <CardContent class="p-4 space-y-2">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="font-bold text-sm line-clamp-2">{{ formatPreviewText(item.pertinjau) }}</div>
                  <div class="text-xs text-muted-foreground space-y-1 mt-2">
                    <div><span class="font-semibold">Unit:</span> {{ (item as any).m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.company?.nama_comp || '-' }}</div>
                    <div><span class="font-semibold">Menu:</span> {{ item.m_menu?.name || item.m_menu?.label || item.menu?.label || '-' }}</div>
                  </div>
                </div>
                <Badge :variant="item.is_active ? 'default' : 'secondary'" class="text-xs shrink-0">
                  {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                </Badge>
              </div>

              <!-- Mobile Action Buttons - Show when selected -->
              <div v-if="selectedItem?.id === item.id" class="flex gap-1 pt-2 border-t">
                <ViewButton
                  @click.stop="router.push(`/setup/m_format_nomor/view/${item.id}`)"
                  class="h-8 w-8"
                />
                <EditButton
                  v-permission="{ menuId: currentMenuId, action: 'update' }"
                  @click.stop="router.push(`/setup/m_format_nomor/form/${item.id}`)"
                  class="h-8 w-8"
                />
                <CopyButton
                  v-permission="{ menuId: currentMenuId, action: 'create' }"
                  @click.stop="copyItem(item)"
                  class="h-8 w-8"
                />
                <DeleteButton
                  v-permission="{ menuId: currentMenuId, action: 'delete' }"
                  @click.stop="deleteSelected"
                  class="h-8 w-8"
                />
              </div>
            </CardContent>
          </Card>

          <!-- Load More Button -->
          <Button
            v-if="hasMoreData"
            @click="handleLoadMore"
            variant="outline"
            :disabled="loadingMore"
            class="w-full"
          >
            <Loader2 v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" />
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </Button>
        </TransitionGroup>
      </div>

      <!-- Mobile FAB Button -->
      <teleport to="body">
        <Button
          v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew"
          :disabled="loading"
          class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <Plus class="h-6 w-6" />
        </Button>
      </teleport>
    </div>

    <!-- ================================================================ -->
    <!-- DESKTOP LAYOUT - hidden lg:block -->
    <!-- ================================================================ -->
    <div class="hidden lg:flex lg:flex-col lg:space-y-4 lg:p-8 h-full">
      <!-- Desktop Header -->
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <h2 class="text-2xl font-bold tracking-tight">Format Nomor</h2>
          <p class="text-muted-foreground">Kelola format nomor untuk setiap menu</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            @click="handleRefresh"
            :disabled="loading"
            title="Refresh data"
          >
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
          <Button
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            @click="createNew"
            :disabled="loading"
          >
            <Plus class="mr-2 h-4 w-4" />
            Create New
          </Button>
        </div>
      </div>

      <!-- Desktop Tabs Navigation -->
      <div class="flex gap-2 border-b">
        <Button
          :variant="activeTab === 'prefix' ? 'default' : 'ghost'"
          @click="switchTab('prefix')"
          class="rounded-b-none"
        >
          Master Prefix
        </Button>
        <Button
          :variant="activeTab === 'format' ? 'default' : 'ghost'"
          @click="switchTab('format')"
          class="rounded-b-none"
        >
          Format Nomor
        </Button>
      </div>

      <!-- Desktop Filter & Actions Row -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">Filter Status:</span>
          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterStatus = null"
          >
            All
          </Button>

          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
            @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
          >
            Aktif
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
            @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'"
          >
            Nonaktif
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative flex gap-2">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search..."
              class="pl-9 pr-10 w-[250px]"
              @keyup.enter="handleApiSearch"
              :disabled="isSearching"
            />
            <Button
              v-if="searchQuery"
              @click="clearSearch"
              size="icon"
              variant="ghost"
              :disabled="isSearching"
              class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button
            @click="handleApiSearch"
            size="icon"
            variant="secondary"
            :disabled="isSearching"
            title="Search"
          >
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Action Buttons - Only visible when row selected -->
        <div class="flex items-center gap-2 ml-auto">
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :disabled="!isActive"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewSelected" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!isActive"
            @click="editSelected"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copySelected"
          />
        </div>
      </div>

      <!-- Desktop Data Table -->
      <div class="flex-1 overflow-hidden rounded-md border">
        <DataTable
          :data="filteredData"
          :columns="columns"
          :loading="loading"
          :loading-more="loadingMore"
          :has-more="hasMoreData"
          :row-select-mode="true"
          :api-filter-mode="true"
          max-height="500px"
          @load-more="handleLoadMore"
          @row-select="(item: FormatNomorItem) => selectItem(item, 0)"
          @row-deselect="deselectItem"
          @filter-change="handleTableFilterChange"
        >
          <template #empty>Tidak ada data Format Nomor</template>
        </DataTable>
      </div>
    </div>

    <!-- Delete Dialog -->
    <GlobalDialog
      :open="isDeleteDialogOpen"
      title="Hapus Format Nomor"
      :description="deleteDialogDescription"
      type="danger"
      :loading="isDeleting"
      confirm-text="Hapus"
      cancel-text="Batal"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
