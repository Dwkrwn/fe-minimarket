<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Check, Clock } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export interface MrqNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string
  t_mrq_id: string
  sender_id: string
  approval_level: number
  status: boolean
  status_name: string
  createdAt: string
  t_mrq?: {
    id: string
    no: string
    status: string
  }
  tpr_sender?: {
    id: string
    name: string
  }
  user_default?: {
    id: string
    name: string
  }
}

const props = defineProps<{
  notifications: MrqNotification[]
  revisiNotifications: MrqNotification[]
  pendingApprovalNotifications?: MrqNotification[]
  isNotificationRead: (notif: MrqNotification) => boolean
}>()

const emit = defineEmits<{
  (e: 'markAsRead', notif: MrqNotification, event?: Event): void
  (e: 'openDetail', notif: MrqNotification, isRevisi?: boolean): void
}>()

const displayNotifications = computed(() => {
  const all = [...(props.notifications || []), ...(props.pendingApprovalNotifications || [])]
  const seen = new Set<string>()
  return all.filter(n => {
    const key = String(n.id || n.t_mrq_id || n.t_mrq?.id || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const unreadCount = computed(() => displayNotifications.value.filter(n => !props.isNotificationRead(n)).length)
const revisiUnreadCount = computed(() => props.revisiNotifications.filter(n => !props.isNotificationRead(n)).length)
const hasNotifications = computed(() => displayNotifications.value.length > 0)
const hasRevisiNotifications = computed(() => props.revisiNotifications.length > 0)

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMs / 3600000)
  const diffInDays = Math.floor(diffInMs / 86400000)
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const getNotifTitle = (notif: MrqNotification) => {
  if (notif.title?.includes('undefined')) return `Request Approval Material Request: ${notif.t_mrq?.no || ''}`
  return notif.title || 'Notification'
}

const getNotifStatus = (notif: MrqNotification) => notif.t_mrq?.status || notif.status_name || 'N/A'
</script>

<template>
  <!-- Material Request Approval -->
  <AccordionItem v-if="hasNotifications" value="material-request">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <FileText class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Material Request</span>
        <Badge v-if="unreadCount > 0" variant="destructive" class="ml-1 md:ml-2 text-xs">{{ unreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card v-for="(notif, index) in displayNotifications" :key="notif.id" v-motion
          :initial="{ opacity: 0, y: 20 }" :enter="{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15, delay: index * 80 } }"
          :class="['transition-all hover:shadow-md cursor-pointer group', !isNotificationRead(notif) && 'border-l-4 border-l-primary bg-primary/10']"
          @click="emit('openDetail', notif)">
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <FileText class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-primary shrink-0" />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle class="text-sm md:text-base flex items-center gap-2">
                    <span class="truncate">{{ getNotifTitle(notif) }}</span>
                    <span v-if="!isNotificationRead(notif)" class="h-2 w-2 rounded-full bg-primary shrink-0"></span>
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-2">{{ notif.approval_message }}</CardDescription>
                  <div class="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-xs text-muted-foreground">
                    <div class="flex items-center gap-1"><Clock class="h-3 w-3" />{{ formatDateTime(notif.createdAt) }}</div>
                    <span class="hidden xs:inline text-muted-foreground">•</span>
                    <span class="truncate">From: {{ notif.tpr_sender?.name || notif.user_default?.name || 'Unknown' }}</span>
                  </div>
                  <div class="flex items-center flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="secondary" class="text-xs">{{ notif.t_mrq?.no || 'N/A' }}</Badge>
                    <Badge variant="outline" class="text-xs">{{ getNotifStatus(notif) }}</Badge>
                  </div>
                </div>
              </div>
              <Button v-if="!isNotificationRead(notif)" variant="ghost" size="icon" class="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 md:h-8 md:w-8" @click.stop="emit('markAsRead', notif, $event)" title="Mark as read">
                <Check class="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <!-- Material Request Revisi -->
  <AccordionItem v-if="hasRevisiNotifications" value="material-request-revisi">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <FileText class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Material Request (Revisi)</span>
        <Badge v-if="revisiUnreadCount > 0" variant="destructive" class="ml-1 md:ml-2 text-xs">{{ revisiUnreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card v-for="(notif, index) in revisiNotifications" :key="notif.id" v-motion
          :initial="{ opacity: 0, y: 20 }" :enter="{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15, delay: index * 80 } }"
          :class="['transition-all hover:shadow-md cursor-pointer group', !isNotificationRead(notif) && 'border-l-4 border-l-primary bg-primary/10']"
          @click="emit('openDetail', notif, true)">
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <FileText class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-primary shrink-0" />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle class="text-sm md:text-base flex items-center gap-2">
                    <span class="truncate">{{ getNotifTitle(notif) }}</span>
                    <span v-if="!isNotificationRead(notif)" class="h-2 w-2 rounded-full bg-primary shrink-0"></span>
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-2">{{ notif.approval_message }}</CardDescription>
                  <div class="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-xs text-muted-foreground">
                    <div class="flex items-center gap-1"><Clock class="h-3 w-3" />{{ formatDateTime(notif.createdAt) }}</div>
                    <span class="hidden xs:inline text-muted-foreground">•</span>
                    <span class="truncate">From: {{ notif.tpr_sender?.name || notif.user_default?.name || 'Unknown' }}</span>
                  </div>
                  <div class="flex items-center flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="secondary" class="text-xs">{{ notif.t_mrq?.no || 'N/A' }}</Badge>
                    <Badge variant="outline" class="text-xs">{{ getNotifStatus(notif) }}</Badge>
                  </div>
                </div>
              </div>
              <Button v-if="!isNotificationRead(notif)" variant="ghost" size="icon" class="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 md:h-8 md:w-8" @click.stop="emit('markAsRead', notif, $event)" title="Mark as read">
                <Check class="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>