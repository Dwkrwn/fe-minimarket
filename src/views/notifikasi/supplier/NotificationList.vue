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
import type { SupplierNotification } from "./service.supplier";

const props = defineProps<{
  notifications: SupplierNotification[];
  revisiNotifications: SupplierNotification[];
  pendingApprovalNotifications: SupplierNotification[];
  isNotificationRead: (notif: SupplierNotification) => boolean;
}>();

const emit = defineEmits<{
  (e: "markAsRead", notif: SupplierNotification, event?: Event): void;
  (e: "openDetail", notif: SupplierNotification, isRevisi?: boolean): void;
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

const getNotifTitle = (notif: any) => {
  if (notif.title?.includes("undefined")) {
    return `Request Approval Supplier: ${notif.m_supplier?.nama_supp || notif.m_supplier?.kode_supplier || ""}`;
  }
  return notif.title || "Notification";
};
</script>

<template>
  <!-- Supplier Approval -->
  <AccordionItem v-if="hasNotifications" value="supplier">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Users class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"> Master Supplier</span>
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
                <Users
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-primary shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base font-semibold line-clamp-2"
                  >
                    {{ getNotifTitle(notif) }}
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-1">
                    {{ notif.approval_message }}
                  </CardDescription>
                  <div
                    class="flex items-center gap-1 md:gap-2 text-xs text-muted-foreground"
                  >
                    <span class="shrink-0">{{
                      formatDateTime(notif.createdAt)
                    }}</span>
                    <span v-if="notif.user_default?.name" class="truncate"
                      >• dari {{ notif.user_default.name }}</span
                    >
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

  <!-- Supplier Pending Approval -->
  <AccordionItem
    v-if="hasPendingNotifications"
    value="supplier-pending-approval"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"
          >Supplier Menunggu Persetujuan</span
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
                <Users
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-secondary-foreground shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base font-semibold line-clamp-2"
                  >
                    {{ getNotifTitle(notif) }}
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-1">
                    {{ notif.approval_message }}
                  </CardDescription>
                  <div
                    class="flex items-center gap-1 md:gap-2 text-xs text-muted-foreground"
                  >
                    <span class="shrink-0">{{
                      formatDateTime(notif.createdAt)
                    }}</span>
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

  <!-- Supplier Revisi -->
  <AccordionItem v-if="hasRevisiNotifications" value="supplier-revisi">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base"
          >Supplier Revisi Notifications</span
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
              'border-l-4 border-l-primary bg-primary/10',
          ]"
          @click="emit('openDetail', notif, true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <Users
                  class="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-primary shrink-0"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <CardTitle
                    class="text-sm md:text-base font-semibold line-clamp-2"
                  >
                    {{ getNotifTitle(notif) }}
                  </CardTitle>
                  <CardDescription class="text-xs md:text-sm line-clamp-1">
                    {{ notif.approval_message }}
                  </CardDescription>
                  <div
                    v-if="notif.approval_catatan"
                    class="text-xs text-destructive font-medium mt-1 line-clamp-2 bg-destructive/10 px-2 py-1 rounded"
                  >
                    Catatan Revisi: {{ notif.approval_catatan }}
                  </div>
                  <div
                    class="flex items-center gap-1 md:gap-2 text-xs text-muted-foreground"
                  >
                    <span class="shrink-0">{{
                      formatDateTime(notif.createdAt)
                    }}</span>
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
