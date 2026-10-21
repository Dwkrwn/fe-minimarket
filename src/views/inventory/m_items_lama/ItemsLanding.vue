<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus, Info } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, SendApprovalButton } from '@/components/button'
import { FieldX } from '@/components/field'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass, renderApprovalStatusBadge } from "@/lib/approvalStatus";
import { getItemsList, deleteItems, type ItemsItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<ItemsItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false)
const itemToSendApproval = ref<ItemsItem | null>(null)
const approvalCatatan = ref('')
const isSendingApproval = ref(false)

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList()
    return approvalList.find((approval: any) =>
        approval.path === '/inventory/m_items' &&
        approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
    )
})

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<ItemsItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const filterApprovalStatus = ref<'IN APPROVAL' | 'REVISI' | 'APPROVED' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { key: 'kode_item', label: 'Kode Item', filterable: true, width: '100px', wrapText: true },
    { key: 'nama_item', label: 'Nama Item', filterable: true, width: '150px', wrapText: true },
    { key: 'nama_singkat', label: 'Nama Singkat', filterable: true, width: '150px', wrapText: true },
    { key: 'nama_merk', label: 'Merk', filterable: true, width: '150px', wrapText: true },
    { key: 'tipe_barang', label: 'Tipe Barang', filterable: true, width: '150px', wrapText: true },
    {
        key: 'group_jenis',
        label: 'Group Jenis',
        filterable: true,
        width: '150px',
        wrapText: true,
        renderHtml: (item: ItemsItem) => {
            // Support both: group_jenis (string) or m_group_jeni/as_group_jenis (relation object)
            return item.group_jenis || (item as any).m_group_jeni?.nama_jenis || item.as_group_jenis?.nama_jenis || '-'
        }
    },
    {
        key: 'satuan',
        label: 'Satuan',
        filterable: true,
        width: '120px',
        wrapText: true,
        renderHtml: (item: ItemsItem) => {
            return item.uom?.value1 || '-'
        }
    },
    {
        key: 'is_active',
        label: 'Status',
        filterable: false,
        width: '30px',
        renderHtml: (item: ItemsItem) => {
            const isActive = item.is_active
            const text = isActive ? 'Aktif' : 'Nonaktif'
            const colorClass = isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            return `<span class="font-bold ${colorClass}">${text}</span>`
        }
    },
    {
        key: 'status',
        label: 'Status Approval',
        filterable: false,
        width: '100px',
        wrapText: true,
        renderHtml: (item: ItemsItem) => {
            return renderApprovalStatusBadge(item.status || 'DRAFT');
        }
    },
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter m_items data berdasarkan status and approval status (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: ItemsItem) => {
        const matchStatus = filterStatus.value === null
            ? true
            : filterStatus.value === 'Aktif'
                ? item.is_active === true
                : item.is_active === false

        const matchApprovalStatus = filterApprovalStatus.value === null
            ? true
            : item.status?.toUpperCase() === filterApprovalStatus.value

        return matchStatus && matchApprovalStatus
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Items "${itemToDelete.value.nama_item}" (${itemToDelete.value.kode_item})? Tindakan ini tidak dapat dibatalkan.`
})

/** Check if item can be edited based on approval status */
const canEdit = (item: ItemsItem | null) => {
    if (!item) return false
    const status = (item.status || '').toUpperCase()
    // Cannot edit if status is IN APPROVAL only
    return status !== 'IN APPROVAL'
}

/** Check if item can be deleted based on approval status */
const canDeleteItem = (item: ItemsItem | null) => {
    if (!item) return false
    const status = (item.status || '').toUpperCase()
    // Cannot delete if status is IN APPROVAL, APPROVED, or REVISI
    return status !== 'IN APPROVAL' && status !== 'APPROVED' && status !== 'REVISI'
}

/** Check if selected item can be edited */
const canEditSelected = computed(() => canEdit(selectedItem.value))

/** Check if selected item can be deleted */
const canDeleteSelected = computed(() => canDeleteItem(selectedItem.value))

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

    // Check if item can be deleted based on status
    if (!canDeleteItem(item)) {
        const status = (item.status || '').toUpperCase()
        toast.error('Tidak dapat menghapus item', {
            description: `Item dengan status ${status} tidak dapat dihapus`
        })
        return
    }

    itemToDelete.value = item
    isDeleteDialogOpen.value = true
}

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
    if (!itemToDelete.value || !itemToDelete.value.id) return

    isDeleting.value = true
    try {
        const response = await deleteItems(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: ItemsItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Items "${itemToDelete.value.nama_item}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Items', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Items', {
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
// SEND APPROVAL FUNCTIONS
// ============================================================================
/** Open send approval dialog */
const openSendApprovalDialog = (item?: ItemsItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    itemToSendApproval.value = selectedItem.value
    approvalCatatan.value = ''
    isSendApprovalDialogOpen.value = true
}

/** Confirm send approval - hit API PUT dengan status IN APPROVAL */
const confirmSendApproval = async () => {
    if (!itemToSendApproval.value || !itemToSendApproval.value.id) return

    isSendingApproval.value = true
    try {
        // Get approval data from localStorage
        const approvalList = authStore.getApprovalList()
        const currentApproval = approvalList.find((approval: any) =>
            approval.path === '/inventory/m_items' &&
            approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
        )

        if (!currentApproval) {
            toast.error('Gagal mengirim approval', {
                description: 'Anda tidak memiliki hak untuk mengajukan approval'
            })
            isSendingApproval.value = false
            return
        }

        // Validate approval data
        if (currentApproval.level === null || currentApproval.level === undefined || !currentApproval.sender_id) {
            toast.error('Data approval tidak lengkap', {
                description: 'Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.',
                duration: 6000
            })
            isSendingApproval.value = false
            return
        }

        // Prepare payload
        const payload = {
            approval_level: currentApproval.level,
            sender_id: currentApproval.sender_id,
            m_items_id: itemToSendApproval.value.id,
            approval_message: approvalCatatan.value.trim() || null
        }

        // Call API POST /dynamic/m_items_notifikasi
        const response = await fetch(
            `${API_BASE_URL}/dynamic/m_items_notifikasi`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                },
                body: JSON.stringify(payload)
            }
        )

        const result = await response.json()

        if (result.status === 'success') {
            // Update item status in list
            const itemIndex = menuData.value.findIndex((m: ItemsItem) => m.id === itemToSendApproval.value!.id)
            if (itemIndex !== -1 && menuData.value[itemIndex]) {
                menuData.value[itemIndex].status = 'IN APPROVAL'
            }

            toast.success('Approval berhasil dikirim', {
                description: `Item "${itemToSendApproval.value.nama_item}" telah dikirim untuk approval`
            })

            // Close dialog and clear state
            isSendApprovalDialogOpen.value = false
            approvalCatatan.value = ''
            itemToSendApproval.value = null
            deselectItem()
        } else {
            toast.error('Gagal mengirim approval', {
                description: result.message || 'Terjadi kesalahan saat mengirim approval'
            })
        }
    } catch (error) {
        toast.error('Gagal mengirim approval', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isSendingApproval.value = false
    }
}

const cancelSendApproval = () => {
    isSendApprovalDialogOpen.value = false
    approvalCatatan.value = ''
    itemToSendApproval.value = null
}

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export m_items data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View Items item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/inventory/m_items/view/${selectedItem.value.id}`)
}

/** Edit Items item */
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

    // Check if item can be edited based on status
    if (!canEdit(selectedItemData)) {
        toast.error('Tidak dapat mengedit item', {
            description: 'Item dengan status IN APPROVAL tidak dapat diedit'
        })
        return
    }

    // Navigate to edit form
    router.push(`/inventory/m_items/form/${selectedItemData.id}`)
}

/** Copy Items item - duplicate data tanpa ID untuk create new */
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
        path: '/inventory/m_items/form',
        query: {
            action: 'copy',
            source: selectedItemData.id
        }
    })

    toast.success(`Menyalin data "${selectedItemData.name}"`, {
        description: 'Silakan edit dan simpan sebagai Items baru'
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

    router.push('/inventory/m_items/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_items data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Call API with search parameters and include relations
        const response = await getItemsList(
            page,
            pageSize.value,
            'createdAt',
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'kode_item,nama_item,nama_singkat,nama_merk,tipe_barang,group_jenis,group_merek' : undefined,
            'm_group_jenis,m_group_merek,m_group_tipe,m_group_ukuran,m_group_batch,m_general'
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
        toast.error('Gagal memuat data Items', {
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
    filterStatus.value = null
    filterApprovalStatus.value = null
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
                        <h1 class="text-lg font-bold">Master Items</h1>
                        <p class="text-xs text-muted-foreground">Kelola Items aplikasi</p>
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

                <!-- Filter Status Approval Buttons -->
                <div class="flex items-center gap-2 overflow-x-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="filterApprovalStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                        @click="filterApprovalStatus = null"
                    >
                        ALL
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('IN APPROVAL', filterApprovalStatus === 'IN APPROVAL')"
                        @click="filterApprovalStatus = filterApprovalStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'"
                    >
                        In Approval
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('REVISI', filterApprovalStatus === 'REVISI')"
                        @click="filterApprovalStatus = filterApprovalStatus === 'REVISI' ? null : 'REVISI'"
                    >
                        Revisi
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('APPROVED', filterApprovalStatus === 'APPROVED')"
                        @click="filterApprovalStatus = filterApprovalStatus === 'APPROVED' ? null : 'APPROVED'"
                    >
                        Approved
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
                        <div class="flex items-center gap-2 justify-between mb-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold truncate">{{ item.nama_item }}</div>
                                <div class="text-xs text-muted-foreground truncate">{{ item.kode_item || '-' }}</div>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <Badge
                                    :variant="item.is_active ? 'default' : 'secondary'"
                                    class="text-xs"
                                >
                                    {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
                                </Badge>
                                <Badge
                                    v-if="item.status"
                                    variant="outline"
                                    class="text-xs border-0"
                                    :class="getApprovalStatusBadgeClass(item.status)"
                                >
                                    {{ item.status?.toUpperCase() }}
                                </Badge>
                            </div>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.nama_singkat">
                                <span class="font-medium">Nama Singkat:</span> {{ item.nama_singkat }}
                            </div>
                            <div v-if="item.nama_merk">
                                <span class="font-medium">Merk:</span> {{ item.nama_merk }}
                            </div>
                            <div v-if="item.tipe_barang">
                                <span class="font-medium">Tipe:</span> {{ item.tipe_barang }}
                            </div>
                            <div v-if="item.group_jenis || (item as any).m_group_jeni?.nama_jenis || item.as_group_jenis?.nama_jenis">
                                <span class="font-medium">Group Jenis:</span> {{ item.group_jenis || (item as any).m_group_jeni?.nama_jenis || item.as_group_jenis?.nama_jenis || '-' }}
                            </div>
                            <div v-if="item.group_merek || (item as any).m_group_merek?.nama_merek || item.as_group_merek?.nama_merek">
                                <span class="font-medium">Merek:</span> {{ item.group_merek || (item as any).m_group_merek?.nama_merek || item.as_group_merek?.nama_merek || '-' }}
                            </div>
                            <div v-if="item.uom?.value1">
                                <span class="font-medium">Satuan:</span> {{ item.uom.value1 }}
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
                                :disabled="!canDeleteItem(item)"
                                @click.stop="() => { selectItem(item, 0); deleteSelected() }"
                            />
                            <EditButton
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost"
                                size="sm"
                                class="h-7 w-7"
                                :disabled="!canEdit(item)"
                                @click.stop="editItem(item)"
                            />
                            <CopyButton
                                v-permission="{ menuId: currentMenuId, action: 'create' }"
                                variant="ghost"
                                size="sm"
                                class="h-7 w-7"
                                @click.stop="copyItem(item)"
                            />
                            <SendApprovalButton
                                path="/inventory/m_items"
                                :status="item.status"
                                variant="ghost"
                                size="sm"
                                :showLabel="false"
                                class="h-7 w-7"
                                @click="openSendApprovalDialog(item)"
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
                <h1 class="text-2xl font-bold">Master Items</h1>
                <p class="text-sm text-muted-foreground">Kelola Items aplikasi</p>
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

            <!-- Filter Status Approval Row -->
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium">Status Approval:</span>
                <Button variant="outline" size="sm"
                    :class="filterApprovalStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                    @click="filterApprovalStatus = null">
                    ALL
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('IN APPROVAL', filterApprovalStatus === 'IN APPROVAL')"
                    @click="filterApprovalStatus = filterApprovalStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'">
                    In Approval
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('REVISI', filterApprovalStatus === 'REVISI')"
                    @click="filterApprovalStatus = filterApprovalStatus === 'REVISI' ? null : 'REVISI'">
                    Revisi
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('APPROVED', filterApprovalStatus === 'APPROVED')"
                    @click="filterApprovalStatus = filterApprovalStatus === 'APPROVED' ? null : 'APPROVED'">
                    Approved
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
                    <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" :disabled="!isActive || !canDeleteSelected"
                        @click="deleteSelected" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" :disabled="!isActive || !canEditSelected"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                    <SendApprovalButton
                        path="/inventory/m_items"
                        :status="selectedItem?.status"
                        variant="default"
                        size="default"
                        :showLabel="true"
                        :disabled="!isActive"
                        @click="openSendApprovalDialog()"
                    />
                </div>
            </div>
        </div>

        <!-- TABLE (Desktop) with internal scroll -->
        <div class="rounded-lg border bg-background/50 overflow-x-auto overflow-y-auto relative max-h-[calc(100vh-250px)]">
            <DataTable
                :data="filteredData"
                :columns="columns"
                :loading="loading"
                :loading-more="loadingMore"
                :has-more="hasMoreData"
                :row-select-mode="true"
                @load-more="handleLoadMore"
                @row-select="(item) => selectItem(item, 0)"
                @row-deselect="deselectItem"
            >
                <template #empty>
                    Tidak ada data Items
                </template>
            </DataTable>
        </div>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Items"
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
    <!-- SEND APPROVAL DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isSendApprovalDialogOpen" @update:open="isSendApprovalDialogOpen = $event">
        <DialogContent class="max-w-md">
            <DialogHeader>
                <div class="flex items-center gap-3 mb-2">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
                        <Info class="w-5 h-5 text-blue-600" />
                    </div>
                    <DialogTitle class="text-lg">Kirim Approval</DialogTitle>
                </div>
            </DialogHeader>

            <div class="space-y-4 py-4">
                <!-- ITEM INFO -->
                <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
                    <p class="text-sm font-medium">Item:</p>
                    <p class="text-sm text-muted-foreground">{{ itemToSendApproval.nama_item }}</p>
                </div>

                <!-- SENDER INFO -->
                <div v-if="currentApprovalInfo" class="space-y-3">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium">Pengirim:</p>
                        <p class="text-sm text-muted-foreground">{{ currentApprovalInfo.sender_name }}</p>
                    </div>

                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium">Tipe Approval:</p>
                        <p class="text-sm font-medium text-primary">{{ currentApprovalInfo.tipe_approve }}</p>
                    </div>
                </div>

                <!-- CATATAN APPROVAL -->
                <div class="border-t pt-4">
                    <FieldX
                        id="approval-catatan"
                        type="textarea"
                        v-model="approvalCatatan"
                        label="Catatan Approval"
                        placeholder="Masukkan catatan untuk approval (opsional)"
                        hints="Catatan ini akan dikirim ke penerima approval"
                        :disabled="isSendingApproval"
                        :rows="4"
                    />
                </div>
            </div>

            <DialogFooter class="gap-2">
                <Button
                    variant="outline"
                    @click="cancelSendApproval"
                    :disabled="isSendingApproval"
                >
                    Batal
                </Button>
                <Button
                    variant="default"
                    @click="confirmSendApproval"
                    :disabled="isSendingApproval"
                    class="gap-2"
                >
                    <span v-if="isSendingApproval">Mengirim...</span>
                    <span v-else>Send</span>
                </Button>
            </DialogFooter>
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
