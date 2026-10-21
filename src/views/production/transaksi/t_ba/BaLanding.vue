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
import { DeleteButton, EditButton, CopyButton, ViewButton, PostButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getBaList, deleteBa, postBa, type BaItem } from './service'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, isSuperAdmin } = usePermission()

// ============================================================================
// STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<BaItem | null>(null)
const isDeleting = ref(false)

const menuData = ref<BaItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

const filterStatus = ref<'DRAFT' | 'POST' | 'CONFIRM' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('')
const isSearching = ref(false)

// Lock edit/delete if status is not DRAFT
const isStatusLocked = computed(() => {
    if (!selectedItem.value) return true
    const status = (selectedItem.value as BaItem).status?.toUpperCase()
    return status !== 'DRAFT'
})

const canEditOrDelete = computed(() => {
    return isActive.value && !isStatusLocked.value
})

// Column filters for API-based filtering
interface ColumnFilters { [key: string]: string }
interface ColumnFilterOperators { [key: string]: string }
interface DateRangeFilter { from: string; to: string }
interface DateRangeFilters { [key: string]: DateRangeFilter }
const tableColumnFilters = ref<ColumnFilters>({})
const tableColumnFilterOperators = ref<ColumnFilterOperators>({})
const tableDateRangeFilters = ref<DateRangeFilters>({})
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { key: 'no', label: 'No Berita Acara', filterable: true, width: '180px' },
    { 
        key: 'date', 
        label: 'Tanggal', 
        filterable: true, 
        filterType: 'date' as const,
        width: '130px',
        renderHtml: (item: BaItem) => {
            if (!item.date) return '-'
            return new Date(item.date).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            })
        }
    },
    { key: 'type', label: 'BA Type', filterable: true, width: '150px' },
    { 
        key: 'm_unit_bisni.nama_comp', 
        label: 'Unit Bisnis', 
        filterable: true, 
        width: '180px',
        valueGetter: (item: BaItem) => item.m_unit_bisni?.nama_comp || item.m_unit_bisni?.nama || '',
        renderHtml: (item: BaItem) => item.m_unit_bisni?.nama_comp || item.m_unit_bisni?.nama || '-'
    },
    { 
        key: 'm_gudang.nama_gudang', 
        label: 'Gudang', 
        filterable: true, 
        width: '160px',
        valueGetter: (item: BaItem) => item.m_gudang?.nama_gudang || item.m_gudang?.nama || '',
        renderHtml: (item: BaItem) => item.m_gudang?.nama_gudang || item.m_gudang?.nama || '-'
    },
    { key: 'notes', label: 'Catatan', filterable: true, width: '200px' },
    {
        key: 'status',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: BaItem) => {
            const status = item.status || 'DRAFT'
            const badgeClass = getApprovalStatusBadgeClass(status)
            return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`
        }
    }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
const filteredData = computed(() => {
    return menuData.value.filter((item: BaItem) => {
        let matchStatus = true;
        if (filterStatus.value) {
            matchStatus = (item.status || 'DRAFT').toUpperCase() === filterStatus.value.toUpperCase();
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

        return matchStatus && matchRelations;
    })
})

const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Berita Acara "${itemToDelete.value.no || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// ACTIONS
// ============================================================================
const deleteSelected = () => {
    const target = selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat dihapus.' });
        return;
    }
    if (!canDelete.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk menghapus data' })
        return
    }
    
    const item = handleDelete()
    if (!item) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    if (item.status !== 'DRAFT') {
        toast.error('Akses Ditolak', { description: 'Hanya data dengan status DRAFT yang dapat dihapus' })
        return
    }

    itemToDelete.value = item
    isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
    if (!itemToDelete.value) return

    isDeleting.value = true
    try {
        const response = await deleteBa(itemToDelete.value.id)
        if (response.status === 'success') {
            menuData.value = menuData.value.filter((m: BaItem) => m.id !== itemToDelete.value!.id)
            toast.success(`Berita Acara "${itemToDelete.value.no || 'tanpa nomor'}" berhasil dihapus`)
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus data', { description: response.message })
        }
    } catch (error) {
        toast.error('Gagal menghapus data', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' })
    } finally {
        isDeleting.value = false
        itemToDelete.value = null
    }
}

const cancelDelete = () => {
    isDeleteDialogOpen.value = false
    itemToDelete.value = null
}

const viewItem = (item?: any) => {
    if (item) selectItem(item, 0)
    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    router.push(`/production/transaksi/t_ba/view/${selectedItem.value.id}`)
}

const editItem = (item?: any) => {
    const target = item || selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat diedit.' });
        return;
    }
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk mengubah data' })
        return
    }
    if (item) selectItem(item, 0)
    
    const selected = handleEdit(item)
    if (!selected) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    router.push(`/production/transaksi/t_ba/form/${selected.id}`)
}

const copyItem = (item?: any) => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
        return
    }
    if (item) selectItem(item, 0)
    
    const selected = handleCopy(item)
    if (!selected) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    router.push({
        path: '/production/transaksi/t_ba/form',
        query: { 
            action: 'copy',
            source: selected.id 
        }
    })
    
    toast.success(`Menyalin data "${selected.no || 'tanpa nomor'}"`)
    deselectItem()
}

const createNew = () => {
    if (!canCreate.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk membuat data baru' })
        return
    }
    router.push('/production/transaksi/t_ba/form')
}

const isPostDialogOpen = ref(false)
const itemToPost = ref<BaItem | null>(null)
const isPosting = ref(false)

const postSelected = (item?: BaItem) => {
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk memposting data' })
        return
    }
    if (item) selectItem(item, 0)
    
    const activeItem = item || selectedItem.value
    if (!activeItem) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    if (activeItem.status !== 'DRAFT') {
        toast.error('Akses Ditolak', { description: 'Hanya data DRAFT yang dapat diposting' })
        return
    }

    itemToPost.value = activeItem
    isPostDialogOpen.value = true
}

const confirmPost = async () => {
    if (!itemToPost.value) return
    isPosting.value = true
    try {
        const response = await postBa(itemToPost.value.id)
        if (response.status === 'success') {
            const index = menuData.value.findIndex(m => m.id === itemToPost.value!.id)
            if (index !== -1) {
                const currentItem = menuData.value[index]
                if (currentItem) {
                    menuData.value[index] = { ...currentItem, status: 'POST' }
                }
            }
            toast.success(`Berita Acara berhasil diposting`)
            isPostDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal memposting Berita Acara')
        }
    } catch (e) {
        toast.error('Gagal memposting Berita Acara', { description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
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
// API DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        const colFilters = { ...tableColumnFilters.value }
        let whereClauses: string[] = []
        if (tableWhereClause.value) whereClauses.push(tableWhereClause.value)

        const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined

        // Generate filter_column_* keys for all columns (including relations)
        const allColumnFilters: Record<string, string> = {};
        Object.entries(colFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                let backendField = key;
                if (backendField.startsWith("m_unit_bisni.")) {
                    backendField = backendField.replace("m_unit_bisni.", "m_unit_bisni.");
                }
                allColumnFilters[`filter_column_${backendField}`] = value.trim();
            }
        });

        const globalSearchFields = [
            "no",
            "notes",
            "status",
            "$m_unit_bisni.nama_comp$",
            "$m_gudang.nama_gudang$"
        ].join(",");

        let effectiveSearch = searchApiQuery.value || undefined;
        let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

        const response = await getBaList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            effectiveSearch,
            effectiveSearchFields,
            undefined, // filterCreatedBy not implemented yet for ba
            Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined,
            finalWhere
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
        toast.error('Gagal memuat data Berita Acara', {
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

const handleTableFilterChange = (filters: any) => {
    tableColumnFilters.value = filters.column
    tableColumnFilterOperators.value = filters.operator
    tableDateRangeFilters.value = filters.dateRange
    tableWhereClause.value = filters.where

    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    fetchMenuData(1, true)
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

// Infinite scroll mobile helper
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
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-lg font-bold">Transaksi Berita Acara</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Berita Acara</p>
                    </div>
                    <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
                        <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                    </Button>
                </div>

                <!-- Filter Status Buttons -->
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium">Status:</span>
                    <Button variant="outline" size="sm"
                        :class="getApprovalStatusFilterClass('ALL', filterStatus === null)"
                        @click="filterStatus = null">
                        ALL
                    </Button>
                    <Button variant="outline" size="sm"
                        :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
                        @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
                        DRAFT
                    </Button>
                    <Button variant="outline" size="sm"
                        :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
                        @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
                        POST
                    </Button>
                    <Button variant="outline" size="sm"
                        :class="getApprovalStatusFilterClass('CONFIRM', filterStatus === 'CONFIRM')"
                        @click="filterStatus = filterStatus === 'CONFIRM' ? null : 'CONFIRM'">
                        CONFIRM
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
                    <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
                        <X class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>

        <!-- CONTENT AREA -->
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
                <Card 
                    v-for="item in filteredData" 
                    :key="item.id"
                    class="cursor-pointer hover:shadow-md transition-all"
                    :class="selectedItem?.id === item.id ? 'ring-2 ring-primary' : ''"
                    @click="selectItem(item, 0)"
                >
                    <CardContent class="pt-3 pb-2 space-y-2">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold text-sm truncate">{{ item.no || 'Tanpa Nomor' }}</div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-' }}
                                </div>
                            </div>
                            <Badge :class="getApprovalStatusBadgeClass(item.status || 'DRAFT')" class="text-xs shrink-0">
                                {{ item.status || 'DRAFT' }}
                            </Badge>
                        </div>

                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.m_unit_bisni">
                                <span class="font-medium">Unit Bisnis:</span> {{ item.m_unit_bisni?.nama_comp || item.m_unit_bisni?.nama || '-' }}
                            </div>
                            <div v-if="item.m_gudang">
                                <span class="font-medium">Gudang:</span> {{ item.m_gudang?.nama_gudang || item.m_gudang?.nama || '-' }}
                            </div>
                            <div v-if="item.reason">
                                <span class="font-medium">Alasan:</span> {{ item.reason?.value1 || item.reason?.code || '-' }}
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
                                :status="item.status"
                                :disabled="item.status !== 'DRAFT'"
                                @click.stop="() => { selectItem(item, 0); deleteSelected() }" 
                            />
                            <EditButton 
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                :status="item.status"
                                :disabled="item.status !== 'DRAFT'"
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
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                :showLabel="false"
                                :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
                                @click.stop="() => postSelected(item)" 
                            />
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
                <h1 class="text-2xl font-bold">Transaksi Berita Acara</h1>
                <p class="text-sm text-muted-foreground">Kelola data Berita Acara (t_ba)</p>
            </div>
            <div class="flex items-center gap-2">
                <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
                    <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                </Button>
                <Button @click="createNew" v-permission="{ menuId: currentMenuId, action: 'create' }" class="gap-2 whitespace-nowrap shrink-0">
                    Create New
                </Button>
            </div>
        </div>

        <!-- FILTER BAR -->
        <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
            <!-- Filter Status Row -->
            <div class="flex items-center gap-2 overflow-x-auto">
                <span class="text-sm font-medium">Status:</span>
                <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                    :class="getApprovalStatusFilterClass('ALL', filterStatus === null)"
                    @click="filterStatus = null">
                    ALL
                </Button>
                <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                    :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
                    @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
                    DRAFT
                </Button>
                <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                    :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
                    @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
                    POST
                </Button>
                <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                    :class="getApprovalStatusFilterClass('CONFIRM', filterStatus === 'CONFIRM')"
                    @click="filterStatus = filterStatus === 'CONFIRM' ? null : 'CONFIRM'">
                    CONFIRM
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
                    <DeleteButton 
                        v-permission="{ menuId: currentMenuId, action: 'delete' }" 
                        :status="selectedItem?.status"
                        :disabled="!canEditOrDelete"
                        @click="() => deleteSelected()" />
                    <ViewButton  :disabled="!isActive" @click="viewItem()" />
                    <EditButton 
                        v-permission="{ menuId: currentMenuId, action: 'update' }"  
                        :status="selectedItem?.status"
                        :disabled="!canEditOrDelete"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }"  :disabled="!isActive"
                        @click="copyItem()" />
                    <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }"  :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
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
                Tidak ada data Berita Acara
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isDeleteDialogOpen" 
        title="Hapus Berita Acara" 
        :description="deleteDialogDescription" 
        type="danger"
        confirm-text="Hapus" 
        cancel-text="Batal" 
        :is-loading="isDeleting" 
        @confirm="confirmDelete"
        @cancel="cancelDelete" 
        @update:open="isDeleteDialogOpen = $event" 
    />

    <!-- POST CONFIRMATION DIALOG -->
    <GlobalDialog
        :open="isPostDialogOpen"
        title="POST Berita Acara"
        :description="`Apakah Anda yakin ingin POST Berita Acara &quot;${itemToPost?.no || 'tanpa nomor'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
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
