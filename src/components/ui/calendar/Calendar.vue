<script lang="ts" setup>
import type { CalendarRootEmits, CalendarRootProps } from "reka-ui"
import type { DateValue } from "@internationalized/date"
import type { HTMLAttributes } from "vue"
import { ref, computed, watch } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CalendarRoot, useForwardPropsEmits } from "reka-ui"
import { CalendarDate } from "@internationalized/date"
import { cn } from "@/lib/utils"
import { CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead, CalendarGridRow, CalendarHeadCell, CalendarHeader, CalendarHeading, CalendarNextButton, CalendarPrevButton } from "."
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const props = defineProps<CalendarRootProps & { class?: HTMLAttributes["class"] }>()

const emits = defineEmits<CalendarRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

// Generate month and year options
const months = [
  { value: 0, label: 'Januari' },
  { value: 1, label: 'Februari' },
  { value: 2, label: 'Maret' },
  { value: 3, label: 'April' },
  { value: 4, label: 'Mei' },
  { value: 5, label: 'Juni' },
  { value: 6, label: 'Juli' },
  { value: 7, label: 'Agustus' },
  { value: 8, label: 'September' },
  { value: 9, label: 'Oktober' },
  { value: 10, label: 'November' },
  { value: 11, label: 'Desember' }
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i)

const selectedMonth = ref<number>(new Date().getMonth())
const selectedYear = ref<number>(currentYear)

// Internal placeholder to control calendar navigation
const getInitialPlaceholder = (): DateValue => {
  // Use modelValue if available, otherwise use placeholder prop or today
  if (props.modelValue && typeof props.modelValue === 'object' && 'month' in props.modelValue) {
    return props.modelValue as DateValue
  }
  if (props.placeholder) {
    return props.placeholder
  }
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1) as DateValue
}

const internalPlaceholder = ref<DateValue | undefined>(getInitialPlaceholder())

// Watch for placeholder prop changes (when user clicks prev/next buttons)
watch(() => props.placeholder, (newVal) => {
  if (newVal) {
    internalPlaceholder.value = newVal
    selectedMonth.value = newVal.month - 1 // CalendarDate months are 1-indexed
    selectedYear.value = newVal.year
  }
})

// Watch for model value changes to sync dropdowns and placeholder
watch(() => props.modelValue, (newVal) => {
  if (newVal && typeof newVal === 'object' && 'month' in newVal) {
    selectedMonth.value = newVal.month - 1 // CalendarDate months are 1-indexed
    selectedYear.value = newVal.year
    // Update placeholder to show the selected month/year
    internalPlaceholder.value = new CalendarDate(newVal.year, newVal.month, 1)
  } else {
    // If no value, reset to today
    const now = new Date()
    selectedMonth.value = now.getMonth()
    selectedYear.value = now.getFullYear()
    internalPlaceholder.value = new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1)
  }
}, { immediate: true })

const handleMonthChange = (value: any) => {
  if (!value && value !== 0) return
  const numValue = typeof value === 'string' ? parseInt(value) : typeof value === 'bigint' ? Number(value) : Number(value)
  if (!isNaN(numValue)) {
    selectedMonth.value = numValue
    updatePlaceholder()
  }
}

const handleYearChange = (value: any) => {
  if (!value) return
  const numValue = typeof value === 'string' ? parseInt(value) : typeof value === 'bigint' ? Number(value) : Number(value)
  if (!isNaN(numValue)) {
    selectedYear.value = numValue
    updatePlaceholder()
  }
}

const updatePlaceholder = () => {
  // Create CalendarDate with selected month/year (month is 1-indexed in CalendarDate)
  const newPlaceholder = new CalendarDate(selectedYear.value, selectedMonth.value + 1, 1)
  internalPlaceholder.value = newPlaceholder
  // Emit placeholder change to update calendar view
  emits('update:placeholder', newPlaceholder)
}
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    :class="cn('p-3', props.class)"
    v-bind="forwarded"
    :placeholder="internalPlaceholder as any"
    @update:placeholder="(val: any) => { 
      internalPlaceholder = val
      if (val) {
        selectedMonth = val.month - 1
        selectedYear = val.year
      }
    }"
  >
    <CalendarHeader class="relative flex items-center justify-between pt-1">
      <CalendarPrevButton />
      
      <div class="flex items-center gap-1">
        <Select :model-value="String(selectedMonth)" @update:model-value="handleMonthChange">
          <SelectTrigger class="h-7 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="month in months" :key="month.value" :value="String(month.value)">
              {{ month.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select :model-value="String(selectedYear)" @update:model-value="handleYearChange">
          <SelectTrigger class="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent class="max-h-[200px]">
            <SelectItem v-for="year in years" :key="year" :value="String(year)">
              {{ year }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <CalendarNextButton />
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell
              v-for="day in weekDays" :key="day"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
