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
import { getUnitBisnisList, deleteUnitBisnis, type UnitBisnisItem } from './service'

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
const itemToDelete = ref<UnitBisnisItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<UnitBisnisItem[]>([])
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
    { key: 'kode_unit_bisnis', label: 'Kode', filterable: true, width: '175px' },
    {
        key: 'company_name',
        label: 'Company',
        filterable: true,
        width: '220px',
        render: (item: UnitBisnisItem) => item.m_company?.nama || '-'
    },
    { key: 'nama_comp', label: 'Nama Unit Bisnis', filterable: true, width: '220px' },
    { key: 'provinsi', label: 'Provinsi', filterable: true, width: '150px' },
    { key: 'kota', label: 'Kota', filterable: true, width: '150px' },
    { key: 'alamat_detail', label: 'Alamat Detail', filterable: true, width: '240px' },
    { key: 'email', label: 'Email', filterable: true, width: '180px' },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '180px' },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: UnitBisnisItem) => {
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
/** Filter m_unit_bisnis data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: UnitBisnisItem) => {
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
    return `Apakah Anda yakin ingin menghapus Unit Bisnis "${itemToDelete.value.nama_comp}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
    if (!canDelete.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk menghapus Unit Bisnis'
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
        const response = await deleteUnitBisnis(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: UnitBisnisItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Unit Bisnis "${itemToDelete.value.nama_comp}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus UnitBisnis', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus UnitBisnis', {
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
/** Export m_unit_bisnis data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View UnitBisnis item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/setup/m_unit_bisnis/view/${selectedItem.value.id}`)
}

/** Edit UnitBisnis item */
const editItem = (item?: any) => {
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengedit Unit Bisnis'
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
    router.push(`/setup/m_unit_bisnis/form/${selectedItemData.id}`)
}

/** Copy UnitBisnis item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat Unit Bisnis baru'
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
        path: '/setup/m_unit_bisnis/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.nama_comp}"`, {
        description: 'Silakan edit dan simpan sebagai Unit Bisnis baru'
    })
    deselectItem()
}

/** Navigasi ke form create baru */
const createNew = () => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat Unit Bisnis baru'
        })
        return
    }

    router.push('/setup/m_unit_bisnis/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_unit_bisnis data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call API with search parameters
        const response = await getUnitBisnisList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'kode_unit_bisnis,nama_comp,provinsi,kota,alamat_detail,email' : undefined
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
        toast.error('Gagal memuat data UnitBisnis', {
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
    <!-- MOBILE LAYOUT - lg:hidden -->
    <!-- ================================================================ -->
    <div class="lg:hidden flex flex-col min-h-screen relative">
        <!-- Mobile Header -->
        <div class="flex-none border-b bg-background sticky top-0 z-40 space-y-4 p-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-bold">Unit Bisnis</h2>
                    <p class="text-xs text-muted-foreground">Kelola unit bisnis</p>
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
                <div class="text-center">
                    <RefreshCw class="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p class="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>

            <div v-else-if="filteredData.length === 0" class="text-center py-12">
                <p class="text-sm text-muted-foreground">Tidak ada data Unit Bisnis</p>
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
                                <div class="font-bold text-sm line-clamp-2">{{ item.nama_comp }}</div>
                                <div class="text-xs text-muted-foreground space-y-1 mt-2">
                                    <div v-if="item.kode_unit_bisnis"><span class="font-semibold">Kode:</span> {{ item.kode_unit_bisnis }}</div>
                                    <div v-if="item.provinsi"><span class="font-semibold">Provinsi:</span> {{ item.provinsi }}</div>
                                    <div v-if="item.kota"><span class="font-semibold">Kota:</span> {{ item.kota }}</div>
                                    <div v-if="item.alamat_detail"><span class="font-semibold">Alamat Detail:</span> {{ item.alamat_detail }}</div>
                                    <div v-if="item.email"><span class="font-semibold">Email:</span> {{ item.email }}</div>
                                </div>
                            </div>
                            <Badge :variant="item.is_active ? 'default' : 'secondary'" class="text-xs shrink-0">
                                {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                            </Badge>
                        </div>

                        <!-- Mobile Action Buttons - Show when selected -->
                        <div v-if="selectedItem?.id === item.id" class="flex gap-1 pt-2 border-t">
                            <ViewButton
                                @click.stop="viewItem(item)"
                                class="h-8 w-8"
                            />
                            <EditButton
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                @click.stop="editItem(item)"
                                class="h-8 w-8"
                            />
                            <CopyButton
                                v-permission="{ menuId: currentMenuId, action: 'create' }"
                                @click.stop="copyItem(item)"
                                class="h-8 w-8"
                            />
                            <DeleteButton
                                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                                @click.stop="deleteSelected()"
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
                    <RefreshCw v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" />
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
    <!-- DESKTOP LAYOUT -->
    <!-- ================================================================ -->
    <div class="hidden lg:block p-6 space-y-4">
        <!-- ================================================================ -->
        <!-- HEADER SECTION - DESKTOP ONLY -->
        <!-- ================================================================ -->
        <div class="flex items-start justify-between mb-4 gap-2">
            <div class="flex-1">
                <h1 class="text-2xl font-bold text-foreground">Unit Bisnis</h1>
                <p class="text-sm text-muted-foreground">Kelola unit bisnis aplikasi</p>
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
                    v-permission="{ menuId: currentMenuId, action: 'create' }"
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
        <div class="space-y-4">
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
        <div>
            <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
                :has-more="hasMoreData" :row-select-mode="true" max-height="500px" @load-more="handleLoadMore"
                @row-select="(item: UnitBisnisItem) => selectItem(item, 0)" @row-deselect="deselectItem">
                <template #empty>
                    Tidak ada data Unit Bisnis
                </template>
            </DataTable>
        </div>
    </div>

    <!-- Delete Dialog -->
    <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Unit Bisnis"
        :description="deleteDialogDescription"
        type="danger"
        :is-loading="isDeleting"
        confirm-text="Hapus"
        cancel-text="Batal"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
        @update:open="isDeleteDialogOpen = $event"
    />
</template>

<style scoped>
/* TransitionGroup animations for filter/search */
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
    transform: scale(0.8) translateY(20px);
}

.list-leave-to {
    opacity: 0;
    transform: scale(0.8) translateY(-20px);
}
</style>
