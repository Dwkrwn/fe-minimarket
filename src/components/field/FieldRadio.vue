<script setup lang="ts">
import { computed } from "vue";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface RadioOption {
  label: string;
  value: string;
}

interface FieldRadioProps {
  /** Field label */
  label?: string;
  /** Input value */
  value?: string;
  /** Input value (for v-model support) */
  modelValue?: string;
  /** Radio options */
  options: RadioOption[];
  /** Placeholder text / hint */
  hints?: string;
  /** Error state name */
  errorname?: "failed" | "";
  /** Is field required */
  required?: boolean;
  /** Is field disabled */
  disabled?: boolean;
  /** Is field readonly */
  readonly?: boolean;
  /** Custom class */
  class?: string;
  /** Field ID */
  id?: string;
  /** Layout direction */
  direction?: "horizontal" | "vertical";
}

const props = withDefaults(defineProps<FieldRadioProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorname: "",
  direction: "horizontal",
});

const emit = defineEmits<{
  input: [value: string];
  "update:modelValue": [value: string];
}>();

const hasError = computed(() => props.errorname === "failed");

// Support both value prop and modelValue prop
const currentValue = computed(() => props.modelValue ?? props.value ?? "");

const handleValueChange = (newValue: unknown) => {
  if (props.disabled || props.readonly) return;
  if (newValue === null || newValue === undefined) return;

  const value = String(newValue);

  // Emit both events for backward compatibility
  emit("input", value);
  emit("update:modelValue", value);
};
</script>

<template>
  <div :class="props.class">
    <Label v-if="label" :for="id" class="mb-2 block">
      {{ label }}
      <span v-if="required" class="text-destructive"> *</span>
    </Label>

    <RadioGroup
      :model-value="currentValue"
      @update:model-value="handleValueChange"
      :disabled="disabled || readonly"
      class="radio-group-wrapper"
    >
      <div
        v-for="option in options"
        :key="option.value"
        class="flex items-center space-x-2"
      >
        <RadioGroupItem
          :value="option.value"
          :id="`${id}-${option.value}`"
          :disabled="disabled || readonly"
        />
        <Label
          :for="`${id}-${option.value}`"
          class="font-normal cursor-pointer"
          :class="{ 'cursor-not-allowed opacity-50': disabled || readonly }"
        >
          {{ option.label }}
        </Label>
      </div>
    </RadioGroup>

    <p
      v-if="hints"
      :class="hasError ? 'text-destructive' : 'text-muted-foreground'"
      class="text-sm mt-1"
    >
      {{ hints }}
    </p>
  </div>
</template>

<style scoped>
.radio-group-wrapper {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  flex-wrap: nowrap;
}

.radio-group-wrapper[data-direction="vertical"] {
  flex-direction: column;
  gap: 0.75rem;
}
</style>
