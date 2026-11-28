<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (3.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Terima Barang</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Catat barang datang. Qty bagus menambah stok gudang; qty ditolak tidak masuk stok.
        </p>
      </div>
      <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/receiving/goods-receipts')">
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </Button>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-3 gap-4" @submit.prevent="handleSubmit">
      <div class="lg:col-span-2 space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Dokumen Pengiriman</CardTitle>
            <CardDescription>Pilih PO yang masih memiliki sisa barang belum diterima.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  No. Penerimaan (No. GR) <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.no_gr"
                  placeholder="Auto (GR-001)"
                  readonly
                  class="font-mono bg-slate-50 dark:bg-slate-900/50"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Nomor otomatis sistem</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Order <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.po_id"
                  required
                  class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  @change="loadPoDetail"
                >
                  <option value="" disabled>Pilih PO</option>
                  <option v-for="order in openOrders" :key="order.id" :value="order.id">
                    {{ order.no_po }} — {{ order.supplier?.nama_supplier }} ({{ order.status_label }})
                  </option>
                </select>
                <p v-if="openOrders.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Tidak ada PO yang menunggu penerimaan.
                </p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">No. Surat Jalan</label>
                <Input v-model="form.no_surat_jalan" placeholder="Nomor SJ dari supplier" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan Penerimaan</label>
              <textarea
                v-model="form.catatan"
                rows="2"
                placeholder="Kondisi truk, jam bongkar, keterangan selisih, dsb."
                class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Rincian Barang Datang</CardTitle>
            <CardDescription>
              Qty bagus (Pcs) = qty diterima (satuan beli) &times; rasio konversi &minus; qty ditolak.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div v-if="loadingPo" class="py-8 text-center text-sm text-slate-500">
              <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2" />
              Memuat rincian PO...
            </div>

            <div v-else-if="!form.po_id" class="py-10 text-center text-slate-500">
              <PackagePlus class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p class="font-medium text-slate-700 dark:text-slate-300">Pilih Purchase Order</p>
              <p class="text-xs text-slate-400 mt-1">Daftar barang dan sisa qty akan muncul di sini.</p>
            </div>

            <div v-else-if="lines.length === 0" class="py-10 text-center text-slate-500">
              <CheckCircle2 class="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p class="font-medium text-slate-700 dark:text-slate-300">Semua barang sudah diterima</p>
              <p class="text-xs text-slate-400 mt-1">PO ini tidak memiliki sisa qty yang bisa diterima.</p>
            </div>

            <div
              v-for="line in lines"
              :key="line.item_id"
              class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white truncate">{{ line.nama_barang }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ line.barcode }}</p>
                </div>
                <Badge variant="outline" class="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30 text-[10px] shrink-0">
                  Sisa {{ formatNumber(line.remaining_pcs) }} Pcs
                </Badge>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Qty Datang</label>
                  <div class="flex items-center gap-1.5">
                    <Input v-model.number="line.qty_diterima_beli" type="number" min="0" step="1" class="h-8 text-sm" />
                    <span class="text-xs text-slate-500 whitespace-nowrap">{{ line.satuan_beli }}</span>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Qty Ditolak (Pcs)</label>
                  <Input v-model.number="line.qty_ditolak_pcs" type="number" min="0" step="1" class="h-8 text-sm" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Qty Bagus (Pcs)</label>
                  <div
                    class="h-8 flex items-center font-mono text-sm font-semibold"
                    :class="lineError(line) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
                  >
                    {{ formatNumber(goodPcs(line)) }}
                  </div>
                </div>
                <div class="text-right">
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Nilai</label>
                  <p class="h-8 flex items-center justify-end font-mono text-sm text-slate-900 dark:text-white">
                    Rp {{ formatNumber(goodPcs(line) * line.harga_satuan_pcs) }}
                  </p>
                </div>
              </div>

              <p v-if="lineError(line)" class="text-[11px] text-rose-600 dark:text-rose-400 mt-2">{{ lineError(line) }}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Ringkasan Penerimaan</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">PO</span>
              <span class="font-mono text-xs font-semibold">{{ selectedOrder?.no_po || "-" }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Supplier</span>
              <span class="font-semibold text-right max-w-[55%] truncate">{{ selectedOrder?.supplier?.nama_supplier || "-" }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Baris diisi</span>
              <span class="font-semibold">{{ filledLines.length }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Total Bagus</span>
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ formatNumber(totalGoodPcs) }} Pcs</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Total Ditolak</span>
              <span class="font-semibold" :class="totalRejectedPcs > 0 ? 'text-rose-600 dark:text-rose-400' : ''">
                {{ formatNumber(totalRejectedPcs) }} Pcs
              </span>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-slate-500">Nilai Diterima</span>
              <span class="font-mono font-bold text-lg text-slate-900 dark:text-white">Rp {{ formatNumber(totalValue) }}</span>
            </div>

            <Button
              type="submit"
              :disabled="isSubmitting || !form.po_id || filledLines.length === 0 || hasLineError"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 mt-2"
            >
              <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <Save v-else class="w-4 h-4" />
              <span>Simpan Penerimaan</span>
            </Button>
            <p class="text-[11px] text-slate-400 text-center">
              Stok gudang bertambah otomatis sebesar qty bagus.
            </p>
          </CardContent>
        </Card>

        <Card v-if="selectedOrder" class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4 text-xs text-slate-500 space-y-1">
            <p class="font-semibold text-slate-700 dark:text-slate-300">Info PO</p>
            <p>Tanggal: {{ formatDate(selectedOrder.tgl_po) }}</p>
            <p>Status: {{ selectedOrder.status_label }}</p>
            <p>Total PO: Rp {{ formatNumber(selectedOrder.total_amount) }}</p>
            <p>Penerimaan sebelumnya: {{ selectedOrder.goods_receipts?.length ?? 0 }} dokumen</p>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, CheckCircle2, PackagePlus, RefreshCw, Save } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getPurchaseOrder,
  getPurchaseOrders,
  type PurchaseOrder,
} from "../../order/purchase_orders/purchaseOrderService";
import { createGoodsReceipt, getNextGoodsReceiptNumber } from "./goodsReceiptService";

interface ReceiptLine {
  item_id: string;
  nama_barang: string;
  barcode: string;
  satuan_beli: string;
  rasio_konversi: number;
  harga_satuan_pcs: number;
  remaining_pcs: number;
  qty_diterima_beli: number;
  qty_ditolak_pcs: number;
}

const route = useRoute();
const router = useRouter();

const orders = ref<PurchaseOrder[]>([]);
const selectedOrder = ref<PurchaseOrder | null>(null);
const lines = ref<ReceiptLine[]>([]);
const loadingPo = ref(false);
const isSubmitting = ref(false);

const form = ref({
  no_gr: "",
  po_id: "",
  no_surat_jalan: "",
  catatan: "",
});

const openOrders = computed(() =>
  orders.value.filter((order) => order.status === "ORDERED" || order.status === "PARTIAL_RECEIVED"),
);

const filledLines = computed(() =>
  lines.value.filter((line) => Number(line.qty_diterima_beli || 0) > 0 || Number(line.qty_ditolak_pcs || 0) > 0),
);

const totalGoodPcs = computed(() =>
  filledLines.value.reduce((acc, line) => acc + goodPcs(line), 0),
);
const totalRejectedPcs = computed(() =>
  filledLines.value.reduce((acc, line) => acc + Number(line.qty_ditolak_pcs || 0), 0),
);
const totalValue = computed(() =>
  filledLines.value.reduce((acc, line) => acc + goodPcs(line) * line.harga_satuan_pcs, 0),
);
const hasLineError = computed(() => lines.value.some((line) => !!lineError(line)));
const anyGood = computed(() => filledLines.value.some((line) => goodPcs(line) > 0));

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function goodPcs(line: ReceiptLine) {
  const arrived = Number(line.qty_diterima_beli || 0) * Number(line.rasio_konversi || 1);
  return Math.max(0, arrived - Number(line.qty_ditolak_pcs || 0));
}

function lineError(line: ReceiptLine): string {
  const arrived = Number(line.qty_diterima_beli || 0) * Number(line.rasio_konversi || 1);
  const rejected = Number(line.qty_ditolak_pcs || 0);
  if (rejected > arrived) {
    return "Qty ditolak melebihi qty datang (setelah konversi Pcs).";
  }
  if (goodPcs(line) > line.remaining_pcs) {
    return `Qty bagus melebihi sisa PO (${formatNumber(line.remaining_pcs)} Pcs).`;
  }
  return "";
}

function receivedPcs(order: PurchaseOrder, itemId: string) {
  return (order.goods_receipts || []).reduce((acc, gr) => {
    const row = (gr.details || []).find((detail) => detail.item_id === itemId);
    return acc + Number(row?.qty_bagus_pcs || 0);
  }, 0);
}

function buildLines(order: PurchaseOrder) {
  lines.value = (order.details || [])
    .map((detail) => {
      const already = receivedPcs(order, detail.item_id);
      const remaining = Math.max(0, Number(detail.qty_order_pcs || 0) - already);
      return {
        item_id: detail.item_id,
        nama_barang: detail.item?.nama_barang || "-",
        barcode: detail.item?.barcode || "-",
        satuan_beli: detail.uom?.satuan_beli || detail.item?.uom?.satuan_beli || "Pcs",
        rasio_konversi: Number(detail.uom?.rasio_konversi || detail.item?.uom?.rasio_konversi || 1),
        harga_satuan_pcs: Number(detail.harga_satuan || 0),
        remaining_pcs: remaining,
        qty_diterima_beli: 0,
        qty_ditolak_pcs: 0,
      } as ReceiptLine;
    })
    .filter((line) => line.remaining_pcs > 0);
}

async function loadOrders() {
  try {
    orders.value = await getPurchaseOrders();
  } catch (error: any) {
    console.error("Gagal memuat daftar PO:", error);
    toast.error(error.message || "Gagal memuat daftar Purchase Order");
  }
}

async function loadPoDetail() {
  if (!form.value.po_id) {
    selectedOrder.value = null;
    lines.value = [];
    return;
  }
  loadingPo.value = true;
  try {
    const order = await getPurchaseOrder(form.value.po_id);
    selectedOrder.value = order;
    buildLines(order);
    if (lines.value.length === 0) {
      toast.info("Semua barang pada PO ini sudah diterima");
    }
  } catch (error: any) {
    console.error("Gagal memuat detail PO:", error);
    toast.error(error.message || "Gagal memuat detail Purchase Order");
    selectedOrder.value = null;
    lines.value = [];
  } finally {
    loadingPo.value = false;
  }
}

async function handleSubmit() {
  if (!form.value.po_id) {
    toast.error("Pilih Purchase Order");
    return;
  }
  if (filledLines.value.length === 0) {
    toast.error("Isi minimal satu baris penerimaan");
    return;
  }
  if (hasLineError.value) {
    toast.error("Perbaiki baris yang melebihi sisa PO atau qty ditolak");
    return;
  }
  if (!anyGood.value) {
    toast.error("Minimal satu barang harus diterima dalam kondisi bagus");
    return;
  }

  isSubmitting.value = true;
  try {
    const receipt = await createGoodsReceipt({
      no_gr: form.value.no_gr.trim() || undefined,
      po_id: form.value.po_id,
      no_surat_jalan: form.value.no_surat_jalan.trim() || null,
      catatan: form.value.catatan.trim() || null,
      items: filledLines.value.map((line) => ({
        item_id: line.item_id,
        qty_diterima_beli: Number(line.qty_diterima_beli || 0),
        qty_bagus_pcs: goodPcs(line),
        qty_ditolak_pcs: Number(line.qty_ditolak_pcs || 0),
      })),
    });
    toast.success(`Penerimaan ${receipt.no_gr} berhasil disimpan, stok gudang bertambah`);
    router.push(`/purchasing/receiving/goods-receipts/view/${receipt.id}`);
  } catch (error: any) {
    console.error("Gagal menyimpan penerimaan:", error);
    toast.error(error.message || "Gagal menyimpan penerimaan barang");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  try {
    form.value.no_gr = await getNextGoodsReceiptNumber();
  } catch (e) {
    console.error("Gagal memuat nomor GR otomatis:", e);
  }
  await loadOrders();
  const queryPo = String(route.query.po || "");
  if (queryPo && openOrders.value.some((order) => order.id === queryPo)) {
    form.value.po_id = queryPo;
    await loadPoDetail();
  }
});
</script>
