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
import { FieldSelect } from '@/components/field'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getEkspedisiList, deleteEkspedisi, checkEkspedisiUsage, type EkspedisiItem } from './service'

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
const itemToDelete = ref<EkspedisiItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<EkspedisiItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const filterProvinsi = ref<string>('')
const filterKotaTujuan = ref<string>('')
const kotaSelectKey = ref(0) // Force re-render when province changes
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
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { key: 'kode_ekspedisi', label: 'Kode Ekspedisi', filterable: true, width: '150px' },
    { key: 'nama', label: 'Nama', filterable: true, width: '200px' },
    { 
        key: 'tujuan_kirim', 
        label: 'Tujuan Kirim', 
        filterable: true, 
        width: '200px',
        format: (item: EkspedisiItem) => {
            if (item.m_tujuan_ekspedisis && item.m_tujuan_ekspedisis.length > 0) {
                return item.m_tujuan_ekspedisis.map((d: any) => d.nama_kota).join(', ')
            }
            return item.tujuan_kirim || '-'
        }
    },
    { key: 'alamat', label: 'Alamat', filterable: true, width: '200px' },
    { key: 'provinsi', label: 'Provinsi', filterable: true, width: '150px' },
    { key: 'kota', label: 'Kota', filterable: true, width: '150px' },
    { key: 'kecamatan', label: 'Kecamatan', filterable: true, width: '150px' },
    { key: 'telepon', label: 'Telepon', filterable: true, width: '150px' },
    { key: 'cp_kantor', label: 'CP Kantor', filterable: true, width: '150px' },
    { key: 'cp_lapangan', label: 'CP Lapangan', filterable: true, width: '150px' },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: EkspedisiItem) => {
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

const filteredData = computed(() => {
    return menuData.value.filter((item: EkspedisiItem) => {
        // Filter by status
        const matchStatus = filterStatus.value === null
            ? true
            : filterStatus.value === 'Aktif'
                ? item.is_active === true
                : item.is_active === false

        const colFilters = tableColumnFilters.value;
        const relationParts = Object.entries(colFilters).filter(
            ([key, val]) => (key.includes(".") || key === 'tujuan_kirim') && val?.trim()
        );

        let matchRelations = true;
        if (relationParts.length > 0) {
            matchRelations = relationParts.every(([key, val]) => {
                let strVal = "";
                if (key === 'tujuan_kirim') {
                    if (item.m_tujuan_ekspedisis && item.m_tujuan_ekspedisis.length > 0) {
                        strVal = item.m_tujuan_ekspedisis.map((d: any) => d.nama_kota).join(', ').toLowerCase();
                    } else {
                        strVal = String(item.tujuan_kirim || "").toLowerCase();
                    }
                } else {
                    let objValue: any = item;
                    const parts = key.split(".");
                    for (const part of parts) {
                        objValue = objValue?.[part];
                    }
                    strVal = String(objValue || "").toLowerCase();
                }
                return strVal.includes(val.trim().toLowerCase());
            });
        }

        // If no provinsi or kota filter, just use status
        if (!filterProvinsi.value && !filterKotaTujuan.value) {
            return matchStatus && matchRelations
        }

        // Check if item has m_tujuan_ekspedisis array
        if (!item.m_tujuan_ekspedisis || item.m_tujuan_ekspedisis.length === 0) {
            return false
        }

        // Filter by provinsi and/or kota
        const hasTujuanMatch = item.m_tujuan_ekspedisis.some((dest: any) => {
            // If filtering by both provinsi and kota
            if (filterProvinsi.value && filterKotaTujuan.value) {
                return dest.nama_provinsi === filterProvinsi.value && dest.nama_kota === filterKotaTujuan.value
            }
            
            // If filtering by provinsi only
            if (filterProvinsi.value) {
                return dest.nama_provinsi === filterProvinsi.value
            }
            
            // If filtering by kota only
            if (filterKotaTujuan.value) {
                return dest.nama_kota === filterKotaTujuan.value
            }
            
            return true
        })

        return matchStatus && hasTujuanMatch && matchRelations
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Ekspedisi "${itemToDelete.value.nama}"? Tindakan ini tidak dapat dibatalkan.`
})

const relationDeleteMessage = 'Data ekspedisi tidak dapat dihapus karena sudah digunakan pada data lain yang berelasi.'

const getRelationUsageDescription = (usages: { label: string; total: number }[]) => {
    if (usages.length === 0) return relationDeleteMessage

    const moduleList = usages
        .map((usage) => `${usage.label} (${usage.total} data)`)
        .join(', ')

    return `${relationDeleteMessage} Data terkait: ${moduleList}.`
}

const getDeleteErrorDescription = (error: unknown) => {
    const apiError = error as {
        statusCode?: number
        response?: {
            data?: {
                message?: string
                error?: string
            }
        }
    }

    const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        (error instanceof Error ? error.message : '') ||
        (typeof error === 'string' ? error : '')

    const normalizedMessage = message.toLowerCase()
    const relationKeywords = [
        'foreign key',
        'constraint',
        'referenced',
        'reference',
        'relation',
        'relasi',
        'digunakan',
        'terkait',
        'associated',
        'cannot delete',
        'parent row',
    ]

    if (apiError?.statusCode === 409 || relationKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
        return relationDeleteMessage
    }

    return message || 'Terjadi kesalahan saat menghapus'
}

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
        const usage = await checkEkspedisiUsage(itemToDelete.value.id)
        if (usage.used) {
            toast.error('Tidak dapat menghapus Ekspedisi', {
                description: getRelationUsageDescription(usage.usages)
            })
            isDeleteDialogOpen.value = false
            return
        }

        const response = await deleteEkspedisi(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: EkspedisiItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Ekspedisi "${itemToDelete.value.nama}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Ekspedisi', {
                description: getDeleteErrorDescription(response.message)
            })
            isDeleteDialogOpen.value = false
        }
    } catch (error) {
        toast.error('Tidak dapat menghapus Ekspedisi', {
            description: getDeleteErrorDescription(error)
        })
        isDeleteDialogOpen.value = false
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
// FILTER HANDLERS
// ============================================================================
/** Handle provinsi change - reset kota filter */
const handleProvinsiFilterChange = (newProvinsi: string) => {
    filterProvinsi.value = newProvinsi
    filterKotaTujuan.value = ''
    kotaSelectKey.value++ // Force re-render kota dropdown
}

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export m_ekspedisi data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View Ekspedisi item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/purchasing/master/m_ekspedisi/view/${selectedItem.value.id}`)
}

/** Edit Ekspedisi item */
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
    router.push(`/purchasing/master/m_ekspedisi/form/${selectedItemData.id}`)
}

/** Copy Ekspedisi item - duplicate data tanpa ID untuk create new */
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
        path: '/purchasing/master/m_ekspedisi/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.name}"`, {
        description: 'Silakan edit dan simpan sebagai Ekspedisi baru'
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
    
    router.push('/purchasing/master/m_ekspedisi/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_ekspedisi data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        const colFilters = { ...tableColumnFilters.value };
        let whereClauses: string[] = [];
        if (tableWhereClause.value) whereClauses.push(tableWhereClause.value);

        const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined;

        const allColumnFilters: Record<string, string> = {};
        Object.entries(colFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                allColumnFilters[key] = value.trim();
            }
        });

        const searchFields = 'nama,tujuan_kirim,alamat,provinsi,kota,kecamatan,telepon,cp_kantor,cp_lapangan';

        // Call API with search parameters
        const response = await getEkspedisiList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? searchFields : undefined,
            Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined,
            tableColumnFilterOperators.value,
            finalWhere
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
        toast.error('Gagal memuat data Ekspedisi', {
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
    tableWhereClause.value = filters.where

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
    tableWhereClause.value = ''
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
                        <h1 class="text-lg font-bold">Master Ekspedisi</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Ekspedisi</p>
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
                <div class="flex items-center gap-2 overflow-x-auto">
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7 shrink-0"
                        :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                        @click="filterStatus = null"
                    >
                        All
                    </Button>

                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7 shrink-0"
                        :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
                        @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
                    >
                        Aktif
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7 shrink-0"
                        :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
                        @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'"
                    >
                        Nonaktif
                    </Button>
                </div>

                <!-- Filter Provinsi -->
                <div class="flex items-center gap-2 min-w-0">
                    <label class="text-xs font-medium shrink-0">Provinsi:</label>
                    <FieldSelect
                        id="filter_provinsi"
                        :value="filterProvinsi"
                        @input="(v: any) => handleProvinsiFilterChange(v)"
                        :api="{
                            url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                            params: { 
                                search: '', 
                                searchfield: 'name', 
                                selectfield: 'name,id', 
                                paginate: 50 
                            },
                            fullUrl: true
                        } as any"
                        displayField="name"
                        valueField="name"
                        :bind="{ clearable: true }"
                        placeholder="Pilih provinsi..."
                        class="flex-1 min-w-[120px]"
                    />
                </div>

                <!-- Filter Kota Tujuan -->
                <div class="flex items-center gap-2 min-w-0">
                    <label class="text-xs font-medium shrink-0">Kota:</label>
                    <FieldSelect
                        :key="kotaSelectKey"
                        id="filter_kota"
                        :value="filterKotaTujuan"
                        @input="(v: any) => filterKotaTujuan = v"
                        :api="{
                            url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                            params: { 
                                provinsi: filterProvinsi,
                                search: '', 
                                searchfield: 'name', 
                                selectfield: 'name,id', 
                                paginate: 100 
                            },
                            fullUrl: true
                        } as any"
                        displayField="name"
                        valueField="name"
                        :bind="{ clearable: true, disabled: !filterProvinsi }"
                        placeholder="Pilih kota..."
                        :hints="!filterProvinsi ? '' : ''"
                        class="flex-1 min-w-[120px]"
                    />
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
                                <div class="font-semibold text-sm truncate">{{ item.nama || '-' }}</div>
                                <div class="text-xs text-muted-foreground truncate">{{ item.kode_ekspedisi || '-' }}</div>
                            </div>
                            <Badge 
                                :variant="item.is_active ? 'default' : 'secondary'" 
                                class="text-xs shrink-0"
                            >
                                {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                            </Badge>
                        </div>

                        <!-- Kota Tujuan Badges -->
                        <div v-if="item.m_tujuan_ekspedisis && item.m_tujuan_ekspedisis.length > 0" class="flex flex-wrap gap-1">
                            <Badge 
                                v-for="(dest, idx) in item.m_tujuan_ekspedisis.slice(0, 3)" 
                                :key="idx"
                                variant="secondary" 
                                class="text-xs"
                            >
                                {{ dest.nama_kota }}
                            </Badge>
                            <Badge 
                                v-if="item.m_tujuan_ekspedisis.length > 3"
                                variant="outline" 
                                class="text-xs"
                            >
                                +{{ item.m_tujuan_ekspedisis.length - 3 }} lainnya
                            </Badge>
                        </div>
                        <div v-else-if="item.tujuan_kirim" class="text-xs text-muted-foreground">
                            <span class="font-medium">Tujuan:</span> {{ item.tujuan_kirim }}
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.alamat">
                                <span class="font-medium">Alamat:</span> {{ item.alamat }}
                            </div>
                            <div v-if="item.provinsi">
                                <span class="font-medium">Provinsi:</span> {{ item.provinsi }}
                            </div>
                            <div v-if="item.kota">
                                <span class="font-medium">Kota:</span> {{ item.kota }}
                            </div>
                            <div v-if="item.kecamatan">
                                <span class="font-medium">Kecamatan:</span> {{ item.kecamatan }}
                            </div>
                            <div v-if="item.telepon">
                                <span class="font-medium">Telepon:</span> {{ item.telepon }}
                            </div>
                            <div v-if="item.cp_kantor">
                                <span class="font-medium">CP Kantor:</span> {{ item.cp_kantor }}
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
                <h1 class="text-2xl font-bold">Master Ekspedisi</h1>
                <p class="text-sm text-muted-foreground">Kelola data Ekspedisi</p>
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
            <div class="flex items-center gap-2 flex-wrap">
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
            </div>

            <!-- Filter Tujuan Row -->
            <div class="space-y-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium shrink-0">Tujuan : </span>
                        <FieldSelect
                            id="filter_provinsi_desktop"
                            :value="filterProvinsi"
                            @input="(v: any) => handleProvinsiFilterChange(v)"
                            :api="{
                                url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                                params: { 
                                    search: '', 
                                    searchfield: 'name', 
                                    selectfield: 'name,id', 
                                    paginate: 50 
                                },
                                fullUrl: true
                            } as any"
                            displayField="name"
                            valueField="name"
                            :bind="{ clearable: true }"
                            placeholder="Pilih provinsi..."
                            class="min-w-[200px]"
                        />
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <FieldSelect
                            :key="kotaSelectKey"
                            id="filter_kota_desktop"
                            :value="filterKotaTujuan"
                            @input="(v: any) => filterKotaTujuan = v"
                            :api="{
                                url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                                params: { 
                                    provinsi: filterProvinsi,
                                    search: '', 
                                    searchfield: 'name', 
                                    selectfield: 'name,id', 
                                    paginate: 100 
                                },
                                fullUrl: true
                            } as any"
                            displayField="name"
                            valueField="name"
                            :bind="{ clearable: true, disabled: !filterProvinsi }"
                            placeholder="Pilih kota..."
                            :hints="!filterProvinsi ? '' : ''"
                            class="min-w-[200px]"
                        />
                    </div>
                </div>
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
            :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange">
            <template #empty>
                Tidak ada data Ekspedisi
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isDeleteDialogOpen" 
        title="Hapus Ekspedisi" 
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
