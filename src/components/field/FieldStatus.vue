<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  name?: string
  value?: boolean | number // Support boolean or 1/0
  modelValue?: boolean | number // Support boolean or 1/0 (for v-model)
  disabled?: boolean
  readonly?: boolean
  activeText?: string
  inactiveText?: string
}

interface Emits {
  (e: 'input', value: boolean): void
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  activeText: 'Aktif',
  inactiveText: 'Tidak Aktif'
})

const emit = defineEmits<Emits>()

// Computed untuk menentukan apakah disabled
const isDisabled = computed(() => props.disabled || props.readonly)

// Support both value prop and modelValue prop
const currentValue = computed(() => props.modelValue ?? props.value ?? false)

// Convert currentValue to boolean for display
const isChecked = computed(() => {
  // If it's a number (1 or 0), convert to boolean
  if (typeof currentValue.value === 'number') {
    return currentValue.value === 1
  }
  
  // If it's already boolean, use as is
  return Boolean(currentValue.value)
})

// Toggle handler
const handleToggle = () => {
  if (isDisabled.value) return
  
  const newValue = !isChecked.value
  
  // Emit both events for backward compatibility
  emit('input', newValue)
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-1">{{ label }}</label>
    <div class="flex items-center gap-3">
      <!-- Custom Switch (tanpa shadcn/reka-ui) -->
      <button
        type="button"
        role="switch"
        :aria-checked="isChecked"
        :disabled="isDisabled"
        @click="handleToggle"
        :class="[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm border-2 border-transparent',
          isChecked ? 'bg-green-600' : 'bg-red-600',
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        ]"
      >
        <span
          :class="[
            'inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform',
            isChecked ? 'translate-x-5' : 'translate-x-0'
          ]"
        />
      </button>
      
      <span class="text-sm font-semibold" :class="isChecked ? 'text-green-600' : 'text-red-600'">
        {{ isChecked ? activeText : inactiveText }}
      </span>
    </div>
  </div>
</template>
