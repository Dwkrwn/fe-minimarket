<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, ChevronDown, Check } from 'lucide-vue-next'
import { apiCall } from '@/lib/api'

interface ApiConfig {
  url: string
  headers?: Record<string, string>
  params?: Record<string, any>
  fullUrl?: boolean
}

interface FieldMultiSelectProps {
  label?: string
  modelValue?: (string | number)[]
  placeholder?: string
  hints?: string
  errorText?: 'failed' | ''
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  class?: string
  id?: string
  displayField?: string
  valueField?: string
  api?: ApiConfig
  options?: Array<Record<string, any>>
  bind?: Record<string, any>
}

const props = withDefaults(defineProps<FieldMultiSelectProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorText: '',
  displayField: 'label',
  valueField: 'value',
  placeholder: 'Pilih items...',
  modelValue: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
  'change': [value: (string | number)[]]
}>()

const loading = ref(false)
const selectOptions = ref<Array<Record<string, any>>>([])
const searchQuery = ref('')
const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownDirection = ref<'above' | 'below'>('below')
const overlayPos = ref({ top: 0, left: 0, width: 0 })
const OPTION_ROW_HEIGHT = 40
const optionsMaxHeight = computed(() => `${OPTION_ROW_HEIGHT * 6}px`) // Slightly taller for multi-select
const hasError = computed(() => props.errorText === 'failed')

const updateOverlayPosition = () => {
  if (!dropdownRef.value) return
  const rect = dropdownRef.value.getBoundingClientRect()
  overlayPos.value = {
    top: dropdownDirection.value === 'below' ? rect.bottom + 6 : rect.top,
    left: rect.left,
    width: rect.width
  }
}

watch(open, (isOpen) => {
  if (isOpen && dropdownRef.value) {
    const rect = dropdownRef.value.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const showAbove = spaceBelow < 300 && spaceAbove > spaceBelow
    dropdownDirection.value = showAbove ? 'above' : 'below'
    updateOverlayPosition()
    window.addEventListener('scroll', updateOverlayPosition, true)
    window.addEventListener('resize', updateOverlayPosition)
  } else {
    window.removeEventListener('scroll', updateOverlayPosition, true)
    window.removeEventListener('resize', updateOverlayPosition)
  }
})

// Current selected values (ensure array)
const currentValues = computed(() => {
  return Array.isArray(props.modelValue) ? props.modelValue : []
})

// Get selected objects for display
const selectedItems = computed(() => {
  return selectOptions.value.filter(opt =>
    currentValues.value.includes(opt[props.valueField])
  )
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return selectOptions.value

  const query = searchQuery.value.toLowerCase()
  return selectOptions.value.filter(opt => {
    const displayValue = String(opt[props.displayField]).toLowerCase()
    return displayValue.includes(query)
  })
})

const toggleOption = (value: string | number) => {
  const newValues = [...currentValues.value]
  const index = newValues.indexOf(value)

  if (index === -1) {
    newValues.push(value)
  } else {
    newValues.splice(index, 1)
  }

  emit('update:modelValue', newValues)
  emit('change', newValues)
}

const removeOption = (value: string | number) => {
  const newValues = currentValues.value.filter(v => v !== value)
  emit('update:modelValue', newValues)
  emit('change', newValues)
}

const toggleDropdown = () => {
  if (props.disabled || props.readonly || loading.value) return

  if (!open.value) {
    fetchOptions()
  }

  open.value = !open.value
  if (open.value) {
    setTimeout(() => {
      const searchInput = dropdownRef.value?.querySelector('input')
      searchInput?.focus()
    }, 50)
  }
}

const handleClickOutside = (event: MouseEvent) => {
  // Check if click is on a removal badge button - if so, don't close
  // (Though logic below handles closing only if outside dropdownRef, badge clicks are inside dropdownRef typically)
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    open.value = false
    searchQuery.value = ''
  }
}

const fetchOptions = async () => {
  if (!props.api) {
    if (props.options) {
      selectOptions.value = props.options
    }
    return
  }

  loading.value = true
  try {
    let fullEndpoint: string

    if (props.api.fullUrl) {
      const queryParams = new URLSearchParams()
      if (props.api.params) {
        Object.entries(props.api.params).forEach(([key, value]) => {
          queryParams.append(key, String(value))
        })
      }
      const separator = props.api.url.includes('?') ? '&' : '?'
      fullEndpoint = `${props.api.url}${separator}${queryParams.toString()}`

      const response = await fetch(fullEndpoint, {
        method: 'GET',
        headers: props.api.headers
      })
      const data = await response.json()

      if (Array.isArray(data)) {
        if (data.length > 0 && typeof data[0] === 'string') {
          selectOptions.value = data.map(item => ({
            [props.valueField]: item,
            [props.displayField]: item
          }))
        } else {
          selectOptions.value = data
        }
      } else if (data.data && Array.isArray(data.data)) {
        selectOptions.value = data.data
      } else {
        console.error('FieldMultiSelect: Invalid API response', data)
        selectOptions.value = []
      }
    } else {
      const url = new URL(props.api.url)
      const endpoint = url.pathname.replace('/api', '')

      const queryParams = new URLSearchParams()
      if (props.api.params) {
        Object.entries(props.api.params).forEach(([key, value]) => {
          queryParams.append(key, String(value))
        })
      }

      fullEndpoint = `${endpoint}?${queryParams.toString()}`

      const response: any = await apiCall(fullEndpoint, {
        method: 'GET',
        headers: props.api.headers
      })

      if (response.status === 'success' && response.data) {
        selectOptions.value = Array.isArray(response.data) ? response.data : []
      } else {
        console.error('FieldMultiSelect: Invalid API response', response)
        selectOptions.value = []
      }
    }
  } catch (error) {
    console.error('FieldMultiSelect: Failed to fetch options', error)
    selectOptions.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (props.options && props.options.length > 0) {
    selectOptions.value = props.options
  }

  if (currentValues.value.length > 0 && props.api) {
    fetchOptions()
  }

  document.addEventListener('click', handleClickOutside)
})

// Watch modelValue: if values are present but options are empty, fetch options
watch(() => props.modelValue, (newVal) => {
  if (Array.isArray(newVal) && newVal.length > 0 && selectOptions.value.length === 0 && props.api) {
    fetchOptions()
  }
}, { deep: true })

watch(() => props.options, (newOptions) => {
  if (Array.isArray(newOptions)) {
    selectOptions.value = newOptions
  } else if (!props.api) {
    selectOptions.value = []
  }
}, { deep: true })

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.api, () => {
  if (open.value) fetchOptions()
}, { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateOverlayPosition, true)
  window.removeEventListener('resize', updateOverlayPosition)
})
</script>

<template>
  <div :class="props.class">
    <Label v-if="label" :for="id" :class="{ 'required': required }" class="mb-2 block">
      {{ label }}
    </Label>

    <div class="relative" ref="dropdownRef">
      <div :id="id"
        class="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        :class="[
          { 'border-destructive': hasError },
          disabled || readonly ? 'cursor-not-allowed opacity-50' : ''
        ]" @click="toggleDropdown">
        <div class="flex flex-wrap gap-1">
          <span v-if="currentValues.length === 0" class="text-muted-foreground py-0.5">
            {{ placeholder }}
          </span>

          <Badge v-for="item in selectedItems" :key="item[valueField]" variant="secondary" class="mr-1 mb-1">
            {{ item[displayField] }}
            <button v-if="!disabled && !readonly"
              class="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              @click.stop="removeOption(item[valueField])" type="button">
              <X class="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        </div>

        <div class="absolute right-3 top-3">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin opacity-50" />
          <ChevronDown v-else class="h-4 w-4 opacity-50" />
        </div>
      </div>

      <Teleport to="body">
        <div v-if="open"
          class="fixed z-50 rounded-md border bg-popover shadow-md outline-none animate-in fade-in-0 zoom-in-95 pointer-events-auto"
          :style="{
            width: overlayPos.width + 'px',
            top: overlayPos.top + 'px',
            left: overlayPos.left + 'px',
            transform: dropdownDirection === 'above' ? 'translateY(calc(-100% - 6px))' : 'none'
          }" :class="dropdownDirection === 'above' ? 'origin-bottom' : 'origin-top'" @click.stop>
          <div class="flex flex-col p-0">
            <div class="border-b p-2">
              <div class="relative">
                <Input v-model="searchQuery" placeholder="Cari..." class="h-9 pr-9" @keydown.escape="open = false"
                  @click.stop />
                <button v-if="searchQuery" type="button"
                  class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                  @click.stop="searchQuery = ''">
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div class="overflow-y-auto p-1 scrollbar-thin" :style="{ maxHeight: optionsMaxHeight }">
              <div v-if="filteredOptions.length === 0 && !loading"
                class="py-6 text-center text-sm text-muted-foreground">
                {{ searchQuery ? 'Tidak ditemukan' : 'Tidak ada data' }}
              </div>

              <div v-for="option in filteredOptions" :key="option[valueField]" @click="toggleOption(option[valueField])"
                :class="[
                  'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors',
                  'hover:bg-accent hover:text-accent-foreground'
                ]">
                <div class="mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary"
                  :class="currentValues.includes(option[valueField]) ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'">
                  <Check class="h-4 w-4" />
                </div>
                <span>{{ option[displayField] }}</span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <p v-if="hints" :class="hasError ? 'text-destructive' : 'text-muted-foreground'" class="text-sm mt-1">
      {{ hints }}
    </p>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: #ef4444;
  font-weight: bold;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}
</style>
