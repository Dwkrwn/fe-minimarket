<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (2.3)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Tracking PO</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pantau pemenuhan setiap baris PO: qty diterima baik, ditolak, dan sisa yang belum datang.
        </p>
      </div>
      <Button variant="outline" size="sm" :disabled="loading" @click="reload" class="flex items-center gap-1.5">
        <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
        <span>Refresh</span>
      </Button>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pilih Purchase Order</label>
          <select
            v-model="selectedPoId"
            class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            @change="loadTracking"
          >
            <option value="">-- Pilih PO --</option>
            <option v-for="order in orders" :key="order.id" :value="order.id">
              {{ order.no_po }} — {{ order.supplier?.nama_supplier }} ({{ order.status }})
            </option>
          </select>
        </div>
        <Button variant="outline" size="sm" class="md:mt-5" :disabled="loading || !selectedPoId" @click="loadTracking">
          Muat Tracking
        </Button>
      </CardContent>
    </Card>

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <Card v-for="n in 4" :key="n" class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 space-y-2">
          <Skeleton class="h-4 w-1/2" />
          <Skeleton class="h-8 w-3/4" />
        </CardContent>
      </Card>
    </div>

    <div v-else-if="!selectedPoId" class="py-16 text-center text-slate-500">
      <Route class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p class="font-medium text-slate-700 dark:text-slate-300">Pilih Purchase Order</p>
      <p class="text-xs text-slate-400 mt-1">Tracking menampilkan progres penerimaan barang per PO.</p>
    </div>

    <template v-else-if="tracking">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Status PO</p>
            <p class="text-lg font-bold text-slate-900 dark:text-white mt-1">{{ tracking.status_badge }}</p>
            <p class="text-xs font-mono text-slate-500 mt-1">{{ tracking.no_po }}</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier</p>
            <p class="font-semibold text-slate-900 dark:text-white mt-1">{{ tracking.supplier }}</p>
            <p class="text-xs text-slate-500 mt-1">{{ formatDate(tracking.tgl_po) }}</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Qty Diterima Baik</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ formatNumber(totalReceived) }} <span class="text-xs font-normal">Pcs</span>
            </p>
            <p class="text-xs text-slate-500 mt-1">dari {{ formatNumber(totalOrdered) }} Pcs</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sisa Belum Datang</p>
            <p class="text-2xl font-bold" :class="totalRemaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'">
              {{ formatNumber(totalRemaining) }} <span class="text-xs font-normal">Pcs</span>
            </p>
            <p class="text-xs text-slate-500 mt-1">{{ formatNumber(totalRejected) }} Pcs ditolak</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Progres per Barang</CardTitle>
          <CardDescription>Bar diterima dihitung dari qty bagus, bukan qty datang.</CardDescription>
        </CardHeader>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-3">Barang</th>
                <th class="px-4 py-3 text-center">Dipesan</th>
                <th class="px-4 py-3 text-center">Diterima</th>
                <th class="px-4 py-3 text-center">Ditolak</th>
                <th class="px-4 py-3 text-center">Sisa</th>
                <th class="px-4 py-3">Pemenuhan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="row in tracking.trackingItems" :key="row.item_id">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">{{ row.nama_barang }}</div>
                  <span class="font-mono text-xs text-slate-500">{{ row.barcode }}</span>
                </td>
                <td class="px-4 py-3 text-center font-semibold">{{ formatNumber(row.qty_order_pcs) }}</td>
                <td class="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  {{ formatNumber(row.received_pcs) }}
                </td>
                <td class="px-4 py-3 text-center" :class="row.rejected_pcs > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'">
                  {{ formatNumber(row.rejected_pcs) }}
                </td>
                <td class="px-4 py-3 text-center" :class="row.remaining_pcs > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400'">
                  {{ formatNumber(row.remaining_pcs) }}
                </td>
                <td class="px-4 py-3 min-w-[160px]">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="progressValue(row.fulfillment_rate) >= 100 ? 'bg-emerald-500' : 'bg-amber-500'"
                        :style="{ width: `${Math.min(progressValue(row.fulfillment_rate), 100)}%` }"
                      ></div>
                    </div>
                    <span class="text-xs font-mono w-12 text-right">{{ row.fulfillment_rate }}</span>
                  </div>
                </td>
              </tr>
              <tr v-if="tracking.trackingItems.length === 0">
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">PO ini tidak memiliki baris barang.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div class="flex justify-end">
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="openPoDetail">
          <ExternalLink class="w-4 h-4" />
          <span>Buka Detail PO</span>
        </Button>
      </div>
    </template>

    <div v-else class="py-16 text-center text-slate-500">
      <AlertTriangle class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p class="font-medium">Tracking tidak tersedia</p>
      <p class="text-xs text-slate-400 mt-1">Pilih PO lain atau muat ulang halaman.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AlertTriangle, ExternalLink, RefreshCw, Route } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPoTracking, type PoTracking } from "./poTrackingService";
import { getPurchaseOrders, type PurchaseOrder } from "../purchase_orders/purchaseOrderService";

const route = useRoute();
const router = useRouter();

const orders = ref<PurchaseOrder[]>([]);
const selectedPoId = ref("");
const tracking = ref<PoTracking | null>(null);
const loading = ref(false);

const totalOrdered = computed(() =>
  (tracking.value?.trackingItems || []).reduce((acc, row) => acc + Number(row.qty_order_pcs || 0), 0),
);
const totalReceived = computed(() =>
  (tracking.value?.trackingItems || []).reduce((acc, row) => acc + Number(row.received_pcs || 0), 0),
);
const totalRejected = computed(() =>
  (tracking.value?.trackingItems || []).reduce((acc, row) => acc + Number(row.rejected_pcs || 0), 0),
);
const totalRemaining = computed(() =>
  (tracking.value?.trackingItems || []).reduce((acc, row) => acc + Number(row.remaining_pcs || 0), 0),
);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function progressValue(rate: string | number | null | undefined) {
  return Number(String(rate || "0").replace("%", "")) || 0;
}

async function loadOrders() {
  try {
    orders.value = await getPurchaseOrders();
  } catch (error: any) {
    console.error("Gagal memuat daftar PO:", error);
    toast.error(error.message || "Gagal memuat daftar Purchase Order");
  }
}

async function loadTracking() {
  if (!selectedPoId.value) {
    tracking.value = null;
    return;
  }
  loading.value = true;
  try {
    tracking.value = await getPoTracking(selectedPoId.value);
  } catch (error: any) {
    tracking.value = null;
    console.error("Gagal memuat tracking PO:", error);
    toast.error(error.message || "Gagal memuat tracking PO");
  } finally {
    loading.value = false;
  }
}

function reload() {
  loadOrders();
  loadTracking();
}

function openPoDetail() {
  if (!selectedPoId.value) return;
  router.push(`/purchasing/order/purchase-orders/view/${selectedPoId.value}`);
}

onMounted(async () => {
  await loadOrders();
  const queryPo = String(route.query.po || "");
  if (queryPo && orders.value.some((order) => order.id === queryPo)) {
    selectedPoId.value = queryPo;
  } else if (orders.value.length === 1) {
    const onlyOrder = orders.value[0];
    if (onlyOrder) selectedPoId.value = onlyOrder.id;
  }
  if (selectedPoId.value) await loadTracking();
});
</script>
