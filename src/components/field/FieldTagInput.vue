<script setup lang="ts">
import { ref, computed } from 'vue'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-vue-next'

interface FieldTagInputProps {
  id?: string
  label?: string
  modelValue?: string[]
  placeholder?: string
  hints?: string
  errorText?: 'failed' | ''
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  class?: string
}

const props = withDefaults(defineProps<FieldTagInputProps>(), {
  id: '',
  label: '',
  modelValue: () => [],
  placeholder: 'Ketik lalu tekan Enter...',
  hints: '',
  errorText: '',
  required: false,
  disabled: false,
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'change': [value: string[]]
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const tags = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const hasError = computed(() => props.errorText === 'failed')

const addTag = () => {
  const val = inputValue.value.trim()
  if (!val || tags.value.includes(val)) {
    inputValue.value = ''
    return
  }
  const newTags = [...tags.value, val]
  emit('update:modelValue', newTags)
  emit('change', newTags)
  inputValue.value = ''
}

const removeTag = (index: number) => {
  const newTags = tags.value.filter((_, i) => i !== index)
  emit('update:modelValue', newTags)
  emit('change', newTags)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
  } else if (e.key === 'Backspace' && inputValue.value === '' && tags.value.length > 0) {
    removeTag(tags.value.length - 1)
  }
}

const focusInput = () => {
  if (!props.disabled && !props.readonly) {
    inputRef.value?.focus()
  }
}
</script>

<template>
  <div :class="props.class">
    <!-- Label -->
    <Label
      v-if="label"
      :for="id"
      class="mb-2 block text-sm font-medium"
      :class="[
        hasError ? 'text-destructive' : '',
        required ? 'required' : '',
      ]"
    >
      {{ label }}
    </Label>

    <!-- Tag Container -->
    <div
      class="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors cursor-text"
      :class="[
        hasError ? 'border-destructive focus-within:ring-destructive' : 'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled || readonly ? 'cursor-not-allowed opacity-50' : 'hover:bg-primary/5',
      ]"
      @click="focusInput"
    >
      <div class="flex flex-wrap gap-1 items-center">
        <!-- Tags -->
        <Badge
          v-for="(tag, index) in tags"
          :key="index"
          variant="secondary"
          class="gap-1 pr-1 text-xs"
        >
          {{ tag }}
          <button
            v-if="!disabled && !readonly"
            type="button"
            class="ml-0.5 rounded-full outline-none focus:ring-1 focus:ring-ring"
            @click.stop="removeTag(index)"
            :aria-label="`Hapus ${tag}`"
          >
            <X class="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        </Badge>

        <!-- Input -->
        <input
          v-if="!readonly"
          ref="inputRef"
          v-model="inputValue"
          :id="id"
          :placeholder="tags.length === 0 ? placeholder : ''"
          :disabled="disabled"
          class="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed text-sm"
          @keydown="handleKeydown"
          @blur="addTag"
        />

        <!-- Readonly placeholder -->
        <span
          v-if="readonly && tags.length === 0"
          class="text-muted-foreground text-sm"
        >
          {{ placeholder }}
        </span>
      </div>
    </div>

    <!-- Hints -->
    <p
      v-if="hints"
      class="mt-1 text-xs"
      :class="hasError ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ hints }}
    </p>
  </div>
</template>

<style scoped>
.required::after {
  content: ' *';
  color: hsl(var(--destructive));
  font-weight: bold;
}
</style>
