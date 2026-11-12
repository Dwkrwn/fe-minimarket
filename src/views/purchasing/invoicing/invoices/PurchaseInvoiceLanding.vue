<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (4.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Verifikasi Nota Supplier</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Cocokkan 3 dokumen (PO, penerimaan barang, retur) sebelum nilai tagihan supplier dikunci.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Menunggu Verifikasi</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ pendingOrders.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">PO selesai tanpa nota</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <FileClock class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sudah Diverifikasi</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ invoices.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Nota terkunci</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <FileCheck2 class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Potongan Retur</p>
            <h3 class="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              Rp {{ formatNumber(totalDeduction) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Dikurangkan dari nota</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <PackageX class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Bersih Tagihan</p>
            <h3 class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              Rp {{ formatNumber(totalNet) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Nilai yang dikunci</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
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
              placeholder="Cari nomor PO, nomor nota, atau supplier..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">PO Siap Diverifikasi</CardTitle>
        <CardDescription>
          Hanya PO berstatus COMPLETED yang belum memiliki nota. Verifikasi akan mengunci satu nota per PO.
        </CardDescription>
      </CardHeader>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. PO &amp; Tanggal</th>
              <th class="px-4 py-3.5">Supplier</th>
              <th class="px-4 py-3.5 text-center">Penerimaan</th>
              <th class="px-4 py-3.5 text-right">Nilai PO</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 3" :key="'skel-pending-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredPendingOrders.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <CheckCircle2 class="w-10 h-10 mx-auto text-emerald-300 dark:text-emerald-700 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada PO yang menunggu verifikasi</p>
                <p class="text-xs text-slate-400 mt-1">
                  Semua PO selesai sudah memiliki nota, atau belum ada PO yang diterima penuh.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="order in filteredPendingOrders"
              :key="order.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ order.no_po }}</div>
                <div class="text-xs text-slate-500">{{ formatDate(order.tgl_po) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div>{{ order.supplier?.nama_supplier || "-" }}</div>
                <div class="text-xs text-slate-500">TOP {{ order.supplier?.term_of_payment ?? 0 }} hari</div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span class="font-semibold">{{ order.goods_receipts?.length ?? 0 }}</span>
                <span class="text-xs text-slate-400"> dokumen</span>
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                Rp {{ formatNumber(order.total_amount) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" class="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  {{ order.status_label }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Button
                  size="sm"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 mx-auto"
                  @click="router.push(`/purchasing/invoicing/invoices/verify/${order.id}`)"
                >
                  <ShieldCheck class="w-4 h-4" />
                  <span>Verifikasi Nota</span>
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">Nota Terverifikasi</CardTitle>
        <CardDescription>
          Nilai tagihan sudah dikunci dan masuk ke jadwal hutang pada halaman Hutang &amp; Pembayaran.
        </CardDescription>
      </CardHeader>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. Nota</th>
              <th class="px-4 py-3.5">PO / Supplier</th>
              <th class="px-4 py-3.5">Jatuh Tempo</th>
              <th class="px-4 py-3.5 text-right">Kotor</th>
              <th class="px-4 py-3.5 text-right">Potongan</th>
              <th class="px-4 py-3.5 text-right">Bersih</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 3" :key="'skel-invoice-' + n">
                <td colspan="8" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredInvoices.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-slate-500">
                <ReceiptText class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada nota terverifikasi</p>
                <p class="text-xs text-slate-400 mt-1">Pilih PO di tabel atas untuk memulai 3-way matching.</p>
              </td>
            </tr>

            <tr
              v-else
              v-for="invoice in filteredInvoices"
              :key="invoice.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ invoice.no_invoice }}</div>
                <div class="text-xs text-slate-500">{{ formatDate(invoice.tgl_invoice) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="font-mono text-xs">{{ invoice.po?.no_po || "-" }}</div>
                <div class="text-xs text-slate-500">{{ invoice.po?.supplier?.nama_supplier || "-" }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="text-xs">{{ formatDate(invoice.tgl_jatuh_tempo) }}</div>
                <div class="text-[11px]" :class="dueClass(invoice.tgl_jatuh_tempo)">
                  {{ dueLabel(invoice.tgl_jatuh_tempo) }}
                </div>
              </td>
              <td class="px-4 py-3.5 text-right font-mono">Rp {{ formatNumber(invoice.gross_amount) }}</td>
              <td class="px-4 py-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                -Rp {{ formatNumber(invoice.return_deduction) }}
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                Rp {{ formatNumber(invoice.net_payable) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(invoice.status)">{{ statusLabel(invoice.status) }}</Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="Buka PO"
                  @click="router.push(`/purchasing/order/purchase-orders/view/${invoice.po_id}`)"
                >
                  <ClipboardList class="w-4 h-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileClock,
  PackageX,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPurchaseOrders,
  type PurchaseOrder,
} from "../../order/purchase_orders/purchaseOrderService";
import {
  getPurchaseInvoices,
  type PurchaseInvoice,
  type PurchaseInvoiceStatus,
} from "./purchaseInvoiceService";

const router = useRouter();

const orders = ref<PurchaseOrder[]>([]);
const invoices = ref<PurchaseInvoice[]>([]);
const loading = ref(false);
const searchQuery = ref("");

const invoicedPoIds = computed(() => new Set(invoices.value.map((invoice) => invoice.po_id)));

const pendingOrders = computed(() =>
  orders.value.filter(
    (order) => order.status === "COMPLETED" && !invoicedPoIds.value.has(order.id),
  ),
);

const filteredPendingOrders = computed(() => filterOrders(pendingOrders.value));
const filteredInvoices = computed(() => {
  const term = searchQuery.value.trim().toLowerCase();
  if (!term) return invoices.value;
  return invoices.value.filter((invoice) =>
    [invoice.no_invoice, invoice.po?.no_po, invoice.po?.supplier?.nama_supplier]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
  );
});

const totalDeduction = computed(() =>
  invoices.value.reduce((acc, invoice) => acc + Number(invoice.return_deduction || 0), 0),
);
const totalNet = computed(() =>
  invoices.value.reduce((acc, invoice) => acc + Number(invoice.net_payable || 0), 0),
);

function filterOrders(list: PurchaseOrder[]) {
  const term = searchQuery.value.trim().toLowerCase();
  if (!term) return list;
  return list.filter((order) =>
    [order.no_po, order.supplier?.nama_supplier]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
  );
}

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: PurchaseInvoiceStatus) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PARTIAL":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "OVERDUE":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
}

function statusLabel(status: PurchaseInvoiceStatus) {
  switch (status) {
    case "PAID":
      return "🟢 Lunas";
    case "PARTIAL":
      return "🟠 Sebagian";
    case "OVERDUE":
      return "🔴 Overdue";
    default:
      return "🟡 Belum Bayar";
  }
}

function dueLabel(value?: string | null) {
  if (!value) return "";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  const today = new Date();
  const diffDays = Math.ceil(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return `Terlambat ${Math.abs(diffDays)} hari`;
  if (diffDays === 0) return "Jatuh tempo hari ini";
  return `${diffDays} hari lagi`;
}

function dueClass(value?: string | null) {
  if (!value) return "text-slate-400";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "text-slate-400";
  const today = new Date();
  const diffDays = Math.ceil(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (diffDays <= 3) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-slate-500";
}

function resetFilter() {
  searchQuery.value = "";
}

async function load() {
  loading.value = true;
  try {
    const [orderRows, invoiceRows] = await Promise.all([
      getPurchaseOrders({ status: "COMPLETED" }),
      getPurchaseInvoices(),
    ]);
    orders.value = orderRows;
    invoices.value = invoiceRows;
  } catch (error: any) {
    console.error("Gagal memuat verifikasi nota:", error);
    toast.error(error.message || "Gagal memuat data verifikasi nota");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
