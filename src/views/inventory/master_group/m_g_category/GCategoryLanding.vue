<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus } from 'lucide-vue-next'
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
import { getGCategoryList, deleteGCategory, updateGCategory, type GCategoryItem } from './service'

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
const itemToDelete = ref<GCategoryItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false)
const itemToPost = ref<GCategoryItem | null>(null)
const isPosting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<GCategoryItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Active' | 'Non Active' | null>(null)
const filterPostingStatus = ref<'DRAFT' | 'POST' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// Column filters for API-based filtering
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
/** Status Active/Non Active berdasarkan field is_active (boolean, support 1/0) */
const getItemStatus = (item: GCategoryItem) => {
    const active = item.is_active as unknown
    if (active === undefined || active === null) return true
    return active === true || active === 1 || active === '1'
}

/** 
 * Normalisasi status pencatatan jadi 'DRAFT' atau 'POST'.
 * Data lama (sebelum field status berisi DRAFT/POST) tersimpan sebagai boolean/string true/false
 * setelah kolom diubah jadi string -> nilai itu dianggap data established, jadi dipetakan ke 'POST'.
 * Hanya nilai yang memang literal 'DRAFT' atau 'POST' yang dihormati apa adanya.
 */
const normalizePostingStatus = (raw: unknown): 'DRAFT' | 'POST' => {
    if (typeof raw === 'string') {
        const v = raw.trim().toUpperCase()
        if (v === 'DRAFT' || v === 'POST') return v as 'DRAFT' | 'POST'
    }
    return 'POST'
}

/** Status pencatatan (DRAFT/POST) milik item */
const getPostingStatus = (item: GCategoryItem) => normalizePostingStatus(item.status)

/** Badge class untuk status pencatatan, konsisten dengan modul lain (DRAFT abu-abu, POST cyan) */
const getPostingStatusBadgeClass = (status: string) => {
    if (status === 'POST') {
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300'
    }
    return getApprovalStatusBadgeClass(status)
}

const columns = [
    { key: 'code', label: 'Code', filterable: true, width: '160px' },
    { key: 'name', label: 'Name', filterable: true, width: '220px' },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '260px' },
    {
        key: 'is_active',
        label: 'Status Active',
        filterable: false,
        width: '130px',
        renderHtml: (item: GCategoryItem) => {
            const isActive = getItemStatus(item)
            const text = isActive ? 'Active' : 'Non Active'
            const colorClass = isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            return `<span class="font-bold ${colorClass}">${text}</span>`
        }
    },
    {
        key: 'status',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: GCategoryItem) => {
            const value = getPostingStatus(item)
            const badgeClass = getPostingStatusBadgeClass(value)
            return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${value}</span>`
        }
    }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter m_g_category data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: GCategoryItem) => {
        const matchStatus = filterStatus.value === null
            ? true
            : filterStatus.value === 'Active'
                ? getItemStatus(item) === true
                : getItemStatus(item) === false

        const matchPosting = filterPostingStatus.value === null
            ? true
            : getPostingStatus(item) === filterPostingStatus.value

        return matchStatus && matchPosting
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Category "${itemToDelete.value.name || itemToDelete.value.code}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Deskripsi dialog post */
const postDialogDescription = computed(() => {
    if (!itemToPost.value) return ''
    return `Apakah Anda yakin ingin mem-POST Category "${itemToPost.value.name || itemToPost.value.code}"? Setelah di-POST, status pencatatan tidak dapat dikembalikan ke DRAFT.`
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

    if (getPostingStatus(item) === 'POST') {
        toast.error('Tidak dapat menghapus', {
            description: 'Data yang sudah POST hanya bisa diedit, tidak bisa dihapus'
        })
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
        const response = await deleteGCategory(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: GCategoryItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Category "${itemToDelete.value.name || itemToDelete.value.code}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Category', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Category', {
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
// POST FUNCTIONS
// ============================================================================
/** Trigger post dialog - ubah status DRAFT -> POST */
const postSelected = (item?: GCategoryItem) => {
    // Check permission
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengubah data'
        })
        return
    }

    if (item) {
        selectItem(item, 0)
    }

    const target = item || selectedItem.value
    if (!target) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    if (getPostingStatus(target) === 'POST') {
        toast.error('Data sudah POST', {
            description: 'Status pencatatan sudah dalam keadaan POST'
        })
        return
    }

    itemToPost.value = target
    isPostDialogOpen.value = true
}

/** Konfirmasi post - hit API dan update UI */
const confirmPost = async () => {
    if (!itemToPost.value) return
    const target = itemToPost.value

    isPosting.value = true
    try {
        const response = await updateGCategory(target.id, { status: 'POST' })

        if (response.status === 'success') {
            // Update item di list secara lokal
            const idx = menuData.value.findIndex((m: GCategoryItem) => m.id === target.id)
            const existingItem = menuData.value[idx]
            if (existingItem) {
                menuData.value.splice(idx, 1, { ...existingItem, status: 'POST' })
            }
            if (selectedItem.value?.id === target.id) {
                selectedItem.value = { ...selectedItem.value, status: 'POST' }
            }

            toast.success(`Category "${target.name || target.code}" berhasil di-POST`, {
                description: response.message || 'Status pencatatan berhasil diubah menjadi POST'
            })

            isPostDialogOpen.value = false
        } else {
            toast.error('Gagal mem-POST Category', {
                description: response.message || 'Terjadi kesalahan saat mem-POST data'
            })
        }
    } catch (error) {
        toast.error('Gagal mem-POST Category', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
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
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export m_g_category data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View GCategory item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/inventory/master_group/m_g_category/view/${selectedItem.value.id}`)
}

/** Edit GCategory item */
const editItem = (item?: any) => {
    // Check permission
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengubah data'
        })
        return
    }
    
    if (item) {
        selectItem(item, 0)
    }
    const selectedItemData = handleEdit(item)
    if (!selectedItemData) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    // Navigate to edit form
    router.push(`/inventory/master_group/m_g_category/form/${selectedItemData.id}`)
}

/** Copy GCategory item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
    // Check permission (copy requires create permission)
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat data baru'
        })
        return
    }
    
    if (item) {
        selectItem(item, 0)
    }
    const selectedItemData = handleCopy(item)
    if (!selectedItemData) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    // Navigate ke form create dengan data yang sama (tanpa ID)
    // Query param action=copy akan trigger mode copy di form
    router.push({
        path: '/inventory/master_group/m_g_category/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.name || selectedItemData.code}"`, {
        description: 'Silakan edit dan simpan sebagai Category baru'
    })
    deselectItem()
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
    
    router.push('/inventory/master_group/m_g_category/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_g_category data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call API with search parameters
        const response = await getGCategoryList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'code,name,catatan' : undefined,
            tableColumnFilters.value
        )
        
        if (response.status === 'success') {
            if (page === 1 || resetData) {
                menuData.value = response.data
            } else {
                // Append data untuk infinite scroll
                menuData.value.push(...response.data)
            }

            // Check if there's more data to load
            if (response.pagination) {
                hasMoreData.value = response.pagination.next_page !== null
            }
        }
    } catch (error) {
        toast.error('Gagal memuat data GCategory', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        loading.value = false
        loadingMore.value = false
    }
}

/** Handle load more triggered dari DataTable infinite scroll */
const handleLoadMore = () => {
    currentPage.value++
    fetchMenuData(currentPage.value)
}

/** Handle API search - triggered by Enter or Search button */
const handleApiSearch = async () => {
    if (isSearching.value) return
    
    isSearching.value = true
    searchApiQuery.value = searchQuery.value
    
    // Reset to page 1 when searching
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

/** Clear search and reload all data */
const clearSearch = async () => {
    searchQuery.value = ''
    searchApiQuery.value = ''
    await handleApiSearch()
}

/** Handle table filter change from DataTable */
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleTableFilterChange = (filters: { 
    column: Record<string, string>
    operator: Record<string, string>
    dateRange: Record<string, { from: string, to: string }>
    where: string
}) => {
    // Update local filter state
    tableColumnFilters.value = filters.column
    tableColumnFilterOperators.value = filters.operator
    tableDateRangeFilters.value = filters.dateRange

    // Debounce API call
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer)
    }

    filterDebounceTimer = setTimeout(async () => {
        // Reset to page 1 when filtering
        menuData.value = []
        currentPage.value = 1
        hasMoreData.value = true

        await fetchMenuData(1, true)
    }, 500) // 500ms debounce
}

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
    // Reset state
    searchQuery.value = ''
    searchApiQuery.value = ''
    tableColumnFilters.value = {}
    tableColumnFilterOperators.value = {}
    tableDateRangeFilters.value = {}
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()
    
    // Reload data
    await fetchMenuData(1, true)
    
    toast.success('Data berhasil dimuat ulang')
}

/** Infinite scroll handler untuk mobile (window scroll) */
const handleWindowScroll = () => {
    if (loadingMore.value || !hasMoreData.value) return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const docHeight = document.documentElement.scrollHeight

    // Trigger load more when near bottom of page
    if (docHeight - scrollTop - windowHeight < 100) {
        currentPage.value++
        fetchMenuData(currentPage.value)
    }
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
/** Load data saat component mount */
onMounted(async () => {
    // Reset state saat mount untuk avoid stale data
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()

    await fetchMenuData(1)

    // Add window scroll listener untuk infinite scroll di mobile
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

/** Cleanup listeners dan state saat component unmount */
onUnmounted(() => {
    // Remove scroll listener
    window.removeEventListener('scroll', handleWindowScroll)
    
    // Clear data untuk prevent memory leak
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
                        <h1 class="text-lg font-bold">Master Group Category</h1>
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
                        @click="filterStatus = null"
                    >
                        All
                    </Button>

                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === 'Active' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
                        @click="filterStatus = filterStatus === 'Active' ? null : 'Active'"
                    >
                        Active
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === 'Non Active' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
                        @click="filterStatus = filterStatus === 'Non Active' ? null : 'Non Active'"
                    >
                        Non Active
                    </Button>
                </div>

                <!-- Filter Status Pencatatan Buttons (DRAFT/POST) -->
                <div class="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterPostingStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                        @click="filterPostingStatus = null"
                    >
                        Semua Status
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="getApprovalStatusFilterClass('DRAFT', filterPostingStatus === 'DRAFT')"
                        @click="filterPostingStatus = filterPostingStatus === 'DRAFT' ? null : 'DRAFT'"
                    >
                        DRAFT
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterPostingStatus === 'POST' ? 'bg-cyan-100 text-cyan-800 border-cyan-500 hover:bg-cyan-200' : ''"
                        @click="filterPostingStatus = filterPostingStatus === 'POST' ? null : 'POST'"
                    >
                        POST
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
            <div v-else-if="filteredData.length === 0" class="text-center py-8">
                <p class="text-sm text-muted-foreground">Tidak ada data</p>
            </div>

            <!-- Card List with Animation -->
            <TransitionGroup v-else name="list" tag="div" class="space-y-3">
                <Card 
                    v-for="item in filteredData" 
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
                            <div class="flex items-center gap-1 shrink-0">
                                <Badge 
                                    :variant="getItemStatus(item) ? 'default' : 'secondary'" 
                                    class="text-xs"
                                >
                                    {{ getItemStatus(item) ? 'Active' : 'Non Active' }}
                                </Badge>
                                <Badge 
                                    :class="getPostingStatusBadgeClass(getPostingStatus(item))"
                                    class="text-xs uppercase"
                                >
                                    {{ getPostingStatus(item) }}
                                </Badge>
                            </div>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.catatan">
                                <span class="font-medium">Catatan:</span> {{ item.catatan }}
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-1 justify-end pt-2 border-t">
                            <ViewButton 
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                @click.stop="viewItem(item)" 
                            />
                            <DeleteButton 
                                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                :disabled="getPostingStatus(item) === 'POST'"
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
                            <PostButton 
                                v-if="getPostingStatus(item) !== 'POST'"
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                :show-label="false"
                                class="h-7 w-7 text-blue-600"
                                @click.stop="() => { selectItem(item, 0); postSelected(item) }" 
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
                <h1 class="text-2xl font-bold">Master Group Category</h1>
                <p class="text-sm text-muted-foreground">Kelola data Category</p>
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

        <!-- FILTER BAR -->
        <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
            <!-- Filter Status Row -->
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium">Status:</span>
                <Button variant="outline" size="sm"
                    :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                    @click="filterStatus = null">
                    All
                </Button>

                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Active' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
                    @click="filterStatus = filterStatus === 'Active' ? null : 'Active'">
                    Active
                </Button>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Non Active' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
                    @click="filterStatus = filterStatus === 'Non Active' ? null : 'Non Active'">
                    Non Active
                </Button>
            </div>

            <!-- Filter Status Pencatatan Row (DRAFT/POST) -->
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium">Status Pencatatan:</span>
                <Button variant="outline" size="sm"
                    :class="filterPostingStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                    @click="filterPostingStatus = null">
                    All
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('DRAFT', filterPostingStatus === 'DRAFT')"
                    @click="filterPostingStatus = filterPostingStatus === 'DRAFT' ? null : 'DRAFT'">
                    DRAFT
                </Button>
                <Button variant="outline" size="sm"
                    :class="filterPostingStatus === 'POST' ? 'bg-cyan-100 text-cyan-800 border-cyan-500 hover:bg-cyan-200' : ''"
                    @click="filterPostingStatus = filterPostingStatus === 'POST' ? null : 'POST'">
                    POST
                </Button>
            </div>

            <!-- Search & Action Buttons Row -->
            <div class="flex items-center gap-2">
                <!-- Search -->
                <div class="flex items-center gap-2 w-1/5">
                    <div class="relative flex-1">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8"
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

                <!-- Action Buttons -->
                <div class="flex items-center gap-2">
                    <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }"
                        :disabled="!isActive || getPostingStatus(selectedItem) === 'POST'"
                        @click="deleteSelected" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" :disabled="!isActive"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                    <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }"
                        :disabled="!isActive || getPostingStatus(selectedItem) === 'POST'"
                        @click="() => postSelected()" />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange">
            <template #empty>
                Tidak ada data Category
            </template>
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

    <!-- ================================================================ -->
    <!-- POST CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isPostDialogOpen" 
        title="Post Category" 
        :description="postDialogDescription" 
        type="warning"
        confirm-text="Post" 
        cancel-text="Batal" 
        :is-loading="isPosting" 
        @confirm="confirmPost"
        @cancel="cancelPost" 
        @update:open="isPostDialogOpen = $event" 
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
