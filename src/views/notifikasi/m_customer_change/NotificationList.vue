<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Clock, AlertCircle, RefreshCw } from "lucide-vue-next";
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
import {
  getCustomerChangeLogById,
  getCustomerChangeNotificationById,
} from "./service.m_customer_change";

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

type CustomerIdentity = {
  customerId: string;
  customerCode: string;
  customerName: string;
};

type GroupedNotification = {
  key: string;
  latest: any;
  rows: any[];
  unreadCount: number;
  customerCode: string;
  customerName: string;
};

const customerIdentityByNotificationId = ref<Record<string, CustomerIdentity>>({});
const hydratedNotificationIds = ref<Record<string, true>>({});
const isHydrating = ref(false);

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

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

const sortByLatest = (rows: any[]) =>
  [...rows].sort(
    (a, b) =>
      new Date(b.createdAt || b.updatedAt || 0).getTime() -
      new Date(a.createdAt || a.updatedAt || 0).getTime(),
  );

const getAllNotificationRows = () => [
  ...props.notifications,
  ...props.revisiNotifications,
  ...props.pendingApprovalNotifications,
];

const hydrateNotificationCustomerIdentities = async () => {
  if (isHydrating.value) return;

  const rowsToHydrate = getAllNotificationRows().filter((row) => {
    const key = String(row.id || "");
    return key && !hydratedNotificationIds.value[key];
  });

  if (rowsToHydrate.length === 0) return;

  isHydrating.value = true;
  try {
    const hydratedEntries = await Promise.all(
      rowsToHydrate.map(async (row) => {
        const notificationId = String(row.id || "");

        try {
          const detail = await getCustomerChangeNotificationById(notificationId);
          const logId = detail.m_customer_log_id || (row as any).m_customer_log_id;
          const changeLog =
            detail.m_customer_change_log ||
            (logId ? await getCustomerChangeLogById(String(logId)) : null);

          const customerId = String(changeLog?.customer_id || "");
          const customerCode = firstValue(
            changeLog?.m_customer?.kode_customer,
            detail.m_customer_change_log?.m_customer?.kode_customer,
            "-",
          );
          const customerName = firstValue(
            changeLog?.m_customer?.nama_customer,
            detail.m_customer_change_log?.m_customer?.nama_customer,
            detail.title,
            "Customer",
          );

          return {
            notificationId,
            identity: {
              customerId: customerId || notificationId,
              customerCode,
              customerName,
            },
          };
        } catch {
          return {
            notificationId,
            identity: {
              customerId: notificationId,
              customerCode: "-",
              customerName: row.title || "Customer",
            },
          };
        }
      }),
    );

    const nextIdentityMap = { ...customerIdentityByNotificationId.value };
    const nextHydratedIds = { ...hydratedNotificationIds.value };

    for (const entry of hydratedEntries) {
      nextIdentityMap[entry.notificationId] = entry.identity;
      nextHydratedIds[entry.notificationId] = true;
    }

    customerIdentityByNotificationId.value = nextIdentityMap;
    hydratedNotificationIds.value = nextHydratedIds;
  } finally {
    isHydrating.value = false;
  }
};

watch(
  () => getAllNotificationRows().map((row) => String(row.id || "")).join("|"),
  () => {
    hydrateNotificationCustomerIdentities();
  },
  { immediate: true },
);

const getCustomerIdentity = (notif: any): CustomerIdentity => {
  const notificationId = String(notif.id || "");
  const hydrated = customerIdentityByNotificationId.value[notificationId];

  if (hydrated) return hydrated;

  return {
    customerId: String(notif.m_customer_id || notif.ref_id || notif.id),
    customerCode: notif.m_customer?.kode_customer || notif.m_customer_id || "-",
    customerName: notif.m_customer?.nama_customer || notif.title || "Customer",
  };
};

const groupNotifications = (rows: any[]): GroupedNotification[] => {
  const grouped = new Map<string, any[]>();

  for (const notif of rows) {
    const identity = getCustomerIdentity(notif);
    const key = identity.customerId || String(notif.id);
    const current = grouped.get(key) || [];
    current.push(notif);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, items]) => {
      const sortedRows = sortByLatest(items);
      const latest = sortedRows[0];
      const identity = getCustomerIdentity(latest);

      return {
        key,
        latest,
        rows: sortedRows,
        unreadCount: sortedRows.filter((item) => !props.isNotificationRead(item))
          .length,
        customerCode: identity.customerCode,
        customerName: identity.customerName,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latest.createdAt || b.latest.updatedAt || 0).getTime() -
        new Date(a.latest.createdAt || a.latest.updatedAt || 0).getTime(),
    );
};

const groupedApprovalNotifications = computed(() =>
  groupNotifications(props.notifications),
);
const groupedRevisiNotifications = computed(() =>
  groupNotifications(props.revisiNotifications),
);
const groupedPendingNotifications = computed(() =>
  groupNotifications(props.pendingApprovalNotifications),
);

const unreadCount = computed(() =>
  groupedApprovalNotifications.value.reduce((total, group) => total + group.unreadCount, 0),
);
const revisiUnreadCount = computed(() =>
  groupedRevisiNotifications.value.reduce((total, group) => total + group.unreadCount, 0),
);
const pendingUnreadCount = computed(() =>
  groupedPendingNotifications.value.reduce((total, group) => total + group.unreadCount, 0),
);

const buildNotificationPayload = (
  notif: any,
  section: "approval" | "pending" | "revisi",
) => ({
  ...notif,
  _notificationSection: section,
});

const getSummaryText = (group: GroupedNotification) => {
  const count = group.rows.length;
  const baseMessage = group.latest.approval_message || "Pengajuan perubahan customer";

  if (count <= 1) return baseMessage;

  return `${count} perubahan kredit limit / ToP diajukan untuk customer ini.`;
};
</script>

<template>
  <AccordionItem
    v-if="groupedApprovalNotifications.length > 0"
    value="m-customer-change-approval"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <RefreshCw class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Perubahan Customer</span>
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
          v-for="group in groupedApprovalNotifications"
          :key="group.key"
          :class="[
            'transition-all hover:shadow-md cursor-pointer group',
            group.unreadCount > 0 && 'border-l-4 border-l-primary bg-primary/10',
          ]"
          @click="emit('openDetail', buildNotificationPayload(group.latest, 'approval'))"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0 space-y-1">
                <CardTitle class="text-sm md:text-base flex items-center gap-2 flex-wrap">
                  <span class="truncate">{{ group.customerName }}</span>
                  <Badge variant="secondary" class="text-xs">{{ group.customerCode }}</Badge>
                </CardTitle>
                <CardDescription class="text-xs md:text-sm line-clamp-2">{{
                  getSummaryText(group)
                }}</CardDescription>
                <div class="text-xs text-muted-foreground">
                  <Clock class="h-3 w-3 inline mr-1" />
                  {{ formatDateTime(group.latest.createdAt) }}
                </div>
                <div class="flex gap-2 flex-wrap">
                  <Badge variant="outline" class="text-xs">
                    {{ group.rows.length }} perubahan
                  </Badge>
                  <Badge v-if="group.unreadCount > 0" variant="destructive" class="text-xs">
                    {{ group.unreadCount }} unread
                  </Badge>
                </div>
              </div>
              <Button
                v-if="group.unreadCount > 0"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                @click.stop="emit('markAsRead', group.rows.find((row) => !isNotificationRead(row)) || group.latest, $event)"
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
    v-if="groupedPendingNotifications.length > 0"
    value="m-customer-change-pending"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Perubahan Customer Menunggu Persetujuan</span>
        <Badge v-if="pendingUnreadCount > 0" variant="secondary" class="ml-1 md:ml-2 text-xs">{{ pendingUnreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="group in groupedPendingNotifications"
          :key="group.key"
          class="cursor-pointer"
          @click="emit('openDetail', buildNotificationPayload(group.latest, 'pending'), true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <CardTitle class="text-sm md:text-base flex items-center gap-2 flex-wrap">
              <span>{{ group.customerName }}</span>
              <Badge variant="secondary" class="text-xs">{{ group.customerCode }}</Badge>
            </CardTitle>
            <CardDescription class="text-xs md:text-sm line-clamp-2">{{ getSummaryText(group) }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem
    v-if="groupedRevisiNotifications.length > 0"
    value="m-customer-change-revisi"
  >
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 md:h-5 md:w-5" />
        <span class="font-semibold text-sm md:text-base">Perubahan Customer Revisi</span>
        <Badge v-if="revisiUnreadCount > 0" variant="destructive" class="ml-1 md:ml-2 text-xs">{{ revisiUnreadCount }}</Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
        <Card
          v-for="group in groupedRevisiNotifications"
          :key="group.key"
          class="cursor-pointer"
          @click="emit('openDetail', buildNotificationPayload(group.latest, 'revisi'), true)"
        >
          <CardHeader class="p-3 md:p-4 md:pb-3">
            <CardTitle class="text-sm md:text-base flex items-center gap-2 flex-wrap">
              <span>{{ group.customerName }}</span>
              <Badge variant="secondary" class="text-xs">{{ group.customerCode }}</Badge>
            </CardTitle>
            <CardDescription class="text-xs md:text-sm line-clamp-2">{{ getSummaryText(group) }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
