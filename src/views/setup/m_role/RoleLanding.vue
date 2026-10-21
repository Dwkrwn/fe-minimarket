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
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getRoleList, deleteRole, type RoleItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete } = usePermission()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<RoleItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<RoleItem[]>([])
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
    { key: 'kode_role', label: 'Kode', filterable: true, width: '150px' },
    { key: 'nama_role', label: 'Nama Role', filterable: true, width: '250px' },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '300px' },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: RoleItem) => {
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
/** Filter m_role data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: RoleItem) => {
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
    return `Apakah Anda yakin ingin menghapus Role "${itemToDelete.value.nama_role}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
    if (!canDelete.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk menghapus Role'
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
        const response = await deleteRole(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: RoleItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Role "${itemToDelete.value.nama_role}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Role', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Role', {
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
/** Export m_role data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View Role item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/setup/m_role/view/${selectedItem.value.id}`)
}

/** Edit Role item */
const editItem = (item?: any) => {
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengedit Role'
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
    router.push(`/setup/m_role/form/${selectedItemData.id}`)
}

/** Copy Role item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat Role baru'
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
        path: '/setup/m_role/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.name}"`, {
        description: 'Silakan edit dan simpan sebagai Role baru'
    })
    deselectItem()
}

/** Navigasi ke form create baru */
const createNew = () => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat Role baru'
        })
        return
    }

    router.push('/setup/m_role/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_role data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call API with search parameters
        const response = await getRoleList(
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
        toast.error('Gagal memuat data Role', {
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

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
    // Reset state
    searchQuery.value = ''
    searchApiQuery.value = ''
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
    <!-- MOBILE LAYOUT -->
    <!-- ================================================================ -->
    <div class="lg:hidden flex flex-col min-h-screen relative">
        <!-- Mobile Header - Compact -->
        <div class="p-4 pb-3 border-b bg-background">
            <div class="flex items-center justify-between mb-3">
                <div>
                    <h1 class="text-lg font-bold text-foreground">Master Role</h1>
                    <p class="text-xs text-muted-foreground">Kelola Role aplikasi</p>
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
    <div class="flex-1 overflow-y-auto p-4 pt-5 pb-28">
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
                <p class="text-sm text-muted-foreground">Tidak ada data Role</p>
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
                        <div class="flex items-start justify-between gap-3 p-3 ">
                            <div class="flex-1 min-w-0">
                                <h3 class="font-semibold text-sm mb-1 truncate leading-snug">{{ item.nama_role }}</h3>
                                <div class="text-xs text-muted-foreground space-y-0.5">
                                    <p class="flex items-center gap-1">
                                        <span class="font-medium">Kode:</span>
                                        <span class="truncate">{{ item.kode_role || '-' }}</span>
                                    </p>
                                    <p v-if="item.catatan" class="line-clamp-1">
                                        <span class="font-medium">Catatan:</span> {{ item.catatan }}
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
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                size="sm" 
                                variant="outline" 
                                @click.stop="editItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Edit
                            </Button>
                            <Button 
                                v-permission="{ menuId: currentMenuId, action: 'create' }"
                                size="sm" 
                                variant="outline" 
                                @click.stop="copyItem()" 
                                class="flex-1 h-8 text-xs"
                            >
                                Copy
                            </Button>
                            <Button 
                                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                                size="sm" 
                                variant="destructive" 
                                @click.stop="deleteSelected()" 
                                class="h-8 w-8 p-0"
                            >
                                <Trash2 class="h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TransitionGroup>

            <!-- Load More Button -->
            <div v-if="hasMoreData && !loading" class="text-center mt-4">
                <Button @click="handleLoadMore" :disabled="loadingMore" variant="outline" size="sm">
                    <RefreshCw v-if="loadingMore" class="h-4 w-4 animate-spin mr-2" />
                    {{ loadingMore ? 'Loading...' : 'Load More' }}
                </Button>
            </div>
        </div>

        <!-- FAB -->
        <teleport to="body">
            <Button 
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                @click="createNew"
                class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden z-50 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:scale-[1.02] transition-transform"
                size="icon"
            >
                <Plus class="h-6 w-6" />
            </Button>
        </teleport>
    </div>

    <!-- ================================================================ -->
    <!-- DESKTOP LAYOUT -->
    <!-- ================================================================ -->
    <div class="hidden lg:block p-6 space-y-4">
        <!-- Header Section -->
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
                <h1 class="text-2xl font-bold text-foreground">Master Role</h1>
                <p class="text-sm text-muted-foreground">Kelola Role aplikasi</p>
            </div>
            <div class="flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="icon"
                    @click="handleRefresh" 
                    :disabled="loading"
                    class="shrink-0"
                >
                    <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                </Button>
                <Button 
                    v-permission="{ menuId: currentMenuId, action: 'create' }"
                    @click="createNew" 
                    class="gap-2 whitespace-nowrap shrink-0"
                >
                    Create New
                </Button>
            </div>
        </div>

        <!-- Filter & Actions Bar -->
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
                <!-- Search Input with Button -->
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
                    >
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

        <!-- Desktop Table View -->
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
                @row-select="(item: RoleItem) => selectItem(item, 0)" @row-deselect="deselectItem">
                <template #empty>
                    <div class="text-center">Tidak ada data Role</div>
                </template>
            </DataTable>
        </div>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog :open="isDeleteDialogOpen" title="Hapus Role" :description="deleteDialogDescription" type="danger"
        confirm-text="Hapus" cancel-text="Batal" :is-loading="isDeleting" @confirm="confirmDelete"
        @cancel="cancelDelete" @update:open="isDeleteDialogOpen = $event" />
</template>

<style scoped>
/* TransitionGroup animations */
.card-move {
    transition: all 0.3s ease;
}

.card-enter-active {
    transition: all 0.3s ease-out;
}

.card-leave-active {
    transition: all 0.2s ease-in;
}

.card-enter-from {
    opacity: 0;
    transform: translateX(-20px);
}

.card-leave-to {
    opacity: 0;
    transform: translateX(20px);
}
</style>
