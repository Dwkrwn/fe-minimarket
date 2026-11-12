<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (2.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Buat Purchase Order</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pesanan pembelian manual. Harga satuan diambil dari katalog supplier, atau harga modal master bila belum ada.
        </p>
      </div>
      <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/order/purchase-orders')">
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </Button>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-3 gap-4" @submit.prevent="handleSubmit">
      <div class="lg:col-span-2 space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Tujuan Pemesanan</CardTitle>
            <CardDescription>Pilih supplier aktif dan jadwal pengiriman yang diharapkan.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.supplier_id"
                  required
                  class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>Pilih supplier</option>
                  <option v-for="supplier in activeSuppliers" :key="supplier.id" :value="supplier.id">
                    {{ supplier.nama_supplier }} ({{ supplier.kode_supplier }}) &middot; TOP {{ supplier.term_of_payment }} hari
                  </option>
                </select>
                <p v-if="activeSuppliers.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Belum ada supplier aktif. Daftarkan dulu di menu Supplier.
                </p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimasi Tanggal Tiba
                </label>
                <Input v-model="form.tgl_estimasi_tiba" type="date" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan PO</label>
              <textarea
                v-model="form.catatan"
                rows="2"
                placeholder="Instruksi pengiriman, jam bongkar, dsb."
                class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle class="text-base">Rincian Barang</CardTitle>
              <CardDescription>Tentukan qty dalam satuan beli; sistem mengonversi ke Pcs.</CardDescription>
            </div>
            <Badge variant="outline" class="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30">
              {{ rows.length }} barang
            </Badge>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-col md:flex-row gap-2">
              <div class="relative w-full md:flex-1">
                <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  v-model="itemSearch"
                  placeholder="Cari barang untuk ditambahkan..."
                  class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
              <select
                :value="''"
                class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-72"
                @change="addItem(($event.target as HTMLSelectElement).value, $event)"
              >
                <option value="" disabled>Tambah barang...</option>
                <option v-for="item in availableItems" :key="item.id" :value="item.id">
                  {{ item.nama_barang }} - {{ item.barcode }}
                </option>
              </select>
            </div>

            <div v-if="rows.length === 0" class="py-10 text-center text-slate-500">
              <Boxes class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada barang dipesan</p>
              <p class="text-xs text-slate-400 mt-1">Gunakan pemilih di atas untuk menambahkan barang.</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(row, index) in rows"
                :key="row.item_id"
                class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-slate-900 dark:text-white truncate">{{ itemOf(row.item_id)?.nama_barang }}</p>
                    <p class="text-xs text-slate-500 font-mono">{{ itemOf(row.item_id)?.barcode }}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                    title="Hapus baris"
                    @click="removeRow(index)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Qty Beli</label>
                    <div class="flex items-center gap-1.5">
                      <Input v-model.number="row.qty_order_beli" type="number" min="1" step="1" class="h-8 text-sm" />
                      <span class="text-xs text-slate-500 whitespace-nowrap">{{ uomOf(row.item_id)?.satuan_beli || "Pcs" }}</span>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Konversi</label>
                    <p class="h-8 flex items-center text-xs text-slate-600 dark:text-slate-300">
                      &times; {{ uomOf(row.item_id)?.rasio_konversi || 1 }} = {{ formatNumber(qtyPcs(row)) }} Pcs
                    </p>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Harga / Pcs</label>
                    <p class="h-8 flex items-center font-mono text-xs text-slate-900 dark:text-slate-100">
                      Rp {{ formatNumber(priceOf(row.item_id)) }}
                      <span v-if="catalogPriceOf(row.item_id) !== null" class="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">katalog</span>
                    </p>
                  </div>
                  <div class="text-right">
                    <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Subtotal</label>
                    <p class="h-8 flex items-center justify-end font-mono font-semibold text-sm text-slate-900 dark:text-white">
                      Rp {{ formatNumber(subtotalOf(row)) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="form.supplier_id && missingCatalogCount > 0" class="text-xs text-amber-600 dark:text-amber-400">
              {{ missingCatalogCount }} barang belum punya harga katalog untuk supplier ini; harga modal master dipakai.
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Ringkasan PO</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Jumlah baris</span>
              <span class="font-semibold">{{ rows.length }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Total Qty</span>
              <span class="font-semibold">{{ formatNumber(totalQtyPcs) }} Pcs</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Supplier</span>
              <span class="font-semibold text-right max-w-[55%] truncate">{{ selectedSupplier?.nama_supplier || '-' }}</span>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-slate-500">Total Nilai</span>
              <span class="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
                Rp {{ formatNumber(grandTotal) }}
              </span>
            </div>

            <Button
              type="submit"
              :disabled="isSubmitting || rows.length === 0 || !form.supplier_id"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 mt-2"
            >
              <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <Save v-else class="w-4 h-4" />
              <span>Terbitkan PO</span>
            </Button>
            <p class="text-[11px] text-slate-400 text-center">
              PO langsung berstatus ORDERED dan siap dikirim ke supplier.
            </p>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4 text-xs text-slate-500 space-y-1">
            <p class="font-semibold text-slate-700 dark:text-slate-300">Catatan</p>
            <p>&bull; Harga mengikuti katalog supplier aktif (menu 1.2).</p>
            <p>&bull; PO yang sudah terbit tidak dapat diubah atau dibatalkan dari layar ini.</p>
            <p>&bull; Penerimaan barang dicatat di menu 3.1.</p>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Boxes, RefreshCw, Save, Search, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMinimarketItems, type MinimarketItem } from "@/views/inventory/master/m_items/minimarketItemService";
import { getSuppliers, type Supplier } from "../../master/suppliers/supplierService";
import { getSupplierCatalogs, type SupplierCatalog } from "../../master/supplier_catalogs/supplierCatalogService";
import { createPurchaseOrder } from "./purchaseOrderService";

interface PoRow {
  item_id: string;
  qty_order_beli: number;
}

const router = useRouter();

const suppliers = ref<Supplier[]>([]);
const items = ref<MinimarketItem[]>([]);
const catalogs = ref<SupplierCatalog[]>([]);
const rows = ref<PoRow[]>([]);
const itemSearch = ref("");
const isSubmitting = ref(false);

const form = ref({
  supplier_id: "",
  tgl_estimasi_tiba: "",
  catatan: "",
});

const activeSuppliers = computed(() => suppliers.value.filter((supplier) => supplier.is_active));
const selectedSupplier = computed(() => suppliers.value.find((supplier) => supplier.id === form.value.supplier_id) || null);

const activeItems = computed(() => items.value.filter((item) => item.is_active));
const availableItems = computed(() => {
  const keyword = itemSearch.value.trim().toLowerCase();
  return activeItems.value
    .filter((item) => !rows.value.some((row) => row.item_id === item.id))
    .filter((item) =>
      !keyword ||
      [item.nama_barang, item.barcode].some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
});

const catalogPriceMap = computed(() => {
  const map = new Map<string, number>();
  for (const catalog of catalogs.value) {
    if (!catalog.is_active) continue;
    map.set(catalog.item_id, Number(catalog.harga_modal) || 0);
  }
  return map;
});

const totalQtyPcs = computed(() => rows.value.reduce((acc, row) => acc + qtyPcs(row), 0));
const grandTotal = computed(() => rows.value.reduce((acc, row) => acc + subtotalOf(row), 0));
const missingCatalogCount = computed(
  () => rows.value.filter((row) => catalogPriceOf(row.item_id) === null).length,
);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function itemOf(itemId: string) {
  return items.value.find((item) => item.id === itemId) || null;
}

function uomOf(itemId: string) {
  return itemOf(itemId)?.uom || null;
}

function catalogPriceOf(itemId: string) {
  return catalogPriceMap.value.has(itemId) ? Number(catalogPriceMap.value.get(itemId)) : null;
}

function priceOf(itemId: string) {
  const catalogPrice = catalogPriceOf(itemId);
  if (catalogPrice !== null) return catalogPrice;
  return Number(itemOf(itemId)?.harga_modal || 0);
}

function qtyPcs(row: PoRow) {
  const ratio = uomOf(row.item_id)?.rasio_konversi || 1;
  return Number(row.qty_order_beli || 0) * Number(ratio);
}

function subtotalOf(row: PoRow) {
  return qtyPcs(row) * priceOf(row.item_id);
}

function addItem(itemId: string, event?: Event) {
  if (!itemId) return;
  if (!rows.value.some((row) => row.item_id === itemId)) {
    rows.value.push({ item_id: itemId, qty_order_beli: 1 });
  }
  if (event?.target) (event.target as HTMLSelectElement).value = "";
  itemSearch.value = "";
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

async function loadReferences() {
  try {
    const [supplierRows, itemRows] = await Promise.all([getSuppliers(), getMinimarketItems()]);
    suppliers.value = supplierRows;
    items.value = itemRows;
  } catch (error: any) {
    console.error("Gagal memuat referensi PO:", error);
    toast.error(error.message || "Gagal memuat supplier/barang");
  }
}

async function loadCatalogs() {
  if (!form.value.supplier_id) {
    catalogs.value = [];
    return;
  }
  try {
    catalogs.value = await getSupplierCatalogs({ supplier_id: form.value.supplier_id });
  } catch (error: any) {
    console.error("Gagal memuat katalog supplier:", error);
    catalogs.value = [];
  }
}

async function handleSubmit() {
  if (!form.value.supplier_id) {
    toast.error("Pilih supplier terlebih dahulu");
    return;
  }
  if (rows.value.length === 0) {
    toast.error("Tambahkan minimal satu barang");
    return;
  }
  if (rows.value.some((row) => !row.qty_order_beli || Number(row.qty_order_beli) <= 0)) {
    toast.error("Qty beli setiap barang harus lebih dari 0");
    return;
  }

  isSubmitting.value = true;
  try {
    const po = await createPurchaseOrder({
      supplier_id: form.value.supplier_id,
      tgl_estimasi_tiba: form.value.tgl_estimasi_tiba || null,
      catatan: form.value.catatan.trim() || null,
      items: rows.value.map((row) => ({
        item_id: row.item_id,
        qty_order_beli: Number(row.qty_order_beli),
        uom_id: uomOf(row.item_id)?.id || null,
      })),
    });
    toast.success(`PO ${po.no_po} berhasil diterbitkan`);
    router.push(`/purchasing/order/purchase-orders/view/${po.id}`);
  } catch (error: any) {
    console.error("Gagal membuat PO:", error);
    toast.error(error.message || "Gagal menerbitkan Purchase Order");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  await loadReferences();
  await loadCatalogs();
});

watch(
  () => form.value.supplier_id,
  () => {
    loadCatalogs();
  },
);
</script>
