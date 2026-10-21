<script setup lang="ts">
import { computed } from 'vue'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface FieldTextareaProps {
  /** Field label */
  label?: string
  /** Input value */
  value?: string
  /** Input value (for v-model support) */
  modelValue?: string
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
  /** Number of rows */
  rows?: number
}

const props = withDefaults(defineProps<FieldTextareaProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorname: '',
  rows: 3
})

const emit = defineEmits<{
  input: [value: string]
  'update:modelValue': [value: string]
}>()

const hasError = computed(() => props.errorname === 'failed')

const modelValueProxy = computed({
  get: () => props.modelValue ?? props.value ?? '',
  set: (value: string) => {
    const nextValue = value ?? ''
    emit('input', nextValue)
    emit('update:modelValue', nextValue)
  }
})
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
    <Textarea
      :id="id"
      v-model="modelValueProxy"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :rows="rows"
      :class="{ 'border-destructive': hasError }"
    />
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
