<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

interface DateRange {
  from: Date | null
  to: Date | null
}

interface Props {
  modelValue?: DateRange
  minDate?: Date
  maxDate?: Date
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ from: null, to: null })
})

const emit = defineEmits<{
  'update:modelValue': [value: DateRange]
}>()

// Current displayed month/year
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// Selection state
const selectionStart = ref<Date | null>(props.modelValue?.from || null)
const selectionEnd = ref<Date | null>(props.modelValue?.to || null)
const hoverDate = ref<Date | null>(null)

// Sync with modelValue
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    selectionStart.value = newVal.from
    selectionEnd.value = newVal.to
  }
}, { deep: true })

// Month names in Indonesian
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

// Day names
const dayNames = ['M', 'S', 'S', 'R', 'K', 'J', 'S']

// Get days in month
const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate()
}

// Get first day of month (0 = Sunday)
const getFirstDayOfMonth = (month: number, year: number) => {
  return new Date(year, month, 1).getDay()
}

// Calendar days for current month
const calendarDays = computed(() => {
  const days: { date: Date; isCurrentMonth: boolean; day: number }[] = []
  const daysInMonth = getDaysInMonth(currentMonth.value, currentYear.value)
  const firstDay = getFirstDayOfMonth(currentMonth.value, currentYear.value)
  
  // Previous month days
  const prevMonth = currentMonth.value === 0 ? 11 : currentMonth.value - 1
  const prevYear = currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear)
  
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    days.push({
      date: new Date(prevYear, prevMonth, day),
      isCurrentMonth: false,
      day
    })
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(currentYear.value, currentMonth.value, i),
      isCurrentMonth: true,
      day: i
    })
  }
  
  // Next month days
  const nextMonth = currentMonth.value === 11 ? 0 : currentMonth.value + 1
  const nextYear = currentMonth.value === 11 ? currentYear.value + 1 : currentYear.value
  const remainingDays = 42 - days.length // 6 rows * 7 days
  
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(nextYear, nextMonth, i),
      isCurrentMonth: false,
      day: i
    })
  }
  
  return days
})

// Navigate months
const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// Check if date is same day
const isSameDay = (d1: Date | null, d2: Date | null) => {
  if (!d1 || !d2) return false
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear()
}

// Check if date is today
const isToday = (date: Date) => {
  const today = new Date()
  return isSameDay(date, today)
}

// Check if date is selected (start or end)
const isSelected = (date: Date) => {
  return isSameDay(date, selectionStart.value) || isSameDay(date, selectionEnd.value)
}

// Check if date is start
const isStart = (date: Date) => {
  return isSameDay(date, selectionStart.value)
}

// Check if date is end
const isEnd = (date: Date) => {
  return isSameDay(date, selectionEnd.value)
}

// Check if date is in range (between start and end, or between start and hover)
const isInRange = (date: Date) => {
  const start = selectionStart.value
  const end = selectionEnd.value || hoverDate.value
  
  if (!start || !end) return false
  
  const dateTime = date.getTime()
  const startTime = start.getTime()
  const endTime = end.getTime()
  
  if (startTime < endTime) {
    return dateTime > startTime && dateTime < endTime
  } else {
    return dateTime < startTime && dateTime > endTime
  }
}

// Check if date is disabled
const isDisabled = (date: Date) => {
  if (props.minDate && date < props.minDate) return true
  if (props.maxDate && date > props.maxDate) return true
  return false
}

// Handle date click
const handleDateClick = (date: Date) => {
  if (isDisabled(date)) return
  
  // If no start selected, or both selected, start new selection
  if (!selectionStart.value || (selectionStart.value && selectionEnd.value)) {
    selectionStart.value = date
    selectionEnd.value = null
    emit('update:modelValue', { from: date, to: null })
  } else {
    // Select end date
    if (date < selectionStart.value) {
      // If clicked date is before start, swap
      selectionEnd.value = selectionStart.value
      selectionStart.value = date
    } else {
      selectionEnd.value = date
    }
    emit('update:modelValue', { from: selectionStart.value, to: selectionEnd.value })
  }
}

// Handle mouse enter for hover effect
const handleMouseEnter = (date: Date) => {
  if (selectionStart.value && !selectionEnd.value) {
    hoverDate.value = date
  }
}

// Handle mouse leave
const handleMouseLeave = () => {
  hoverDate.value = null
}

// Get cell classes
const getCellClasses = (item: { date: Date; isCurrentMonth: boolean }) => {
  const classes: string[] = [
    'relative h-9 w-9 flex items-center justify-center text-sm transition-all duration-150 cursor-pointer'
  ]
  
  if (!item.isCurrentMonth) {
    classes.push('text-muted-foreground/40')
  }
  
  if (isDisabled(item.date)) {
    classes.push('opacity-30 cursor-not-allowed')
  }
  
  // Range highlight (background band)
  if (isInRange(item.date) && item.isCurrentMonth) {
    classes.push('bg-primary/20')
  }
  
  // Start date - round left
  if (isStart(item.date) && (selectionEnd.value || hoverDate.value)) {
    classes.push('bg-primary/20 rounded-l-full')
  }
  
  // End date - round right
  if ((isEnd(item.date) || (selectionStart.value && !selectionEnd.value && isSameDay(item.date, hoverDate.value))) && selectionStart.value) {
    classes.push('bg-primary/20 rounded-r-full')
  }
  
  return classes.join(' ')
}

// Get inner circle classes (for the actual date number)
const getInnerClasses = (item: { date: Date; isCurrentMonth: boolean }) => {
  const classes: string[] = [
    'h-9 w-9 flex items-center justify-center rounded-full transition-all duration-200'
  ]
  
  if (isSelected(item.date)) {
    classes.push('bg-primary text-primary-foreground font-semibold selected-date')
  } else if (isToday(item.date) && item.isCurrentMonth) {
    classes.push('ring-2 ring-primary/50 text-primary font-medium')
  } else if (item.isCurrentMonth) {
    classes.push('hover:bg-accent hover:text-accent-foreground')
  }
  
  return classes.join(' ')
}

// Reset selection
const reset = () => {
  selectionStart.value = null
  selectionEnd.value = null
  hoverDate.value = null
  emit('update:modelValue', { from: null, to: null })
}

// Expose methods
defineExpose({
  reset
})
</script>

<template>
  <div class="date-range-picker p-3 select-none" @mouseleave="handleMouseLeave">
    <!-- Header Navigation -->
    <div class="flex items-center justify-between mb-4">
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        @click="prevMonth"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      
      <div class="text-sm font-medium">
        {{ monthNames[currentMonth] }} {{ currentYear }}
      </div>
      
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        @click="nextMonth"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
    
    <!-- Day Headers -->
    <div class="grid grid-cols-7 mb-2">
      <div
        v-for="day in dayNames"
        :key="day"
        class="h-9 w-9 flex items-center justify-center text-xs font-medium text-muted-foreground"
      >
        {{ day }}
      </div>
    </div>
    
    <!-- Calendar Grid -->
    <div class="grid grid-cols-7">
      <div
        v-for="(item, index) in calendarDays"
        :key="index"
        :class="getCellClasses(item)"
        @click="handleDateClick(item.date)"
        @mouseenter="handleMouseEnter(item.date)"
      >
        <span :class="getInnerClasses(item)">
          {{ item.day }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-range-picker {
  min-width: 280px;
}

/* Selected date glow effect */
.selected-date {
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2), 0 4px 12px hsl(var(--primary) / 0.3);
}
</style>
