<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CalendarDays, UserCheck, Pencil } from 'lucide-vue-next'
import { useUserLookup } from '@/composables/useUserLookup'

export interface AuditMeta {
  created_by?: string | null
  createdBy?: string | null
  createdAt?: string | null
  updated_by?: string | null
  updatedBy?: string | null
  updatedAt?: string | null
}

interface Props {
  createdBy?: string | null
  createdAt?: string | null
  updatedBy?: string | null
  updatedAt?: string | null
  auditMeta?: AuditMeta | null
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Informasi Pembuatan',
})

const { resolveUserName } = useUserLookup()

const createdByName = ref('-')
const updatedByName = ref('-')

const effectiveCreatedBy = computed(
  () => props.createdBy || props.auditMeta?.created_by || props.auditMeta?.createdBy || null
)
const effectiveCreatedAt = computed(
  () => props.createdAt || props.auditMeta?.createdAt || null
)
const effectiveUpdatedBy = computed(
  () =>
    props.updatedBy ||
    props.auditMeta?.updated_by ||
    props.auditMeta?.updatedBy ||
    (props.auditMeta as any)?.update_by ||
    (props.auditMeta as any)?.edited_by ||
    null
)
const effectiveUpdatedAt = computed(
  () => props.updatedAt || props.auditMeta?.updatedAt || null
)

watch(
  effectiveCreatedBy,
  async (value) => {
    createdByName.value = value ? await resolveUserName(value) : '-'
  },
  { immediate: true },
)

watch(
  effectiveUpdatedBy,
  async (value) => {
    updatedByName.value = value ? await resolveUserName(value) : '-'
  },
  { immediate: true },
)

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <div class="rounded-2xl border border-border/40 bg-muted/20 px-5 py-4 shadow-sm">
    <p class="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
      {{ title }}
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">Dibuat Pada</p>
          <p class="truncate text-sm font-semibold text-foreground">{{ formatDateTime(effectiveCreatedAt) }}</p>
        </div>
      </div>

      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserCheck class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">Dibuat Oleh</p>
          <p class="truncate text-sm font-semibold text-foreground">{{ createdByName }}</p>
        </div>
      </div>

      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <CalendarDays class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">Diedit Pada</p>
          <p class="truncate text-sm font-semibold text-foreground">{{ formatDateTime(effectiveUpdatedAt) }}</p>
        </div>
      </div>

      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Pencil class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">Diedit Oleh</p>
          <p class="truncate text-sm font-semibold text-foreground">{{ updatedByName }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
