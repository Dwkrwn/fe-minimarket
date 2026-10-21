<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner"
import { Toaster as Sonner } from "vue-sonner"
import { onMounted } from 'vue'
import { useMotion } from '@vueuse/motion'

const props = defineProps<ToasterProps>()

onMounted(() => {
  const toastMotions = new Map()
  
  // Apply motion to all toast elements when they appear
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Handle added nodes (new toasts)
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.hasAttribute('data-sonner-toast')) {
          const isRemoving = node.getAttribute('data-removed') === 'true'
          
          if (!isRemoving && !toastMotions.has(node)) {
            // Apply entrance animation with @vueuse/motion
            const motionInstance = useMotion(node, {
              initial: {
                opacity: 0,
                x: 100,
                scale: 0.95,
              },
              enter: {
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  duration: 400,
                }
              }
            })
            toastMotions.set(node, motionInstance)
          }
        }
      })
      
      // Handle attribute changes (toast being removed)
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-removed') {
        const node = mutation.target as HTMLElement
        if (node.getAttribute('data-removed') === 'true' && toastMotions.has(node)) {
          const motionInstance = toastMotions.get(node)
          // Apply exit animation
          motionInstance.apply({
            opacity: 0,
            x: 120,
            scale: 0.9,
            transition: {
              duration: 300,
              ease: [0.4, 0, 1, 1]
            }
          })
          
          // Clean up after animation
          setTimeout(() => {
            toastMotions.delete(node)
          }, 300)
        }
      }
    })
  })

  // Observe the toaster container
  const toasterContainer = document.querySelector('[data-sonner-toaster]')
  if (toasterContainer) {
    observer.observe(toasterContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-removed']
    })
  }
})
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :toast-options="{
      classes: {
        toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton:
          'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton:
          'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }"
  />
</template>

<style scoped>
:deep([data-sonner-toast]) {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep([data-sonner-toast]:hover) {
  transform: scale(1.02);
}
</style>
