<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Search, RefreshCw, X, Pencil, History, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import DataTable from '@/components/table/DataTable.vue'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { useApi } from '@/composables/useApi'
import { getPriceList, updatePriceList, getPriceListHistory, type ItemWithPriceList, type PriceListItem, type PriceListHistoryItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const { selectedItem, isActive, selectItem, deselectItem } = useActionButtons()
const { currentMenuId } = usePermission()
const { API_BASE_URL } = useApi()

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<ItemWithPriceList[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER STATE FOR API-BASED FILTERING
// ============================================================================
interface ColumnFilters {
  [key: string]: string
}
interface ColumnFilterOperators {
  [key: string]: string
}
interface DateRangeFilter {
  from: string
  to: string
}
interface DateRangeFilters {
  [key: string]: DateRangeFilter
}
const tableColumnFilters = ref<ColumnFilters>({})
const tableColumnFilterOperators = ref<ColumnFilterOperators>({})
const tableDateRangeFilters = ref<DateRangeFilters>({})
const tableWhereClause = ref<string>('')
const dataTableRef = ref<any>(null)

// ============================================================================
// EDIT DIALOG STATE
// ============================================================================
const isEditDialogOpen = ref(false)
const editingItem = ref<ItemWithPriceList | null>(null)
const editForm = ref<PriceListItem>({
    m_items_id: undefined,
    harga: undefined,
    is_active: true,
    note: undefined
})
const isSaving = ref(false)

// ============================================================================
// BULK EDIT DIALOG STATE
// ============================================================================
const isBulkEditDialogOpen = ref(false)
const selectedItemsForBulk = ref<ItemWithPriceList[]>([])
const bulkEditForm = ref({
    harga: undefined as number | undefined,
    note: undefined as string | undefined
})
const isBulkSaving = ref(false)
const bulkSearchQuery = ref('')

// ============================================================================
// HISTORY DIALOG STATE
// ============================================================================
const isHistoryDialogOpen = ref(false)
const historyItem = ref<ItemWithPriceList | null>(null)
const historyData = ref<PriceListHistoryItem[]>([])
const loadingHistory = ref(false)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// ============================================================================
// IMAGE CAROUSEL STATE
// ============================================================================
const activeImageIndex = ref<{ [key: string]: number }>({})
const showImagePreview = ref(false)
const previewImages = ref<string[]>([])
const previewImageIndex = ref(0)

const getImageUrl = (imagePath: string) => {
  if (!imagePath) return ''
  // If value is already full URL, use it
  if (imagePath.startsWith('http')) return imagePath
  // Otherwise, construct URL from filename
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  // If value already starts with 'uploads/', don't add it again
  if (imagePath.startsWith('uploads/')) {
    return `${baseUrl}/${imagePath}`
  }
  return `${baseUrl}/uploads/${imagePath}`
}

const openImagePreview = (item: ItemWithPriceList, event: Event) => {
    event.stopPropagation()
    const images = item.m_items_images || []
    if (images.length === 0) return
    
    previewImages.value = images.map(img => getImageUrl(img.gambar))
    previewImageIndex.value = activeImageIndex.value[item.id] || 0
    showImagePreview.value = true
}

const closeImagePreview = () => {
    showImagePreview.value = false
    previewImages.value = []
    previewImageIndex.value = 0
}

const nextPreviewImage = () => {
    if (previewImages.value.length === 0) return
    previewImageIndex.value = (previewImageIndex.value + 1) % previewImages.value.length
}

const prevPreviewImage = () => {
    if (previewImages.value.length === 0) return
    previewImageIndex.value = previewImageIndex.value === 0 
        ? previewImages.value.length - 1 
        : previewImageIndex.value - 1
}

const getActiveImage = (item: ItemWithPriceList) => {
    const images = item.m_items_images || []
    if (images.length === 0) return null
    const index = activeImageIndex.value[item.id] || 0
    return getImageUrl(images[index]?.gambar || '')
}

const nextImage = (item: ItemWithPriceList, event: Event) => {
    event.stopPropagation()
    const images = item.m_items_images || []
    if (images.length === 0) return
    const currentIndex = activeImageIndex.value[item.id] || 0
    activeImageIndex.value[item.id] = (currentIndex + 1) % images.length
}

const prevImage = (item: ItemWithPriceList, event: Event) => {
    event.stopPropagation()
    const images = item.m_items_images || []
    if (images.length === 0) return
    const currentIndex = activeImageIndex.value[item.id] || 0
    activeImageIndex.value[item.id] = currentIndex === 0 ? images.length - 1 : currentIndex - 1
}

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    {
        key: 'gambar',
        label: 'Gambar',
        filterable: false,
        sortable: false,
        width: '90px',
        renderHtml: (item: ItemWithPriceList) => {
            const images = item.m_items_images || []
            if (images.length === 0) {
                return `<div class="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>`
            }
            const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
            const firstImagePath = images[0]?.gambar || ''
            const firstImage = firstImagePath.startsWith('http') ? firstImagePath : 
                firstImagePath.startsWith('uploads/') ? `${baseUrl}/${firstImagePath}` : `${baseUrl}/uploads/${firstImagePath}`
            return `<div class="action-image-preview relative w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" data-item-id="${item.id}" data-item-name="${item.nama_item || ''}">
                <img src="${firstImage}" alt="Item" class="w-full h-full object-cover" />
                ${images.length > 1 ? `<div class="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-xs px-1 py-0 rounded" style="font-size: 10px">+${images.length - 1}</div>` : ''}
            </div>`
        }
    },
    // { key: 'kode_item', label: 'Kode Item', filterable: true, width: '130px' },
    { key: 'nama_item', label: 'Nama Item', filterable: true, width: '150px', wrapText: true },
    {
        key: 'group_jenis',
        label: 'Jenis',
        filterable: false,
        width: '150px',
        wrapText: true,
        sortValue: (item: ItemWithPriceList) => item.m_group_jeni?.nama_jenis || '',
        render: (item: ItemWithPriceList) => item.m_group_jeni?.nama_jenis || '-'
    },
    {
        key: 'group_tipe',
        label: 'Tipe',
        filterable: false,
        width: '150px',
        wrapText: true,
        sortValue: (item: ItemWithPriceList) => item.m_group_tipe?.nama_tipe || '',
        render: (item: ItemWithPriceList) => item.m_group_tipe?.nama_tipe || '-'
    },
    {
        key: 'group_merek',
        label: 'Merek',
        filterable: false,
        width: '150px',
        wrapText: true,
        sortValue: (item: ItemWithPriceList) => item.m_group_merek?.nama_merek || '',
        render: (item: ItemWithPriceList) => item.m_group_merek?.nama_merek || '-'
    },
    {
        key: 'group_ukuran',
        label: 'Ukuran',
        filterable: false,
        width: '120px',
        wrapText: true,
        sortValue: (item: ItemWithPriceList) => item.m_group_ukuran?.nama_ukuran || '',
        render: (item: ItemWithPriceList) => item.m_group_ukuran?.nama_ukuran || '-'
    },
    {
        key: 'harga',
        label: 'Harga',
        filterable: false,
        width: '150px',
        sortValue: (item: ItemWithPriceList) => {
            const activePrice = item.m_items_pricelists?.find(p => p.is_active === true)
            return activePrice?.harga || 0
        },
        renderHtml: (item: ItemWithPriceList) => {
            // Find active price
            const activePrice = item.m_items_pricelists?.find(p => p.is_active === true)
            if (activePrice && activePrice.harga) {
                return `<span class="font-semibold">Rp ${activePrice.harga.toLocaleString('id-ID')}</span>`
            }
            return '<span class="text-muted-foreground">-</span>'
        }
    },
    {
        key: 'note',
        label: 'Catatan Harga',
        filterable: true,
        width: '200px',
        wrapText: true,
        sortValue: (item: ItemWithPriceList) => {
            const activePrice = item.m_items_pricelists?.find(p => p.is_active === true)
            return activePrice?.note || ''
        },
        filterValue: (item: ItemWithPriceList) => {
            const activePrice = item.m_items_pricelists?.find(p => p.is_active === true)
            return activePrice?.note || ''
        },
        render: (item: ItemWithPriceList) => {
            // Find active price
            const activePrice = item.m_items_pricelists?.find(p => p.is_active === true)
            return activePrice?.note || '-'
        }
    }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter price list data berdasarkan status (search sudah dari API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: ItemWithPriceList) => {
        const matchStatus = filterStatus.value === null
            ? true
            : filterStatus.value === 'Aktif'
                ? item.is_active === true
                : item.is_active === false

        return matchStatus
    })
})

/** Filter items for bulk edit dialog based on search */
const filteredBulkItems = computed(() => {
    if (!bulkSearchQuery.value.trim()) {
        return filteredData.value
    }
    
    const query = bulkSearchQuery.value.toLowerCase()
    return filteredData.value.filter((item: ItemWithPriceList) => {
        return (
            item.nama_item?.toLowerCase().includes(query) ||
            item.kode_item?.toLowerCase().includes(query) ||
            item.m_group_jeni?.nama_jenis?.toLowerCase().includes(query) ||
            item.m_group_merek?.nama_merek?.toLowerCase().includes(query) ||
            item.m_group_tipe?.nama_tipe?.toLowerCase().includes(query)
        )
    })
})

/** Check if all filtered items are selected */
const isAllFilteredItemsSelected = computed(() => {
    if (filteredBulkItems.value.length === 0) return false
    return filteredBulkItems.value.every(item => isItemSelectedForBulk(item))
})

// ============================================================================
// EDIT FUNCTIONS
// ============================================================================
/** Open edit dialog for price list */
const openEditDialog = (item?: ItemWithPriceList) => {
    const itemToEdit = item || selectedItem.value
    if (!itemToEdit) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    // If item is provided (from mobile view), select it first
    if (item) {
        selectItem(item, 0)
    }
    
    editingItem.value = itemToEdit
    
    // Pre-fill form with existing active price list data if available
    const activePrice = itemToEdit.m_items_pricelists?.find((p: PriceListItem) => p.is_active === true)
    if (activePrice) {
        editForm.value = {
            m_items_id: itemToEdit.id,
            harga: activePrice.harga,
            is_active: true,
            note: activePrice.note
        }
    } else {
        editForm.value = {
            m_items_id: itemToEdit.id,
            harga: undefined,
            is_active: true,
            note: undefined
        }
    }
    
    isEditDialogOpen.value = true
}

/** Close edit dialog */
const closeEditDialog = () => {
    isEditDialogOpen.value = false
    editingItem.value = null
    editForm.value = {
        m_items_id: undefined,
        harga: undefined,
        is_active: true,
        note: undefined
    }
}

/** Save price list changes */
const savePriceList = async () => {
    if (!editingItem.value) return
    
    // Validate harga
    if (!editForm.value.harga || editForm.value.harga <= 0) {
        toast.error('Harga harus diisi dan lebih dari 0')
        return
    }
    
    // Get user ID from localStorage
    const authData = localStorage.getItem('auth_bb')
    let userId = null
    if (authData) {
        try {
            const parsed = JSON.parse(authData)
            userId = parsed.user?.id
        } catch (e) {
            console.error('Failed to parse auth data:', e)
        }
    }
    
    isSaving.value = true
    
    try {
        const response = await updatePriceList({
            ...editForm.value,
            created_by: userId
        })
        
        if (response.status === 'success') {
            toast.success('Price List berhasil disimpan', {
                description: `Harga untuk ${editingItem.value.nama_item} telah diperbarui`
            })
            
            closeEditDialog()
            
            // Refresh data
            await fetchMenuData(1, true)
        } else {
            toast.error('Gagal menyimpan Price List', {
                description: response.message || 'Terjadi kesalahan saat menyimpan'
            })
        }
    } catch (error) {
        toast.error('Gagal menyimpan Price List', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isSaving.value = false
    }
}

// ============================================================================
// BULK EDIT FUNCTIONS
// ============================================================================
/** Open bulk edit dialog */
const openBulkEditDialog = () => {
    selectedItemsForBulk.value = []
    bulkSearchQuery.value = ''
    bulkEditForm.value = {
        harga: undefined,
        note: undefined
    }
    isBulkEditDialogOpen.value = true
}

/** Close bulk edit dialog */
const closeBulkEditDialog = () => {
    isBulkEditDialogOpen.value = false
    selectedItemsForBulk.value = []
    bulkSearchQuery.value = ''
    bulkEditForm.value = {
        harga: undefined,
        note: undefined
    }
}

/** Toggle all filtered items selection */
const toggleAllFilteredItems = () => {
    if (isAllFilteredItemsSelected.value) {
        // Unselect all filtered items
        filteredBulkItems.value.forEach(item => {
            const index = selectedItemsForBulk.value.findIndex(i => i.id === item.id)
            if (index > -1) {
                selectedItemsForBulk.value.splice(index, 1)
            }
        })
    } else {
        // Select all filtered items
        filteredBulkItems.value.forEach(item => {
            if (!isItemSelectedForBulk(item)) {
                selectedItemsForBulk.value.push(item)
            }
        })
    }
}

/** Toggle item selection for bulk edit */
const toggleItemSelection = (item: ItemWithPriceList) => {
    const index = selectedItemsForBulk.value.findIndex(i => i.id === item.id)
    if (index > -1) {
        selectedItemsForBulk.value.splice(index, 1)
    } else {
        selectedItemsForBulk.value.push(item)
    }
}

/** Check if item is selected for bulk edit */
const isItemSelectedForBulk = (item: ItemWithPriceList) => {
    return selectedItemsForBulk.value.some(i => i.id === item.id)
}

/** Save bulk edit */
const saveBulkEdit = async () => {
    if (selectedItemsForBulk.value.length === 0) {
        toast.error('Pilih minimal 1 item untuk di-edit')
        return
    }
    
    if (!bulkEditForm.value.harga || bulkEditForm.value.harga <= 0) {
        toast.error('Harga harus diisi dan lebih dari 0')
        return
    }
    
    isBulkSaving.value = true
    
    // Get user ID from localStorage
    const authData = localStorage.getItem('auth_bb')
    let userId = null
    if (authData) {
        try {
            const parsed = JSON.parse(authData)
            userId = parsed.user?.id
        } catch (e) {
            console.error('Failed to parse auth data:', e)
        }
    }
    
    try {
        const promises = selectedItemsForBulk.value.map(item => {
            return updatePriceList({
                m_items_id: item.id,
                harga: bulkEditForm.value.harga,
                is_active: true,
                note: bulkEditForm.value.note,
                created_by: userId
            })
        })
        
        const results = await Promise.all(promises)
        const successCount = results.filter(r => r.status === 'success').length
        
        if (successCount > 0) {
            toast.success(`${successCount} item berhasil diperbarui`, {
                description: 'Harga telah diperbarui untuk item yang dipilih'
            })
            
            closeBulkEditDialog()
            
            // Refresh data
            await fetchMenuData(1, true)
        } else {
            toast.error('Gagal memperbarui item')
        }
    } catch (error) {
        toast.error('Gagal memperbarui item', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isBulkSaving.value = false
    }
}

// ============================================================================
// HISTORY FUNCTIONS
// ============================================================================
/** Open history dialog */
const openHistoryDialog = async (item?: ItemWithPriceList) => {
    const itemToView = item || selectedItem.value
    if (!itemToView) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    // If item is provided (from mobile view), select it first
    if (item) {
        selectItem(item, 0)
    }
    
    historyItem.value = itemToView
    isHistoryDialogOpen.value = true
    
    await fetchHistory(itemToView.id)
}

/** Close history dialog */
const closeHistoryDialog = () => {
    isHistoryDialogOpen.value = false
    historyItem.value = null
    historyData.value = []
}

/** Fetch price list history */
const fetchHistory = async (itemId: string) => {
    loadingHistory.value = true
    
    try {
        const response = await getPriceListHistory(itemId)
        
        if (response.status === 'success') {
            // Sort: active first, then by date descending (newest first)
            historyData.value = response.data.sort((a, b) => {
                // Active items first
                if (a.is_active && !b.is_active) return -1
                if (!a.is_active && b.is_active) return 1
                
                // Then sort by date descending (newest first)
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
        } else {
            toast.error('Gagal memuat history')
        }
    } catch (error) {
        toast.error('Gagal memuat history', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        loadingHistory.value = false
    }
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch price list data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call API with search parameters
        const response = await getPriceList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'kode_item,nama_item,group_jenis,group_tipe,group_merek' : undefined,
            Object.keys(tableColumnFilters.value).length > 0 ? tableColumnFilters.value : undefined,
            Object.keys(tableColumnFilterOperators.value).length > 0 ? tableColumnFilterOperators.value : undefined,
            tableWhereClause.value || undefined
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
        toast.error('Gagal memuat data Master Price List', {
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

/** Handle table filter change from DataTable */
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleTableFilterChange = (filters: {
  column: Record<string, string>
  operator: Record<string, string>
  dateRange: Record<string, { from: string; to: string }>
  where: string
}) => {
  tableColumnFilters.value = filters.column
  tableColumnFilterOperators.value = filters.operator
  tableDateRangeFilters.value = filters.dateRange
  tableWhereClause.value = filters.where
  deselectItem()

  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer)
  }

  filterDebounceTimer = setTimeout(async () => {
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true

    await fetchMenuData(1, true)
  }, 500)
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
    tableColumnFilters.value = {}
    tableColumnFilterOperators.value = {}
    tableDateRangeFilters.value = {}
    tableWhereClause.value = ''
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()
    
    dataTableRef.value?.resetFilters?.()
    
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
    
    // Add click event listener untuk image preview di table
    document.addEventListener('click', handleTableImageClick)
})

/** Cleanup listeners dan state saat component unmount */
onUnmounted(() => {
    // Remove scroll listener
    window.removeEventListener('scroll', handleWindowScroll)
    
    // Remove image click listener
    document.removeEventListener('click', handleTableImageClick)
    
    // Clear data untuk prevent memory leak
    menuData.value = []
    deselectItem()
})

/** Handle click pada image preview di table */
const handleTableImageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const imagePreview = target.closest('.action-image-preview')
    
    if (imagePreview) {
        event.stopPropagation()
        
        // Get item ID from data attribute
        const itemId = imagePreview.getAttribute('data-item-id')
        if (itemId) {
            const item = filteredData.value.find(i => i.id === itemId)
            if (item) {
                openImagePreview(item, event)
            }
        }
    }
}
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
                        <h1 class="text-lg font-bold">Master Price List</h1>
                        <p class="text-xs text-muted-foreground">Kelola Price List aplikasi</p>
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
                    <!-- <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                        @click="filterStatus = null"
                    >
                        All
                    </Button>

                    <!-- <Button 
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
                    </Button> -->
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

            <!-- Card List -->
            <div v-else class="space-y-3">
                <Card 
                    v-for="item in filteredData" 
                    :key="item.id"
                    class="cursor-pointer hover:shadow-md transition-all overflow-hidden"
                    @click="selectItem(item, 0)"
                >
                    <CardContent class="p-0">
                        <!-- Image Carousel Section -->
                        <div 
                            v-if="item.m_items_images && item.m_items_images.length > 0" 
                            class="relative bg-muted aspect-video cursor-pointer"
                            @click="openImagePreview(item, $event)"
                        >
                            <img 
                                :src="getActiveImage(item) || ''" 
                                :alt="item.nama_item"
                                class="w-full h-full object-cover"
                            />
                            
                            <!-- Carousel Controls -->
                            <template v-if="item.m_items_images.length > 1">
                                <button
                                    @click="prevImage(item, $event)"
                                    class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
                                >
                                    <ChevronLeft class="h-4 w-4" />
                                </button>
                                <button
                                    @click="nextImage(item, $event)"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
                                >
                                    <ChevronRight class="h-4 w-4" />
                                </button>
                                
                                <!-- Image Counter -->
                                <div class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    {{ (activeImageIndex[item.id] || 0) + 1 }} / {{ item.m_items_images.length }}
                                </div>
                            </template>
                        </div>
                        
                        <!-- No Image Placeholder -->
                        <div v-else class="relative bg-muted aspect-video flex items-center justify-center">
                            <ImageIcon class="h-12 w-12 text-muted-foreground" />
                        </div>
                        
                        <!-- Item Details Section -->
                        <div class="p-3 space-y-2">
                            <!-- Name & Status Row -->
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex-1 min-w-0">
                                    <div class="font-semibold text-sm truncate">{{ item.nama_item || '-' }}</div>
                                    <div class="text-xs text-muted-foreground truncate">{{ item.kode_item || '-' }}</div>
                                </div>
                                <!-- <Badge 
                                    :variant="item.is_active ? 'default' : 'secondary'" 
                                    class="text-xs shrink-0"
                                >
                                    {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                                </Badge> -->
                            </div>

                            <!-- Details Grid -->
                            <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                <div v-if="item.m_group_jeni" class="col-span-1">
                                    <span class="text-muted-foreground">Jenis:</span>
                                    <div class="font-medium truncate">{{ item.m_group_jeni.nama_jenis }}</div>
                                </div>
                                <div v-if="item.m_group_tipe" class="col-span-1">
                                    <span class="text-muted-foreground">Tipe:</span>
                                    <div class="font-medium truncate">{{ item.m_group_tipe.nama_tipe }}</div>
                                </div>
                                <div v-if="item.m_group_merek" class="col-span-1">
                                    <span class="text-muted-foreground">Merek:</span>
                                    <div class="font-medium truncate">{{ item.m_group_merek.nama_merek }}</div>
                                </div>
                                <div v-if="item.m_group_ukuran" class="col-span-1">
                                    <span class="text-muted-foreground">Ukuran:</span>
                                    <div class="font-medium truncate">{{ item.m_group_ukuran.nama_ukuran }}</div>
                                </div>
                            </div>
                            
                            <!-- Price Section -->
                            <div v-if="item.m_items_pricelists?.find(p => p.is_active === true)" class="pt-2 border-t">
                                <div class="flex items-baseline justify-between">
                                    <span class="text-xs text-muted-foreground">Harga:</span>
                                    <span class="text-base font-bold text-primary">
                                        Rp {{ (item.m_items_pricelists.find(p => p.is_active === true)?.harga || 0).toLocaleString('id-ID') }}
                                    </span>
                                </div>
                                <div v-if="item.m_items_pricelists.find(p => p.is_active === true)?.note" class="text-xs text-muted-foreground mt-1">
                                    {{ item.m_items_pricelists.find(p => p.is_active === true)?.note }}
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex items-center justify-end gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 gap-2"
                                    @click.stop="openEditDialog(item)"
                                >
                                    <Pencil class="h-4 w-4" />
                                    <span>Edit</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 gap-2"
                                    @click.stop="openHistoryDialog(item)"
                                >
                                    <History class="h-4 w-4" />
                                    <span>History</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

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
    </div>

    <!-- ================================================================ -->
    <!-- DESKTOP VIEW (HIDDEN LG:FLEX) -->
    <!-- ================================================================ -->
    <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
        <!-- HEADER -->
        <div class="flex items-start justify-between">
            <div>
                <h1 class="text-2xl font-bold">Master Price List</h1>
                <p class="text-sm text-muted-foreground">Kelola Price List aplikasi</p>
            </div>
            <div class="flex items-center gap-2">
                <Button 
                    variant="default" 
                    size="sm" 
                    @click="openBulkEditDialog" 
                    class="gap-2"
                >
                    <Pencil class="h-4 w-4" />
                    Bulk Edit
                </Button>
                <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0"
                    title="Refresh data">
                    <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                </Button>
            </div>
        </div>

        <!-- FILTER BAR -->
        <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
            <!-- Filter Status Row -->
            <div class="flex items-center gap-2">
                <!-- <span class="text-sm font-medium">Status:</span>
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
                </Button> -->
            </div>

            <!-- Search Row -->
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
            </div>
            
            <!-- Action Buttons Row -->
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    @click="openEditDialog()"
                    :disabled="!selectedItem"
                    class="gap-2"
                >
                    <Pencil class="h-4 w-4" />
                    Edit Price
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    @click="openHistoryDialog()"
                    :disabled="!selectedItem"
                    class="gap-2"
                >
                    <History class="h-4 w-4" />
                    View History
                </Button>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable 
            ref="dataTableRef"
            :api-filter-mode="true"
            @filter-change="handleTableFilterChange"
            :data="filteredData" 
            :columns="columns" 
            :loading="loading" 
            :loading-more="loadingMore"
            :has-more="hasMoreData" 
            :row-select-mode="true"
            :row-height="70"
            @row-select="selectItem" 
            @row-deselect="deselectItem"
            @load-more="handleLoadMore"
            @refresh-requested="handleRefresh"
        >
            <template #empty>
                Tidak ada data Master Price List
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- EDIT PRICE DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isEditDialogOpen" @update:open="isEditDialogOpen = $event">
        <DialogContent class="sm:max-w-[500px] xl:max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Edit Price List</DialogTitle>
                <DialogDescription>
                    Update harga dan catatan untuk item ini
                </DialogDescription>
            </DialogHeader>

            <div v-if="editingItem" class="py-4">
                <!-- 2 Column Layout for XL screens -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <!-- Left Column: Image & Item Info -->
                    <div class="space-y-4">
                        <!-- Item Images Carousel -->
                        <div v-if="editingItem.m_items_images && editingItem.m_items_images.length > 0" class="space-y-2">
                            <Label class="text-sm font-medium">Gambar Item</Label>
                            <div class="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                <img 
                                    :src="getActiveImage(editingItem) || ''" 
                                    :alt="editingItem.nama_item"
                                    class="w-full h-full object-cover"
                                />
                                
                                <!-- Carousel Controls -->
                                <template v-if="editingItem.m_items_images.length > 1">
                                    <button
                                        @click="prevImage(editingItem, $event)"
                                        type="button"
                                        class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                                    >
                                        <ChevronLeft class="h-5 w-5" />
                                    </button>
                                    <button
                                        @click="nextImage(editingItem, $event)"
                                        type="button"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                                    >
                                        <ChevronRight class="h-5 w-5" />
                                    </button>
                                    
                                    <!-- Image Counter -->
                                    <div class="absolute bottom-3 right-3 bg-black/70 text-white text-sm px-3 py-1 rounded">
                                        {{ (activeImageIndex[editingItem.id] || 0) + 1 }} / {{ editingItem.m_items_images.length }}
                                    </div>
                                </template>
                            </div>
                        </div>
                        
                        <!-- Item Info (Read Only) -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">Item Information</Label>
                            <div class="rounded-lg border p-3 bg-muted/50 space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Kode Item:</span>
                                    <span class="text-sm font-medium">{{ editingItem.kode_item || '-' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Nama Item:</span>
                                    <span class="text-sm font-medium">{{ editingItem.nama_item }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Jenis:</span>
                                    <span class="text-sm font-medium">{{ editingItem.m_group_jeni?.nama_jenis || '-' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Merek:</span>
                                    <span class="text-sm font-medium">{{ editingItem.m_group_merek?.nama_merek || '-' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Tipe:</span>
                                    <span class="text-sm font-medium">{{ editingItem.m_group_tipe?.nama_tipe || '-' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm text-muted-foreground">Ukuran:</span>
                                    <span class="text-sm font-medium">{{ editingItem.m_group_ukuran?.nama_ukuran || '-' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Editable Fields -->
                    <div class="space-y-4">
                        <!-- Harga (Editable) -->
                        <div class="space-y-2">
                            <Label for="harga" class="text-sm font-medium">
                                Harga <span class="text-red-500">*</span>
                            </Label>
                            <Input
                                id="harga"
                                v-model.number="editForm.harga"
                                type="number"
                                placeholder="Masukkan harga"
                                step="0.01"
                                min="0"
                                class="font-mono"
                            />
                            <p v-if="editForm.harga" class="text-xs text-muted-foreground">
                                Rp {{ editForm.harga.toLocaleString('id-ID') }}
                            </p>
                        </div>

                        <!-- Note (Editable) -->
                        <div class="space-y-2">
                            <Label for="note" class="text-sm font-medium">Catatan</Label>
                            <Textarea
                                id="note"
                                v-model="editForm.note"
                                placeholder="Tambahkan catatan (opsional)"
                                rows="3"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    @click="closeEditDialog"
                    :disabled="isSaving"
                >
                    Batal
                </Button>
                <Button
                    type="button"
                    @click="savePriceList"
                    :disabled="isSaving"
                >
                    <span v-if="isSaving">Menyimpan...</span>
                    <span v-else>Simpan</span>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- HISTORY DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isHistoryDialogOpen" @update:open="isHistoryDialogOpen = $event">
        <DialogContent class="sm:max-w-[700px]">
            <DialogHeader>
                <DialogTitle>Price List History</DialogTitle>
                <DialogDescription>
                    Riwayat perubahan harga untuk item ini
                </DialogDescription>
            </DialogHeader>

            <div v-if="historyItem" class="space-y-4 py-4">
                <!-- Item Info -->
                <div class="rounded-lg border p-3 bg-muted/50">
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">{{ historyItem.nama_item }}</span>
                        <span class="text-xs text-muted-foreground">{{ historyItem.kode_item || '-' }}</span>
                    </div>
                </div>

                <!-- History Table -->
                <div class="border rounded-lg overflow-hidden">
                    <div class="overflow-auto max-h-[400px]">
                        <table class="w-full">
                            <thead class="bg-muted sticky top-0">
                                <tr>
                                    <th class="text-left p-3 text-sm font-medium">Tanggal</th>
                                    <th class="text-left p-3 text-sm font-medium">Harga</th>
                                    <th class="text-left p-3 text-sm font-medium">Catatan</th>
                                    <th class="text-left p-3 text-sm font-medium">Dibuat Oleh</th>
                                    <th class="text-left p-3 text-sm font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Loading State -->
                                <tr v-if="loadingHistory">
                                    <td colspan="5" class="p-8 text-center">
                                        <div class="flex items-center justify-center gap-2">
                                            <RefreshCw class="h-4 w-4 animate-spin" />
                                            <span class="text-sm text-muted-foreground">Loading...</span>
                                        </div>
                                    </td>
                                </tr>

                                <!-- Empty State -->
                                <tr v-else-if="historyData.length === 0">
                                    <td colspan="5" class="p-8 text-center text-sm text-muted-foreground">
                                        Tidak ada history
                                    </td>
                                </tr>

                                <!-- Data Rows -->
                                <tr 
                                    v-else
                                    v-for="(history, index) in historyData" 
                                    :key="history.id"
                                    class="border-t hover:bg-muted/50"
                                >
                                    <td class="p-3 text-sm">
                                        <div class="font-medium">{{ new Date(history.createdAt).toLocaleDateString('id-ID') }}</div>
                                        <div class="text-xs text-muted-foreground">
                                            {{ new Date(history.createdAt).toLocaleTimeString('id-ID') }}
                                        </div>
                                    </td>
                                    <td class="p-3 text-sm font-semibold">
                                        Rp {{ history.harga.toLocaleString('id-ID') }}
                                    </td>
                                    <td class="p-3 text-sm text-muted-foreground">
                                        {{ history.note || '-' }}
                                    </td>
                                    <td class="p-3 text-sm">
                                        <div class="font-medium">{{ history.price_ctr?.name || '-' }}</div>
                                        <div class="text-xs text-muted-foreground">{{ history.price_ctr?.username || '-' }}</div>
                                    </td>
                                    <td class="p-3">
                                        <Badge :variant="history.is_active ? 'default' : 'secondary'" class="text-xs">
                                            {{ history.is_active ? 'Aktif' : 'Nonaktif' }}
                                        </Badge>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    @click="closeHistoryDialog"
                >
                    Tutup
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- BULK EDIT DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isBulkEditDialogOpen" @update:open="isBulkEditDialogOpen = $event">
        <DialogContent class="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Edit Harga Massal</DialogTitle>
                <DialogDescription>
                    Pilih item yang ingin diupdate harga dan catatannya
                </DialogDescription>
            </DialogHeader>

            <div class="py-4 space-y-4">
                <!-- Price Input Section -->
                <div class="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div class="space-y-2">
                        <Label for="bulk-harga" class="text-sm font-medium">
                            Harga Baru <span class="text-red-500">*</span>
                        </Label>
                        <Input
                            id="bulk-harga"
                            v-model.number="bulkEditForm.harga"
                            type="number"
                            placeholder="Masukkan harga baru"
                            step="0.01"
                            min="0"
                            class="font-mono"
                        />
                        <p v-if="bulkEditForm.harga" class="text-xs text-muted-foreground">
                            Rp {{ bulkEditForm.harga.toLocaleString('id-ID') }}
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="bulk-note" class="text-sm font-medium">Catatan (Opsional)</Label>
                        <Textarea
                            id="bulk-note"
                            v-model="bulkEditForm.note"
                            placeholder="Catatan tambahan (opsional)"
                            rows="2"
                        />
                    </div>
                </div>

                <!-- Item Selection Section -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <Label class="text-sm font-medium shrink-0">
                            Pilih Item ({{ selectedItemsForBulk.length }} dipilih)
                        </Label>
                        <div class="relative flex-1 max-w-sm">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                v-model="bulkSearchQuery" 
                                placeholder="Cari item..." 
                                class="pl-9 pr-8 h-9"
                            />
                            <Button 
                                v-if="bulkSearchQuery" 
                                @click="bulkSearchQuery = ''" 
                                size="icon" 
                                variant="ghost"
                                class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                            >
                                <X class="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    
                    <div class="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                        <table class="w-full">
                            <thead class="bg-muted sticky top-0">
                                <tr>
                                    <th class="w-12 p-3">
                                        <input 
                                            type="checkbox" 
                                            :checked="isAllFilteredItemsSelected"
                                            @change="toggleAllFilteredItems"
                                            class="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                            title="Select All"
                                        />
                                    </th>
                                    <th class="text-left p-3 text-sm font-medium">Gambar</th>
                                    <th class="text-left p-3 text-sm font-medium">Nama Item</th>
                                    <th class="text-left p-3 text-sm font-medium">Jenis</th>
                                    <th class="text-left p-3 text-sm font-medium">Merek</th>
                                    <th class="text-left p-3 text-sm font-medium">Harga Saat Ini</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr 
                                    v-for="item in filteredBulkItems" 
                                    :key="item.id"
                                    @click="toggleItemSelection(item)"
                                    class="border-t hover:bg-muted/50 cursor-pointer"
                                    :class="isItemSelectedForBulk(item) ? 'bg-primary/5' : ''"
                                >
                                    <td class="p-3">
                                        <input 
                                            type="checkbox" 
                                            :checked="isItemSelectedForBulk(item)"
                                            @click.stop="toggleItemSelection(item)"
                                            class="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                        />
                                    </td>
                                    <td class="p-3">
                                        <div v-if="item.m_items_images && item.m_items_images.length > 0" class="w-12 h-12 rounded overflow-hidden bg-muted">
                                            <img 
                                                :src="getImageUrl(item.m_items_images[0]?.gambar || '')" 
                                                :alt="item.nama_item"
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div v-else class="w-12 h-12 rounded bg-muted flex items-center justify-center">
                                            <ImageIcon class="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    </td>
                                    <td class="p-3">
                                        <div class="text-sm font-medium">{{ item.nama_item }}</div>
                                        <div class="text-xs text-muted-foreground">{{ item.kode_item || '-' }}</div>
                                    </td>
                                    <td class="p-3 text-sm">{{ item.m_group_jeni?.nama_jenis || '-' }}</td>
                                    <td class="p-3 text-sm">{{ item.m_group_merek?.nama_merek || '-' }}</td>
                                    <td class="p-3 text-sm font-semibold">
                                        <template v-if="item.m_items_pricelists?.find((p: PriceListItem) => p.is_active === true)">
                                            Rp {{ (item.m_items_pricelists.find((p: PriceListItem) => p.is_active === true)?.harga || 0).toLocaleString('id-ID') }}
                                        </template>
                                        <template v-else>
                                            <span class="text-muted-foreground">-</span>
                                        </template>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    @click="closeBulkEditDialog"
                    :disabled="isBulkSaving"
                >
                    Batal
                </Button>
                <Button
                    type="button"
                    @click="saveBulkEdit"
                    :disabled="isBulkSaving || selectedItemsForBulk.length === 0"
                >
                    <RefreshCw v-if="isBulkSaving" class="h-4 w-4 mr-2 animate-spin" />
                    Update {{ selectedItemsForBulk.length }} Item
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- IMAGE PREVIEW DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="showImagePreview" @update:open="showImagePreview = $event">
        <DialogContent class="sm:max-w-[900px] p-0 [&>button]:text-white [&>button]:hover:bg-white/20">
            <div class="relative bg-black">
                <!-- Main Image -->
                <div class="relative aspect-video w-full flex items-center justify-center">
                    <img 
                        v-if="previewImages[previewImageIndex]"
                        :src="previewImages[previewImageIndex]" 
                        alt="Preview"
                        class="max-w-full max-h-[80vh] object-contain"
                    />

                    <!-- Navigation Controls -->
                    <template v-if="previewImages.length > 1">
                        <button
                            @click="prevPreviewImage"
                            class="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors backdrop-blur-sm"
                        >
                            <ChevronLeft class="h-6 w-6" />
                        </button>
                        <button
                            @click="nextPreviewImage"
                            class="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors backdrop-blur-sm"
                        >
                            <ChevronRight class="h-6 w-6" />
                        </button>

                        <!-- Image Counter -->
                        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full">
                            {{ previewImageIndex + 1 }} / {{ previewImages.length }}
                        </div>
                    </template>
                </div>

                <!-- Thumbnails -->
                <div v-if="previewImages.length > 1" class="flex gap-2 p-4 overflow-x-auto bg-black/50">
                    <button
                        v-for="(img, index) in previewImages"
                        :key="index"
                        @click="previewImageIndex = index"
                        :class="[
                            'shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                            previewImageIndex === index 
                                ? 'border-primary scale-110' 
                                : 'border-transparent opacity-50 hover:opacity-100'
                        ]"
                    >
                        <img :src="img" alt="" class="w-full h-full object-cover" />
                    </button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
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

