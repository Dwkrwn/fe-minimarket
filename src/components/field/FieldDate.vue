<script setup lang="ts">
import { computed, ref } from 'vue'
import { DateFormatter, getLocalTimeZone, parseDate, type DateValue } from '@internationalized/date'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Props {
  id?: string
  label: string
  value?: string | null
  modelValue?: string | null
  min?: string | null
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  errorname?: string
  hints?: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  placeholder: 'Pilih tanggal',
  disabled: false,
  readonly: false,
  clearable: false,
  errorname: '',
  hints: '',
  required: false
})

const emit = defineEmits<{
  input: [value: string]
  'update:value': [value: string]
  'update:modelValue': [value: string]
}>()

const df = new DateFormatter('id-ID', {
  dateStyle: 'long',
})

const isOpen = ref(false)

const dateValue = computed({
  get: () => {
    const currentValue = props.modelValue ?? props.value
    if (!currentValue) return undefined
    try {
      // Parse YYYY-MM-DD format to CalendarDate
      return parseDate(currentValue)
    } catch {
      return undefined
    }
  },
  set: (val) => {
    if (val) {
      // Format to YYYY-MM-DD
      const formatted = `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`
      emit('input', formatted)
      emit('update:value', formatted)
      emit('update:modelValue', formatted)
      // Auto-close popover setelah memilih tanggal
      isOpen.value = false
    } else {
      emit('input', '')
      emit('update:value', '')
      emit('update:modelValue', '')
    }
  }
})

const minDateValue = computed(() => {
  if (!props.min) return undefined
  try {
    return parseDate(props.min)
  } catch {
    return undefined
  }
})

const isDateUnavailable = (date: DateValue) => {
  return minDateValue.value ? date.compare(minDateValue.value) < 0 : false
}

const displayValue = computed(() => {
  if (!dateValue.value) return props.placeholder
  return df.format(dateValue.value.toDate(getLocalTimeZone()))
})

const handleClear = (e: Event) => {
  e.stopPropagation()
  dateValue.value = undefined
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="id || label.toLowerCase().replace(/\s+/g, '-')">
      {{ label }}
      <span v-if="required" class="text-destructive">*</span>
    </Label>
    
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :class="cn(
            'w-full justify-start text-left font-normal',
            !dateValue && 'text-muted-foreground',
            errorname === 'failed' && 'border-destructive focus-visible:ring-destructive',
          )"
          :disabled="disabled || readonly"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          {{ displayValue }}
          <span v-if="clearable && dateValue && !readonly && !disabled" class="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-6 w-6 p-0 hover:bg-transparent"
              @click="handleClear"
            >
              <span class="sr-only">Clear</span>
              ×
            </Button>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0">
        <Calendar 
          v-model="dateValue" 
          initial-focus 
          :disabled="disabled || readonly"
          :is-date-unavailable="isDateUnavailable"
        />
      </PopoverContent>
    </Popover>
    <p v-if="hints" :class="['text-xs', errorname === 'failed' ? 'text-destructive' : 'text-muted-foreground']">
      {{ hints }}
    </p>
  </div>
</template>
