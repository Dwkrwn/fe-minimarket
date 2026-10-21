<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Lock,
  MapPin,
  Package,
  ShieldAlert,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const props = defineProps<{
  notifications: any[];
  isNotificationRead: (notif: any) => boolean;
}>();

const expanded = ref(false);
const COLLAPSED_LIMIT = 5;

const unreadCount = computed(
  () => props.notifications.filter((n) => !props.isNotificationRead(n)).length,
);
const hasNotifications = computed(() => props.notifications.length > 0);
const visibleItems = computed(() =>
  expanded.value
    ? props.notifications
    : props.notifications.slice(0, COLLAPSED_LIMIT),
);
const hasMore = computed(() => props.notifications.length > COLLAPSED_LIMIT);

const lockedWarehouseCount = computed(() => {
  const warehouses = props.notifications
    .map((notif) => notif.stock_gudang?.nama_gudang || notif.nama_gudang)
    .filter(Boolean);

  return new Set(warehouses).size;
});

const getItemCode = (notif: any) =>
  notif.stock_gudang?.kode_item || notif.kode_item || "-";

const getItemName = (notif: any) =>
  notif.stock_gudang?.nama_item || notif.nama_item || notif.title || "-";

const getWarehouseName = (notif: any) =>
  notif.stock_gudang?.nama_gudang ||
  notif.nama_gudang ||
  notif.approval_message ||
  "-";
</script>

<template>
  <AccordionItem v-if="hasNotifications" value="stock-gudang-lock">
    <AccordionTrigger class="py-3 hover:no-underline md:py-4">
      <div class="flex w-full items-center justify-between gap-3 pr-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10"
          >
            <Lock class="h-5 w-5 text-orange-500" />
          </span>
          <div class="min-w-0 text-left">
            <div class="flex items-center gap-2">
              <span
                class="truncate text-sm font-semibold text-orange-600 dark:text-orange-300 md:text-base"
              >
                Stock Terkunci Opname
              </span>
              <Badge class="bg-orange-500 text-white hover:bg-orange-600">
                {{ notifications.length }}
              </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              Item aktif yang sedang dikunci proses hitung fisik
            </p>
          </div>
        </div>

        <div class="hidden shrink-0 items-center gap-2 md:flex">
          <Badge variant="outline" class="text-xs">
            {{ lockedWarehouseCount }} gudang
          </Badge>
          <Badge v-if="unreadCount > 0" variant="destructive" class="text-xs">
            {{ unreadCount }} baru
          </Badge>
        </div>
      </div>
    </AccordionTrigger>

    <AccordionContent>
      <div
        class="mt-2 overflow-hidden rounded-lg border border-orange-500/30 bg-orange-500/[0.03]"
      >
        <div class="grid gap-3 border-b border-orange-500/20 p-3 md:grid-cols-3">
          <div class="flex items-center gap-3 rounded-md bg-background/60 p-3">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-md bg-orange-500/10"
            >
              <Package class="h-4 w-4 text-orange-500" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">Item terkunci</p>
              <p class="text-lg font-semibold leading-none">
                {{ notifications.length }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 rounded-md bg-background/60 p-3">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10"
            >
              <MapPin class="h-4 w-4 text-amber-500" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">Gudang terdampak</p>
              <p class="text-lg font-semibold leading-none">
                {{ lockedWarehouseCount }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 rounded-md bg-background/60 p-3">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10"
            >
              <ShieldAlert class="h-4 w-4 text-red-500" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">Status</p>
              <p class="truncate text-sm font-medium leading-tight">
                Terkunci sampai opname selesai
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-2 p-3">
          <button
            v-for="notif in visibleItems"
            :key="notif.id"
            type="button"
            :class="[
              'group flex w-full items-start gap-3 rounded-md border border-transparent bg-background/55 p-3 text-left transition-all hover:border-orange-500/40 hover:bg-orange-500/10',
              !isNotificationRead(notif) && 'ring-1 ring-orange-500/20',
            ]"
          >
            <span
              class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-orange-500 transition-colors group-hover:bg-orange-500 group-hover:text-white"
            >
              <Boxes class="h-4 w-4" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate text-sm font-semibold md:text-base">
                  {{ getItemCode(notif) }}
                </span>
                <Badge
                  variant="outline"
                  class="border-orange-500/30 text-[10px] text-orange-600 dark:text-orange-300"
                >
                  LOCKED
                </Badge>
              </span>
              <span class="mt-1 block truncate text-sm text-muted-foreground">
                {{ getItemName(notif) }}
              </span>
              <span
                class="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                <MapPin class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ getWarehouseName(notif) }}</span>
              </span>
            </span>
          </button>

          <button
            v-if="hasMore"
            class="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-orange-500/30 py-2 text-xs text-muted-foreground transition-colors hover:bg-orange-500/10 hover:text-foreground"
            @click="expanded = !expanded"
          >
            <template v-if="!expanded">
              <ChevronDown class="h-3 w-3" />
              Tampilkan {{ notifications.length - COLLAPSED_LIMIT }} item lainnya
            </template>
            <template v-else>
              <ChevronUp class="h-3 w-3" />
              Sembunyikan
            </template>
          </button>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
