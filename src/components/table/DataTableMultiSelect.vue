<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface Column<T> {
    key?: string
    field?: string
    label?: string
    headerName?: string
    width?: string
    flex?: number
    sortable?: boolean
    filterable?: boolean
    render?: (item: T, index: number) => any
    renderHtml?: (item: T, index: number) => string
}

interface Props {
    data: T[]
    columns: Column<T>[]
    loading?: boolean
    loadingMore?: boolean
    maxHeight?: string
    showIndex?: boolean
    hasMore?: boolean
    selectedItems?: T[]
    singleSelect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    loadingMore: false,
    maxHeight: '400px',
    showIndex: true,
    hasMore: true,
    selectedItems: () => [],
    singleSelect: false,
})

const emit = defineEmits<{
    loadMore: []
    selectionChange: [items: T[]]
}>()

const tableContainer = ref<HTMLDivElement>()

// Multi-selection state
const selectedRows = ref<Set<string>>(new Set())

// Initialize selected items from props
const initializeSelection = () => {
    selectedRows.value.clear()
    props.selectedItems.forEach(item => {
        const rowId = item.id || JSON.stringify(item)
        selectedRows.value.add(rowId)
    })
}

// Watch for prop changes
onMounted(() => {
    initializeSelection()
})

// Column filters
const columnFilters = ref<Record<string, string>>({})

// Initialize filters for filterable columns
props.columns.forEach(col => {
    const key = col.key || col.field
    if (col.filterable && key) {
        columnFilters.value[key] = ''
    }
})

// Sorting state
const sortColumn = ref<string | null>(null)
const sortOrder = ref<'asc' | 'desc' | null>(null)

// Toggle sort
const toggleSort = (columnKey: string) => {
    if (sortColumn.value === columnKey) {
        if (sortOrder.value === 'asc') {
            sortOrder.value = 'desc'
        } else if (sortOrder.value === 'desc') {
            sortColumn.value = null
            sortOrder.value = null
        } else {
            sortOrder.value = 'asc'
        }
    } else {
        sortColumn.value = columnKey
        sortOrder.value = 'asc'
    }
}

// Get sort icon
const getSortIcon = (columnKey: string) => {
    if (sortColumn.value !== columnKey) return ArrowUpDown
    return sortOrder.value === 'asc' ? ArrowUp : ArrowDown
}

// Get column key
const getColumnKey = (col: Column<T>): string => {
    return col.key || col.field || ''
}

// Get column header
const getColumnHeader = (col: Column<T>): string => {
    return col.label || col.headerName || ''
}

// Processed data with filtering and sorting
const processedData = computed(() => {
    let result = props.data.map((item, index) => ({
        ...item,
        _originalIndex: index
    }))

    // Apply column filters
    result = result.filter(item => {
        return props.columns.every(col => {
            const key = getColumnKey(col)
            if (!col.filterable || !key) return true
            const filterValue = columnFilters.value[key]
            if (!filterValue) return true
            
            const itemValue = String(item[key] || '').toLowerCase()
            return itemValue.includes(filterValue.toLowerCase())
        })
    })

    // Apply sorting
    if (sortColumn.value && sortOrder.value) {
        result = [...result].sort((a, b) => {
            let comparison = 0
            
            if (sortColumn.value === 'index') {
                comparison = a._originalIndex - b._originalIndex
            } else {
                const aVal = a[sortColumn.value!]
                const bVal = b[sortColumn.value!]
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    comparison = aVal - bVal
                } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                    comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1
                } else {
                    const aStr = String(aVal || '').toLowerCase()
                    const bStr = String(bVal || '').toLowerCase()
                    comparison = aStr.localeCompare(bStr)
                }
            }
            
            return sortOrder.value === 'asc' ? comparison : -comparison
        })
    }

    return result
})

// Handle checkbox selection
const toggleRowSelection = (item: T) => {
    // Hilangkan properti internal _originalIndex sebelum stringify
    const { _originalIndex, ...cleanItem } = item as any
    const rowId = item.id || JSON.stringify(cleanItem)
    
    if (selectedRows.value.has(rowId)) {
        selectedRows.value.delete(rowId)
    } else {
        if (props.singleSelect) {
            selectedRows.value.clear()
        }
        selectedRows.value.add(rowId)
    }
    
    // Emit selected items
    const selected = props.data.filter(dataItem => {
        const dataRowId = dataItem.id || JSON.stringify(dataItem)
        return selectedRows.value.has(dataRowId)
    })
    
    emit('selectionChange', selected)
}

// Check if row is selected
const isRowSelected = (item: T): boolean => {
    // Hilangkan properti internal _originalIndex sebelum stringify
    const { _originalIndex, ...cleanItem } = item as any
    const rowId = item.id || JSON.stringify(cleanItem)
    return selectedRows.value.has(rowId)
}

// Select/deselect all visible rows
const toggleAllSelection = () => {
    if (props.singleSelect) return

    const allSelected = processedData.value.every(item => isRowSelected(item))
    
    if (allSelected) {
        // Deselect all visible
        processedData.value.forEach(item => {
            const rowId = item.id || JSON.stringify(item)
            selectedRows.value.delete(rowId)
        })
    } else {
        // Select all visible
        processedData.value.forEach(item => {
            const rowId = item.id || JSON.stringify(item)
            selectedRows.value.add(rowId)
        })
    }
    
    // Emit selected items
    const selected = props.data.filter(dataItem => {
        const dataRowId = dataItem.id || JSON.stringify(dataItem)
        return selectedRows.value.has(dataRowId)
    })
    
    emit('selectionChange', selected)
}

// Check if all visible rows are selected
const allVisibleSelected = computed(() => {
    if (processedData.value.length === 0) return false
    return processedData.value.every(item => isRowSelected(item))
})

// Check if some (but not all) visible rows are selected
const someVisibleSelected = computed(() => {
    if (processedData.value.length === 0) return false
    const selectedCount = processedData.value.filter(item => isRowSelected(item)).length
    return selectedCount > 0 && selectedCount < processedData.value.length
})

// Infinite scroll handler
const handleScroll = () => {
    if (!tableContainer.value || props.loadingMore || !props.hasMore) return
    
    const element = tableContainer.value
    const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    
    // Trigger load more when within 100px of bottom
    if (scrollBottom < 100) {
        emit('loadMore')
    }
}

// Header checkbox ref
const headerCheckboxRef = ref<HTMLInputElement | null>(null)

// Update header checkbox indeterminate state
const updateHeaderCheckbox = () => {
    if (headerCheckboxRef.value) {
        headerCheckboxRef.value.indeterminate = someVisibleSelected.value
    }
}

// Watch for selection changes to update indeterminate state
watch([selectedRows, () => processedData.value.length], () => {
    updateHeaderCheckbox()
}, { deep: true })

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll)
    }
    updateHeaderCheckbox()
})

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll)
    }
})

// Expose methods
defineExpose({
    clearSelection: () => {
        selectedRows.value.clear()
        emit('selectionChange', [])
    },
    getSelectedItems: () => {
        return props.data.filter(item => {
            const rowId = item.id || JSON.stringify(item)
            return selectedRows.value.has(rowId)
        })
    }
})
</script>

<template>
    <div class="w-full h-full flex flex-col">
        <!-- Column Filters -->
        <div v-if="columns.some(col => col.filterable)" class="mb-4 grid gap-2 shrink-0"
            :class="`grid-cols-${columns.filter(col => col.filterable).length}`">
            <template v-for="col in columns" :key="getColumnKey(col)">
                <div v-if="col.filterable">
                    <div class="relative">
                        <Input
                            v-model="columnFilters[getColumnKey(col)]"
                            :placeholder="`Filter ${getColumnHeader(col)}...`"
                            class="h-8 pr-8"
                        />
                        <button
                            v-if="columnFilters[getColumnKey(col)]"
                            type="button"
                            class="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                            @click="columnFilters[getColumnKey(col)] = ''"
                        >
                            <X class="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </template>
        </div>

        <!-- Table Container -->
        <div 
            ref="tableContainer"
            class="border rounded-lg overflow-auto h-full"
        >
            <Table>
                <TableHeader class="sticky top-0 bg-background z-10">
                    <TableRow>
                        <!-- Checkbox Column -->
                        <TableHead v-if="!singleSelect" class="w-12">
                            <input
                                ref="headerCheckboxRef"
                                type="checkbox"
                                :checked="allVisibleSelected"
                                @change="toggleAllSelection"
                                class="rounded cursor-pointer"
                            />
                        </TableHead>

                        <!-- Index Column -->
                        <TableHead v-if="showIndex" class="w-16">
                            <div class="flex items-center gap-1">
                                <span>No</span>
                                <button 
                                    @click="toggleSort('index')"
                                    class="p-1 hover:bg-muted rounded"
                                >
                                    <component :is="getSortIcon('index')" class="h-4 w-4" />
                                </button>
                            </div>
                        </TableHead>

                        <!-- Data Columns -->
                        <TableHead
                            v-for="col in columns"
                            :key="getColumnKey(col)"
                            :style="{ 
                                width: col.width,
                                minWidth: col.width,
                                flex: col.flex
                            }"
                        >
                            <div class="flex items-center gap-1">
                                <span>{{ getColumnHeader(col) }}</span>
                                <button 
                                    v-if="col.sortable"
                                    @click="toggleSort(getColumnKey(col))"
                                    class="p-1 hover:bg-muted rounded"
                                >
                                    <component :is="getSortIcon(getColumnKey(col))" class="h-4 w-4" />
                                </button>
                            </div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <!-- Loading State -->
                    <TableRow v-if="loading">
                        <TableCell :colspan="columns.length + (showIndex ? (singleSelect ? 1 : 2) : (singleSelect ? 0 : 1))">
                            <div class="flex flex-col gap-2 py-4">
                                <Skeleton class="h-8 w-full" v-for="i in 5" :key="i" />
                            </div>
                        </TableCell>
                    </TableRow>

                    <!-- Empty State -->
                    <TableRow v-else-if="processedData.length === 0">
                        <TableCell :colspan="columns.length + (showIndex ? (singleSelect ? 1 : 2) : (singleSelect ? 0 : 1))" class="text-center py-16 text-muted-foreground">
                            <div class="flex flex-col items-center justify-center gap-2">
                                <p class="text-sm">Tidak ada data</p>
                            </div>
                        </TableCell>
                    </TableRow>

                    <!-- Data Rows -->
                    <TableRow 
                        v-else
                        v-for="(item, index) in processedData" 
                        :key="item.id || index"
                        class="cursor-pointer hover:bg-muted/50"
                        :class="{
                            'bg-muted/30': isRowSelected(item) && !singleSelect,
                            'bg-primary/10': isRowSelected(item) && singleSelect,
                        }"
                    >
                        <!-- Checkbox Cell -->
                        <TableCell v-if="!singleSelect" class="w-12">
                            <input
                                type="checkbox"
                                :checked="isRowSelected(item)"
                                @change="toggleRowSelection(item)"
                                @click.stop
                                class="rounded cursor-pointer"
                            />
                        </TableCell>

                        <!-- Index Cell -->
                        <TableCell
                            v-if="showIndex"
                            class="w-16"
                            :class="{ 'bg-primary/10 font-medium': singleSelect && isRowSelected(item) }"
                        >
                            {{ item._originalIndex + 1 }}
                        </TableCell>

                        <!-- Data Cells -->
                        <TableCell
                            v-for="col in columns"
                            :key="getColumnKey(col)"
                            :style="{ 
                                width: col.width,
                                minWidth: col.width,
                                flex: col.flex
                            }"
                            :class="{ 'bg-primary/10': singleSelect && isRowSelected(item) }"
                            @click="toggleRowSelection(item)"
                        >
                            <div
                                class="flex items-center gap-2"
                                :class="{ 'font-medium': singleSelect && isRowSelected(item) }"
                            >
                                <Badge
                                    v-if="singleSelect && isRowSelected(item) && col === columns[0]"
                                    variant="default"
                                    class="shrink-0"
                                >
                                    Dipilih
                                </Badge>

                                <span v-if="col.render">
                                    {{ col.render(item, index) }}
                                </span>
                                <span v-else-if="col.renderHtml" v-html="col.renderHtml(item, index)"></span>
                                <span v-else>
                                    {{ item[getColumnKey(col)] }}
                                </span>
                            </div>
                        </TableCell>
                    </TableRow>

                    <!-- Loading More Indicator -->
                    <TableRow v-if="loadingMore">
                        <TableCell :colspan="columns.length + (showIndex ? (singleSelect ? 1 : 2) : (singleSelect ? 0 : 1))" class="text-center py-4">
                            <div class="flex items-center justify-center gap-2 text-muted-foreground">
                                <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                <span>Memuat lebih banyak...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <!-- Selection Info -->
        <div v-if="selectedRows.size > 0" class="mt-2 text-sm text-muted-foreground">
            {{ selectedRows.size }} item dipilih<span v-if="singleSelect">, klik lagi baris aktif untuk batal pilih</span>
        </div>
    </div>
</template>

<style scoped>
/* Indeterminate checkbox style */
input[type="checkbox"]:indeterminate {
    background-color: hsl(var(--primary));
    border-color: hsl(var(--primary));
    position: relative;
}

input[type="checkbox"]:indeterminate::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8px;
    height: 2px;
    background: white;
    transform: translate(-50%, -50%);
}
</style>
