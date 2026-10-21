<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  id?: string
  label: string
  value?: string | null
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  errorname?: string
  hints?: string
  displayfield?: string // field name used to display label
  valuefield?: string // field name used as stored value
  api: {
    url: string
    headers?: Record<string, string>
    params?: Record<string, any>
    selectField?: string // backward compatible single field
    onsuccess?: (response: any) => any
  }
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  placeholder: 'Pilih atau ketik...',
  disabled: false,
  readonly: false,
  required: false,
  errorname: '',
  hints: ''
})

const emit = defineEmits<{
  input: [value: string]
  'update:value': [value: string]
}>()

type OptionItem = { label: string; value: string }
const options = ref<OptionItem[]>([])
const loading = ref(false)
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const internalInput = ref('')

// derive keys (fallback to api.selectField when explicit props missing)
const displayKey = computed(() => props.displayfield || props.api.selectField || '')
const valueKey = computed(() => props.valuefield || props.api.selectField || '')

// sync internal input when external value changes and options loaded
watch(() => props.value, () => {
  if (!props.value) {
    internalInput.value = ''
    return
  }
  const match = options.value.find(o => o.value === props.value)
  internalInput.value = match ? match.label : String(props.value)
}, { immediate: true })

// Fetch data from API
const fetchOptions = async () => {
  loading.value = true
  try {
    const url = new URL(props.api.url)
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, val]) => {
        url.searchParams.append(key, String(val))
      })
    }
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: props.api.headers || {}
    })
    let data = await response.json()
    if (props.api.onsuccess) data = props.api.onsuccess(data)
    const dKey = displayKey.value
    const vKey = valueKey.value
    if (data.data && Array.isArray(data.data) && dKey && vKey) {
      const map = new Map<string, OptionItem>()
      data.data.forEach((item: any) => {
        const rawLabel = item[dKey]
        const rawValue = item[vKey]
        if (rawValue && String(rawValue).trim()) {
          const v = String(rawValue).trim()
          const lbl = rawLabel ? String(rawLabel).trim() : v
          if (!map.has(v)) map.set(v, { value: v, label: lbl })
        }
      })
      options.value = Array.from(map.values()).sort((a,b) => a.label.localeCompare(b.label))
    }
  } catch (e) {
    console.error('Failed to fetch options:', e)
    options.value = []
  } finally {
    loading.value = false
    // resync input after load
    const match = options.value.find(o => o.value === props.value)
    if (match) internalInput.value = match.label
  }
}

// Fetch on mount
watch(() => [props.api.url, displayKey.value, valueKey.value], () => {
  fetchOptions()
}, { immediate: true })

// Handle input change
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  internalInput.value = target.value
  showDropdown.value = true
  highlightedIndex.value = -1
  // do not emit yet; emit when selecting or blur if it's new
}

const selectOption = (opt: OptionItem) => {
  internalInput.value = opt.label
  emit('input', opt.value)
  emit('update:value', opt.value)
  showDropdown.value = false
}

const handleBlur = () => {
  // if typed text corresponds to an existing option label, map to its value
  const match = options.value.find(o => o.label.toLowerCase() === internalInput.value.toLowerCase())
  if (match) {
    emit('input', match.value)
    emit('update:value', match.value)
  } else {
    // treat new label as value
    if (internalInput.value.trim() === '') {
      emit('input', '')
      emit('update:value', '')
    } else {
      emit('input', internalInput.value.trim())
      emit('update:value', internalInput.value.trim())
    }
  }
  setTimeout(() => { showDropdown.value = false }, 100) // allow click selection before hide
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!showDropdown.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % filteredOptions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0 ? filteredOptions.value.length - 1 : highlightedIndex.value - 1
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const opt = filteredOptions.value[highlightedIndex.value]
    if (opt) selectOption(opt)
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

const filteredOptions = computed(() => {
  if (!internalInput.value) return options.value
  return options.value.filter(o => o.label.toLowerCase().includes(internalInput.value.toLowerCase()))
})

// Clear value
const handleClear = (e: Event) => {
  e.stopPropagation()
  internalInput.value = ''
  emit('input', '')
  emit('update:value', '')
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="id || label.toLowerCase().replace(/\s+/g, '-')">
      {{ label }}
      <span v-if="required && !readonly" class="text-destructive ml-1">*</span>
    </Label>
    
    <div class="relative" @keydown="handleKeydown">
      <Input
        :id="id || label.toLowerCase().replace(/\s+/g, '-')"
        type="text"
        :value="internalInput"
        @input="handleInput"
        @focus="() => showDropdown = true"
        @blur="handleBlur"
        :placeholder="placeholder"
        :disabled="disabled || readonly"
        :readonly="readonly"
        :class="cn(
          errorname === 'failed' && 'border-destructive focus-visible:ring-destructive',
          (internalInput && !readonly && !disabled) && 'pr-8'
        )"
        autocomplete="off"
      />

      <!-- Dropdown suggestions -->
      <div
        v-if="showDropdown && filteredOptions.length && !readonly && !disabled"
        class="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md focus:outline-none"
      >
        <ul class="max-h-56 overflow-auto py-1 text-sm">
          <li
            v-for="(opt, idx) in filteredOptions"
            :key="`${opt.value}`"
            @mousedown.prevent="selectOption(opt)"
            :class="cn('cursor-pointer select-none px-2 py-1 rounded', idx === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')"
          >
            {{ opt.label }}
          </li>
        </ul>
      </div>

      <!-- Clear button -->
      <Button
        v-if="internalInput && !readonly && !disabled"
        type="button"
        variant="ghost"
        size="icon"
        class="absolute right-0 top-0 h-full w-8 p-0 hover:bg-transparent"
        @click="handleClear"
      >
        <X class="h-4 w-4 text-destructive" />
      </Button>
    </div>
    
    <p 
      v-if="hints" 
      :class="['text-xs', errorname === 'failed' ? 'text-destructive' : 'text-muted-foreground']"
    >
      {{ hints }}
    </p>
  </div>
</template>
