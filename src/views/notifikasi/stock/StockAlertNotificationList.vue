<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  X,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { StockAlertsMeta } from "./service.stock";

const props = defineProps<{
  notifications: any[];
  isDismissed: (notif: any) => boolean;
  meta?: StockAlertsMeta | null;
}>();

const emit = defineEmits<{
  (e: "dismiss", notif: any): void;
  (e: "openDetail", notif: any): void;
}>();

const expanded = ref(false);
const activeType = ref<"all" | "kritis" | "warning" | "expired">("all");
const collapsedLimit = 8;

const hasNotifications = computed(() => props.notifications.length > 0);
const filteredNotifications = computed(() => {
  if (activeType.value === "all") return props.notifications;
  if (activeType.value === "expired")
    return props.notifications.filter((n) => n.alert_type === "EXPIRED");
  return props.notifications.filter((n) => n.tingkat === activeType.value);
});
const visibleItems = computed(() =>
  expanded.value
    ? filteredNotifications.value
    : filteredNotifications.value.slice(0, collapsedLimit),
);
const hasMore = computed(
  () => filteredNotifications.value.length > collapsedLimit,
);
const kritisCount = computed(
  () =>
    props.notifications.filter(
      (n) => n.alert_type === "LOW_STOCK" && n.tingkat === "kritis",
    ).length,
);
const warningCount = computed(
  () =>
    props.notifications.filter(
      (n) => n.alert_type === "LOW_STOCK" && n.tingkat === "warning",
    ).length,
);
const expiredCount = computed(
  () => props.notifications.filter((n) => n.alert_type === "EXPIRED").length,
);
const filterOptions = computed(() => [
  { value: "all" as const, label: "Semua", count: props.notifications.length },
  { value: "kritis" as const, label: "Kritis", count: kritisCount.value },
  { value: "warning" as const, label: "Warning", count: warningCount.value },
  { value: "expired" as const, label: "Expired", count: expiredCount.value },
]);

const setActiveType = (
  type: "all" | "kritis" | "warning" | "expired",
) => {
  activeType.value = type;
  expanded.value = false;
};

const accentClass = (notif: any) =>
  notif?.alert_type === "EXPIRED" || notif?.tingkat === "kritis"
    ? "border-l-rose-500/80 bg-rose-500/[0.05] hover:border-rose-400/90 hover:bg-rose-500/[0.08]"
    : "border-l-amber-500/80 bg-amber-500/[0.05] hover:border-amber-400/90 hover:bg-amber-500/[0.08]";

const iconAccentClass = (notif: any) =>
  notif?.alert_type === "EXPIRED" || notif?.tingkat === "kritis"
    ? "bg-rose-500/12 text-rose-500"
    : "bg-amber-500/12 text-amber-500";
</script>

<template>
  <AccordionItem v-if="hasNotifications" value="stock-alerts">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex w-full items-center justify-between gap-3 pr-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/[0.08]"
          >
            <AlertTriangle class="h-4 w-4 text-amber-500" />
          </span>
          <div class="min-w-0 text-left">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold md:text-base">
                Alert Stok
              </span>
              <Badge
                class="border border-amber-500/20 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
              >
                {{ notifications.length }}
              </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              Stok minimum/ROP dan expired (bila tersedia)
            </p>
          </div>
        </div>
        <div class="hidden shrink-0 items-center gap-2 md:flex">
          <Badge variant="outline" class="text-xs">{{ kritisCount }} kritis</Badge>
          <Badge variant="outline" class="text-xs">{{ warningCount }} warning</Badge>
        </div>
      </div>
    </AccordionTrigger>

    <AccordionContent>
      <div class="space-y-3 pt-2">
        <div
          v-if="meta && meta.expired_supported === false"
          class="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          Alert expired belum tersedia: {{ meta.expired_reason || "data batch tidak disimpan" }}
        </div>

        <div
          class="flex flex-col gap-3 rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3 md:flex-row md:items-center md:justify-between"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium">Filter alert</p>
            <p class="text-xs text-muted-foreground">
              Dismiss hanya sementara (24 jam) dan tidak mengubah status permanen
            </p>
          </div>
          <div
            class="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-background/80 p-1 sm:grid-cols-4"
          >
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              :class="[
                'flex items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors',
                activeType === option.value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ]"
              @click="setActiveType(option.value)"
            >
              <span>{{ option.label }}</span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {{ option.count }}
              </span>
            </button>
          </div>
        </div>

        <Card
          v-for="(notif, index) in visibleItems"
          :key="notif.id"
          v-motion
          :initial="{ opacity: 0, y: 12 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: { type: 'spring', stiffness: 120, damping: 18, delay: index * 35 },
          }"
          :class="[
            'group overflow-hidden border border-l-4 shadow-sm transition-all hover:-translate-y-0.5',
            accentClass(notif),
            isDismissed(notif) && 'opacity-60',
          ]"
        >
          <CardContent class="p-3 md:p-4">
            <div class="flex items-start justify-between gap-3">
              <div
                class="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                @click="emit('openDetail', notif)"
              >
                <span
                  :class="[
                    'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                    iconAccentClass(notif),
                  ]"
                >
                  <AlertTriangle v-if="notif.alert_type === 'EXPIRED'" class="h-4 w-4" />
                  <Package v-else class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-sm font-semibold md:text-base">
                      {{ notif.nama_item }}
                    </h3>
                    <Badge variant="outline" class="text-xs">
                      {{ notif.alert_type === 'EXPIRED' ? 'EXPIRED' : notif.tingkat }}
                    </Badge>
                    <Badge v-if="isDismissed(notif)" variant="secondary" class="text-xs">
                      Dismiss sementara
                    </Badge>
                  </div>
                  <p class="mt-1 line-clamp-2 text-xs text-foreground/78 md:text-sm">
                    <template v-if="notif.alert_type === 'EXPIRED'">
                      Expired {{ notif.expired_date || 'tanpa tanggal' }}
                      <span v-if="notif.hari_menuju_expired !== null">
                        · {{ notif.hari_menuju_expired }} hari
                      </span>
                    </template>
                    <template v-else>
                      Stok {{ notif.stok }} / batas {{ notif.batas }}
                      · saran tambah {{ notif.suggested_qty }}
                    </template>
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span
                      v-if="notif.kode_item"
                      class="truncate rounded-full bg-background/55 px-2 py-1"
                    >
                      {{ notif.kode_item }}
                    </span>
                    <span
                      v-if="notif.uom?.nama_uom || notif.uom?.satuan_dasar"
                      class="truncate rounded-full bg-background/55 px-2 py-1"
                    >
                      {{ notif.uom?.nama_uom || notif.uom?.satuan_dasar }}
                    </span>
                    <span class="rounded-full bg-background/55 px-2 py-1">
                      {{ notif.lokasi || 'SEMUA' }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :title="isDismissed(notif) ? 'Pulihkan alert' : 'Dismiss sementara'"
                @click.stop="emit('dismiss', notif)"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        <button
          v-if="hasMore"
          class="flex w-full items-center justify-center gap-1 rounded-md border border-white/10 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          @click="expanded = !expanded"
        >
          <template v-if="!expanded">
            <ChevronDown class="h-3 w-3" />
            Tampilkan {{ filteredNotifications.length - collapsedLimit }} alert lainnya
          </template>
          <template v-else>
            <ChevronUp class="h-3 w-3" />
            Sembunyikan
          </template>
        </button>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
