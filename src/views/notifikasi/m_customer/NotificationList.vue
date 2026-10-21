<script setup lang="ts">
import { computed } from "vue";
import { Users, Check, Clock, AlertCircle } from "lucide-vue-next";
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
</script>

<template>
  <AccordionItem
    v-if="notifications.length > 0"
    value="m-customer-approval"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Users class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Customer</span>
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
          v-for="notif in notifications"
          :key="notif.id"
          :class="[
            'transition-all hover:shadow-md cursor-pointer group',
            !isNotificationRead(notif) &&
              'border-l-4 border-l-primary bg-primary/10',
          ]"
          @click="emit('openDetail', notif)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0 space-y-1">
                <CardTitle class="text-sm md:text-base flex items-center gap-2">
                  <span class="truncate">{{
                    notif.title || "Customer Approval"
                  }}</span>
                </CardTitle>
                <CardDescription class="text-xs md:text-sm line-clamp-2">{{
                  notif.approval_message
                }}</CardDescription>
                <div class="text-xs text-muted-foreground">
                  <Clock class="h-3 w-3 inline mr-1" />
                  {{ formatDateTime(notif.createdAt) }}
                </div>
                <div class="flex gap-2 flex-wrap">
                  <Badge variant="secondary" class="text-xs">{{
                    notif.m_customer?.kode_customer || notif.m_customer_id || "-"
                  }}</Badge>
                  <Badge variant="outline" class="text-xs">{{
                    notif.status_name || "IN APPROVAL"
                  }}</Badge>
                </div>
              </div>
              <Button
                v-if="!isNotificationRead(notif)"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                @click.stop="emit('markAsRead', notif, $event)"
                title="Mark as read"
              >
                <Check class="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem
    v-if="pendingApprovalNotifications.length > 0"
    value="m-customer-pending"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Customer Menunggu Persetujuan</span>
        <Badge v-if="pendingUnreadCount > 0" variant="secondary" class="ml-1 md:ml-2 text-xs">{{ pendingUnreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="notif in pendingApprovalNotifications"
          :key="notif.id"
          class="cursor-pointer"
          @click="emit('openDetail', notif, true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <CardTitle class="text-sm md:text-base">{{ notif.title || "Customer" }}</CardTitle>
            <CardDescription class="text-xs md:text-sm line-clamp-2">{{ notif.approval_message }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem
    v-if="revisiNotifications.length > 0"
    value="m-customer-revisi"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Customer Revisi</span>
        <Badge v-if="revisiUnreadCount > 0" variant="destructive" class="ml-1 md:ml-2 text-xs">{{ revisiUnreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="notif in revisiNotifications"
          :key="notif.id"
          class="cursor-pointer"
          @click="emit('openDetail', notif, true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <CardTitle class="text-sm md:text-base">{{ notif.title || "Customer Revisi" }}</CardTitle>
            <CardDescription class="text-xs md:text-sm line-clamp-2">{{ notif.approval_message }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
