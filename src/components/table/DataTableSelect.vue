<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed } from 'vue'
import { Search, X } from 'lucide-vue-next'
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
    key: string
    label: string
    width?: string
    filterable?: boolean
    render?: (item: T, index: number) => any
    renderHtml?: (item: T, index: number) => string
}

interface Props {
    data: T[]
    columns: Column<T>[]
    loading?: boolean
    loadingMore?: boolean
    hasMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    loadingMore: false,
    hasMore: true
})

const emit = defineEmits<{
    loadMore: []
    rowSelect: [item: T, index: number]
}>()

// Column filters
const columnFilters = ref<Record<string, string>>({})

// Initialize filters for filterable columns
props.columns.forEach(col => {
    if (col.filterable) {
        columnFilters.value[col.key] = ''
    }
})

// Filtered data based on column filters
const filteredData = computed(() => {
    let result = props.data

    Object.keys(columnFilters.value).forEach(key => {
        const filterValue = columnFilters.value[key]?.toLowerCase().trim()
        if (filterValue) {
            result = result.filter(item => {
                const cellValue = String(item[key] || '').toLowerCase()
                return cellValue.includes(filterValue)
            })
        }
    })

    return result
})

// Row selection
const selectRow = (item: T, index: number) => {
    emit('rowSelect', item, index)
}

// Scroll handler for infinite scroll
const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight

    // Load more when scrolled to bottom
    if (scrollTop + clientHeight >= scrollHeight - 50 && !props.loadingMore && props.hasMore) {
        emit('loadMore')
    }
}
</script>

<template>
    <div class="w-full h-full flex flex-col border rounded-md overflow-hidden">
        <!-- Scrollable Container -->
        <div class="flex-1 overflow-auto" @scroll="handleScroll">
            <table class="w-full">
                <thead class="sticky top-0 z-10 bg-background border-b">
                    <!-- Header Row -->
                    <tr class="border-b">
                        <th class="h-10 px-2 text-center align-middle font-medium text-muted-foreground w-[60px]">
                            No
                        </th>
                        <th v-for="col in columns" :key="col.key"
                            class="h-10 px-2 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
                            {{ col.label }}
                        </th>
                    </tr>

                    <!-- Filter Row -->
                    <tr v-if="columns.some(c => c.filterable)" class="bg-muted/50 border-b">
                        <th class="p-2"></th>
                        <th v-for="col in columns" :key="`filter-${col.key}`" class="p-2">
                            <div v-if="col.filterable" class="relative">
                                <Search
                                    class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <input v-model="columnFilters[col.key]" type="text" placeholder="Search..."
                                    class="w-full h-8 pl-7 pr-7 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                                <button v-if="columnFilters[col.key]" type="button"
                                    class="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                                    @click="columnFilters[col.key] = ''">
                                    <X class="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </th>
                    </tr>
                </thead>

                <TableBody>
                    <!-- Loading State -->
                    <template v-if="loading">
                        <TableRow v-for="i in 5" :key="`skeleton-${i}`">
                            <TableCell class="text-center w-[60px]">
                                <Skeleton class="h-4 w-8 mx-auto" />
                            </TableCell>
                            <TableCell v-for="col in columns" :key="`skeleton-${col.key}`">
                                <Skeleton class="h-4 w-full" />
                            </TableCell>
                        </TableRow>
                    </template>

                    <!-- Empty State -->
                    <TableRow v-else-if="filteredData.length === 0">
                        <TableCell :colspan="columns.length + 1" class="text-center py-8 text-muted-foreground">
                            {{columnFilters && Object.values(columnFilters).some(v => v) ? 'No data found' : 'No data available' }}
                        </TableCell>
                    </TableRow>

                    <!-- Data Rows -->
                    <template v-else>
                        <TableRow v-for="(item, index) in filteredData" :key="item.id || index"
                            class="cursor-pointer hover:bg-muted/50 transition-colors" @click="selectRow(item, index)">
                            <TableCell class="text-center font-medium w-[60px]">
                                {{ index + 1 }}
                            </TableCell>
                            <TableCell v-for="col in columns" :key="col.key" class="whitespace-nowrap">
                                <template v-if="col.renderHtml">
                                    <span v-html="col.renderHtml(item, index)"></span>
                                </template>
                                <template v-else-if="col.render">
                                    {{ col.render(item, index) }}
                                </template>
                                <template v-else>
                                    {{ item[col.key] }}
                                </template>
                            </TableCell>
                        </TableRow>
                    </template>

                    <!-- Loading More State -->
                    <template v-if="loadingMore">
                        <TableRow v-for="i in 3" :key="`skeleton-more-${i}`">
                            <TableCell class="text-center w-[60px]">
                                <Skeleton class="h-4 w-8 mx-auto" />
                            </TableCell>
                            <TableCell v-for="col in columns" :key="`skeleton-more-${col.key}`">
                                <Skeleton class="h-4 w-full" />
                            </TableCell>
                        </TableRow>
                    </template>
                </TableBody>
            </table>
        </div>

        <!-- Load More Info -->
        <div v-if="!loading && hasMore && !loadingMore"
            class="text-center text-xs text-muted-foreground py-2 border-t bg-muted/20">
            Scroll down to load more...
        </div>
    </div>
</template>

<style scoped>
/* Ensure proper text alignment */
:deep(td) {
    text-align: left !important;
}

:deep(th) {
    text-align: left !important;
}

:deep(th:first-child),
:deep(td:first-child) {
    text-align: center !important;
}
</style>
