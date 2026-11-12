<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (2.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Purchase Order</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Terbitkan pesanan pembelian ke supplier dan pantau status pemenuhannya.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canCreate"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push('/purchasing/order/purchase-orders/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Buat PO</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Menunggu Kirim</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ countByStatus.ORDERED }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Status ORDERED</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Truck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Diterima Sebagian</p>
            <h3 class="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{{ countByStatus.PARTIAL_RECEIVED }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Menunggu sisa barang</p>
          </div>
          <div class="p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-xl">
            <PackageOpen class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Selesai</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ countByStatus.COMPLETED }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Seluruh qty diterima</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Nilai PO</p>
            <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">Rp {{ formatNumber(totalAmount) }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ orders.length }} dokumen</p>
          </div>
          <div class="p-3 bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 rounded-xl">
            <Wallet class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nomor PO atau nama supplier..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="load"
            />
          </div>
          <select
            v-model="statusFilter"
            class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-48"
            @change="load"
          >
            <option value="">Semua status</option>
            <option value="ORDERED">Menunggu Kirim</option>
            <option value="PARTIAL_RECEIVED">Diterima Sebagian</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
          <select
            v-model="supplierFilter"
            class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-56"
            @change="load"
          >
            <option value="">Semua supplier</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.nama_supplier }}
            </option>
          </select>
          <Button variant="outline" size="sm" :disabled="loading" @click="load">Cari</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. PO &amp; Tanggal</th>
              <th class="px-4 py-3.5">Supplier</th>
              <th class="px-4 py-3.5 text-center">Item</th>
              <th class="px-4 py-3.5 text-right">Total Nilai</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="orders.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <ClipboardList class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada Purchase Order</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canCreate ? 'Klik "+ Buat PO" untuk menerbitkan pesanan pembelian pertama.' : 'Belum ada PO yang diterbitkan.' }}
                </p>
              </td>
            </tr>

            <tr v-else v-for="po in orders" :key="po.id" class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ po.no_po }}</div>
                <div class="text-xs text-slate-500">{{ formatDate(po.tgl_po) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div>{{ po.supplier?.nama_supplier || '-' }}</div>
                <div class="text-xs text-slate-500">
                  TOP {{ po.supplier?.term_of_payment ?? 0 }} hari
                </div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span class="font-semibold">{{ po.details?.length ?? 0 }}</span>
                <span class="text-xs text-slate-400"> barang</span>
                <div class="text-xs text-slate-500">{{ po.goods_receipts?.length ?? 0 }} penerimaan</div>
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                Rp {{ formatNumber(po.total_amount) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(po.status)">{{ po.status_label }}</Badge>
                <div v-if="po.tgl_estimasi_tiba" class="text-[11px] text-slate-500 mt-1">
                  ETA {{ formatDate(po.tgl_estimasi_tiba) }}
                </div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Detail PO"
                    @click="router.push(`/purchasing/order/purchase-orders/view/${po.id}`)"
                  >
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    title="Tracking PO"
                    @click="router.push({ path: '/purchasing/order/tracking', query: { po: po.id } })"
                  >
                    <Route class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Cetak PO"
                    @click="router.push(`/purchasing/order/purchase-orders/print/${po.id}`)"
                  >
                    <Printer class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canCreate"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Kirim ke supplier"
                    @click="openSendDialog(po)"
                  >
                    <Send class="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <GlobalDialog
      v-model:open="isSendDialogOpen"
      title="Kirim Purchase Order"
      description="Draft pesan siap dikirim via WhatsApp. Cetak dokumen bila supplier meminta hard copy."
      type="info"
      content-class="max-w-2xl"
    >
      <div v-if="sending" class="py-8 text-center text-sm text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2" />
        Menyiapkan draft pesan...
      </div>

      <div v-else-if="sendResult" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <p class="text-xs text-slate-500">No. PO</p>
            <p class="font-mono font-semibold text-slate-900 dark:text-white">{{ sendResult.no_po }}</p>
          </div>
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <p class="text-xs text-slate-500">Supplier</p>
            <p class="font-semibold text-slate-900 dark:text-white">{{ sendResult.supplier_name }}</p>
          </div>
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <p class="text-xs text-slate-500">Nomor Tujuan</p>
            <p class="font-mono font-semibold text-slate-900 dark:text-white">{{ sendResult.target_wa || '-' }}</p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Draft Pesan</label>
          <textarea
            v-model="sendMessage"
            rows="10"
            class="w-full text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <p v-if="!sendResult.target_wa" class="text-xs text-amber-600 dark:text-amber-400">
          Supplier belum memiliki nomor WhatsApp/telepon. Salin pesan secara manual.
        </p>

        <div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" class="flex items-center gap-1.5" @click="copyMessage">
            <Copy class="w-4 h-4" />
            <span>Salin Pesan</span>
          </Button>
          <Button variant="outline" class="flex items-center gap-1.5" @click="printPo">
            <Printer class="w-4 h-4" />
            <span>Cetak PO</span>
          </Button>
          <a
            v-if="waLink"
            :href="waLink"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
          >
            <Send class="w-4 h-4" />
            Buka WhatsApp
          </a>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  PackageOpen,
  Plus,
  Printer,
  RefreshCw,
  Route,
  Search,
  Send,
  Truck,
  Wallet,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { getSuppliers, type Supplier } from "../../master/suppliers/supplierService";
import {
  getPurchaseOrders,
  sendPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type SendPurchaseOrderResult,
} from "./purchaseOrderService";

const router = useRouter();
const authStore = useAuthStore();
const canCreate = computed(() => authStore.isManager || authStore.user?.role.system_key === "GUDANG");

const orders = ref<PurchaseOrder[]>([]);
const suppliers = ref<Supplier[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const statusFilter = ref("");
const supplierFilter = ref("");

const isSendDialogOpen = ref(false);
const sending = ref(false);
const sendResult = ref<SendPurchaseOrderResult | null>(null);
const sendMessage = ref("");
const sendingPoId = ref("");

const countByStatus = computed(() => {
  const base: Record<PurchaseOrderStatus, number> = {
    ORDERED: 0,
    PARTIAL_RECEIVED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const po of orders.value) base[po.status] += 1;
  return base;
});

const totalAmount = computed(() =>
  orders.value.reduce((acc, po) => acc + Number(po.total_amount || 0), 0),
);

const waLink = computed(() => {
  if (!sendResult.value?.target_wa) return "";
  const phone = String(sendResult.value.target_wa).replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${phone}?text=${encodeURIComponent(sendMessage.value)}`;
});

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: PurchaseOrderStatus) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PARTIAL_RECEIVED":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "CANCELLED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
}

async function load() {
  loading.value = true;
  try {
    orders.value = await getPurchaseOrders({
      search: searchQuery.value,
      status: (statusFilter.value || undefined) as PurchaseOrderStatus | undefined,
      supplier_id: supplierFilter.value || undefined,
    });
  } catch (error: any) {
    console.error("Gagal memuat PO:", error);
    toast.error(error.message || "Gagal memuat Purchase Order");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    suppliers.value = await getSuppliers();
  } catch (error) {
    console.error("Gagal memuat supplier:", error);
  }
}

function resetFilter() {
  searchQuery.value = "";
  statusFilter.value = "";
  supplierFilter.value = "";
  load();
}

async function openSendDialog(po: PurchaseOrder) {
  isSendDialogOpen.value = true;
  sending.value = true;
  sendResult.value = null;
  sendMessage.value = "";
  sendingPoId.value = po.id;
  try {
    const result = await sendPurchaseOrder(po.id);
    sendResult.value = result;
    sendMessage.value = result.message_draft;
  } catch (error: any) {
    console.error("Gagal menyiapkan draft PO:", error);
    toast.error(error.message || "Gagal menyiapkan draft pesan PO");
    isSendDialogOpen.value = false;
  } finally {
    sending.value = false;
  }
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(sendMessage.value);
    toast.success("Draft pesan disalin");
  } catch {
    toast.error("Gagal menyalin pesan. Salin manual dari kotak draft.");
  }
}

function printPo() {
  if (!sendingPoId.value) return;
  window.open(`/purchasing/order/purchase-orders/print/${sendingPoId.value}`, "_blank");
}

onMounted(async () => {
  await loadSuppliers();
  await load();
});
</script>
