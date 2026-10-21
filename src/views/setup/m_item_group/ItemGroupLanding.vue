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
import { getItemGroupNestedList, deleteItemGroupCascade, type ItemGroupItem } from './service'

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
const itemToDelete = ref<ItemGroupItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<ItemGroupItem[]>([])
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
    { 
        key: 'nama_jenis', 
        label: 'Nama Jenis', 
        filterable: true, 
        width: '200px',
        render: (item: ItemGroupItem) => item.nama_jenis || '-'
    },
    { 
        key: 'catatan', 
        label: 'Catatan', 
        filterable: true, 
        width: '300px',
        render: (item: ItemGroupItem) => item.catatan || '-'
    },
    {
        key: 'merek_count',
        label: 'Jumlah Merek',
        filterable: false,
        width: '100px',
        render: (item: ItemGroupItem) => {
            const count = item.m_group_mereks?.length || 0
            return count.toString()
        }
    },
    {
        key: 'tipe_count',
        label: 'Jumlah Tipe',
        filterable: false,
        width: '100px',
        render: (item: ItemGroupItem) => {
            let count = 0
            item.m_group_mereks?.forEach(merek => {
                count += merek.m_group_tipes?.length || 0
            })
            return count.toString()
        }
    },
    {
        key: 'ukuran_count',
        label: 'Jumlah Ukuran',
        filterable: false,
        width: '100px',
        render: (item: ItemGroupItem) => {
            let count = 0
            item.m_group_mereks?.forEach(merek => {
                merek.m_group_tipes?.forEach(tipe => {
                    count += tipe.m_group_ukurans?.length || 0
                })
            })
            return count.toString()
        }
    },
    {
        key: 'batch_count',
        label: 'Jumlah Batch',
        filterable: false,
        width: '100px',
        render: (item: ItemGroupItem) => {
            let count = 0
            item.m_group_mereks?.forEach(merek => {
                merek.m_group_tipes?.forEach(tipe => {
                    tipe.m_group_ukurans?.forEach(ukuran => {
                        count += ukuran.m_group_batchs?.length || 0
                    })
                })
            })
            return count.toString()
        }
    },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: ItemGroupItem) => {
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
/** Filter m_item_group data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: ItemGroupItem) => {
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
    const identifier = itemToDelete.value.nama_jenis || 'item ini'
    return `Apakah Anda yakin ingin menghapus Group Jenis "${identifier}"? Tindakan ini akan menghapus semua Merek, Tipe, Ukuran, dan Batch terkait. Tindakan ini tidak dapat dibatalkan.`
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

/** Konfirmasi delete - validasi dulu semua ID, baru hit API cascade satu per satu */
const confirmDelete = async () => {
    if (!itemToDelete.value) return

    isDeleting.value = true
    try {
        // Use cascade delete - validates all IDs first, then hits API one by one
        // Order: batch → ukuran → tipe → merek → jenis
        const result = await deleteItemGroupCascade(itemToDelete.value)
        
        console.log('Delete cascade result:', result)

        if (result.success) {
            // Remove item from list
            menuData.value = menuData.value.filter((m: ItemGroupItem) => m.id !== itemToDelete.value!.id)

            const identifier = itemToDelete.value.nama_jenis || 'Group Jenis'
            toast.success(`${identifier} berhasil dihapus`, {
                description: result.message
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            console.log('Delete cascade failed:', result)
            toast.error('Gagal menghapus ItemGroup', {
                description: result.message
            })
        }
    } catch (error) {
        console.error('Delete error:', error)
        toast.error('Gagal menghapus ItemGroup', {
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
/** Export m_item_group data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View ItemGroup item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/setup/m_item_group/view/${selectedItem.value.id}`)
}

/** Edit ItemGroup item */
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
    router.push(`/setup/m_item_group/form/${selectedItemData.id}`)
}

/** Copy ItemGroup item - duplicate data tanpa ID untuk create new */
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
        path: '/setup/m_item_group/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    const identifier = selectedItemData.kode_group || selectedItemData.jenis_group || 'ItemGroup'
    toast.success(`Menyalin data "${identifier}"`, {
        description: 'Silakan edit dan simpan sebagai ItemGroup baru'
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
    
    router.push('/setup/m_item_group/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_item_group data dari API using nested endpoint */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call getNested API - returns data with proper nested structure
        const response = await getItemGroupNestedList(true)
        
        if (response.message === 'success') {
            // Data sudah dalam format yang benar dari API:
            // m_group_mereks[] -> m_group_tipes[] -> m_group_ukurans[] -> m_group_batchs[]
            let data = response.data
            
            // Apply client-side search filter if needed
            if (searchApiQuery.value && searchApiQuery.value.trim()) {
                const searchLower = searchApiQuery.value.toLowerCase()
                data = data.filter((item: ItemGroupItem) => {
                    return (
                        item.nama_jenis?.toLowerCase().includes(searchLower) ||
                        item.catatan?.toLowerCase().includes(searchLower)
                    )
                })
            }
            
            menuData.value = data
            
            // No pagination for nested endpoint (loads all data)
            hasMoreData.value = false
        }
    } catch (error) {
        toast.error('Gagal memuat data ItemGroup', {
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
    <!-- MOBILE VIEW (LG:HIDDEN) -->
    <!-- ================================================================ -->
    <div class="lg:hidden flex flex-col min-h-screen pb-28">
        <!-- STICKY HEADER -->
        <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
            <div class="p-4 space-y-3">
                <!-- Title & Refresh -->
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-lg font-bold">Master Item Group</h1>
                        <p class="text-xs text-muted-foreground">Kelola ItemGroup aplikasi</p>
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
                        :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
                        @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
                    >
                        Aktif
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
                        @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'"
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
                                <div class="font-semibold text-sm truncate">{{ item.nama_jenis || '-' }}</div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {{ item.m_group_mereks?.length || 0 }} Merek
                                </div>
                            </div>
                            <Badge 
                                :variant="item.is_active ? 'default' : 'secondary'" 
                                class="text-xs shrink-0"
                            >
                                {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                            </Badge>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.catatan">
                                <span class="font-medium">Catatan:</span> {{ item.catatan }}
                            </div>
                            <div v-if="item.m_group_mereks && item.m_group_mereks.length > 0">
                                <span class="font-medium">Merek:</span> 
                                {{ item.m_group_mereks.map(m => m.nama_merek).filter(Boolean).join(', ') || '-' }}
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
                <h1 class="text-2xl font-bold">Master Item Group</h1>
                <p class="text-sm text-muted-foreground">Kelola ItemGroup aplikasi</p>
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
                    <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" :disabled="!isActive"
                        @click="deleteSelected" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" :disabled="!isActive"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem">
            <template #empty>
                Tidak ada data ItemGroup
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isDeleteDialogOpen" 
        title="Hapus ItemGroup" 
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
