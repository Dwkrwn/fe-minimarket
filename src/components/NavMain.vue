<script setup lang="ts">
import type { Component } from 'vue'
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { computed } from 'vue'

interface MenuItem {
  title: string
  url: string
  icon?: Component | string
  isActive?: boolean
  items?: MenuItem[]
  badge?: number
}

const props = defineProps<{
  items: MenuItem[]
}>()

const route = useRoute()
const { state } = useSidebar()
const isCollapsed = computed(() => state.value === 'collapsed')

// Track which parent menu is currently open (only one at a time)
const openParentMenu = ref<string | null>(null)

// Initialize open menu based on active route
const initializeOpenMenu = () => {
  const activeItem = props.items.find(item => item.isActive && item.items)
  if (activeItem) {
    openParentMenu.value = activeItem.title
  }
}

// Watch for route changes to update open menu
watch(() => route.path, () => {
  const activeItem = props.items.find(item => item.isActive && item.items)
  if (activeItem) {
    openParentMenu.value = activeItem.title
  }
}, { immediate: true })

// Toggle parent menu - close others when opening new one
const toggleParentMenu = (title: string) => {
  if (openParentMenu.value === title) {
    openParentMenu.value = null
  } else {
    openParentMenu.value = title
  }
}

// Check if a parent menu is open
const isParentOpen = (title: string) => {
  return openParentMenu.value === title
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel class="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Menu</SidebarGroupLabel>
    <SidebarMenu>
      <template v-for="item in items" :key="item.title">
        <!-- Menu item without sub-items -->
        <SidebarMenuItem v-if="!item.items">
          <SidebarMenuButton :tooltip="item.title" :is-active="item.isActive" as-child>
            <RouterLink 
              :to="item.url" 
              class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              :class="item.isActive ? 'bg-slate-100 text-slate-900 border-l-2 border-primary shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'"
            >
              <component :is="item.icon" v-if="item.icon && typeof item.icon === 'string'" class="h-4 w-4 shrink-0" />
              <component :is="item.icon" v-else-if="item.icon" class="h-4 w-4 shrink-0" />
              <span v-show="!isCollapsed" class="truncate">{{ item.title }}</span>
              <Badge v-if="item.badge && item.badge > 0 && !isCollapsed" variant="destructive" class="ml-auto h-5 min-w-5 px-1.5 text-xs">
                {{ item.badge }}
              </Badge>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Menu item with sub-items (collapsible) -->
        <Collapsible
          v-else
          as-child
          :open="isParentOpen(item.title) && !isCollapsed"
          class="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger as-child>
              <SidebarMenuButton 
                :tooltip="item.title" 
                @click="toggleParentMenu(item.title)"
                class="rounded-xl px-3 py-2 text-xs transition-all duration-150"
                :class="[
                  item.isActive 
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                ]"
              >
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" :class="item.isActive ? 'text-primary' : 'text-slate-500'" />
                <span v-show="!isCollapsed" class="truncate font-medium">{{ item.title }}</span>
                <ChevronRight v-show="!isCollapsed" class="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" :class="item.isActive ? 'text-primary' : 'text-slate-400'" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent 
              v-show="!isCollapsed"
              class="overflow-hidden"
              v-motion
              :initial="{ 
                height: 0, 
                opacity: 0,
                y: -15
              }"
              :enter="{ 
                height: 'auto',
                opacity: 1,
                y: 0,
                transition: { 
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                  mass: 0.8
                }
              }"
              :leave="{ 
                height: 0,
                opacity: 0,
                y: 15,
                transition: { 
                  duration: 280,
                  ease: [0.4, 0, 0.6, 1]
                }
              }"
            >
              <SidebarMenuSub>
                <template v-for="subItem in item.items" :key="subItem.title">
                  <!-- Sub-item without nested items -->
                  <SidebarMenuSubItem 
                    v-if="!subItem.items"
                    v-motion
                    :initial="{ 
                      opacity: 0,
                      y: -8
                    }"
                    :enter="{ 
                      opacity: 1,
                      y: 0,
                      transition: { 
                        type: 'spring',
                        stiffness: 400,
                        damping: 28,
                        delay: 50
                      }
                    }"
                    :leave="{ 
                      opacity: 0,
                      y: 8,
                      transition: { 
                        duration: 200,
                        ease: 'easeOut'
                      }
                    }"
                  >
                    <SidebarMenuSubButton as-child :is-active="subItem.isActive" class="rounded-xl text-xs transition-all duration-150">
                      <RouterLink 
                        :to="subItem.url" 
                        class="flex items-center gap-2.5 py-1.5 px-2 rounded-xl transition-all duration-150 text-xs"
                        :class="subItem.isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium'"
                      >
                        <span 
                          class="h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-200" 
                          :class="subItem.isActive ? 'bg-primary ring-2 ring-primary/30 scale-125' : 'bg-slate-300'" 
                        />
                        <component :is="subItem.icon" v-if="subItem.icon" class="h-3.5 w-3.5 shrink-0" :class="subItem.isActive ? 'text-primary' : 'text-slate-400'" />
                        <span class="truncate">{{ subItem.title }}</span>
                      </RouterLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  <!-- Sub-item with nested items (3rd level) -->
                  <Collapsible
                    v-else
                    as-child
                    :default-open="subItem.isActive"
                    class="group/collapsible-sub"
                  >
                    <SidebarMenuSubItem>
                      <CollapsibleTrigger as-child>
                        <SidebarMenuSubButton class="flex items-center gap-2">
                          <component :is="subItem.icon" v-if="subItem.icon" class="h-4 w-4 shrink-0" />
                          <span>{{ subItem.title }}</span>
                          <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible-sub:rotate-90" />
                        </SidebarMenuSubButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent 
                        class="overflow-hidden"
                        v-motion
                        :initial="{ 
                          height: 0,
                          opacity: 0,
                          y: -12
                        }"
                        :enter="{ 
                          height: 'auto',
                          opacity: 1,
                          y: 0,
                          transition: { 
                            type: 'spring',
                            stiffness: 320,
                            damping: 26,
                            mass: 0.8,
                            delay: 80
                          }
                        }"
                        :leave="{ 
                          height: 0,
                          opacity: 0,
                          y: 12,
                          transition: { 
                            duration: 250,
                            ease: [0.4, 0, 0.6, 1]
                          }
                        }"
                      >
                        <SidebarMenuSub class="mx-1 px-1.5">
                          <SidebarMenuSubItem 
                            v-for="nestedItem in subItem.items" 
                            :key="nestedItem.title"
                            v-motion
                            :initial="{ 
                              opacity: 0,
                              y: -8
                            }"
                            :enter="{ 
                              opacity: 1,
                              y: 0,
                              transition: { 
                                type: 'spring',
                                stiffness: 420,
                                damping: 28,
                                delay: 100
                              }
                            }"
                            :leave="{ 
                              opacity: 0,
                              y: 8,
                              transition: { 
                                duration: 200,
                                ease: 'easeOut'
                              }
                            }"
                          >
                            <SidebarMenuSubButton as-child :is-active="nestedItem.isActive" class="rounded-xl text-xs">
                              <RouterLink 
                                :to="nestedItem.url" 
                                class="flex items-center gap-2 py-1.5 px-2 rounded-xl transition-all duration-150 text-xs"
                                :class="nestedItem.isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium'"
                              >
                                <span 
                                  class="h-1 w-1 rounded-full shrink-0 transition-all duration-200" 
                                  :class="nestedItem.isActive ? 'bg-primary ring-2 ring-primary/30' : 'bg-slate-300'" 
                                />
                                <component :is="nestedItem.icon" v-if="nestedItem.icon" class="h-3.5 w-3.5 shrink-0" :class="nestedItem.isActive ? 'text-primary' : 'text-slate-400'" />
                                <span class="truncate">{{ nestedItem.title }}</span>
                              </RouterLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuSubItem>
                  </Collapsible>
                </template>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>

