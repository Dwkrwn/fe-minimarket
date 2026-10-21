<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Truck,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const props = defineProps<{
  notifications: any[];
  isNotificationRead: (notif: any) => boolean;
}>();

const emit = defineEmits<{
  (e: "openDetail", notif: any): void;
}>();

const expanded = ref(false);
const activeType = ref<"all" | "purchase_request" | "purchase_order">("all");
const collapsedLimit = 8;

const hasNotifications = computed(() => props.notifications.length > 0);
const filteredNotifications = computed(() => {
  if (activeType.value === "all") return props.notifications;
  return props.notifications.filter((item) => item.outstanding_type === activeType.value);
});
const visibleItems = computed(() =>
  expanded.value
    ? filteredNotifications.value
    : filteredNotifications.value.slice(0, collapsedLimit),
);
const hasMore = computed(() => filteredNotifications.value.length > collapsedLimit);

const totalQtyOts = computed(() =>
  filteredNotifications.value.reduce((sum, item) => sum + Number(item.total_qty_ots || 0), 0),
);

const prCount = computed(
  () => props.notifications.filter((item) => item.outstanding_type === "purchase_request").length,
);
const poCount = computed(
  () => props.notifications.filter((item) => item.outstanding_type === "purchase_order").length,
);

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getIcon = (notif: any) =>
  notif.outstanding_type === "purchase_request" ? FileText : ShoppingCart;

const getTypeLabel = (notif: any) =>
  notif.outstanding_type === "purchase_request" ? "PR" : "PO";

const getTypeAccentClass = (notif: any) =>
  notif.outstanding_type === "purchase_request"
    ? "border-l-amber-500/80 bg-amber-500/[0.05] hover:border-amber-400/90 hover:bg-amber-500/[0.08]"
    : "border-l-sky-700/80 bg-sky-700/[0.05] hover:border-sky-600/90 hover:bg-sky-700/[0.08] dark:border-l-sky-500/80 dark:bg-sky-500/[0.05] dark:hover:border-sky-400/90 dark:hover:bg-sky-500/[0.08]";

const getTypeIconAccentClass = (notif: any) =>
  notif.outstanding_type === "purchase_request"
    ? "bg-amber-500/12 text-amber-300 group-hover:bg-amber-500 group-hover:text-amber-950"
    : "bg-sky-700/12 text-sky-700 group-hover:bg-sky-700 group-hover:text-white dark:bg-sky-500/12 dark:text-sky-300 dark:group-hover:bg-sky-500 dark:group-hover:text-sky-950";

const getTypeBadgeClass = (notif: any) =>
  notif.outstanding_type === "purchase_request"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
    : "border-sky-700/25 bg-sky-700/10 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200";

const filterOptions = computed(() => [
  {
    value: "all" as const,
    label: "Semua",
    count: props.notifications.length,
  },
  {
    value: "purchase_request" as const,
    label: "PR",
    count: prCount.value,
  },
  {
    value: "purchase_order" as const,
    label: "PO",
    count: poCount.value,
  },
]);

const setActiveType = (type: "all" | "purchase_request" | "purchase_order") => {
  activeType.value = type;
  expanded.value = false;
};
</script>

<template>
  <AccordionItem v-if="hasNotifications" value="outstanding-transactions">
    <AccordionTrigger class="hover:no-underline py-3 md:py-4">
      <div class="flex w-full items-center justify-between gap-3 pr-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sky-700/20 bg-sky-700/[0.08] dark:border-sky-400/25 dark:bg-sky-400/[0.08]"
          >
            <Truck class="h-4 w-4 text-sky-700 dark:text-sky-300" />
          </span>
          <div class="min-w-0 text-left">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold md:text-base">
                Outstanding Purchase
              </span>
              <Badge class="border border-sky-700/20 bg-sky-700/10 text-sky-800 hover:bg-sky-700/15 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200">
                {{ notifications.length }}
              </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              PR dan PO dengan qty outstanding aktif
            </p>
          </div>
        </div>
        <div class="hidden shrink-0 items-center gap-2 md:flex">
          <Badge variant="outline" class="text-xs">{{ prCount }} PR</Badge>
          <Badge variant="outline" class="text-xs">{{ poCount }} PO</Badge>
        </div>
      </div>
    </AccordionTrigger>

    <AccordionContent>
      <div class="space-y-3 pt-2">
        <div class="flex flex-col gap-3 rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium">Filter transaksi</p>
            <p class="text-xs text-muted-foreground">Pilih semua outstanding atau fokus ke PR/PO saja</p>
          </div>
          <div class="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-background/80 p-1 md:w-auto md:min-w-[260px]">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              :class="[
                'flex items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors',
                activeType === option.value
                  ? option.value === 'purchase_request'
                    ? 'bg-amber-500 text-amber-950 shadow-sm'
                    : option.value === 'purchase_order'
                      ? 'bg-sky-700 text-white shadow-sm dark:bg-sky-500 dark:text-sky-950'
                      : 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ]"
              @click="setActiveType(option.value)"
            >
              <span>{{ option.label }}</span>
              <span
                :class="[
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  activeType === option.value
                    ? option.value === 'all'
                      ? 'bg-background/15 text-background'
                      : 'bg-black/10 text-inherit'
                    : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ option.count }}
              </span>
            </button>
          </div>
        </div>

        <div
          class="grid gap-3 rounded-lg border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3 sm:grid-cols-3"
        >
          <div class="min-w-0 rounded-md bg-background/50 p-3">
            <p class="text-xs text-muted-foreground">Transaksi</p>
            <div class="mt-2 flex items-center gap-2">
              <Boxes class="h-4 w-4 text-foreground/70" />
              <p class="text-lg font-semibold leading-tight">{{ filteredNotifications.length }}</p>
            </div>
          </div>
          <div class="min-w-0 rounded-md bg-background/50 p-3">
            <p class="text-xs text-muted-foreground">Total Qty OTS</p>
            <div class="mt-2 flex items-center gap-2">
              <PackageSearch class="h-4 w-4 text-foreground/70" />
              <p class="text-lg font-semibold leading-tight">{{ totalQtyOts }}</p>
            </div>
          </div>
          <div class="min-w-0 rounded-md bg-background/50 p-3">
            <p class="text-xs text-muted-foreground">Komposisi</p>
            <div class="mt-2 flex items-center gap-2">
              <ReceiptText class="h-4 w-4 text-foreground/70" />
              <p class="text-sm font-medium leading-tight">
                <template v-if="activeType === 'purchase_request'">{{ prCount }} PR</template>
                <template v-else-if="activeType === 'purchase_order'">{{ poCount }} PO</template>
                <template v-else>{{ prCount }} PR / {{ poCount }} PO</template>
              </p>
            </div>
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
            'group cursor-pointer overflow-hidden border border-white/8 border-l-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-lg',
            getTypeAccentClass(notif),
          ]"
          @click="emit('openDetail', notif)"
        >
          <CardContent class="p-3 md:p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-1 items-start gap-3">
                <span
                  :class="[
                    'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                    getTypeIconAccentClass(notif),
                  ]"
                >
                  <component :is="getIcon(notif)" class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-sm font-semibold md:text-base">
                      {{ notif.no_transaksi || notif.title || '-' }}
                    </h3>
                    <Badge
                      variant="outline"
                      class="text-xs"
                      :class="getTypeBadgeClass(notif)"
                    >
                      {{ getTypeLabel(notif) }}
                    </Badge>
                    <Badge variant="outline" class="border-white/10 bg-background/65 text-xs">
                      OTS {{ notif.total_qty_ots || 0 }}
                    </Badge>
                  </div>
                  <p class="mt-1 line-clamp-2 text-xs text-foreground/78 md:text-sm">
                    {{ notif.approval_message }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span class="inline-flex items-center gap-1 rounded-full bg-background/55 px-2 py-1">
                      <Clock class="h-3 w-3" />
                      {{ formatDate(notif.tgl_transaksi || notif.createdAt) }}
                    </span>
                    <span v-if="notif.nama_supplier" class="truncate rounded-full bg-background/55 px-2 py-1">
                      Supplier: {{ notif.nama_supplier }}
                    </span>
                    <span v-if="notif.nama_gudang" class="truncate rounded-full bg-background/55 px-2 py-1">
                      Gudang: {{ notif.nama_gudang }}
                    </span>
                  </div>
                </div>
              </div>
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
            Tampilkan {{ filteredNotifications.length - collapsedLimit }} transaksi lainnya
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
