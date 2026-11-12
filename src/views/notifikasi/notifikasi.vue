<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter, useRoute, onBeforeRouteUpdate } from "vue-router";
import {
  Bell,
  CheckCheck,
  Clock3,
  Info,
  ListChecks,
  RefreshCw,
  ShoppingCart,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Accordion } from "@/components/ui/accordion";
import { toast } from "vue-sonner";

// Import notification list components (hanya modul minimarket)
import PRNotificationList from "./pr/NotificationList.vue";
import PONotificationList from "./po/NotificationList.vue";
import PINotificationList from "./pi/NotificationList.vue";
import PReturnNotificationList from "./purchase_retrun/NotificationList.vue";
import PenerimaanGudangNotificationList from "./t_penerimaan_gudang/NotificationList.vue";
import SupplierNotificationList from "./supplier/NotificationList.vue";
import StockOpnameNotificationList from "./stock_opname/NotificationList.vue";
import StockGudangLockNotificationList from "./stock_opname/StockGudangLockNotificationList.vue";
import OutstandingNotificationList from "./outstanding/OutstandingNotificationList.vue";

// Import services
import {
  getUnifiedNotifications,
  markUnifiedNotificationAsRead,
  type NotificationItem,
} from "./service";

const STORAGE_KEY = "bb_read_notifications";

const canMarkNotificationAsRead = (notif: any) =>
  notif?.notification_category !== "outstanding" &&
  notif?.info_type !== "stock_opname_lock";

const markAsReadByType = (notif: any): Promise<any> => {
  if (!canMarkNotificationAsRead(notif)) {
    return Promise.resolve({ skipped: true });
  }
  return markUnifiedNotificationAsRead(notif);
};

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const refreshing = ref(false);
type NotificationTab = "all" | "approval" | "outstanding" | "info";

// Notification data
const activeNotificationType = ref<NotificationTab>("all");
const notificationCounts = ref({
  all: 0,
  approval: 0,
  outstanding: 0,
  info: 0,
});
const notifications = ref<NotificationItem[]>([]);
const revisiNotifications = ref<NotificationItem[]>([]);
const pendingApprovalNotifications = ref<NotificationItem[]>([]);
const outstandingNotifications = ref<any[]>([]);
const poNotifications = ref<any[]>([]);
const poRevisiNotifications = ref<any[]>([]);
const poPendingApprovalNotifications = ref<any[]>([]);
const piNotifications = ref<any[]>([]);
const piRevisiNotifications = ref<any[]>([]);
const piPendingApprovalNotifications = ref<any[]>([]);
const preturnNotifications = ref<any[]>([]);
const preturnRevisiNotifications = ref<any[]>([]);
const preturnPendingApprovalNotifications = ref<any[]>([]);
const pgNotifications = ref<any[]>([]);
const pgRevisiNotifications = ref<any[]>([]);
const pgPendingApprovalNotifications = ref<any[]>([]);
const supplierNotifications = ref<any[]>([]);
const supplierRevisiNotifications = ref<any[]>([]);
const supplierPendingApprovalNotifications = ref<any[]>([]);
const stockGudangLockNotifications = ref<any[]>([]);
const stockOpnameNotifications = ref<any[]>([]);
const stockOpnameRevisiNotifications = ref<any[]>([]);
const stockOpnamePendingApprovalNotifications = ref<any[]>([]);

const page = ref(1);
const limit = ref(10);
const openAccordions = ref<string[]>([]);
const readNotificationIds = ref<Set<string>>(new Set());

const notificationTabs = [
  {
    value: "all" as const,
    label: "All",
    icon: ListChecks,
    description: "Semua prioritas aktif",
  },
  {
    value: "approval" as const,
    label: "Approval",
    icon: Clock3,
    description: "Butuh persetujuan",
  },
  {
    value: "outstanding" as const,
    label: "Outstanding",
    icon: ShoppingCart,
    description: "PR dan PO tersisa",
  },
  {
    value: "info" as const,
    label: "Info",
    icon: Info,
    description: "Revisi dan lock",
  },
];

// localStorage functions
const loadReadNotifications = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored)
      readNotificationIds.value = new Set(JSON.parse(stored) as string[]);
  } catch (e) {
    console.error("Failed to load read notifications:", e);
  }
};

const saveReadNotifications = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(readNotificationIds.value)),
    );
    window.dispatchEvent(new CustomEvent("notificationRead"));
  } catch (e) {
    console.error("Failed to save read notifications:", e);
  }
};

const isNotificationRead = (notif: any) =>
  !canMarkNotificationAsRead(notif) ||
  notif.status ||
  readNotificationIds.value.has(notif.id);

// Computed - separate by type
const purchaseRequestNotifications = computed(() =>
  notifications.value.filter((n) => n.notification_type === "purchase_request"),
);

// Unread counts
const prUnreadCount = computed(
  () =>
    purchaseRequestNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const revisiUnreadCount = computed(
  () => revisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const pendingApprovalUnreadCount = computed(
  () =>
    pendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const outstandingUnreadCount = computed(
  () =>
    outstandingNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const poUnreadCount = computed(
  () => poNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const poRevisiUnreadCount = computed(
  () =>
    poRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const poPendingUnreadCount = computed(
  () =>
    poPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const piUnreadCount = computed(
  () => piNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const piRevisiUnreadCount = computed(
  () =>
    piRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const piPendingUnreadCount = computed(
  () =>
    piPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const preturnUnreadCount = computed(
  () => preturnNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const preturnRevisiUnreadCount = computed(
  () =>
    preturnRevisiNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const preturnPendingUnreadCount = computed(
  () =>
    preturnPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const pgUnreadCount = computed(
  () => pgNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const pgRevisiUnreadCount = computed(
  () =>
    pgRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const pgPendingUnreadCount = computed(
  () =>
    pgPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const supplierUnreadCount = computed(
  () =>
    supplierNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const supplierRevisiUnreadCount = computed(
  () =>
    supplierRevisiNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const supplierPendingUnreadCount = computed(
  () =>
    supplierPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const stockOpnameUnreadCount = computed(
  () =>
    stockOpnameNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const stockGudangLockUnreadCount = computed(
  () =>
    stockGudangLockNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const stockOpnameRevisiUnreadCount = computed(
  () =>
    stockOpnameRevisiNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const stockOpnamePendingUnreadCount = computed(
  () =>
    stockOpnamePendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const totalUnreadCount = computed<number>(() => {
  return (
    prUnreadCount.value +
    revisiUnreadCount.value +
    pendingApprovalUnreadCount.value +
    outstandingUnreadCount.value +
    poUnreadCount.value +
    poRevisiUnreadCount.value +
    poPendingUnreadCount.value +
    piUnreadCount.value +
    piRevisiUnreadCount.value +
    piPendingUnreadCount.value +
    preturnUnreadCount.value +
    preturnRevisiUnreadCount.value +
    preturnPendingUnreadCount.value +
    pgUnreadCount.value +
    pgRevisiUnreadCount.value +
    pgPendingUnreadCount.value +
    supplierUnreadCount.value +
    supplierRevisiUnreadCount.value +
    supplierPendingUnreadCount.value +
    stockGudangLockUnreadCount.value +
    stockOpnameUnreadCount.value +
    stockOpnameRevisiUnreadCount.value +
    stockOpnamePendingUnreadCount.value
  );
});

// Check if has any notifications
const hasAnyNotifications = computed<boolean>(() => {
  return (
    purchaseRequestNotifications.value.length > 0 ||
    revisiNotifications.value.length > 0 ||
    pendingApprovalNotifications.value.length > 0 ||
    outstandingNotifications.value.length > 0 ||
    poNotifications.value.length > 0 ||
    poRevisiNotifications.value.length > 0 ||
    poPendingApprovalNotifications.value.length > 0 ||
    piNotifications.value.length > 0 ||
    piRevisiNotifications.value.length > 0 ||
    piPendingApprovalNotifications.value.length > 0 ||
    preturnNotifications.value.length > 0 ||
    preturnRevisiNotifications.value.length > 0 ||
    preturnPendingApprovalNotifications.value.length > 0 ||
    pgNotifications.value.length > 0 ||
    pgRevisiNotifications.value.length > 0 ||
    pgPendingApprovalNotifications.value.length > 0 ||
    supplierNotifications.value.length > 0 ||
    supplierRevisiNotifications.value.length > 0 ||
    supplierPendingApprovalNotifications.value.length > 0 ||
    stockGudangLockNotifications.value.length > 0 ||
    stockOpnameNotifications.value.length > 0 ||
    stockOpnameRevisiNotifications.value.length > 0 ||
    stockOpnamePendingApprovalNotifications.value.length > 0
  );
});

const fetchNotifications = async (showLoading = true) => {
  try {
    if (showLoading) loading.value = true;
    else refreshing.value = true;
    const unifiedResponse = await getUnifiedNotifications(
      page.value,
      100,
      !showLoading,
      activeNotificationType.value,
    );
    const approvalRows = unifiedResponse.data?.approval || [];
    const outstandingRows = unifiedResponse.data?.outstanding || [];
    const infoRows = unifiedResponse.data?.info || [];
    const revisiRows =
      unifiedResponse.data?.revisi ||
      infoRows.filter(
        (row: any) =>
          row.info_type === "revisi" || row.status_name === "REVISI",
      );
    const pendingRows =
      unifiedResponse.data?.pending_approval ||
      infoRows.filter(
        (row: any) =>
          row.info_type === "pending_approval" ||
          row.status_name === "IN APPROVAL",
      );

    if (unifiedResponse.counts) {
      notificationCounts.value =
        activeNotificationType.value === "all"
          ? {
              all: unifiedResponse.counts.all || 0,
              approval: unifiedResponse.counts.approval || 0,
              outstanding: unifiedResponse.counts.outstanding || 0,
              info: unifiedResponse.counts.info || 0,
            }
          : {
              ...notificationCounts.value,
              [activeNotificationType.value]:
                unifiedResponse.counts[activeNotificationType.value] || 0,
            };
    }

    const byType = (rows: any[], type: string) =>
      rows.filter((row) => row.notification_type === type);

    if (unifiedResponse.active_ids?.length) {
      const validIds = new Set(
        (unifiedResponse.active_ids || []).map((id) => String(id)),
      );
      const cleanedIds = [...readNotificationIds.value].filter((id) =>
        validIds.has(id),
      );
      if (cleanedIds.length !== readNotificationIds.value.size) {
        readNotificationIds.value = new Set(cleanedIds);
        saveReadNotifications();
      }
    }

    // Merge pendingRows into approvalRows to prevent double data and unify into single module lists
    const seenApprovalKeys = new Set<string>();
    const combinedApprovalRows: any[] = [];
    for (const item of [...approvalRows, ...pendingRows]) {
      const key = String(
        item.id ||
        item.t_purchase_request_id ||
        item.t_purchase_order_id ||
        item.t_purchase_invoice_id ||
        item.t_purchase_return_id ||
        item.t_penerimaan_gudang_id ||
        item.t_stock_opname_id ||
        item.ref_id ||
        `${item.notification_type}_${item.id}`
      );
      if (!seenApprovalKeys.has(key)) {
        seenApprovalKeys.add(key);
        combinedApprovalRows.push(item);
      }
    }

    notifications.value = byType(combinedApprovalRows, "purchase_request");
    revisiNotifications.value = byType(revisiRows, "purchase_request");
    pendingApprovalNotifications.value = [];
    outstandingNotifications.value = outstandingRows;

    poNotifications.value = byType(combinedApprovalRows, "purchase_order");
    poRevisiNotifications.value = byType(revisiRows, "purchase_order");
    poPendingApprovalNotifications.value = [];

    piNotifications.value = byType(combinedApprovalRows, "purchase_invoice");
    piRevisiNotifications.value = byType(revisiRows, "purchase_invoice");
    piPendingApprovalNotifications.value = [];

    preturnNotifications.value = byType(combinedApprovalRows, "purchase_return");
    preturnRevisiNotifications.value = byType(revisiRows, "purchase_return");
    preturnPendingApprovalNotifications.value = [];

    pgNotifications.value = byType(combinedApprovalRows, "penerimaan_gudang");
    pgRevisiNotifications.value = byType(revisiRows, "penerimaan_gudang");
    pgPendingApprovalNotifications.value = [];

    supplierNotifications.value = byType(combinedApprovalRows, "supplier");
    supplierRevisiNotifications.value = byType(revisiRows, "supplier");
    supplierPendingApprovalNotifications.value = [];

    stockOpnameNotifications.value = byType(
      combinedApprovalRows,
      "stock_opname",
    ).filter((n: any) => n.status_name !== "LOCKED");
    stockGudangLockNotifications.value = byType(
      infoRows,
      "stock_opname",
    ).filter(
      (n: any) =>
        n.info_type === "stock_opname_lock" || n.status_name === "LOCKED",
    );
    stockOpnameRevisiNotifications.value = byType(revisiRows, "stock_opname");
    stockOpnamePendingApprovalNotifications.value = [];

    // All accordions stay collapsed by default
    openAccordions.value = [];
  } catch (error: any) {
    toast.error("Failed to load notifications", {
      description: error.message || "An error occurred",
    });
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const handleOpenDetail = (notif: any, isRevisiSection = false) => {
  if (notif.notification_category === "outstanding") {
    if (notif.outstanding_type === "purchase_request")
      router.push("/purchasing/order/auto-pr");
    else if (notif.outstanding_type === "purchase_order")
      router.push(
        `/purchasing/order/purchase-orders/view/${notif.ref_id}`,
      );
    return;
  }

  if (notif.notification_type === "purchase_request") {
    if (notif.status_name === "REVISI" || isRevisiSection)
      router.push("/purchasing/order/auto-pr");
    else router.push(`/notifikasi/purchase-request/${notif.id}`);
  } else if (notif.notification_type === "purchase_order") {
    if (notif.status_name === "REVISI" || isRevisiSection)
      router.push(
        `/purchasing/order/purchase-orders/view/${notif.t_purchase_order_id}`,
      );
    else router.push(`/notifikasi/purchase-order/${notif.id}`);
  } else if (notif.notification_type === "purchase_invoice") {
    if (notif.status_name === "REVISI" || isRevisiSection)
      router.push("/purchasing/order/purchase-orders");
    else router.push(`/notifikasi/purchase_invoice/${notif.id}`);
  } else if (notif.notification_type === "purchase_return") {
    if (notif.status_name === "REVISI" || isRevisiSection)
      router.push("/purchasing/receiving/purchase-returns");
    else router.push(`/notifikasi/purchase-return/${notif.id}`);
  } else if (notif.notification_type === "penerimaan_gudang") {
    if (notif.status_name === "REVISI" || isRevisiSection)
      router.push(
        `/purchasing/receiving/goods-receipts/view/${notif.t_penerimaan_gudang_id}`,
      );
    else router.push(`/notifikasi/penerimaan_gudang/${notif.id}`);
  } else if (notif.notification_type === "supplier") {
    if (notif.status_name === "REVISI")
      router.push(`/purchasing/master/suppliers/form/${notif.m_supplier_id}`);
    else if (isRevisiSection)
      router.push(`/purchasing/master/suppliers/view/${notif.m_supplier_id}`);
    else router.push(`/notifikasi/supplier/${notif.id}`);
  } else if (notif.notification_type === "stock_opname") {
    const opnameId = notif.t_stock_opname_id || notif.ref_id;
    router.push(
      opnameId
        ? `/inventory/opname/fisik/${opnameId}`
        : "/inventory/opname/fisik",
    );
  } else {
    // Notifikasi item & tipe lain yang tidak punya halaman form/view khusus
    router.push(`/notifikasi/${notif.id}`);
  }
};

const handleMarkAsRead = async (notif: any, e?: Event) => {
  if (e) e.stopPropagation();
  if (!canMarkNotificationAsRead(notif)) {
    toast.info(
      "Notifikasi ini mengikuti status transaksi dan tidak bisa ditandai read.",
    );
    return;
  }

  try {
    await markAsReadByType(notif);
    readNotificationIds.value.add(notif.id);
    saveReadNotifications();
    notif.status = true;
    toast.success("Notification marked as read");
  } catch (error: any) {
    toast.error("Failed to mark as read", { description: error.message });
  }
};

const markAllAsRead = async () => {
  const allUnread = [
    ...notifications.value,
    ...revisiNotifications.value,
    ...pendingApprovalNotifications.value,
    ...outstandingNotifications.value,
    ...poNotifications.value,
    ...poRevisiNotifications.value,
    ...poPendingApprovalNotifications.value,
    ...piNotifications.value,
    ...piRevisiNotifications.value,
    ...piPendingApprovalNotifications.value,
    ...preturnNotifications.value,
    ...preturnRevisiNotifications.value,
    ...preturnPendingApprovalNotifications.value,
    ...pgNotifications.value,
    ...pgRevisiNotifications.value,
    ...pgPendingApprovalNotifications.value,
    ...supplierNotifications.value,
    ...supplierRevisiNotifications.value,
    ...supplierPendingApprovalNotifications.value,
    ...stockGudangLockNotifications.value,
    ...stockOpnameNotifications.value,
    ...stockOpnameRevisiNotifications.value,
    ...stockOpnamePendingApprovalNotifications.value,
  ].filter((n) => canMarkNotificationAsRead(n) && !isNotificationRead(n));

  if (allUnread.length === 0) {
    toast.info("No unread notifications");
    return;
  }

  const results = await Promise.allSettled(
    allUnread.map((n) => markAsReadByType(n)),
  );
  const successItems = allUnread.filter(
    (_, index) => results[index]?.status === "fulfilled",
  );

  successItems.forEach((n) => {
    readNotificationIds.value.add(n.id);
    n.status = true;
  });
  saveReadNotifications();

  if (successItems.length) {
    toast.success(`${successItems.length} notifications marked as read`);
  }
  if (successItems.length < allUnread.length) {
    toast.error(
      `${allUnread.length - successItems.length} notifications failed to mark as read`,
    );
  }
};

const getTabCount = (type: NotificationTab) =>
  notificationCounts.value[type] || 0;

const setNotificationType = async (type: NotificationTab) => {
  if (activeNotificationType.value === type) return;
  activeNotificationType.value = type;
  openAccordions.value = [];
  await fetchNotifications(true);
};

const refreshNotifications = () => fetchNotifications(false);

const handleNotificationsUpdated = () => {
  fetchNotifications(true);
};

const handleWindowFocus = () => {
  fetchNotifications(true);
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    fetchNotifications(true);
  }
};

onMounted(() => {
  loadReadNotifications();
  fetchNotifications(true);
  window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
  window.addEventListener("focus", handleWindowFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  window.removeEventListener(
    "notificationsUpdated",
    handleNotificationsUpdated,
  );
  window.removeEventListener("focus", handleWindowFocus);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

watch(
  () => route.fullPath,
  () => {
    fetchNotifications(true);
  },
);

onBeforeRouteUpdate(() => {
  fetchNotifications(true);
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 100, damping: 15 },
      }"
    >
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">
        Notifications
      </h1>
      <div class="flex items-center gap-2">
        <Button
          v-if="totalUnreadCount > 0"
          @click="markAllAsRead"
          variant="outline"
          size="sm"
          class="gap-1 md:gap-2 text-xs md:text-sm"
        >
          <CheckCheck class="h-3 w-3 md:h-4 md:w-4" />
          <span class="hidden xs:inline">Mark All</span>
          <Badge variant="secondary" class="ml-1 text-xs">{{
            totalUnreadCount
          }}</Badge>
        </Button>
        <Button
          @click="refreshNotifications"
          variant="outline"
          size="icon"
          :disabled="refreshing"
          class="h-8 w-8 md:h-9 md:w-9"
        >
          <RefreshCw
            :class="['h-3 w-3 md:h-4 md:w-4', refreshing && 'animate-spin']"
          />
        </Button>
      </div>
    </div>

    <Separator />

    <div
      v-if="!loading"
      class="rounded-lg border bg-card/80 p-3 shadow-sm"
      v-motion
      :initial="{ opacity: 0, y: -6 }"
      :enter="{
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 130, damping: 18 },
      }"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <button
          v-for="tab in notificationTabs"
          :key="tab.value"
          type="button"
          :class="[
            'group min-h-[104px] rounded-md border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            activeNotificationType === tab.value
              ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
          ]"
          @click="setNotificationType(tab.value)"
        >
          <div class="flex h-full items-center gap-3">
            <span
              :class="[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors',
                activeNotificationType === tab.value
                  ? 'border-primary-foreground/30 bg-primary-foreground/15'
                  : 'border-border bg-background/70 text-muted-foreground group-hover:text-foreground',
              ]"
            >
              <component :is="tab.icon" class="h-5 w-5" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold md:text-base">{{
                tab.label
              }}</span>
              <span
                :class="[
                  'mt-0.5 block truncate text-xs',
                  activeNotificationType === tab.value
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground',
                ]"
              >
                {{ tab.description }}
              </span>
            </span>

            <Badge
              :variant="
                activeNotificationType === tab.value ? 'secondary' : 'secondary'
              "
              :class="[
                'ml-auto h-6 min-w-6 justify-center rounded-full px-2 text-xs transition-colors',
                activeNotificationType === tab.value
                  ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                  : 'bg-background/80 text-foreground',
              ]"
            >
              {{ getTabCount(tab.value) }}
            </Badge>
          </div>
        </button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div class="rounded-lg border bg-card/80 p-3 shadow-sm">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div
            v-for="i in 4"
            :key="`filter-skeleton-${i}`"
            class="min-h-[104px] rounded-md border bg-muted/20 p-4"
          >
            <div class="flex h-full items-center gap-3">
              <Skeleton class="h-10 w-10 shrink-0 rounded-md" />
              <div class="min-w-0 flex-1 space-y-2">
                <Skeleton class="h-4 w-24" />
                <Skeleton class="h-3 w-32 max-w-full" />
              </div>
              <Skeleton class="h-6 w-8 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div class="divide-y rounded-lg border bg-card/40">
        <div
          v-for="i in 7"
          :key="`notification-row-skeleton-${i}`"
          class="flex items-center gap-3 px-3 py-4 md:px-4"
        >
          <Skeleton class="h-9 w-9 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <Skeleton class="h-4 w-44 max-w-[55vw]" />
              <Skeleton class="h-5 w-8 rounded-full" />
              <Skeleton v-if="i % 2 === 0" class="h-5 w-16 rounded-full" />
            </div>
            <Skeleton class="h-3 w-64 max-w-[70vw]" />
          </div>
          <Skeleton class="ml-auto h-4 w-4 shrink-0 rounded" />
        </div>
      </div>
    </div>

    <!-- Notification Lists -->
    <Accordion
      v-if="!loading"
      type="multiple"
      class="w-full"
      v-model="openAccordions"
    >
      <StockGudangLockNotificationList
        v-if="
          activeNotificationType === 'all' || activeNotificationType === 'info'
        "
        :notifications="stockGudangLockNotifications"
        :is-notification-read="isNotificationRead"
        @open-detail="handleOpenDetail"
      />

      <OutstandingNotificationList
        v-if="
          activeNotificationType === 'all' ||
          activeNotificationType === 'outstanding'
        "
        :notifications="outstandingNotifications"
        :is-notification-read="isNotificationRead"
        @open-detail="handleOpenDetail"
      />

      <template v-if="activeNotificationType !== 'outstanding'">
        <PRNotificationList
          :notifications="purchaseRequestNotifications"
          :revisi-notifications="
            revisiNotifications.filter(
              (n) => n.notification_type === 'purchase_request',
            )
          "
          :pending-approval-notifications="
            pendingApprovalNotifications.filter(
              (n) => n.notification_type === 'purchase_request',
            )
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PONotificationList
          :notifications="poNotifications"
          :revisi-notifications="poRevisiNotifications"
          :pending-approval-notifications="poPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PINotificationList
          :notifications="piNotifications"
          :revisi-notifications="piRevisiNotifications"
          :pending-approval-notifications="piPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PReturnNotificationList
          :notifications="preturnNotifications"
          :revisi-notifications="preturnRevisiNotifications"
          :pending-approval-notifications="preturnPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PenerimaanGudangNotificationList
          :notifications="pgNotifications"
          :revisi-notifications="pgRevisiNotifications"
          :pending-approval-notifications="pgPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <SupplierNotificationList
          :notifications="supplierNotifications"
          :revisi-notifications="supplierRevisiNotifications"
          :pending-approval-notifications="supplierPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <StockOpnameNotificationList
          :notifications="stockOpnameNotifications"
          :revisi-notifications="stockOpnameRevisiNotifications"
          :pending-approval-notifications="
            stockOpnamePendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />
      </template>
    </Accordion>

    <!-- Empty State -->
    <div
      v-if="!loading && !hasAnyNotifications"
      class="text-center py-12 md:py-16"
    >
      <Bell
        class="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3 md:mb-4"
      />
      <h3 class="text-lg md:text-xl font-semibold mb-1 md:mb-2">
        No notifications
      </h3>
      <p class="text-sm text-muted-foreground">
        You're all caught up! Check back later.
      </p>
    </div>
  </div>
</template>
