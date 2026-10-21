<script setup lang="ts">
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'
import { X } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Button } from '@/components/ui/button'

interface PickerDateRange {
  from: Date | null
  to: Date | null
}

interface Props {
  params: any
}

const props = defineProps<Props>()

const dateRange = ref<PickerDateRange>({ from: null, to: null })
const pickerRef = ref<any>(null)
const isOpen = ref(false)

// Inject the date filter handler & state from DataTable parent
const onDateFilterChange = inject<(columnKey: string, from: string, to: string) => void>('onDateFilterChange')
const dateRangeFilters = inject<Ref<Record<string, { from: string; to: string }>>>('dateRangeFilters')

if (dateRangeFilters) {
  watch(
    () => dateRangeFilters.value,
    (newVal) => {
      const columnKey = props.params?.column?.getColId?.() || props.params?.colDef?.field || ''
      if (!newVal || !newVal[columnKey]) {
        dateRange.value = { from: null, to: null }
        if (pickerRef.value) {
          pickerRef.value.reset()
        }
      }
    },
    { deep: true }
  )
}

const filterText = computed(() => {
  if (!dateRange.value.from && !dateRange.value.to) return 'Pilih tanggal'

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (dateRange.value.from && dateRange.value.to) {
    return `${formatDate(dateRange.value.from)} - ${formatDate(dateRange.value.to)}`
  } else if (dateRange.value.from) {
    return formatDate(dateRange.value.from)
  } else if (dateRange.value.to) {
    return `≤ ${formatDate(dateRange.value.to)}`
  }

  return 'Pilih tanggal'
})

const dateToString = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const handleDateRangeChange = (range: PickerDateRange) => {
  dateRange.value = range

  const columnKey = props.params?.column?.getColId?.() || props.params?.colDef?.field || ''
  const from = dateToString(range.from)
  const to = dateToString(range.to)

  // Call injected handler from DataTable
  if (onDateFilterChange) {
    onDateFilterChange(columnKey, from, to)
  }

  // Close popover after selection
  if (range.from && range.to) {
    isOpen.value = false
  }
}

const clearFilter = () => {
  dateRange.value = { from: null, to: null }
  if (pickerRef.value) {
    pickerRef.value.reset()
  }

  const columnKey = props.params?.column?.getColId?.() || props.params?.colDef?.field || ''

  if (onDateFilterChange) {
    onDateFilterChange(columnKey, '', '')
  }
}

// AG Grid floating filter interface - required methods
const onParentModelChanged = (parentModel: any) => {
  // We don't need to sync from parent since we manage state directly
}

// Expose AG Grid interface methods
defineExpose({
  onParentModelChanged
})
</script>

<template>
  <div
    class="h-full w-full flex items-center justify-between px-1 gap-1"
    @click.stop
    @mousedown.stop
  >
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="flex-1 h-7 text-xs font-normal justify-start px-2 bg-background border border-input hover:bg-muted/50"
          :class="dateRange.from || dateRange.to ? 'text-foreground' : 'text-muted-foreground'"
          @click.stop
        >
          {{ filterText }}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        class="w-auto max-h-[min(430px,calc(100vh-120px))] overflow-y-auto p-0 border border-border dark:border-slate-700 z-[9999]"
        side="bottom"
        align="start"
        :side-offset="10"
        :avoid-collisions="false"
        position-strategy="fixed"
      >
        <div class="flex flex-col">
          <DateRangePicker
            ref="pickerRef"
            :modelValue="dateRange"
            @update:modelValue="handleDateRangeChange"
            locale="id-ID"
          />
          <div class="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              class="w-full"
              @click.stop="clearFilter"
              :disabled="!dateRange.from && !dateRange.to"
            >
              <X class="h-3 w-3 mr-2" />
              Hapus Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <Button
      v-if="dateRange.from || dateRange.to"
      variant="ghost"
      size="sm"
      class="h-6 w-6 p-0 flex-shrink-0"
      @click.stop="clearFilter"
    >
      <X class="h-3 w-3" />
    </Button>
  </div>
</template>
