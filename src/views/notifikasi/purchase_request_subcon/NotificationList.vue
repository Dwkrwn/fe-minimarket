<script setup lang="ts">
import { computed } from "vue";
import { Package, Check, Clock, AlertCircle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const props = defineProps<{
  notifications: any[];
  revisiNotifications: any[];
  pendingApprovalNotifications: any[];
  isNotificationRead: (notif: any) => boolean;
}>();

const emit = defineEmits<{
  (e: "markAsRead", notif: any, event?: Event): void;
  (e: "openDetail", notif: any, isRevisi?: boolean): void;
}>();

const unreadCount = computed(
  () => props.notifications.filter((n) => !props.isNotificationRead(n)).length,
);
const revisiUnreadCount = computed(
  () =>
    props.revisiNotifications.filter((n) => !props.isNotificationRead(n))
      .length,
);
const pendingUnreadCount = computed(
  () =>
    props.pendingApprovalNotifications.filter(
      (n) => !props.isNotificationRead(n),
    ).length,
);

const hasNotifications = computed(() => props.notifications.length > 0);
const hasRevisiNotifications = computed(
  () => props.revisiNotifications.length > 0,
);
const hasPendingNotifications = computed(
  () => props.pendingApprovalNotifications.length > 0,
);

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60)
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  if (diffInHours < 24)
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  if (diffInDays < 7)
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getSenderName = (notif: any) =>
  notif.tpr_sc_sender?.name || notif.user_default?.name || "Unknown";
</script>

<template>
  <!-- Purchase Request Subcon Approval -->
  <AccordionItem v-if="hasNotifications" value="purchase-request-subcon">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Package class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"
          >Purchase Request Subcon</span
        >
        <Badge
          v-if="unreadCount > 0"
          variant="destructive"
          class="ml-1 md:ml-2 text-xs"
          >{{ unreadCount }}</Badge
        >
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="(notif, index) in notifications"
          :key="notif.id"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 15,
              delay: index * 80,
            },
          }"
          :class="[
            'transition-all hover:shadow-md cursor-pointer group',
            !isNotificationRead(notif) &&
              'border-l-4 border-l-primary bg-primary/10',
          ]"
          @click="emit('openDetail', notif)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <Package
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-primary shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base flex items-center gap-2"
                  >
                    <span class="truncate">{{
                      notif.title || "Purchase Request Subcon Approval"
                    }}</span>
                    <span
                      v-if="!isNotificationRead(notif)"
                      class="h-2 w-2 rounded-full bg-primary shrink-0"
                    ></span>
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-2">{{
                    notif.approval_message
                  }}</CardDescription>
                  <div
                    class="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-xs text-muted-foreground"
                  >
                    <div class="flex items-center gap-1">
                      <Clock class="h-3 w-3" />{{
                        formatDateTime(notif.createdAt)
                      }}
                    </div>
                    <span class="hidden xs:inline">•</span>
                    <span class="truncate"
                      >From: {{ getSenderName(notif) }}</span
                    >
                  </div>
                  <div class="flex items-center flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="secondary" class="text-xs">{{
                      notif.t_purchase_request_subcon?.no_pr_subcon ||
                      notif.t_purchase_request_subcon_id ||
                      "N/A"
                    }}</Badge>
                    <Badge variant="outline" class="text-xs">{{
                      notif.t_purchase_request_subcon?.status ||
                      notif.status_name ||
                      "N/A"
                    }}</Badge>
                  </div>
                </div>
              </div>
              <Button
                v-if="!isNotificationRead(notif)"
                variant="ghost"
                size="icon"
                class="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 md:h-8 md:w-8"
                @click.stop="emit('markAsRead', notif, $event)"
                title="Mark as read"
              >
                <Check class="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <!-- Purchase Request Subcon Pending Approval -->
  <AccordionItem
    v-if="hasPendingNotifications"
    value="purchase-request-subcon-pending"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"
          >Purchase Request Subcon Menunggu Persetujuan</span
        >
        <Badge
          v-if="pendingUnreadCount > 0"
          variant="secondary"
          class="ml-1 md:ml-2 text-xs"
          >{{ pendingUnreadCount }}</Badge
        >
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="(notif, index) in pendingApprovalNotifications"
          :key="notif.id"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 15,
              delay: index * 80,
            },
          }"
          :class="[
            'transition-all hover:shadow-md cursor-pointer group',
            !isNotificationRead(notif) &&
              'border-l-4 border-l-secondary bg-secondary/10',
          ]"
          @click="emit('openDetail', notif, true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <Package
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-secondary-foreground shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base flex items-center gap-2"
                  >
                    <span class="truncate">{{
                      notif.title || "Purchase Request Subcon"
                    }}</span>
                    <span
                      v-if="!isNotificationRead(notif)"
                      class="h-2 w-2 rounded-full bg-secondary shrink-0"
                    ></span>
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-2">{{
                    notif.approval_message
                  }}</CardDescription>
                  <div
                    class="flex items-center gap-1 md:gap-2 text-xs text-muted-foreground"
                  >
                    <Clock class="h-3 w-3" />{{
                      formatDateTime(notif.createdAt)
                    }}
                  </div>
                  <div class="flex items-center flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="secondary" class="text-xs">
                      <Package class="h-3 w-3 mr-1 shrink-0" />{{
                        notif.t_purchase_request_subcon?.no_pr_subcon ||
                       
                        "N/A"
                      }}
                    </Badge>
                    <Badge variant="outline" class="text-xs">{{
                      notif.status_name || "N/A"
                    }}</Badge>
                  </div>
                  <div
                    v-if="notif.approval_catatan"
                    class="mt-2 p-2 bg-muted/50 rounded-md"
                  >
                    <p class="text-xs text-muted-foreground line-clamp-2">
                      <span class="font-medium">Catatan:</span>
                      {{ notif.approval_catatan }}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                v-if="!isNotificationRead(notif)"
                variant="ghost"
                size="icon"
                class="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 md:h-8 md:w-8"
                @click.stop="emit('markAsRead', notif, $event)"
                title="Mark as read"
              >
                <Check class="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <!-- Purchase Request Subcon Revisi -->
  <AccordionItem
    v-if="hasRevisiNotifications"
    value="purchase-request-subcon-revisi"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"
          >Purchase Request Subcon Revisi</span
        >
        <Badge
          v-if="revisiUnreadCount > 0"
          variant="destructive"
          class="ml-1 md:ml-2 text-xs"
          >{{ revisiUnreadCount }}</Badge
        >
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="(notif, index) in revisiNotifications"
          :key="notif.id"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 15,
              delay: index * 80,
            },
          }"
          :class="[
            'transition-all hover:shadow-md cursor-pointer group',
            !isNotificationRead(notif) &&
              'border-l-4 border-l-destructive bg-destructive/10',
          ]"
          @click="emit('openDetail', notif, true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <AlertCircle
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-destructive shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base flex items-center gap-2"
                  >
                    <span class="truncate">{{
                      notif.title || "Purchase Request Subcon"
                    }}</span>
                    <span
                      v-if="!isNotificationRead(notif)"
                      class="h-2 w-2 rounded-full bg-destructive shrink-0"
                    ></span>
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-2">{{
                    notif.approval_message
                  }}</CardDescription>
                  <div
                    class="flex items-center gap-1 md:gap-2 text-xs text-muted-foreground"
                  >
                    <Clock class="h-3 w-3" />{{
                      formatDateTime(notif.createdAt)
                    }}
                  </div>
                  <div class="flex items-center flex-wrap gap-1 md:gap-2 mt-2">
                    <Badge variant="secondary" class="text-xs">
                      <Package class="h-3 w-3 mr-1 shrink-0" />{{
                        notif.t_purchase_request_subcon?.no_pr_subcon ||
                        notif.t_purchase_request_subcon_id ||
                        "N/A"
                      }}
                    </Badge>
                    <Badge variant="destructive" class="text-xs">REVISI</Badge>
                  </div>
                  <div
                    v-if="notif.approval_catatan"
                    class="mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20"
                  >
                    <p class="text-xs text-destructive line-clamp-3">
                      <span class="font-medium">Catatan Revisi:</span>
                      {{ notif.approval_catatan }}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                v-if="!isNotificationRead(notif)"
                variant="ghost"
                size="icon"
                class="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 md:h-8 md:w-8"
                @click.stop="emit('markAsRead', notif, $event)"
                title="Mark as read"
              >
                <Check class="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
