<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  as: 'button',
  variant: 'default',
  size: 'md',
  disabled: false,
})
</script>

<template>
  <component
    :is="props.as"
    :disabled="props.as === 'button' ? props.disabled : undefined"
    :aria-disabled="props.disabled ? 'true' : undefined"
    class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    :class="[
      props.variant === 'outline'
        ? 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground'
        : props.variant === 'ghost'
        ? 'hover:bg-accent hover:text-accent-foreground'
        : 'bg-primary text-primary-foreground hover:opacity-90',
      props.size === 'sm' ? 'h-9 px-3 py-2' : props.size === 'lg' ? 'h-11 px-8' : 'h-10 px-4 py-2',
    ]"
  >
    <slot />
  </component>
</template>
