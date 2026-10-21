<template>
  <div class="flex flex-col gap-1.5 w-full">
    <label 
      v-if="label" 
      :for="id" 
      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      :class="{ 'text-red-500': required }"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>
    <textarea
      :id="id"
      :value="modelValue"
      @input="handleInput"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="placeholder"
      :rows="rows"
      :required="required"
      class="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    />
  </div>
</template>

<script setup lang="ts">

interface Props {
  id?: string
  label?: string
  modelValue?: string | null
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  rows?: number
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  label: undefined,
  modelValue: '',
  disabled: false,
  readonly: false,
  placeholder: undefined,
  rows: 3,
  required: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>
