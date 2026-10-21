<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getGeneralList, deleteGeneral, type GeneralItem } from './service'

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
const itemToDelete = ref<GeneralItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<GeneralItem[]>([])
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
    { key: 'group', label: 'Group', filterable: true, width: '150px' },
    { key: 'key1', label: 'Key1', filterable: true, width: '150px' },
    { key: 'code', label: 'Code', filterable: true, width: '150px' },
    { key: 'value1', label: 'Value1', filterable: true, width: '200px' },
    { key: 'value2', label: 'Value2', filterable: true, width: '200px' },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: GeneralItem) => {
            const isActive = item.is_active
            const text = isActive ? 'Aktif' : 'Nonaktif'
            const colorClass = isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            return `<span class="font-bold ${colorClass}">${text}</span>`
        }
    }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter m_general data berdasarkan status (search sudah dari API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: GeneralItem) => {
        const matchStatus = filterStatus.value === null
            ? true
            : filterStatus.value === 'Aktif'
                ? item.is_active === true
                : item.is_active === false

        return matchStatus
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus General dengan code "${itemToDelete.value.code}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
    // Check permission
    if (!canDelete.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki akses untuk menghapus data'
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
        const response = await deleteGeneral(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter(m => m.id !== itemToDelete.value!.id)

            toast.success(`General code "${itemToDelete.value.code}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus General', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus General', {
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
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export m_general data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View General item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/setup/m_general/view/${selectedItem.value.id}`)
}

/** Edit General item */
const editItem = (item?: any) => {
    // Check permission
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki akses untuk mengubah data'
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
    router.push(`/setup/m_general/form/${selectedItemData.id}`)
}

/** Copy General item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
    // Check permission (copy requires create permission)
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki akses untuk menyalin data'
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
        path: '/setup/m_general/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.name}"`, {
        description: 'Silakan edit dan simpan sebagai General baru'
    })
    deselectItem()
}

/** Navigasi ke form create baru */
const createNew = () => {
    // Check permission
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki akses untuk membuat data baru'
        })
        return
    }
    router.push('/setup/m_general/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_general data dari API */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Meminta server mengurutkan berdasarkan createdAt descending
        const response = await getGeneralList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'group,key1,code,value1,value2' : undefined
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
        toast.error('Gagal memuat data General', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        loading.value = false
        loadingMore.value = false
    }
}

/** Handle API search */
const handleApiSearch = async () => {
    if (isSearching.value) return
    
    isSearching.value = true
    searchApiQuery.value = searchQuery.value
    
    // Reset to page 1 and fetch with search
    currentPage.value = 1
    hasMoreData.value = true
    await fetchMenuData(1, true)
    
    toast.success('Pencarian selesai', {
        description: `Ditemukan ${menuData.value.length} hasil`
    })
    
    isSearching.value = false
}

/** Clear search */
const clearSearch = async () => {
    searchQuery.value = ''
    searchApiQuery.value = ''
    await handleApiSearch()
}

/** Handle load more triggered dari DataTable infinite scroll */
const handleLoadMore = () => {
    currentPage.value++
    fetchMenuData(currentPage.value)
}

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
    // Reset state
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    searchQuery.value = ''
    searchApiQuery.value = ''
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

    // Reset scroll position ke top saat component mount
    window.scrollTo(0, 0)
    const mobileContent = document.querySelector('[data-mobile-content]')
    if (mobileContent) {
        (mobileContent as HTMLElement).scrollTop = 0
    }

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
    <!-- MOBILE LAYOUT -->
    <!-- ================================================================ -->
    <div class="lg:hidden flex flex-col min-h-screen relative">
        <!-- Mobile Header - Compact -->
        <div class="p-4 pb-3 border-b bg-background">
            <div class="flex items-center justify-between mb-3">
                <div>
                    <h1 class="text-lg font-bold text-foreground">Master General</h1>
                    <p class="text-xs text-muted-foreground">Kelola General aplikasi</p>
                </div>
                <Button 
                    variant="outline" 
                    size="icon"
                    @click="handleRefresh" 
                    :disabled="loading"
                    class="h-9 w-9"
                >
                    <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                </Button>
            </div>

            <!-- Filter Status - Compact -->
            <div class="flex items-center gap-2 mb-3">
                <span class="text-xs font-medium whitespace-nowrap">Status:</span>
                <Button variant="outline" size="sm"
                    :class="['text-xs h-8', filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : '']"
                    @click="filterStatus = null">
                    All
                </Button>

                <Button variant="outline" size="sm"
                    :class="['text-xs h-8', filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : '']"
                    @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">
                    Aktif
                </Button>
                <Button variant="outline" size="sm"
                    :class="['text-xs h-8', filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : '']"
                    @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">
                    Nonaktif
                </Button>
            </div>

            <!-- Search - Compact -->
            <div class="flex gap-2">
                <div class="relative flex-1">
                    <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        v-model="searchQuery" 
                        placeholder="Search..." 
                        class="pl-8 pr-8 h-9 text-sm"
                        @keyup.enter="handleApiSearch"
                        :disabled="isSearching"
                    />
                    <Button 
                        v-if="searchQuery"
                        @click="clearSearch" 
                        size="icon" 
                        variant="ghost"
                        :disabled="isSearching"
                        class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                    >
                        <X class="h-3 w-3" />
                    </Button>
                </div>
                <Button 
                    @click="handleApiSearch" 
                    size="icon" 
                    variant="secondary"
                    :disabled="isSearching"
                    class="h-9 w-9"
                >
                    <Search class="h-4 w-4" />
                </Button>
            </div>
        </div>

        <!-- Mobile Content - Scrollable -->
        <div class="flex-1 overflow-y-auto p-4 pt-5 pb-28" data-mobile-content>
            <!-- Loading Skeletons -->
            <div v-if="loading && menuData.length === 0" class="grid grid-cols-1 gap-3">
                <Card v-for="i in 4" :key="`skeleton-${i}`">
                    <CardContent class="pt-4 space-y-2">
                        <Skeleton class="h-4 w-full" />
                        <Skeleton class="h-4 w-3/4" />
                        <Skeleton class="h-4 w-1/2" />
                    </CardContent>
                </Card>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredData.length === 0" class="text-center py-12">
                <p class="text-sm text-muted-foreground">Tidak ada data General</p>
            </div>

            <!-- Card List -->
            <TransitionGroup v-else name="card" tag="div" class="space-y-3">
                <Card v-for="(item, index) in filteredData" :key="item.id"
                    class="cursor-pointer hover:shadow-md transition-all duration-200"
                    :class="{ 'ring-2 ring-primary': selectedItem?.id === item.id }"
                    @click="selectItem(item, index)"
                    v-motion :initial="{ opacity: 0, x: -20 }" :enter="{
                        opacity: 1,
                        x: 0,
                        transition: { delay: index * 30 }
                    }">
                    <CardContent class="">
                        <div class="flex items-start justify-between gap-3 p-3">
                            <div class="flex-1 min-w-0">
                                <h3 class="font-semibold text-sm mb-1 truncate leading-snug">{{ item.value1 }}</h3>
                                <div class="text-xs text-muted-foreground space-y-0.5">
                                    <p class="flex items-center gap-1">
                                        <span class="font-medium">Group:</span>
                                        <span class="truncate">{{ item.group }}</span>
                                    </p>
                                    <p class="flex items-center gap-1">
                                        <span class="font-medium">Code:</span>
                                        <span class="truncate">{{ item.code }}</span>
                                    </p>
                                    <p v-if="item.key1" class="line-clamp-1">
                                        <span class="font-medium">Key1:</span> {{ item.key1 }}
                                    </p>
                                    <p v-if="item.value2" class="line-clamp-1">
                                        <span class="font-medium">Value2:</span> {{ item.value2 }}
                                    </p>
                                </div>
                            </div>
                            <Badge :variant="item.is_active ? 'default' : 'secondary'" 
                                   class="shrink-0 text-xs mt-0.5">
                                {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                            </Badge>
                        </div>
                        
                        <!-- Action Buttons for selected item -->
                        <div v-if="selectedItem?.id === item.id" 
                             class="flex items-center gap-2 mt-3 pt-3 border-t">
                            <Button size="sm" variant="outline" @click.stop="viewItem()" class="flex-1 h-8 text-xs">
                                View
                            </Button>
                            <Button 
                                v-if="currentMenuId"
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                size="sm" 
                                variant="outline" 
                                @click.stop="editItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Edit
                            </Button>
                            <Button 
                                v-else
                                size="sm" 
                                variant="outline" 
                                @click.stop="editItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Edit
                            </Button>
                            <Button 
                                v-if="currentMenuId"
                                v-permission="{ menuId: currentMenuId, action: 'create' }"
                                size="sm" 
                                variant="outline" 
                                @click.stop="copyItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Copy
                            </Button>
                            <Button 
                                v-else
                                size="sm" 
                                variant="outline" 
                                @click.stop="copyItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Copy
                            </Button>
                            <Button 
                                v-if="currentMenuId"
                                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                                size="sm" 
                                variant="destructive" 
                                @click.stop="deleteSelected()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Delete
                            </Button>
                            <Button 
                                v-else
                                size="sm" 
                                variant="destructive" 
                                @click.stop="deleteSelected()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Delete
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TransitionGroup>

            <!-- Loading More Indicator -->
            <div v-if="loadingMore" class="text-center py-4">
                <Loader2 class="h-6 w-6 animate-spin mx-auto text-primary" />
                <p class="text-sm text-muted-foreground mt-2">Loading more...</p>
            </div>
        </div>

        <!-- Mobile FAB (Floating Action Button) -->
        <teleport to="body">
            <Button 
                @click="createNew" 
                size="icon"
                class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
                v-permission="{ menuId: currentMenuId, action: 'create' }"
            >
                <Plus class="h-6 w-6" />
            </Button>
        </teleport>
    </div>

    <!-- ================================================================ -->
    <!-- DESKTOP LAYOUT -->
    <!-- ================================================================ -->
    <div class="hidden lg:block p-6 space-y-4">
        <!-- ================================================================ -->
        <!-- HEADER SECTION - DESKTOP ONLY -->
        <!-- ================================================================ -->
        <div class="flex items-start justify-between mb-4 gap-2" v-motion :initial="{ opacity: 0, y: -10 }"
            :enter="{
                opacity: 1,
                y: 0,
                transition: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 15
                }
            }">
            <div class="flex-1">
                <h1 class="text-2xl font-bold text-foreground">Master General</h1>
                <p class="text-sm text-muted-foreground">Kelola General aplikasi</p>
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
                <Button 
                    v-else
                    @click="createNew" 
                    class="gap-2 whitespace-nowrap shrink-0"
                >
                    Create New
                </Button>
            </div>
        </div>

        <!-- ================================================================ -->
        <!-- FILTER & ACTIONS BAR -->
        <!-- ================================================================ -->

        <div class="space-y-4"
            v-motion :initial="{ opacity: 0, y: -20 }" :enter="{
                opacity: 1,
                y: 0,
                transition: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                    delay: 100
                }
            }">
            <!-- Filter Status Row -->
            <div class="flex items-center gap-4">
                <span class="text-sm font-medium">Filter Status :</span>
                <Button variant="outline" size="sm"
                    :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                    @click="filterStatus = null">
                    All
                </Button>

                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
                    @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">
                    Aktif
                </Button>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
                    @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">
                    Nonaktif
                </Button>
            </div>

            <!-- Search & Actions Row -->
            <div class="flex items-center gap-4">
                <!-- Search Input dengan API search -->
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
                        <!-- Clear Button Inside Input -->
                        <Button 
                            v-if="searchQuery"
                            @click="clearSearch" 
                            size="icon" 
                            variant="ghost"
                            class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        >
                            <X class="h-4 w-4" />
                        </Button>
                    </div>
                    <!-- Search Button - Icon Only -->
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

                <!-- Action Buttons -->
                <div class="flex items-center gap-2">
                    <DeleteButton :menu-id="currentMenuId" :disabled="!isActive" @click="deleteSelected" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton :menu-id="currentMenuId" :disabled="!isActive" @click="editItem()" />
                    <CopyButton :menu-id="currentMenuId" :disabled="!isActive" @click="copyItem()" />
                </div>
            </div>
        </div>

        <!-- ================================================================ -->
        <!-- DESKTOP TABLE VIEW -->
        <!-- ================================================================ -->

        <div v-motion :initial="{ opacity: 0, scale: 0.95 }" :enter="{
            opacity: 1,
            scale: 1,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 15,
                delay: 200
            }
        }">
            <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
                :has-more="hasMoreData" :row-select-mode="true" max-height="500px" @load-more="handleLoadMore"
                @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem">
                <template #empty>
                    Tidak ada data General
                </template>
            </DataTable>
        </div>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG (GLOBAL REUSABLE) -->
    <!-- ================================================================ -->

    <GlobalDialog :open="isDeleteDialogOpen" title="Hapus General" :description="deleteDialogDescription" type="danger"
        confirm-text="Hapus" cancel-text="Batal" :is-loading="isDeleting" @confirm="confirmDelete"
        @cancel="cancelDelete" @update:open="isDeleteDialogOpen = $event" />
</template>

<style scoped>
/* TransitionGroup animations for filter/search */
.card-move {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-enter-active {
    transition: all 0.4s ease-out;
}

.card-leave-active {
    transition: all 0.3s ease-in;
    position: absolute;
}

.card-enter-from {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
}

.card-leave-to {
    opacity: 0;
    transform: scale(0.8) translateY(-20px);
}
</style>
