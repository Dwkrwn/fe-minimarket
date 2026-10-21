<script setup lang="ts">
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-vue-next'

interface FieldXProps {
  /** Field label */
  label?: string
  /** Input value */
  value?: string | number | null
  /** Input value (for v-model support) */
  modelValue?: string | number | null
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'number' | 'decimal' | 'textarea' | 'date' | 'select' | 'npwp'
  /** Placeholder text */
  placeholder?: string
  /** Error message or hint */
  hints?: string
  /** Error state name */
  errorname?: 'failed' | ''
  /** Is field required */
  required?: boolean
  /** Is field disabled */
  disabled?: boolean
  /** Is field readonly */
  readonly?: boolean
  /** Custom class */
  class?: string
  /** Field ID */
  id?: string
  /** Textarea rows (only for textarea type) */
  rows?: number
  /** Maximum input length */
  maxlength?: number
  /** Mobile keyboard/input mode */
  inputmode?: string
}

const props = withDefaults(defineProps<FieldXProps>(), {
  type: 'text',
  required: false,
  disabled: false,
  readonly: false,
  errorname: '',
  rows: 3
})

const emit = defineEmits<{
  input: [value: string]
  'update:modelValue': [value: string]
  inputLimit: []
}>()

const hasError = computed(() => props.errorname === 'failed')
const showPassword = ref(false)

// Support both value prop and modelValue prop
// Convert to string to preserve leading zeros for tel type
const currentValue = computed(() => {
  const val = props.modelValue ?? props.value ?? ''
  // For tel type, always return as string to preserve leading zeros
  if (props.type === 'tel' && val !== null && val !== undefined) {
    return String(val)
  }
  return val
})

// Computed type for password toggle
const inputType = computed(() => {
  if (props.type === 'password' && showPassword.value) {
    return 'text'
  }
  return props.type
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  let newValue = target.value
  
  // For decimal type, only allow: digits, e, E, ., -, +, ,
  if (props.type === 'decimal') {
    newValue = newValue.replace(/[^0-9eE.\-+,]/g, '')
    target.value = newValue
  }
  
  // For number type, only allow digits
  if (props.type === 'number') {
    newValue = newValue.replace(/[^0-9]/g, '')
    target.value = newValue
  }
  
  // For tel type, only allow digits, +, -, space, and parentheses
  if (props.type === 'tel') {
    newValue = newValue.replace(/[^0-9+\-\s()]/g, '')
    target.value = newValue
  }

  // For npwp type, only allow digits, dots, and hyphens
  if (props.type === 'npwp') {
    newValue = newValue.replace(/[^0-9.\-]/g, '')
    target.value = newValue
  }
  
  // Emit both events for backward compatibility
  emit('input', newValue)
  emit('update:modelValue', newValue)
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Apply to decimal, number, tel, and npwp type
  if (props.type !== 'tel' && props.type !== 'number' && props.type !== 'decimal' && props.type !== 'npwp') return
  
  const key = event.key
  
  // Allow: backspace, delete, tab, escape, enter
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter'].includes(key)) {
    return
  }
  
  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if (event.ctrlKey || event.metaKey) {
    return
  }
  
  // Allow: home, end, left, right, up, down
  if (['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
    return
  }
  
  // For decimal type, allow: digits, e, E, ., -, +, ,
  if (props.type === 'decimal') {
    if ((key >= '0' && key <= '9') || ['e', 'E', '.', '-', '+', ','].includes(key)) {
      return
    }
    event.preventDefault()
    return
  }
  
  // For number type, only allow digits
  if (props.type === 'number') {
    if (key >= '0' && key <= '9') {
      return
    }
    event.preventDefault()
    return
  }
  
  // For tel type, allow: digits, +, -, space, (, )
  if (props.type === 'tel') {
    if ((key >= '0' && key <= '9') || ['+', '-', ' ', '(', ')'].includes(key)) {
      return
    }
  }

  // For npwp type, allow: digits, dots, and hyphens
  if (props.type === 'npwp') {
    if ((key >= '0' && key <= '9') || ['.', '-'].includes(key)) {
      return
    }
  }
  
  // Block everything else (letters, special chars)
  event.preventDefault()
}

const handleBeforeInput = (event: InputEvent) => {
  if (!props.maxlength || props.type === 'textarea') return
  if (event.inputType.startsWith('delete')) return

  const target = event.target as HTMLInputElement
  const currentLength = target.value.length
  const selectedLength = Math.max(0, target.selectionEnd ?? 0) - Math.max(0, target.selectionStart ?? 0)
  const incomingLength = event.data?.length ?? 0

  if (currentLength - selectedLength + incomingLength > props.maxlength) {
    event.preventDefault()
    emit('inputLimit')
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

// Check if textarea
const isTextarea = computed(() => props.type === 'textarea')
</script>

<template>
  <div :class="props.class">
    <Label 
      v-if="label" 
      :for="id"
      :class="{ 'required': required }"
      class="mb-2 block"
    >
      {{ label }}
    </Label>
    <div class="relative">
      <!-- Textarea -->
      <textarea
        v-if="isTextarea"
        :id="id"
        :value="currentValue"
        @input="handleInput"
        :disabled="disabled"
        :readonly="readonly"
        :placeholder="placeholder"
        :rows="rows"
        :class="[
          'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          { 'border-destructive': hasError }
        ]"
      />
      <!-- Input -->
      <Input
        v-else
        :id="id"
        :type="inputType"
        :inputmode="inputmode || (type === 'tel' ? 'tel' : undefined)"
        :maxlength="maxlength"
        :model-value="currentValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="[
          { 'border-destructive': hasError },
          type === 'password' && 'pr-10'
        ]"
        class="h-10"
        @beforeinput="handleBeforeInput"
        @input="handleInput"
        @keydown="handleKeyDown"
        @update:model-value="(val) => {
          emit('input', String(val))
          emit('update:modelValue', String(val))
        }"
      />
      <!-- Password Toggle Button -->
      <button
        v-if="type === 'password'"
        type="button"
        class="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
        @click="togglePasswordVisibility"
        :disabled="disabled || readonly"
      >
        <Eye v-if="!showPassword" class="h-4 w-4" />
        <EyeOff v-else class="h-4 w-4" />
      </button>
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
</style>
