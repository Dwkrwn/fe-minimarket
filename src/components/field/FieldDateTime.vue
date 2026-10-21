<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { DateFormatter, getLocalTimeZone, parseDate, type DateValue } from '@internationalized/date'
import { Calendar as CalendarIcon, Clock } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  errorname?: string
  hints?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  placeholder: 'Pilih tanggal & jam',
  disabled: false,
  readonly: false,
  clearable: false,
  errorname: '',
  hints: ''
})

const emit = defineEmits<{
  input: [value: string]
  'update:value': [value: string]
  'update:modelValue': [value: string]
}>()

const df = new DateFormatter('id-ID', {
  dateStyle: 'long',
})

// Format friendly untuk display (misal: 9 Desember 2025 13:03)
const formatDisplayDateTime = (iso: string | undefined) => {
  if (!iso) return ''
  try {
    const dt = new Date(iso)
    const dateStr = df.format(dt)
    const h = String(dt.getHours()).padStart(2, '0')
    const m = String(dt.getMinutes()).padStart(2, '0')
    return `${dateStr} ${h}:${m}`
  } catch {
    return ''
  }
}

// State untuk jam dan menit
const hours = ref('00')
const minutes = ref('00')
const selectedDate = ref<DateValue | undefined>()

// Initialize dengan waktu sekarang saat component mount
onMounted(() => {
  const now = new Date()
  hours.value = String(now.getHours()).padStart(2, '0')
  minutes.value = String(now.getMinutes()).padStart(2, '0')
})

// Parse ISO datetime dan extract tanggal + waktu
const parseDateTime = (iso: string | undefined) => {
  if (!iso) return { date: undefined, hours: '00', minutes: '00' }
  try {
    const dt = new Date(iso)
    const h = String(dt.getHours()).padStart(2, '0')
    const m = String(dt.getMinutes()).padStart(2, '0')
    const dateStr = iso.split('T')[0]
    return {
      date: parseDate(dateStr || ''),
      hours: h,
      minutes: m
    }
  } catch {
    return { date: undefined, hours: '00', minutes: '00' }
  }
}

const initializeDateTime = () => {
  const currentValue = props.modelValue ?? props.value
  if (!currentValue) {
    // Jika tidak ada value, set dengan waktu sekarang (jam & menit device)
    selectedDate.value = undefined
    const now = new Date()
    hours.value = String(now.getHours()).padStart(2, '0')
    minutes.value = String(now.getMinutes()).padStart(2, '0')
    return
  }
  const parsed = parseDateTime(currentValue)
  selectedDate.value = parsed.date
  hours.value = parsed.hours
  minutes.value = parsed.minutes
}

// Initialize pada mount/update prop
const displayValue = computed(() => {
  const currentValue = props.modelValue ?? props.value
  if (!currentValue) return props.placeholder
  
  initializeDateTime()
  
  if (!selectedDate.value) return props.placeholder
  const dateStr = df.format(selectedDate.value.toDate(getLocalTimeZone()))
  const timeStr = `${hours.value}:${minutes.value}`
  return `${dateStr} ${timeStr}`
})

const handleClear = (e: Event) => {
  e.stopPropagation()
  selectedDate.value = undefined
  hours.value = '00'
  minutes.value = '00'
  emit('input', '')
  emit('update:value', '')
  emit('update:modelValue', '')
}

const handleDateSelect = (day: DateValue | undefined) => {
  if (day) {
    selectedDate.value = day
    emitDateTime()
  }
}

const emitDateTime = () => {
  if (!selectedDate.value) return
  const dateStr = `${selectedDate.value.year}-${String(selectedDate.value.month).padStart(2, '0')}-${String(selectedDate.value.day).padStart(2, '0')}`
  const timeStr = `${hours.value}:${minutes.value}`
  const formatted = `${dateStr}T${timeStr}`
  emit('input', formatted)
  emit('update:value', formatted)
  emit('update:modelValue', formatted)
}

const handleTimeChange = () => {
  emitDateTime()
}
</script>

<template>
  <div class="w-full space-y-2">
    <!-- Label -->
    <div v-if="label" class="flex items-center gap-1">
      <Label :for="id" :class="cn('text-sm font-medium', errorname === 'failed' && 'text-destructive')">
        {{ label }}
      </Label>
    </div>

    <!-- Popover Trigger & Content -->
    <Popover>
      <PopoverTrigger as-child>
        <Button
          :id="id"
          :disabled="disabled || readonly"
          :variant="errorname === 'failed' ? 'destructive' : 'outline'"
          :class="cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          {{ displayValue }}
        </Button>
      </PopoverTrigger>

      <PopoverContent class="w-auto p-0" align="start">
        <div class="flex gap-4 p-4">
          <!-- Left: Calendar -->
          <div>
            <Calendar v-model="selectedDate" @update:model-value="handleDateSelect" />
          </div>

          <!-- Right: Time Input Section -->
          <div class="flex flex-col gap-4 justify-start">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <Clock class="h-4 w-4 text-muted-foreground" />
                <Label class="text-xs font-medium">Waktu</Label>
              </div>
              <div class="flex gap-2">
                <!-- Hours -->
                <div class="flex flex-col gap-1 flex-1">
                  <Label class="text-xs text-muted-foreground">Jam</Label>
                  <Input
                    v-model="hours"
                    type="number"
                    min="0"
                    max="23"
                    @input="(e: Event) => {
                      const val = parseInt((e.target as HTMLInputElement).value) || 0
                      hours = String(Math.min(23, Math.max(0, val))).padStart(2, '0')
                      handleTimeChange()
                    }"
                    class="h-8 text-center text-sm"
                  />
                </div>
                <!-- Separator -->
                <div class="flex items-end pb-1 text-muted-foreground">:</div>
                <!-- Minutes -->
                <div class="flex flex-col gap-1 flex-1">
                  <Label class="text-xs text-muted-foreground">Menit</Label>
                  <Input
                    v-model="minutes"
                    type="number"
                    min="0"
                    max="59"
                    @input="(e: Event) => {
                      const val = parseInt((e.target as HTMLInputElement).value) || 0
                      minutes = String(Math.min(59, Math.max(0, val))).padStart(2, '0')
                      handleTimeChange()
                    }"
                    class="h-8 text-center text-sm"
                  />
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-2 pt-2 border-t">
              <Button
                v-if="clearable || selectedDate"
                variant="outline"
                size="sm"
                class="flex-1"
                @click="handleClear"
              >
                Bersihkan
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <!-- Hints / Error Messages -->
    <p v-if="hints" :class="cn('text-xs', errorname === 'failed' ? 'text-destructive' : 'text-muted-foreground')">
      {{ hints }}
    </p>
  </div>
</template>
