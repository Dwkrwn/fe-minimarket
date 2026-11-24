<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter, useRoute, onBeforeRouteUpdate } from "vue-router";
import { Bell, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { toast } from "vue-sonner";

import StockAlertNotificationList from "./stock/StockAlertNotificationList.vue";
import { getStockAlerts } from "./stock/service.stock";
import { useAuthStore } from "@/stores/auth";
import {
  loadDismissedStockAlertIds,
  saveDismissedStockAlertIds,
} from "@/lib/notificationState";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const canViewStockAlerts = computed(
  () => authStore.isManager || authStore.user?.role.system_key === "GUDANG",
);

const loading = ref(true);
const refreshing = ref(false);
const openAccordions = ref<string[]>(["stock-alerts"]);
const stockNotifications = ref<any[]>([]);
const stockMeta = ref<any>(null);
const dismissedStockAlertIds = ref<Set<string>>(new Set());

const stockUnreadCount = computed(
  () =>
    stockNotifications.value.filter(
      (notif) => !dismissedStockAlertIds.value.has(String(notif.id)),
    ).length,
);

const hasAnyNotifications = computed(() => stockNotifications.value.length > 0);

const isStockAlertDismissed = (notif: any) =>
  dismissedStockAlertIds.value.has(String(notif?.id));

const fetchStockAlerts = async (showLoading = true) => {
  if (!canViewStockAlerts.value) {
    stockNotifications.value = [];
    stockMeta.value = null;
    dismissedStockAlertIds.value = new Set();
    loading.value = false;
    refreshing.value = false;
    return;
  }

  try {
    if (showLoading) loading.value = true;
    else refreshing.value = true;

    const snapshot = await getStockAlerts(!showLoading);
    stockNotifications.value = snapshot.items || [];
    stockMeta.value = snapshot.meta || null;
    dismissedStockAlertIds.value = loadDismissedStockAlertIds(
      new Set(stockNotifications.value.map((notif) => String(notif.id))),
    );
  } catch (error: any) {
    toast.error("Gagal memuat notifikasi stok", {
      description: error?.message || "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const handleOpenDetail = (notif: any) => {
  router.push(
    notif?.alert_type === "EXPIRED"
      ? "/inventory/stok/positions"
      : "/inventory/master/rop",
  );
};

const handleDismissStockAlert = (notif: any) => {
  const id = String(notif?.id);
  if (!id) return;

  const next = new Set(dismissedStockAlertIds.value);
  if (next.has(id)) {
    next.delete(id);
    toast.success("Alert stok dipulihkan");
  } else {
    next.add(id);
    toast.success("Alert stok di-dismiss sementara");
  }

  dismissedStockAlertIds.value = next;
  saveDismissedStockAlertIds(next);
};

const refreshStockAlerts = () => fetchStockAlerts(false);

const handleNotificationsUpdated = () => fetchStockAlerts(true);
const handleWindowFocus = () => fetchStockAlerts(true);
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") fetchStockAlerts(true);
};

onMounted(() => {
  fetchStockAlerts(true);
  window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
  window.addEventListener("focus", handleWindowFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  window.removeEventListener("notificationsUpdated", handleNotificationsUpdated);
  window.removeEventListener("focus", handleWindowFocus);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

watch(
  () => route.fullPath,
  () => fetchStockAlerts(true),
);

onBeforeRouteUpdate(() => fetchStockAlerts(true));
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div class="flex items-center gap-2">
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">
          Notifikasi Stok
        </h1>
        <Badge v-if="stockUnreadCount > 0" variant="secondary">
          {{ stockUnreadCount }}
        </Badge>
      </div>
      <Button
        @click="refreshStockAlerts"
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

    <Separator />

    <div v-if="loading" class="space-y-2 rounded-lg border p-4">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-3 w-64 max-w-[70vw]" />
      <Skeleton class="h-3 w-48 max-w-[60vw]" />
    </div>

    <div
      v-else-if="!canViewStockAlerts"
      class="text-center py-12 md:py-16"
    >
      <Bell
        class="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3 md:mb-4"
      />
      <h3 class="text-lg md:text-xl font-semibold mb-1 md:mb-2">
        Notifikasi stok tidak tersedia
      </h3>
      <p class="text-sm text-muted-foreground">
        Menu ini hanya untuk role Admin, Super Admin, dan Gudang.
      </p>
    </div>

    <Accordion
      v-else-if="hasAnyNotifications"
      type="multiple"
      class="w-full"
      v-model="openAccordions"
    >
      <StockAlertNotificationList
        :notifications="stockNotifications"
        :is-dismissed="isStockAlertDismissed"
        :meta="stockMeta"
        @dismiss="handleDismissStockAlert"
        @open-detail="handleOpenDetail"
      />
    </Accordion>

    <div v-else class="text-center py-12 md:py-16">
      <Bell
        class="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3 md:mb-4"
      />
      <h3 class="text-lg md:text-xl font-semibold mb-1 md:mb-2">
        Tidak ada alert stok
      </h3>
      <p class="text-sm text-muted-foreground">
        Stok dalam batas aman. Tidak ada yang perlu ditindaklanjuti.
      </p>
    </div>
  </div>
</template>
