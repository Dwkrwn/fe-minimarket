<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (3.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ receipt?.no_gr || "Detail Penerimaan" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Bukti barang masuk beserta qty bagus yang sudah menambah stok gudang.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/receiving/goods-receipts')">
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" :disabled="!receipt" @click="openPo">
          <ClipboardList class="w-4 h-4" />
          <span>Buka PO</span>
        </Button>
        <Button
          v-if="canCreate && receipt && !hasInvoice && totalGood > 0"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          @click="openReturn"
        >
          <PackageX class="w-4 h-4" />
          <span>Retur Barang</span>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 6" :key="n" class="h-8 w-full" />
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 4" :key="n" class="h-8 w-full" />
        </CardContent>
      </Card>
    </div>

    <div v-else-if="!receipt" class="py-16 text-center text-slate-500">
      <PackagePlus class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p class="font-medium">Penerimaan barang tidak ditemukan</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Status</p>
            <Badge variant="outline" :class="statusClass(receipt.status)" class="mt-2">{{ receipt.status_label || receipt.status }}</Badge>
            <p class="text-xs text-slate-500 mt-2">{{ formatDate(receipt.tgl_gr) }}</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">PO / Supplier</p>
            <p class="font-mono text-sm font-semibold text-slate-900 dark:text-white mt-1">{{ receipt.po?.no_po || "-" }}</p>
            <p class="text-xs text-slate-500">{{ receipt.po?.supplier?.nama_supplier || "-" }}</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Qty Bagus Masuk</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ formatNumber(totalGood) }} <span class="text-xs font-normal">Pcs</span>
            </p>
            <p class="text-xs text-slate-500">
              {{ formatNumber(totalRejected) }} Pcs ditolak
            </p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Nilai Diterima</p>
            <p class="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">
              Rp {{ formatNumber(totalValue) }}
            </p>
            <p class="text-xs text-slate-500">Dasar verifikasi nota</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-xs text-slate-500">No. Surat Jalan</p>
            <p class="font-mono font-semibold text-slate-900 dark:text-white">{{ receipt.no_surat_jalan || "-" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Diterima Oleh</p>
            <p class="font-semibold text-slate-900 dark:text-white">{{ receipt.user?.name || "-" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Catatan</p>
            <p class="text-slate-700 dark:text-slate-200">{{ receipt.catatan || "-" }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Rincian Barang Diterima</CardTitle>
        </CardHeader>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-3">Barang</th>
                <th class="px-4 py-3 text-center">Qty Datang</th>
                <th class="px-4 py-3 text-center">Bagus (Pcs)</th>
                <th class="px-4 py-3 text-center">Ditolak (Pcs)</th>
                <th class="px-4 py-3 text-right">Harga / Pcs</th>
                <th class="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="row in receipt.details" :key="row.id || row.item_id">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">{{ row.item?.nama_barang || "-" }}</div>
                  <span class="font-mono text-xs text-slate-500">{{ row.item?.barcode || "-" }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  {{ formatNumber(row.qty_diterima_beli) }}
                  <span class="text-xs text-slate-500">{{ row.uom?.satuan_beli || row.item?.uom?.satuan_beli || "Pcs" }}</span>
                </td>
                <td class="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                  {{ formatNumber(row.qty_bagus_pcs) }}
                </td>
                <td class="px-4 py-3 text-center" :class="Number(row.qty_ditolak_pcs) > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-400'">
                  {{ formatNumber(row.qty_ditolak_pcs) }}
                </td>
                <td class="px-4 py-3 text-right font-mono">Rp {{ formatNumber(row.harga_satuan_pcs) }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                  Rp {{ formatNumber(row.subtotal) }}
                </td>
              </tr>
              <tr v-if="!receipt.details?.length">
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">Tidak ada baris barang.</td>
              </tr>
            </tbody>
            <tfoot class="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
              <tr>
                <td colspan="5" class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total Nilai Diterima</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {{ formatNumber(totalValue) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card v-if="receipt.invoices?.length" class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Tagihan Terkait</CardTitle>
          <CardDescription>Retur tidak dapat dibuat setelah invoice terbit.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <div v-for="invoice in receipt.invoices" :key="invoice.id" class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-sm flex items-center justify-between">
            <span class="font-mono text-xs font-semibold">{{ invoice.no_invoice }}</span>
            <Badge variant="outline" class="text-[10px]">{{ invoice.status }}</Badge>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ClipboardList, PackagePlus, PackageX } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import { getGoodsReceipt, type GoodsReceipt } from "./goodsReceiptService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const receipt = ref<GoodsReceipt | null>(null);
const loading = ref(false);

const canCreate = computed(() => authStore.isManager || authStore.user?.role.system_key === "GUDANG");
const receiptId = computed(() => String(route.params.id || ""));

const totalGood = computed(() =>
  (receipt.value?.details || []).reduce((acc, row) => acc + Number(row.qty_bagus_pcs || 0), 0),
);
const totalRejected = computed(() =>
  (receipt.value?.details || []).reduce((acc, row) => acc + Number(row.qty_ditolak_pcs || 0), 0),
);
const totalValue = computed(() =>
  (receipt.value?.details || []).reduce((acc, row) => acc + Number(row.subtotal || 0), 0),
);
const hasInvoice = computed(() => (receipt.value?.invoices || []).length > 0);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: string) {
  if (status === "VERIFIED") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (status === "CANCELLED") return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
}

function openPo() {
  if (!receipt.value?.po_id) return;
  router.push(`/purchasing/order/purchase-orders/view/${receipt.value.po_id}`);
}

function openReturn() {
  if (!receipt.value?.po_id) return;
  router.push({ path: "/purchasing/receiving/purchase-returns/form", query: { po: receipt.value.po_id } });
}

async function load() {
  if (!receiptId.value) return;
  loading.value = true;
  try {
    receipt.value = await getGoodsReceipt(receiptId.value);
  } catch (error: any) {
    console.error("Gagal memuat penerimaan:", error);
    toast.error(error.message || "Gagal memuat detail penerimaan barang");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
