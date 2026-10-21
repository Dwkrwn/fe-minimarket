<script setup lang="ts">
import { computed, watch } from 'vue'

interface Props {
  show?: boolean
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  message: 'Loading...'
})

const isVisible = computed(() => props.show)

// Disable scrolling when loading screen is visible
watch(isVisible, (newVal) => {
  if (newVal) {
    // Save current scroll position
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  } else {
    // Restore scroll position
    const scrollY = document.body.style.top
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    window.scrollTo(0, parseInt(scrollY || '0') * -1)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-background/95 backdrop-blur-md overflow-hidden"
        @wheel.prevent
        @touchmove.prevent
        @scroll.prevent
      >
        <div class="flex flex-col items-center gap-4">
          <!-- Spinner Animation -->
          <div class="relative h-16 w-16">
            <div class="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div
              class="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
            ></div>
          </div>

          <!-- Loading Message -->
          <div class="text-center">
            <p class="text-lg font-semibold text-foreground">{{ message }}</p>
            <p class="text-sm text-muted-foreground mt-1">Mohon tunggu sebentar...</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Ensure backdrop blur works properly */
@supports (backdrop-filter: blur(8px)) {
  .backdrop-blur-sm {
    backdrop-filter: blur(8px);
  }
}
</style>
