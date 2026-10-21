<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldNumberProps {
  /** Field label */
  label?: string
  /** Input value */
  value?: string | number | null
  /** Input value (for v-model support) */
  modelValue?: string | number | null
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
  /** Min value */
  min?: number
  /** Max value */
  max?: number
  /** Step value */
  step?: number
  /** Input type: 'integer' (default) or 'decimal' for decimal numbers */
  type?: 'integer' | 'decimal'
  /** Whether to format the integer part with grouping separators */
  useGrouping?: boolean
  /** Optional text/currency prefix rendered inside the left of the input (e.g. "Rp") */
  prefix?: string
  /** Extra classes applied to the inner <Input> (e.g. override height, colors) */
  inputClass?: string
}

const props = withDefaults(defineProps<FieldNumberProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorname: '',
  step: 1,
  type: 'integer',
  useGrouping: true,
  prefix: '',
  inputClass: ''
})

const emit = defineEmits<{
  input: [value: string]
  'update:modelValue': [value: string]
  blur: [payload: Event]
}>()

const hasError = computed(() => props.errorname === 'failed')

// Support both value prop and modelValue prop
const currentValue = computed(() => props.modelValue ?? props.value ?? '')

// Decimal mode is enabled explicitly or inferred from a fractional step.
const isDecimal = computed(() => {
  if (props.type === 'decimal') {
    return true
  }

  return !Number.isInteger(props.step)
})

// Negative numbers are only allowed when an explicit negative min is provided.
// By default (no min, or min >= 0) negative input is blocked entirely.
const allowsNegative = computed(() => props.min !== undefined && props.min < 0)

// Effective lower bound used for clamping. Defaults to 0 when negatives are not allowed.
const effectiveMin = computed(() => {
  if (props.min !== undefined) return props.min
  return allowsNegative.value ? props.min : 0
})

// ---------------------------------------------------------------------------
// Parsing / formatting helpers
// ---------------------------------------------------------------------------

const stripGrouping = (value: string): string => value.replace(/\./g, '').replace(',', '.')

// Parse a canonical or Indonesian-formatted string into a number.
// Numeric strings (dot decimal) are parsed directly so saved values like 0.5
// are never mangled; display strings (thousand dots + comma decimal) fall back
// to the Indonesian cleanup.
const parseNumber = (value: string | number | null | undefined): number => {
  const str = String(value ?? '').trim()
  if (str === '' || str === '-') return NaN

  const direct = Number(str)
  if (!isNaN(direct)) return direct

  return parseFloat(stripGrouping(str))
}

// Format a value for display in the field.
// - decimal + grouping: "1.000,5"
// - decimal (ungrouped): "1.5"
// - integer: "1.000"
const formatNumber = (value: string | number | null | undefined): string => {
  const str = String(value ?? '')
  if (str === '') return ''
  if (str === 'null' || str === 'undefined') return ''

  const num = parseNumber(str)
  if (isNaN(num)) return ''

  if (isDecimal.value) {
    if (!props.useGrouping) {
      return String(num)
    }

    const parts = num.toFixed(10).split('.')
    const integerPart = parts[0] || '0'
    let decimalPart = parts[1] || ''
    decimalPart = decimalPart.replace(/0+$/, '')

    const formattedInteger = parseInt(integerPart).toLocaleString('id-ID')

    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger
  }

  return num.toLocaleString('id-ID')
}

// Keep only meaningful characters while typing/pasting.
// - integer: digits (and minus when allowed)
// - decimal + grouping: digits, repeatable "." thousand separators, one "," decimal
// - decimal (ungrouped): digits, one decimal separator ("," or "." became ".")
const sanitizeTyped = (rawValue: string): string => {
  let result = ''
  let decimalSeen = false
  const grouping = props.useGrouping && isDecimal.value
  console.log('fieldnumber decimal?', grouping)

  for (const ch of rawValue) {
    if (ch >= '0' && ch <= '9') {
      result += ch
      continue
    }

    if (ch === '-') {
      if (allowsNegative.value && result === '') result += '-'
      continue
    }

    if (ch === ',' || ch === '.') {
      if (!isDecimal.value) continue

      if (grouping) {
        if (ch === ',') {
          if (!decimalSeen) {
            decimalSeen = true
            result += ','
          }
        } else if (!decimalSeen) {
          // "." acts as a thousand separator, only valid before the decimal comma
          result += '.'
        }
      } else if (!decimalSeen) {
        decimalSeen = true
        result += '.'
      }
      continue
    }

    // Drop all other characters
  }

  return result
}

// Convert the displayed text into the canonical (dot-based) value emitted to the parent.
const toCanonical = (display: string): string => {
  let value: string

  if (isDecimal.value && props.useGrouping) {
    value = stripGrouping(display)
  } else if (isDecimal.value) {
    value = display.replace(',', '.')
  } else {
    value = display.replace(/\./g, '')
  }

  if (!allowsNegative.value) {
    value = value.replace(/-/g, '')
  }

  return value
}

// The value currently shown in the input. Kept as typed while editing so the
// decimal separator (comma in grouped/Indonesian mode) is never lost mid-keystroke.
const internal = ref<string>(formatNumber(currentValue.value))

// Last value emitted to the parent, used to detect and skip prop echoes
// (v-model feedback or Number() round-trips in form handlers).
const lastEmitted = ref<string>('')

// Refresh the displayed text when the prop value changes externally
// (initial load, reset, server assign, copy). Skipped for our own echoes.
watch(currentValue, (newValue) => {
  if (newValue === null || newValue === undefined || newValue === '') {
    if (lastEmitted.value === '') return
    internal.value = ''
    lastEmitted.value = ''
    return
  }

  const newNum = parseNumber(newValue)
  const lastNum = lastEmitted.value === '' ? null : parseNumber(lastEmitted.value)
  if (lastNum !== null && newNum === lastNum) return

  internal.value = formatNumber(newValue)
})

// ---------------------------------------------------------------------------
// Input handlers
// ---------------------------------------------------------------------------

const handleInput = (val: string | number) => {
  if (props.readonly) return

  const display = sanitizeTyped(String(val))
  const canonical = toCanonical(display)
  const safeCanonical = canonical === '.' || canonical === '-' ? '' : canonical

  let formatted = safeCanonical ? formatNumber(safeCanonical) : ''
  if (isDecimal.value && (display.endsWith(',') || (!props.useGrouping && display.endsWith('.')))) {
    formatted += props.useGrouping ? ',' : '.'
  }

  const inputEl = props.id ? document.getElementById(props.id) as HTMLInputElement : null
  const cursorPos = inputEl ? inputEl.selectionStart || 0 : 0
  const diff = formatted.length - display.length

  internal.value = formatted

  nextTick(() => {
    if (inputEl) {
      const newPos = cursorPos + diff
      inputEl.setSelectionRange(newPos, newPos)
    }
  })

  lastEmitted.value = safeCanonical
  emit('input', safeCanonical)
  emit('update:modelValue', safeCanonical)
}

const handleBlur = (event: Event) => {
  // Skip if readonly or disabled
  if (props.readonly || props.disabled) {
    return
  }

  const canonical = toCanonical(internal.value)
  const num = canonical === '' ? NaN : parseFloat(canonical)

  if (canonical === '' || isNaN(num)) {
    lastEmitted.value = ''
    emit('input', '')
    emit('update:modelValue', '')
    internal.value = ''
  } else {
    // Clamp to bounds and emit the final clean (dot-based) value
    let finalValue = num
    if (effectiveMin.value !== undefined && finalValue < effectiveMin.value) finalValue = effectiveMin.value
    if (props.max !== undefined && finalValue > props.max) finalValue = props.max

    const stringValue = String(finalValue)
    lastEmitted.value = stringValue
    emit('input', stringValue)
    emit('update:modelValue', stringValue)

    // Reformat for display (Indonesian format: 1.000,5)
    internal.value = formatNumber(stringValue)
  }

  emit('blur', event)
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Block all input if readonly or disabled
  if (props.readonly || props.disabled) {
    // Only allow tab for navigation
    if (event.key === 'Tab') {
      return
    }
    event.preventDefault()
    return
  }

  const key = event.key
  const target = event.target as HTMLInputElement
  const currentVal = target.value

  // Allow: backspace, delete, tab, escape, enter (but prevent form submit)
  if (['Backspace', 'Delete', 'Tab', 'Escape'].includes(key)) {
    return
  }

  // Enter: move focus to next input without submitting the form
  if (key === 'Enter') {
    event.preventDefault()
    const inputs = Array.from(document.querySelectorAll<HTMLElement>('input:not([disabled]):not([readonly])'))
    const idx = inputs.indexOf(event.target as HTMLElement)
    if (idx !== -1 && idx + 1 < inputs.length) {
      inputs[idx + 1]?.focus()
    }
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

  // Allow minus only when negative values are explicitly permitted (min < 0)
  if (key === '-') {
    if (!allowsNegative.value) {
      event.preventDefault()
      return
    }
    if (currentVal.includes('-') || target.selectionStart !== 0) {
      event.preventDefault()
      return
    }
    return
  }

  // For decimal mode: allow comma as decimal separator.
  if (isDecimal.value && key === ',') {
    // Only allow one comma (decimal separator)
    if (currentVal.includes(',') || (!props.useGrouping && currentVal.includes('.'))) {
      event.preventDefault()
      return
    }
    return
  }

  // In grouped decimal mode, dot is reserved for thousands formatting.
  if (isDecimal.value && key === '.') {
    if (props.useGrouping) {
      event.preventDefault()
      return
    }

    if (currentVal.includes('.') || currentVal.includes(',')) {
      event.preventDefault()
      return
    }
    return
  }

  // Allow digits (0-9)
  if (key >= '0' && key <= '9') {
    // Check if adding this digit would exceed max (for integer mode)
    if (!isDecimal.value && props.max !== undefined) {
      // Get the value after this key would be added
      const selectionStart = target.selectionStart || 0
      const selectionEnd = target.selectionEnd || 0
      const beforeCursor = currentVal.substring(0, selectionStart)
      const afterCursor = currentVal.substring(selectionEnd)
      const newValue = beforeCursor + key + afterCursor

      // Remove dots (thousand separators) and parse
      const cleanNewValue = newValue.replace(/\./g, '')
      const numValue = parseFloat(cleanNewValue)

      if (!isNaN(numValue) && numValue > props.max) {
        event.preventDefault()
        return
      }
    }
    return
  }

  // Block everything else (including letters, special chars)
  event.preventDefault()
}
</script>

<template>
  <div :class="props.class">
    <Label v-if="label" :for="id" :class="{ 'required': required }" class="mb-2 block">
      {{ label }}
    </Label>
    <div :class="['relative', props.prefix ? 'flex items-stretch' : '']">
      <span v-if="props.prefix" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground z-10">
        {{ props.prefix }}
      </span>
      <Input :id="id" type="text" :inputmode="isDecimal ? 'decimal' : 'numeric'" :modelValue="internal" :placeholder="placeholder"
         :disabled="disabled" :readonly="readonly" :class="[
           { 'border-destructive': hasError },
           props.prefix ? 'pl-9' : '',
           props.inputClass,
         ]" class="h-10"
         @update:modelValue="handleInput" @blur="handleBlur" @keydown="handleKeyDown" />
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