<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (3.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Buat Retur Pembelian</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Retur hanya dapat dilakukan sebelum invoice terbit dan sebesar barang bagus yang benar-benar diterima.
        </p>
      </div>
      <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/receiving/purchase-returns')">
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </Button>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-3 gap-4" @submit.prevent="handleSubmit">
      <div class="lg:col-span-2 space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Sumber Barang</CardTitle>
            <CardDescription>Pilih PO yang sudah memiliki penerimaan dan belum diverifikasi notanya.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
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
                <option v-for="order in eligibleOrders" :key="order.id" :value="order.id">
                  {{ order.no_po }} — {{ order.supplier?.nama_supplier }} ({{ order.status_label }})
                </option>
              </select>
              <p v-if="eligibleOrders.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Belum ada PO yang memenuhi syarat retur (sudah ada penerimaan, belum invoice).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Barang Diretur</CardTitle>
            <CardDescription>
              Stok rak akan dipotong sebesar qty retur. Pastikan barang sudah dipisahkan dari rak.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div v-if="loadingPo" class="py-8 text-center text-sm text-slate-500">
              <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2" />
              Memuat data PO...
            </div>

            <div v-else-if="!form.po_id" class="py-10 text-center text-slate-500">
              <PackageX class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p class="font-medium text-slate-700 dark:text-slate-300">Pilih Purchase Order</p>
              <p class="text-xs text-slate-400 mt-1">Daftar barang yang masih bisa diretur akan muncul di sini.</p>
            </div>

            <div v-else-if="eligibleItems.length === 0" class="py-10 text-center text-slate-500">
              <CheckCircle2 class="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada sisa yang bisa diretur</p>
              <p class="text-xs text-slate-400 mt-1">Seluruh barang bagus sudah pernah diretur.</p>
            </div>

            <template v-else>
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barang <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.item_id"
                  required
                  class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>Pilih barang</option>
                  <option v-for="item in eligibleItems" :key="item.item_id" :value="item.item_id">
                    {{ item.nama_barang }} — sisa retur {{ formatNumber(item.remaining_pcs) }} Pcs
                  </option>
                </select>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Qty Retur (Pcs) <span class="text-rose-500">*</span>
                  </label>
                  <Input v-model.number="form.qty_pcs" type="number" min="1" step="1" required />
                  <p class="text-xs text-slate-500 mt-1">
                    Maksimal {{ formatNumber(maxQty) }} Pcs
                    <span v-if="selectedItem && selectedItem.rak_stock < selectedItem.remaining_pcs" class="text-amber-600 dark:text-amber-400">
                      (dibatasi stok rak {{ formatNumber(selectedItem.rak_stock) }} Pcs)
                    </span>
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Alasan Retur</label>
                  <select
                    v-model="form.alasan"
                    class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Barang Rusak">Barang Rusak</option>
                    <option value="Expired">Expired</option>
                    <option value="Salah Kirim">Salah Kirim</option>
                    <option value="Kemasan Penyok">Kemasan Penyok</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div v-if="selectedItem" class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-sm space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Diterima bagus</span>
                  <span class="font-semibold">{{ formatNumber(selectedItem.received_pcs) }} Pcs</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Sudah diretur</span>
                  <span class="font-semibold">{{ formatNumber(selectedItem.returned_pcs) }} Pcs</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Sisa dapat diretur</span>
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ formatNumber(selectedItem.remaining_pcs) }} Pcs</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Stok rak saat ini</span>
                  <span class="font-semibold">{{ formatNumber(selectedItem.rak_stock) }} Pcs</span>
                </div>
                <div class="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span class="text-slate-500">Estimasi potongan tagihan</span>
                  <span class="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    Rp {{ formatNumber(Number(form.qty_pcs || 0) * selectedItem.harga_satuan_pcs) }}
                  </span>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
                <textarea
                  v-model="form.catatan"
                  rows="2"
                  placeholder="Detail kondisi barang atau kesepakatan dengan sales..."
                  class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <label class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input v-model="confirmed" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span>
                  Saya memastikan barang sudah dikeluarkan dari rak. Stok rak akan dipotong otomatis sebesar qty retur.
                </span>
              </label>
            </template>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Ringkasan Retur</CardTitle>
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
              <span class="text-slate-500">Qty Retur</span>
              <span class="font-semibold">{{ formatNumber(form.qty_pcs) }} Pcs</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Status Invoice</span>
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">Belum terbit</span>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-slate-500">Potongan</span>
              <span class="font-mono font-bold text-lg text-rose-600 dark:text-rose-400">
                Rp {{ formatNumber(estimatedCut) }}
              </span>
            </div>

            <Button
              type="submit"
              :disabled="isSubmitting || !form.po_id || !form.item_id || !confirmed || form.qty_pcs <= 0"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 mt-2"
            >
              <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <Save v-else class="w-4 h-4" />
              <span>Proses Retur</span>
            </Button>
            <p class="text-[11px] text-slate-400 text-center">
              Nota potong tagihan diterbitkan otomatis.
            </p>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4 text-xs text-slate-500 space-y-1">
            <p class="font-semibold text-slate-700 dark:text-slate-300">Syarat Retur</p>
            <p>&bull; PO tidak dibatalkan dan sudah memiliki penerimaan bagus.</p>
            <p>&bull; Invoice PO belum terbit (nominal tagihan belum dikunci).</p>
            <p>&bull; Qty retur kumulatif tidak melebihi qty bagus diterima.</p>
            <p>&bull; Stok rak harus mencukupi karena stok rak dipotong saat retur.</p>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, CheckCircle2, PackageX, RefreshCw, Save } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStockPositions } from "@/views/inventory/stok/positions/stockPositionService";
import {
  getPurchaseOrder,
  getPurchaseOrders,
  type PurchaseOrder,
} from "../../order/purchase_orders/purchaseOrderService";
import { createPurchaseReturn } from "./purchaseReturnService";

interface ReturnableItem {
  item_id: string;
  nama_barang: string;
  barcode: string;
  received_pcs: number;
  returned_pcs: number;
  remaining_pcs: number;
  rak_stock: number;
  harga_satuan_pcs: number;
}

const route = useRoute();
const router = useRouter();

const orders = ref<PurchaseOrder[]>([]);
const selectedOrder = ref<PurchaseOrder | null>(null);
const eligibleItems = ref<ReturnableItem[]>([]);
const rakStockMap = ref<Map<string, number>>(new Map());
const loadingPo = ref(false);
const isSubmitting = ref(false);
const confirmed = ref(false);

const form = ref({
  po_id: "",
  item_id: "",
  qty_pcs: 1,
  alasan: "Barang Rusak",
  catatan: "",
});

const eligibleOrders = computed(() =>
  orders.value.filter(
    (order) =>
      order.status !== "CANCELLED" &&
      (order.goods_receipts?.length ?? 0) > 0 &&
      (order.invoices?.length ?? 0) === 0,
  ),
);

const selectedItem = computed(() =>
  eligibleItems.value.find((item) => item.item_id === form.value.item_id) || null,
);

const maxQty = computed(() => {
  if (!selectedItem.value) return 0;
  return Math.max(0, Math.min(selectedItem.value.remaining_pcs, selectedItem.value.rak_stock));
});

const estimatedCut = computed(() =>
  Number(form.value.qty_pcs || 0) * Number(selectedItem.value?.harga_satuan_pcs || 0),
);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function receivedPcs(order: PurchaseOrder, itemId: string) {
  return (order.goods_receipts || []).reduce((acc, gr) => {
    const row = (gr.details || []).find((detail) => detail.item_id === itemId);
    return acc + Number(row?.qty_bagus_pcs || 0);
  }, 0);
}

function returnedPcs(order: PurchaseOrder, itemId: string) {
  return (order.purchase_returns || [])
    .filter((ret) => ret.status === "ISSUED" || ret.status === "MATCHED_INVOICE")
    .reduce((acc, ret) => {
      const row = (ret.details || []).find((detail) => detail.item_id === itemId);
      return acc + Number(row?.qty_pcs || 0);
    }, 0);
}

function buildItems(order: PurchaseOrder) {
  eligibleItems.value = (order.details || [])
    .map((detail) => {
      const received = receivedPcs(order, detail.item_id);
      const returned = returnedPcs(order, detail.item_id);
      return {
        item_id: detail.item_id,
        nama_barang: detail.item?.nama_barang || "-",
        barcode: detail.item?.barcode || "-",
        received_pcs: received,
        returned_pcs: returned,
        remaining_pcs: Math.max(0, received - returned),
        rak_stock: Number(rakStockMap.value.get(detail.item_id) || 0),
        harga_satuan_pcs: Number(detail.harga_satuan || 0),
      } as ReturnableItem;
    })
    .filter((item) => item.remaining_pcs > 0);
}

async function loadOrders() {
  try {
    orders.value = await getPurchaseOrders();
  } catch (error: any) {
    console.error("Gagal memuat daftar PO:", error);
    toast.error(error.message || "Gagal memuat daftar Purchase Order");
  }
}

async function loadRakStocks() {
  try {
    const rows = await getStockPositions({ location: "RAK" });
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.item_id, Number(row.qty || 0));
    rakStockMap.value = map;
  } catch (error: any) {
    console.error("Gagal memuat stok rak:", error);
    rakStockMap.value = new Map();
  }
}

async function loadPoDetail() {
  if (!form.value.po_id) {
    selectedOrder.value = null;
    eligibleItems.value = [];
    return;
  }
  loadingPo.value = true;
  confirmed.value = false;
  form.value.item_id = "";
  form.value.qty_pcs = 1;
  try {
    const order = await getPurchaseOrder(form.value.po_id);
    selectedOrder.value = order;
    await loadRakStocks();
    buildItems(order);
    if (eligibleItems.value.length === 1) {
      const onlyItem = eligibleItems.value[0];
      if (onlyItem) {
        form.value.item_id = onlyItem.item_id;
        form.value.qty_pcs = Math.max(1, Math.min(onlyItem.remaining_pcs, onlyItem.rak_stock));
      }
    }
    if (eligibleItems.value.length === 0) {
      toast.info("Tidak ada sisa barang yang dapat diretur pada PO ini");
    }
  } catch (error: any) {
    console.error("Gagal memuat detail PO:", error);
    toast.error(error.message || "Gagal memuat detail Purchase Order");
    selectedOrder.value = null;
    eligibleItems.value = [];
  } finally {
    loadingPo.value = false;
  }
}

async function handleSubmit() {
  if (!form.value.po_id || !form.value.item_id) {
    toast.error("Pilih PO dan barang yang akan diretur");
    return;
  }
  const qty = Number(form.value.qty_pcs);
  if (!Number.isInteger(qty) || qty <= 0) {
    toast.error("Qty retur harus bilangan bulat lebih dari 0");
    return;
  }
  if (qty > maxQty.value) {
    toast.error(`Qty retur melebihi batas ${formatNumber(maxQty.value)} Pcs`);
    return;
  }
  if (!confirmed.value) {
    toast.error("Centang konfirmasi pengeluaran barang dari rak");
    return;
  }

  isSubmitting.value = true;
  try {
    const created = await createPurchaseReturn({
      po_id: form.value.po_id,
      item_id: form.value.item_id,
      qty_pcs: qty,
      alasan: form.value.alasan,
      catatan: form.value.catatan.trim() || null,
    });
    toast.success(`Retur ${created.no_retur} berhasil diproses, stok rak dipotong ${qty} Pcs`);
    router.push("/purchasing/receiving/purchase-returns");
  } catch (error: any) {
    console.error("Gagal memproses retur:", error);
    toast.error(error.message || "Gagal memproses retur pembelian");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  await loadOrders();
  const queryPo = String(route.query.po || "");
  if (queryPo && eligibleOrders.value.some((order) => order.id === queryPo)) {
    form.value.po_id = queryPo;
    await loadPoDetail();
  }
});
</script>
