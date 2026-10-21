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

// Import notification list components
// import ItemNotificationList from './item/NotificationList.vue'
import IoNotificationList from "./io/NotificationList.vue";
import WoNotificationList from "./wo/NotificationList.vue";
import PRNotificationList from "./pr/NotificationList.vue";
import PONotificationList from "./po/NotificationList.vue";
import PINotificationList from "./pi/NotificationList.vue";
import PRCNotificationList from "./purchase_request_close/NotificationList.vue";
import POCNotificationList from "./purchase_order_close/NotificationList.vue";
import PReturnNotificationList from "./purchase_retrun/NotificationList.vue";
import PenerimaanGudangNotificationList from "./t_penerimaan_gudang/NotificationList.vue";
import SupplierNotificationList from "./supplier/NotificationList.vue";
import StockOpnameNotificationList from "./stock_opname/NotificationList.vue";
import StockGudangLockNotificationList from "./stock_opname/StockGudangLockNotificationList.vue";
import StockAdjNotificationList from "./stock_adjustment/NotificationList.vue";
import TransferGudangNotificationList from "./transfer_gudang/NotificationList.vue";
import TransformItemNotificationList from "./transform_item/NotificationList.vue";
import PurchaseRequestSubconNotificationList from "./purchase_request_subcon/NotificationList.vue";
import PurchaseOrderSubconNotificationList from "./purchase_order_subcon/NotificationList.vue";
import PurchaseInvoiceSubconNotificationList from "./purchase_invoice_subcon/NotificationList.vue";
import PurchaseReturnSubconNotificationList from "./purchase_return_subcon/NotificationList.vue";
import CustomerNotificationList from "./m_customer/NotificationList.vue";
import CustomerChangeNotificationList from "./m_customer_change/NotificationList.vue";
import OutstandingNotificationList from "./outstanding/OutstandingNotificationList.vue";
import PrecostNotificationList from "./precost/NotificationList.vue";
import MtfNotificationList from "./mtf/NotificationList.vue";
import MrqNotificationList from "./mrq/NotificationList.vue";
import RcNotificationList from "./rc/NotificationList.vue";

// Import services
import {
  getUnifiedNotifications,
  markUnifiedNotificationAsRead,
  type NotificationItem,
} from "./service";
import {
  getMrqNotifications,
  getMrqRevisiNotifications,
  getPendingMrqNotifications,
  markMrqNotificationAsRead,
} from "./service.mrq";

const STORAGE_KEY = "bb_read_notifications";

const canMarkNotificationAsRead = (notif: any) =>
  notif?.notification_category !== "outstanding" &&
  notif?.info_type !== "stock_opname_lock";

const markAsReadByType = (notif: any): Promise<any> => {
  if (!canMarkNotificationAsRead(notif)) {
    return Promise.resolve({ skipped: true });
  }

  if (notif.notification_type === "mrq") {
    return markMrqNotificationAsRead(notif.id);
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
const prcNotifications = ref<any[]>([]);
const prcRevisiNotifications = ref<any[]>([]);
const prcPendingApprovalNotifications = ref<any[]>([]);
const pocNotifications = ref<any[]>([]);
const pocRevisiNotifications = ref<any[]>([]);
const pocPendingApprovalNotifications = ref<any[]>([]);
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
const stockAdjNotifications = ref<any[]>([]);
const stockAdjRevisiNotifications = ref<any[]>([]);
const stockAdjPendingApprovalNotifications = ref<any[]>([]);
const tgNotifications = ref<any[]>([]);
const tgRevisiNotifications = ref<any[]>([]);
const tgPendingApprovalNotifications = ref<any[]>([]);
const transformItemNotifications = ref<any[]>([]);
const transformItemRevisiNotifications = ref<any[]>([]);
const transformItemPendingApprovalNotifications = ref<any[]>([]);
const purchaseRequestSubconNotifications = ref<any[]>([]);
const purchaseRequestSubconRevisiNotifications = ref<any[]>([]);
const purchaseRequestSubconPendingApprovalNotifications = ref<any[]>([]);
const purchaseOrderSubconNotifications = ref<any[]>([]);
const purchaseOrderSubconRevisiNotifications = ref<any[]>([]);
const purchaseOrderSubconPendingApprovalNotifications = ref<any[]>([]);

const purchaseInvoiceSubconNotifications = ref<any[]>([]);
const purchaseInvoiceSubconRevisiNotifications = ref<any[]>([]);
const purchaseInvoiceSubconPendingApprovalNotifications = ref<any[]>([]);

const purchaseReturnSubconNotifications = ref<any[]>([]);
const purchaseReturnSubconRevisiNotifications = ref<any[]>([]);
const purchaseReturnSubconPendingApprovalNotifications = ref<any[]>([]);

const customerNotifications = ref<any[]>([]);
const customerRevisiNotifications = ref<any[]>([]);
const customerPendingApprovalNotifications = ref<any[]>([]);
const customerChangeNotifications = ref<any[]>([]);
const customerChangeRevisiNotifications = ref<any[]>([]);
const customerChangePendingApprovalNotifications = ref<any[]>([]);

const ioNotifications = ref<any[]>([]);
const ioRevisiNotifications = ref<any[]>([]);
const ioPendingApprovalNotifications = ref<any[]>([]);

const precostNotifications = ref<any[]>([]);
const precostRevisiNotifications = ref<any[]>([]);
const precostPendingApprovalNotifications = ref<any[]>([]);

const mtfNotifications = ref<any[]>([]);
const mtfRevisiNotifications = ref<any[]>([]);
const mtfPendingApprovalNotifications = ref<any[]>([]);

const mrqNotifications = ref<any[]>([]);
const mrqRevisiNotifications = ref<any[]>([]);
const mrqPendingApprovalNotifications = ref<any[]>([]);

const rcNotifications = ref<any[]>([]);
const rcRevisiNotifications = ref<any[]>([]);
const rcPendingApprovalNotifications = ref<any[]>([]);

const woNotifications = ref<any[]>([]);
const woRevisiNotifications = ref<any[]>([]);
const woPendingApprovalNotifications = ref<any[]>([]);

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
// const itemsNotifications = computed(() => notifications.value.filter(n => n.notification_type === 'items'))
const purchaseRequestNotifications = computed(() =>
  notifications.value.filter((n) => n.notification_type === "purchase_request"),
);

// Unread counts
// const itemsUnreadCount = computed(() => itemsNotifications.value.filter(n => !isNotificationRead(n)).length)
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
const prcUnreadCount = computed(
  () => prcNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const prcRevisiUnreadCount = computed(
  () =>
    prcRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const prcPendingUnreadCount = computed(
  () =>
    prcPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const pocUnreadCount = computed(
  () => pocNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const pocRevisiUnreadCount = computed(
  () =>
    pocRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const pocPendingUnreadCount = computed(
  () =>
    pocPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
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
const stockAdjUnreadCount = computed(
  () =>
    stockAdjNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const stockAdjRevisiUnreadCount = computed(
  () =>
    stockAdjRevisiNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const stockAdjPendingUnreadCount = computed(
  () =>
    stockAdjPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const tgUnreadCount = computed(
  () => tgNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const tgRevisiUnreadCount = computed(
  () =>
    tgRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const tgPendingUnreadCount = computed(
  () =>
    tgPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const transformItemUnreadCount = computed(
  () =>
    transformItemNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const transformItemRevisiUnreadCount = computed(
  () =>
    transformItemRevisiNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const transformItemPendingUnreadCount = computed(
  () =>
    transformItemPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const purchaseRequestSubconUnreadCount = computed(
  () =>
    purchaseRequestSubconNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const purchaseRequestSubconRevisiUnreadCount = computed(
  () =>
    purchaseRequestSubconRevisiNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const purchaseRequestSubconPendingUnreadCount = computed(
  () =>
    purchaseRequestSubconPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const purchaseOrderSubconUnreadCount = computed(
  () =>
    purchaseOrderSubconNotifications.value.filter((n) => !isNotificationRead(n))
      .length,
);
const purchaseOrderSubconRevisiUnreadCount = computed(
  () =>
    purchaseOrderSubconRevisiNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const purchaseOrderSubconPendingUnreadCount = computed(
  () =>
    purchaseOrderSubconPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const purchaseInvoiceSubconUnreadCount = computed(
  () =>
    purchaseInvoiceSubconNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const purchaseInvoiceSubconRevisiUnreadCount = computed(
  () =>
    purchaseInvoiceSubconRevisiNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const purchaseInvoiceSubconPendingUnreadCount = computed(
  () =>
    purchaseInvoiceSubconPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const purchaseReturnSubconUnreadCount = computed(
  () =>
    purchaseReturnSubconNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const purchaseReturnSubconRevisiUnreadCount = computed(
  () =>
    purchaseReturnSubconRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const purchaseReturnSubconPendingUnreadCount = computed(
  () =>
    purchaseReturnSubconPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const customerUnreadCount = computed(
  () => customerNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const customerRevisiUnreadCount = computed(
  () =>
    customerRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const customerPendingUnreadCount = computed(
  () =>
    customerPendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);
const customerChangeUnreadCount = computed(
  () => customerChangeNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const customerChangeRevisiUnreadCount = computed(
  () =>
    customerChangeRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const customerChangePendingUnreadCount = computed(
  () =>
    customerChangePendingApprovalNotifications.value.filter(
      (n) => !isNotificationRead(n),
    ).length,
);

const ioUnreadCount = computed(
  () => ioNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const ioRevisiUnreadCount = computed(
  () => ioRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const ioPendingUnreadCount = computed(
  () => ioPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const precostUnreadCount = computed(
  () => precostNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const precostRevisiUnreadCount = computed(
  () => precostRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const precostPendingUnreadCount = computed(
  () => precostPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const mtfUnreadCount = computed(
  () => mtfNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const mtfRevisiUnreadCount = computed(
  () => mtfRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const mtfPendingUnreadCount = computed(
  () => mtfPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const mrqUnreadCount = computed(
  () => mrqNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const mrqRevisiUnreadCount = computed(
  () => mrqRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const mrqPendingUnreadCount = computed(
  () => mrqPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const rcUnreadCount = computed(
  () => rcNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const rcRevisiUnreadCount = computed(
  () => rcRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const rcPendingUnreadCount = computed(
  () => rcPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const woUnreadCount = computed(
  () => woNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const woRevisiUnreadCount = computed(
  () => woRevisiNotifications.value.filter((n) => !isNotificationRead(n)).length,
);
const woPendingUnreadCount = computed(
  () => woPendingApprovalNotifications.value.filter((n) => !isNotificationRead(n)).length,
);

const totalUnreadCount = computed<number>(() => {
  return (
    /* itemsUnreadCount.value + */ prUnreadCount.value +
    revisiUnreadCount.value +
    pendingApprovalUnreadCount.value +
    outstandingUnreadCount.value +
    poUnreadCount.value +
    poRevisiUnreadCount.value +
    poPendingUnreadCount.value +
    piUnreadCount.value +
    piRevisiUnreadCount.value +
    piPendingUnreadCount.value +
    prcUnreadCount.value +
    prcRevisiUnreadCount.value +
    prcPendingUnreadCount.value +
    pocUnreadCount.value +
    pocRevisiUnreadCount.value +
    pocPendingUnreadCount.value +
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
    stockOpnamePendingUnreadCount.value +
    stockAdjUnreadCount.value +
    stockAdjRevisiUnreadCount.value +
    stockAdjPendingUnreadCount.value +
    tgUnreadCount.value +
    tgRevisiUnreadCount.value +
    tgPendingUnreadCount.value +
    transformItemUnreadCount.value +
    transformItemRevisiUnreadCount.value +
    transformItemPendingUnreadCount.value +
    purchaseRequestSubconUnreadCount.value +
    purchaseRequestSubconRevisiUnreadCount.value +
    purchaseRequestSubconPendingUnreadCount.value +
    purchaseOrderSubconUnreadCount.value +
    purchaseOrderSubconRevisiUnreadCount.value +
    purchaseOrderSubconPendingUnreadCount.value +
    purchaseInvoiceSubconUnreadCount.value +
    purchaseInvoiceSubconRevisiUnreadCount.value +
    purchaseInvoiceSubconPendingUnreadCount.value +
    purchaseReturnSubconUnreadCount.value +
    purchaseReturnSubconRevisiUnreadCount.value +
    purchaseReturnSubconPendingUnreadCount.value +
    customerUnreadCount.value +
    customerRevisiUnreadCount.value +
    customerPendingUnreadCount.value +
    customerChangeUnreadCount.value +
    customerChangeRevisiUnreadCount.value +
    customerChangePendingUnreadCount.value +
    ioUnreadCount.value +
    ioRevisiUnreadCount.value +
    ioPendingUnreadCount.value +
    precostUnreadCount.value +
    precostRevisiUnreadCount.value +
    precostPendingUnreadCount.value +
    mtfUnreadCount.value +
    mtfRevisiUnreadCount.value +
    mtfPendingUnreadCount.value +
    mrqUnreadCount.value +
    mrqRevisiUnreadCount.value +
    mrqPendingUnreadCount.value +
    rcUnreadCount.value +
    rcRevisiUnreadCount.value +
    rcPendingUnreadCount.value +
    woUnreadCount.value +
    woRevisiUnreadCount.value +
    woPendingUnreadCount.value
  );
});

// Check if has any notifications
const hasAnyNotifications = computed<boolean>(() => {
  return (
    /* itemsNotifications.value.length > 0 || */ purchaseRequestNotifications
      .value.length > 0 ||
    revisiNotifications.value.length > 0 ||
    pendingApprovalNotifications.value.length > 0 ||
    outstandingNotifications.value.length > 0 ||
    poNotifications.value.length > 0 ||
    poRevisiNotifications.value.length > 0 ||
    poPendingApprovalNotifications.value.length > 0 ||
    piNotifications.value.length > 0 ||
    piRevisiNotifications.value.length > 0 ||
    piPendingApprovalNotifications.value.length > 0 ||
    prcNotifications.value.length > 0 ||
    prcRevisiNotifications.value.length > 0 ||
    prcPendingApprovalNotifications.value.length > 0 ||
    pocNotifications.value.length > 0 ||
    pocRevisiNotifications.value.length > 0 ||
    pocPendingApprovalNotifications.value.length > 0 ||
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
    stockOpnamePendingApprovalNotifications.value.length > 0 ||
    stockAdjNotifications.value.length > 0 ||
    stockAdjRevisiNotifications.value.length > 0 ||
    stockAdjPendingApprovalNotifications.value.length > 0 ||
    tgNotifications.value.length > 0 ||
    tgRevisiNotifications.value.length > 0 ||
    tgPendingApprovalNotifications.value.length > 0 ||
    transformItemNotifications.value.length > 0 ||
    transformItemRevisiNotifications.value.length > 0 ||
    transformItemPendingApprovalNotifications.value.length > 0 ||
    purchaseRequestSubconNotifications.value.length > 0 ||
    purchaseRequestSubconRevisiNotifications.value.length > 0 ||
    purchaseRequestSubconPendingApprovalNotifications.value.length > 0 ||
    purchaseOrderSubconNotifications.value.length > 0 ||
    purchaseOrderSubconRevisiNotifications.value.length > 0 ||
    purchaseOrderSubconPendingApprovalNotifications.value.length > 0 ||
    purchaseInvoiceSubconNotifications.value.length > 0 ||
    purchaseInvoiceSubconRevisiNotifications.value.length > 0 ||
    purchaseInvoiceSubconPendingApprovalNotifications.value.length > 0 ||
    purchaseReturnSubconNotifications.value.length > 0 ||
    purchaseReturnSubconRevisiNotifications.value.length > 0 ||
    purchaseReturnSubconPendingApprovalNotifications.value.length > 0 ||
    customerNotifications.value.length > 0 ||
    customerRevisiNotifications.value.length > 0 ||
    customerPendingApprovalNotifications.value.length > 0 ||
    customerChangeNotifications.value.length > 0 ||
    customerChangeRevisiNotifications.value.length > 0 ||
    customerChangePendingApprovalNotifications.value.length > 0 ||
    ioPendingApprovalNotifications.value.length > 0 ||
    woNotifications.value.length > 0 ||
    woRevisiNotifications.value.length > 0 ||
    woPendingApprovalNotifications.value.length > 0 ||
    precostNotifications.value.length > 0 ||
    precostRevisiNotifications.value.length > 0 ||
    precostPendingApprovalNotifications.value.length > 0 ||
    mtfNotifications.value.length > 0 ||
    mtfRevisiNotifications.value.length > 0 ||
    mtfPendingApprovalNotifications.value.length > 0 ||
    mrqNotifications.value.length > 0 ||
    mrqRevisiNotifications.value.length > 0 ||
    mrqPendingApprovalNotifications.value.length > 0 ||
    rcNotifications.value.length > 0 ||
    rcRevisiNotifications.value.length > 0 ||
    rcPendingApprovalNotifications.value.length > 0
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
        item.t_precost_id ||
        item.t_precost?.id ||
        item.t_wo_id ||
        item.t_mtf_id ||
        item.t_purchase_request_id ||
        item.t_purchase_order_id ||
        item.t_purchase_invoice_id ||
        item.t_rc_id ||
        item.t_material_transfer_id ||
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

    prcNotifications.value = byType(combinedApprovalRows, "purchase_request_close");
    prcRevisiNotifications.value = byType(revisiRows, "purchase_request_close");
    prcPendingApprovalNotifications.value = [];

    pocNotifications.value = byType(combinedApprovalRows, "purchase_order_close");
    pocRevisiNotifications.value = byType(revisiRows, "purchase_order_close");
    pocPendingApprovalNotifications.value = [];

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

    stockAdjNotifications.value = byType(combinedApprovalRows, "stock_adj");
    stockAdjRevisiNotifications.value = byType(revisiRows, "stock_adj");
    stockAdjPendingApprovalNotifications.value = [];

    tgNotifications.value = byType(combinedApprovalRows, "transfer_gudang");
    tgRevisiNotifications.value = byType(revisiRows, "transfer_gudang");
    tgPendingApprovalNotifications.value = [];

    transformItemNotifications.value = byType(combinedApprovalRows, "transform_item");
    transformItemRevisiNotifications.value = byType(
      revisiRows,
      "transform_item",
    );
    transformItemPendingApprovalNotifications.value = [];

    purchaseRequestSubconNotifications.value = byType(
      combinedApprovalRows,
      "purchase_request_subcon",
    );
    purchaseRequestSubconRevisiNotifications.value = byType(
      revisiRows,
      "purchase_request_subcon",
    );
    purchaseRequestSubconPendingApprovalNotifications.value = [];

    purchaseOrderSubconNotifications.value = byType(
      combinedApprovalRows,
      "purchase_order_subcon",
    );
    purchaseOrderSubconRevisiNotifications.value = byType(
      revisiRows,
      "purchase_order_subcon",
    );
    purchaseOrderSubconPendingApprovalNotifications.value = [];

    purchaseInvoiceSubconNotifications.value = byType(
      combinedApprovalRows,
      "purchase_invoice_subcon",
    );
    purchaseInvoiceSubconRevisiNotifications.value = byType(
      revisiRows,
      "purchase_invoice_subcon",
    );
    purchaseInvoiceSubconPendingApprovalNotifications.value = [];

    purchaseReturnSubconNotifications.value = byType(
      combinedApprovalRows,
      "purchase_return_subcon",
    );
    purchaseReturnSubconRevisiNotifications.value = byType(
      revisiRows,
      "purchase_return_subcon",
    );
    purchaseReturnSubconPendingApprovalNotifications.value = [];

    customerNotifications.value = [
      ...byType(combinedApprovalRows, "m_customer"),
      ...byType(combinedApprovalRows, "customer"),
    ];
    customerRevisiNotifications.value = [
      ...byType(revisiRows, "m_customer"),
      ...byType(revisiRows, "customer"),
    ];
    customerPendingApprovalNotifications.value = [];

    customerChangeNotifications.value = [
      ...byType(combinedApprovalRows, "m_customer_change"),
      ...byType(combinedApprovalRows, "customer_change"),
    ];
    customerChangeRevisiNotifications.value = [
      ...byType(revisiRows, "m_customer_change"),
      ...byType(revisiRows, "customer_change"),
    ];
    customerChangePendingApprovalNotifications.value = [];

    ioNotifications.value = byType(combinedApprovalRows, "io");
    ioRevisiNotifications.value = byType(revisiRows, "io");
    ioPendingApprovalNotifications.value = [];

    precostNotifications.value = byType(combinedApprovalRows, "precost");
    precostRevisiNotifications.value = byType(revisiRows, "precost");
    precostPendingApprovalNotifications.value = [];

    mtfNotifications.value = byType(combinedApprovalRows, "mtf");
    mtfRevisiNotifications.value = byType(revisiRows, "mtf");
    mtfPendingApprovalNotifications.value = [];

    mrqNotifications.value = byType(combinedApprovalRows, "mrq");
    mrqRevisiNotifications.value = byType(revisiRows, "mrq");
    mrqPendingApprovalNotifications.value = byType(pendingRows, "mrq");

    // MRQ tidak disediakan oleh backend unified, ambil dari endpoint dedicated
    const [mrqApprovalRes, mrqRevisiRes, mrqPendingRes] = await Promise.all([
      getMrqNotifications(1, 100).catch(() => ({
        status: "error",
        data: [] as any[],
      })),
      getMrqRevisiNotifications(1, 100).catch(() => ({
        status: "error",
        data: [] as any[],
      })),
      getPendingMrqNotifications(1, 100).catch(() => ({
        status: "error",
        data: [] as any[],
      })),
    ]);

    const mergeMrqRows = (base: any[], extra: any[]) => {
      const map = new Map<string, any>();
      [...base, ...extra].forEach((n) => {
        if (n && n.id != null) map.set(String(n.id), n);
      });
      return [...map.values()];
    };

    const prevMrqTotal =
      mrqNotifications.value.length +
      mrqRevisiNotifications.value.length +
      mrqPendingApprovalNotifications.value.length;

    mrqNotifications.value = mergeMrqRows(
      mrqNotifications.value,
      mrqApprovalRes.data || [],
    );
    mrqRevisiNotifications.value = mergeMrqRows(
      mrqRevisiNotifications.value,
      mrqRevisiRes.data || [],
    );
    mrqPendingApprovalNotifications.value = mergeMrqRows(
      mrqPendingApprovalNotifications.value,
      mrqPendingRes.data || [],
    );

    const addedMrqTotal =
      mrqNotifications.value.length +
      mrqRevisiNotifications.value.length +
      mrqPendingApprovalNotifications.value.length -
      prevMrqTotal;
    if (addedMrqTotal > 0) {
      notificationCounts.value = {
        ...notificationCounts.value,
        all: (notificationCounts.value.all || 0) + addedMrqTotal,
        approval: (notificationCounts.value.approval || 0) + addedMrqTotal,
      };
    }

    rcNotifications.value = byType(combinedApprovalRows, "rc");
    rcRevisiNotifications.value = byType(revisiRows, "rc");
    rcPendingApprovalNotifications.value = [];

    woNotifications.value = byType(combinedApprovalRows, "wo");
    woRevisiNotifications.value = byType(revisiRows, "wo");
    woPendingApprovalNotifications.value = [];
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
      router.push(
        `/purchasing/transaksi/t_purchase_request/view/${notif.ref_id}`,
      );
    else if (notif.outstanding_type === "purchase_order")
      router.push(
        `/purchasing/transaksi/t_purchase_order/view/${notif.ref_id}`,
      );
    return;
  }

  if (notif.notification_type === "purchase_request") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_request/form/${notif.t_purchase_request_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_request/view/${notif.t_purchase_request_id}`,
      );
    else router.push(`/notifikasi/purchase-request/${notif.id}`);
  } else if (notif.notification_type === "purchase_order") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_order/form/${notif.t_purchase_order_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_order/view/${notif.t_purchase_order_id}`,
      );
    else router.push(`/notifikasi/purchase-order/${notif.id}`);
  } else if (notif.notification_type === "purchase_invoice") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_invoice/form/${notif.t_purchase_invoice_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_invoice/view/${notif.t_purchase_invoice_id}`,
      );
    else router.push(`/notifikasi/purchase_invoice/${notif.id}`);
  } else if (notif.notification_type === "purchase_request_close") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_request_close/form/${notif.t_purchase_request_close_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_request_close/view/${notif.t_purchase_request_close_id}`,
      );
    else router.push(`/notifikasi/purchase_request_close/${notif.id}`);
  } else if (notif.notification_type === "purchase_order_close") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_order_close/form/${notif.t_purchase_order_close_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_order_close/view/${notif.t_purchase_order_close_id}`,
      );
    else router.push(`/notifikasi/purchase_order_close/${notif.id}`);
  } else if (notif.notification_type === "purchase_return") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/transaksi/t_purchase_return/form/${notif.t_purchase_return_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/transaksi/t_purchase_return/view/${notif.t_purchase_return_id}`,
      );
    else router.push(`/notifikasi/purchase-return/${notif.id}`);
  } else if (notif.notification_type === "penerimaan_gudang") {
    if (notif.status_name === "REVISI")
      router.push(
        `/inventory/transaksi/t_penerimaan_gudang/form/${notif.t_penerimaan_gudang_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/inventory/transaksi/t_penerimaan_gudang/view/${notif.t_penerimaan_gudang_id}`,
      );
    else router.push(`/notifikasi/penerimaan_gudang/${notif.id}`);
  } else if (notif.notification_type === "supplier") {
    if (notif.status_name === "REVISI")
      router.push(`/purchasing/master/m_supplier/form/${notif.m_supplier_id}`);
    else if (isRevisiSection)
      router.push(`/purchasing/master/m_supplier/view/${notif.m_supplier_id}`);
    else router.push(`/notifikasi/supplier/${notif.id}`);
  } else if (notif.notification_type === "stock_opname") {
    if (notif.status_name === "REVISI")
      router.push(`/inventory/transaksi/t_stock_opname/form/${notif.t_stock_opname_id}`);
    else if (isRevisiSection)
      router.push(`/inventory/transaksi/t_stock_opname/view/${notif.t_stock_opname_id}`);
    else router.push(`/notifikasi/stock_opname/${notif.id}`);
  } else if (notif.notification_type === "stock_adj") {
    if (notif.status_name === "REVISI")
      router.push(`/inventory/transaksi/t_stock_adj/form/${notif.t_stock_adj_id}`);
    else if (isRevisiSection)
      router.push(`/inventory/transaksi/t_stock_adj/view/${notif.t_stock_adj_id}`);
    else router.push(`/notifikasi/stock_adj/${notif.id}`);
  } else if (notif.notification_type === "transfer_gudang") {
    if (notif.status_name === "REVISI")
      router.push(
        `/inventory/transaksi/t_transfer_gudang/form/${notif.t_transfer_gudang_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/inventory/transaksi/t_transfer_gudang/view/${notif.t_transfer_gudang_id}`,
      );
    else router.push(`/notifikasi/transfer_gudang/${notif.id}`);
  } else if (notif.notification_type === "transform_item") {
    if (notif.status_name === "REVISI")
      router.push(
        `/inventory/transaksi/t_transform_item/form/${notif.t_transform_item_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/inventory/transaksi/t_transform_item/view/${notif.t_transform_item_id}`,
      );
    else router.push(`/notifikasi/transform_item/${notif.id}`);
  } else if (notif.notification_type === "purchase_request_subcon") {
    router.push(`/notifikasi/purchase_request_subcon/${notif.id}`);
  } else if (notif.notification_type === "purchase_order_subcon") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/subcon/t_purchase_order_subcon/form/${notif.t_purchase_order_subcon_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/subcon/t_purchase_order_subcon/view/${notif.t_purchase_order_subcon_id}`,
      );
    else router.push(`/notifikasi/purchase_order_subcon/${notif.id}`);
  } else if (notif.notification_type === "purchase_invoice_subcon") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/subcon/t_purchase_invoice_subcon/form/${notif.t_purchase_invoice_subcon_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/subcon/t_purchase_invoice_subcon/view/${notif.t_purchase_invoice_subcon_id}`,
      );
    else router.push(`/notifikasi/purchase_invoice_subcon/${notif.id}`);
  } else if (notif.notification_type === "purchase_return_subcon") {
    if (notif.status_name === "REVISI")
      router.push(
        `/purchasing/subcon/t_purchase_return_subcon/form/${notif.t_purchase_return_subcon_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/purchasing/subcon/t_purchase_return_subcon/view/${notif.t_purchase_return_subcon_id}`,
      );
    else router.push(`/notifikasi/purchase_return_subcon/${notif.id}`);
  } else if (
    notif.notification_type === "m_customer" ||
    notif.notification_type === "customer"
  ) {
    const customerId = notif.m_customer_id || notif.ref_id;
    if (notif.status_name === "REVISI")
      router.push(`/marketing/master/m_customer/form/${customerId}`);
    else if (isRevisiSection)
      router.push(`/marketing/master/m_customer/view/${customerId}`);
    else router.push(`/notifikasi/m_customer/${notif.id}`);
  } else if (
    notif.notification_type === "m_customer_change" ||
    notif.notification_type === "customer_change"
  ) {
    const section =
      notif._notificationSection ||
      (notif.status_name === "REVISI"
        ? "revisi"
        : notif.status_name === "IN APPROVAL"
          ? "pending"
          : "approval");
    router.push(`/notifikasi/m_customer_change/${notif.id}?section=${section}`);
  } else if (notif.notification_type === "precost") {
    if (notif.status_name === "REVISI")
      router.push(
        `/production/transaksi/t_precost/form/${notif.t_precost_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/production/transaksi/t_precost/view/${notif.t_precost_id}`,
      );
    else router.push(`/notifikasi/precost/${notif.id}`);
  } else if (notif.notification_type === "mtf") {
    if (notif.status_name === "REVISI")
      router.push(
        `/production/transaksi/t_mtf/form/${notif.t_mtf_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/production/transaksi/t_mtf/view/${notif.t_mtf_id}`,
      );
    else router.push(`/notifikasi/material_transfer/${notif.id}`);
  } else if (notif.notification_type === "mrq") {
    if (notif.status_name === "REVISI")
      router.push(
        `/production/transaksi/t_mrq/form/${notif.t_mrq_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/production/transaksi/t_mrq/view/${notif.t_mrq_id}`,
      );
    else router.push(`/notifikasi/material_request/${notif.id}`);
  } else if (notif.notification_type === "rc") {
    const isWip = notif.t_rc?.flag === "WIP" || notif.flag === "WIP";
    const basePath = isWip ? "/production/transaksi/t_rc_wip" : "/production/transaksi/t_rc";
    if (notif.status_name === "REVISI")
      router.push(
        `${basePath}/form/${notif.t_rc_id || notif.ref_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `${basePath}/view/${notif.t_rc_id || notif.ref_id}`,
      );
    else router.push(`/notifikasi/result_confirmation/${notif.id}`);
  } else if (notif.notification_type === "io") {
    if (notif.status_name === "REVISI")
      router.push(
        `/production/transaksi/t_io/form/${notif.t_io_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/production/transaksi/t_io/view/${notif.t_io_id}`,
      );
    else router.push(`/notifikasi/internal_order/${notif.id}`);
  } else if (notif.notification_type === "wo") {
    const isWip = notif.t_wo?.flag === "WIP";
    if (isWip) {
      if (notif.status_name === "REVISI")
        router.push(
          `/production/transaksi/t_wo_wip/form/${notif.t_wo_id}`,
        );
      else if (isRevisiSection)
        router.push(
          `/production/transaksi/t_wo_wip/view/${notif.t_wo_id}`,
        );
      else router.push(`/notifikasi/work_order_wip/${notif.id}`);
    } else {
      if (notif.status_name === "REVISI")
        router.push(
          `/production/transaksi/t_wo/form/${notif.t_wo_id}`,
        );
      else if (isRevisiSection)
        router.push(
          `/production/transaksi/t_wo/view/${notif.t_wo_id}`,
        );
      else router.push(`/notifikasi/work_order/${notif.id}`);
    }
  } else if (notif.notification_type === "wo_wip") {
    if (notif.status_name === "REVISI")
      router.push(
        `/production/transaksi/t_wo_wip/form/${notif.t_wo_id}`,
      );
    else if (isRevisiSection)
      router.push(
        `/production/transaksi/t_wo_wip/view/${notif.t_wo_id}`,
      );
    else router.push(`/notifikasi/work_order_wip/${notif.id}`);
  } else {
    if (notif.status_name === "REVISI")
      router.push(`/inventory/m_items/form/${notif.m_items_id}`);
    else if (isRevisiSection)
      router.push(`/inventory/m_items/view/${notif.m_items_id}`);
    else router.push(`/notifikasi/${notif.id}`);
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
    ...prcNotifications.value,
    ...prcRevisiNotifications.value,
    ...prcPendingApprovalNotifications.value,
    ...pocNotifications.value,
    ...pocRevisiNotifications.value,
    ...pocPendingApprovalNotifications.value,
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
    ...stockAdjNotifications.value,
    ...stockAdjRevisiNotifications.value,
    ...stockAdjPendingApprovalNotifications.value,
    ...tgNotifications.value,
    ...tgRevisiNotifications.value,
    ...tgPendingApprovalNotifications.value,
    ...transformItemNotifications.value,
    ...transformItemRevisiNotifications.value,
    ...transformItemPendingApprovalNotifications.value,
    ...purchaseRequestSubconNotifications.value,
    ...purchaseRequestSubconRevisiNotifications.value,
    ...purchaseRequestSubconPendingApprovalNotifications.value,
    ...purchaseOrderSubconNotifications.value,
    ...purchaseOrderSubconRevisiNotifications.value,
    ...purchaseOrderSubconPendingApprovalNotifications.value,
    ...purchaseInvoiceSubconNotifications.value,
    ...purchaseInvoiceSubconRevisiNotifications.value,
    ...purchaseInvoiceSubconPendingApprovalNotifications.value,
    ...purchaseReturnSubconNotifications.value,
    ...purchaseReturnSubconRevisiNotifications.value,
    ...purchaseReturnSubconPendingApprovalNotifications.value,
    ...customerNotifications.value,
    ...customerRevisiNotifications.value,
    ...customerPendingApprovalNotifications.value,
    ...customerChangeNotifications.value,
    ...customerChangeRevisiNotifications.value,
    ...customerChangePendingApprovalNotifications.value,
    ...ioNotifications.value,
    ...ioRevisiNotifications.value,
    ...ioPendingApprovalNotifications.value,
    ...precostNotifications.value,
    ...precostRevisiNotifications.value,
    ...precostPendingApprovalNotifications.value,
    ...mtfNotifications.value,
    ...mtfRevisiNotifications.value,
    ...mtfPendingApprovalNotifications.value,
    ...mrqNotifications.value,
    ...mrqRevisiNotifications.value,
    ...mrqPendingApprovalNotifications.value,
    ...rcNotifications.value,
    ...rcRevisiNotifications.value,
    ...rcPendingApprovalNotifications.value,
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
      <!-- <ItemNotificationList
        :notifications="itemsNotifications"
        :is-notification-read="isNotificationRead"
        @mark-as-read="handleMarkAsRead"
        @open-detail="handleOpenDetail"
      /> -->

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

        <IoNotificationList
          :notifications="ioNotifications"
          :revisi-notifications="ioRevisiNotifications"
          :pending-approval-notifications="ioPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PrecostNotificationList
          :notifications="precostNotifications"
          :revisi-notifications="precostRevisiNotifications"
          :pending-approval-notifications="precostPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <MtfNotificationList
          :notifications="mtfNotifications"
          :revisi-notifications="mtfRevisiNotifications"
          :pending-approval-notifications="mtfPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <MrqNotificationList
          :notifications="mrqNotifications"
          :revisi-notifications="mrqRevisiNotifications"
          :pending-approval-notifications="mrqPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <RcNotificationList
          :notifications="rcNotifications"
          :revisi-notifications="rcRevisiNotifications"
          :pending-approval-notifications="rcPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <WoNotificationList
          :notifications="woNotifications"
          :revisi-notifications="woRevisiNotifications"
          :pending-approval-notifications="woPendingApprovalNotifications"
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

        <PRCNotificationList
          :notifications="prcNotifications"
          :revisi-notifications="prcRevisiNotifications"
          :pending-approval-notifications="prcPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <POCNotificationList
          :notifications="pocNotifications"
          :revisi-notifications="pocRevisiNotifications"
          :pending-approval-notifications="pocPendingApprovalNotifications"
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

        <StockAdjNotificationList
          :notifications="stockAdjNotifications"
          :revisi-notifications="stockAdjRevisiNotifications"
          :pending-approval-notifications="stockAdjPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <TransferGudangNotificationList
          :notifications="tgNotifications"
          :revisi-notifications="tgRevisiNotifications"
          :pending-approval-notifications="tgPendingApprovalNotifications"
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <TransformItemNotificationList
          :notifications="transformItemNotifications"
          :revisi-notifications="transformItemRevisiNotifications"
          :pending-approval-notifications="
            transformItemPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PurchaseRequestSubconNotificationList
          :notifications="purchaseRequestSubconNotifications"
          :revisi-notifications="purchaseRequestSubconRevisiNotifications"
          :pending-approval-notifications="
            purchaseRequestSubconPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PurchaseOrderSubconNotificationList
          :notifications="purchaseOrderSubconNotifications"
          :revisi-notifications="purchaseOrderSubconRevisiNotifications"
          :pending-approval-notifications="
            purchaseOrderSubconPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PurchaseInvoiceSubconNotificationList
          :notifications="purchaseInvoiceSubconNotifications"
          :revisi-notifications="purchaseInvoiceSubconRevisiNotifications"
          :pending-approval-notifications="
            purchaseInvoiceSubconPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />

        <PurchaseReturnSubconNotificationList
          :notifications="purchaseReturnSubconNotifications"
          :revisi-notifications="purchaseReturnSubconRevisiNotifications"
          :pending-approval-notifications="
            purchaseReturnSubconPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />
        <CustomerNotificationList
          :notifications="customerNotifications"
          :revisi-notifications="customerRevisiNotifications"
          :pending-approval-notifications="
            customerPendingApprovalNotifications
          "
          :is-notification-read="isNotificationRead"
          @mark-as-read="handleMarkAsRead"
          @open-detail="handleOpenDetail"
        />
        <CustomerChangeNotificationList
          :notifications="customerChangeNotifications"
          :revisi-notifications="customerChangeRevisiNotifications"
          :pending-approval-notifications="
            customerChangePendingApprovalNotifications
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



