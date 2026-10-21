<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-vue-next'

interface Option {
  value: string
  label: string
}

interface Props {
  label?: string
  modelValue?: string
  placeholder?: string
  hints?: string
  errorname?: 'failed' | ''
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  class?: string
  id?: string
  options?: Option[]
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  errorname: '',
  required: false,
  disabled: false,
  readonly: false,
  options: () => [],
  clearable: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const search = ref('')
const containerRef = ref<HTMLDivElement | null>(null)

const filtered = computed(() => {
  if (!search.value.trim()) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter(o => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
})

const hasError = computed(() => props.errorname === 'failed')

const selectValue = (val: string) => {
  if (props.readonly || props.disabled) return
  emit('update:modelValue', val)
}

const clearValue = () => {
  if (props.readonly || props.disabled) return
  emit('update:modelValue', '')
}

const scrollToSelected = async () => {
  await nextTick()
  const c = containerRef.value
  const targetValue = props.modelValue
  if (!c || !targetValue) return
  const nodes = Array.from(c.querySelectorAll('[data-value]')) as HTMLElement[]
  const found = nodes.find(n => n.dataset.value === targetValue)
  if (found) {
    try {
      found.scrollIntoView({ block: 'center', inline: 'center' })
    } catch {}
  }
}

watch(() => props.modelValue, async () => {
  await scrollToSelected()
})

onMounted(() => {
  // Initial scroll when mounted (for edit/view mode)
  scrollToSelected()
})
</script>

<template>
  <div :class="props.class">
    <Label v-if="label" :for="id" :class="{ 'required': required }" class="mb-2 block">{{ label }}</Label>
    <div class="space-y-2">
      <!-- Selected preview -->
      <div v-if="modelValue" class="flex items-center gap-2 px-2 py-1.5 rounded border bg-background text-foreground relative">
        <component :is="modelValue" class="h-4 w-4" />
        <span class="text-sm font-medium">{{ modelValue }}</span>
        <button
          v-if="clearable && !disabled && !readonly"
          type="button"
          class="absolute right-1.5 top-1.5 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          @click="clearValue"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="relative">
        <Input
          v-model="search"
          :placeholder="placeholder || 'Cari icon...'"
          :disabled="disabled || readonly"
          class="h-9 pr-9"
          :class="{ 'border-destructive': hasError }"
        />
        <button
          v-if="search && !disabled && !readonly"
          type="button"
          class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
          @click="search = ''"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div ref="containerRef" class="h-56 w-full rounded border bg-muted/40 p-2 overflow-auto">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <button
            v-for="opt in filtered"
            :key="opt.value"
            type="button"
            @click="selectValue(opt.value)"
            :title="opt.value"
            :data-value="opt.value"
            :class="[
              'flex flex-col items-center gap-1 p-2 rounded border text-xs transition-colors group select-none',
              (modelValue === opt.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-muted hover:bg-accent hover:text-accent-foreground'
            ]"
            :aria-selected="modelValue === opt.value"
          >
            <component :is="opt.value" v-if="opt.value !== 'Icon'" class="h-5 w-5" />
            <span class="truncate w-full text-center" :class="(modelValue === opt.value) ? 'font-semibold' : ''">{{ opt.label }}</span>
          </button>
        </div>
      </div>
      <p v-if="hints" :class="hasError ? 'text-destructive' : 'text-muted-foreground'" class="text-xs mt-1">{{ hints }}</p>
    </div>
  </div>
</template>

<style scoped>
.required::after { content: ' *'; color: hsl(var(--destructive)); }
</style>
