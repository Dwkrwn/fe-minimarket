<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (2.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Posisi Stok Real-Time
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Saldo fisik per barang di dua lokasi: gudang belakang dan rak pajangan toko.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="loadData" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading || groupedStocks.length === 0"
          class="flex items-center gap-1.5"
          @click="exportCsv"
        >
          <Download class="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">SKU Terpantau</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ groupedStocks.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Barang dengan slot stok</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Stok Gudang</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {{ totalGudang.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Buffer stok kardusan</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Warehouse class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Stok Rak</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ totalRak.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Siap dijual di kasir</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Store class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Perlu Restock</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {{ locationFilter ? "-" : restockCount }} <span class="text-xs font-normal text-slate-500">SKU</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Total stok &le; ROP</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <TriangleAlert class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4 space-y-3">
        <div class="flex flex-col md:flex-row items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nama barang atau barcode..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="loadData"
            />
          </div>

          <div class="w-full md:w-44">
            <select
              v-model="locationFilter"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Lokasi</option>
              <option value="GUDANG">Gudang</option>
              <option value="RAK">Rak Pajangan</option>
            </select>
          </div>

          <div class="w-full md:w-64">
            <select
              v-model="categoryFilter"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kategori &amp; Zona</option>
              <option v-for="rack in categoryRacks" :key="rack.id" :value="rack.id">
                [{{ rack.tipe_zona }}] {{ rack.nama }}
              </option>
            </select>
          </div>

          <Button variant="outline" size="sm" :disabled="loading" @click="loadData">Terapkan</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilters">Reset</Button>
        </div>

        <p v-if="locationFilter" class="text-[11px] text-amber-600 dark:text-amber-400">
          Filter lokasi aktif: angka gudang/rak hanya menghitung lokasi terpilih, status ROP disembunyikan.
        </p>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5">Kategori &amp; Zona</th>
              <th class="px-4 py-3.5 text-center">Gudang</th>
              <th class="px-4 py-3.5 text-center">Rak</th>
              <th class="px-4 py-3.5 text-center">Total</th>
              <th class="px-4 py-3.5 text-center">ROP</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 5" :key="'skel-' + n">
                <td colspan="8" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="groupedStocks.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-slate-500">
                <Package class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada posisi stok</p>
                <p class="text-xs text-slate-400 mt-1">
                  Slot stok dibuat otomatis saat barang didaftarkan atau diterima dari pembelian.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="stock in groupedStocks"
              :key="stock.itemId"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ stock.nama }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {{ stock.barcode }}
                  </span>
                  <span class="text-[11px] text-slate-400">{{ stock.uom }}</span>
                </div>
              </td>
              <td class="px-4 py-3.5">
                <div v-if="stock.rackName !== '-'" class="flex flex-col gap-0.5">
                  <span class="font-medium text-slate-800 dark:text-slate-200">{{ stock.rackName }}</span>
                  <div class="flex items-center gap-1 text-xs text-slate-500">
                    <Badge
                      variant="outline"
                      :class="stock.rackZone === 'RAK'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
                      class="text-[10px] py-0 px-1.5"
                    >
                      {{ stock.rackZone }}
                    </Badge>
                    <span>{{ stock.lokasiRak }}</span>
                  </div>
                </div>
                <span v-else class="text-xs text-slate-400 italic">-</span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono">
                <span
                  class="px-2 py-0.5 rounded-md"
                  :class="stock.gudang > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                >
                  {{ stock.gudang.toLocaleString("id-ID") }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono">
                <span
                  class="px-2 py-0.5 rounded-md"
                  :class="stock.rak > 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                >
                  {{ stock.rak.toLocaleString("id-ID") }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span class="font-mono font-semibold text-slate-900 dark:text-white">
                  {{ stock.total.toLocaleString("id-ID") }}
                </span>
                <span class="text-[11px] text-slate-400"> Pcs</span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono text-xs">
                <span v-if="stock.rop !== null">{{ stock.rop }}</span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge v-if="stockStatus(stock)" variant="outline" :class="stockStatus(stock)?.className">
                  {{ stockStatus(stock)?.label }}
                </Badge>
                <span v-else class="text-xs text-slate-400">-</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <RouterLink
                  :to="{ path: '/inventory/stok/cards', query: { item_id: stock.itemId } }"
                  class="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  title="Lihat kartu stok barang ini"
                >
                  <BookOpen class="w-3.5 h-3.5" />
                  Kartu
                </RouterLink>
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
import {
  BookOpen,
  Download,
  Package,
  RefreshCw,
  Search,
  Store,
  TriangleAlert,
  Warehouse,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCategoryRacks,
  type CategoryRack,
} from "../../master/category_racks/categoryRackService";
import {
  getStockPositions,
  type StockLocation,
  type StockRow,
} from "./stockPositionService";

interface GroupedStock {
  itemId: string;
  nama: string;
  barcode: string;
  rackName: string;
  rackZone: string;
  lokasiRak: string;
  uom: string;
  gudang: number;
  rak: number;
  total: number;
  rop: number | null;
}

interface StockStatusInfo {
  key: "RESTOCK" | "WARNING" | "SAFE" | "NO_ROP";
  label: string;
  className: string;
}

const stocks = ref<StockRow[]>([]);
const categoryRacks = ref<CategoryRack[]>([]);
const loading = ref(false);

const searchQuery = ref("");
const locationFilter = ref<"" | StockLocation>("");
const categoryFilter = ref("");

const groupedStocks = computed<GroupedStock[]>(() => {
  const map = new Map<string, GroupedStock>();

  for (const row of stocks.value) {
    const item = row.item;
    let group = map.get(row.item_id);

    if (!group) {
      const rack = item?.category_rack || row.category_rack || null;
      group = {
        itemId: row.item_id,
        nama: item?.nama_barang || "-",
        barcode: item?.barcode || "-",
        rackName: rack?.nama || "-",
        rackZone: rack?.tipe_zona || "-",
        lokasiRak: rack?.lokasi || "-",
        uom: item?.uom?.satuan_dasar || "Pcs",
        gudang: 0,
        rak: 0,
        total: 0,
        rop: item?.rop_setting ? Number(item.rop_setting.rop_pcs) : null,
      };
      map.set(row.item_id, group);
    }

    const qty = Number(row.qty) || 0;
    if (row.location === "GUDANG") group.gudang += qty;
    else group.rak += qty;
    group.total += qty;
  }

  return Array.from(map.values());
});

const totalGudang = computed(() =>
  groupedStocks.value.reduce((sum, stock) => sum + stock.gudang, 0),
);

const totalRak = computed(() =>
  groupedStocks.value.reduce((sum, stock) => sum + stock.rak, 0),
);

const restockCount = computed(() => {
  if (locationFilter.value) return 0;
  return groupedStocks.value.filter((stock) => stock.rop !== null && stock.total <= stock.rop).length;
});

function stockStatus(stock: GroupedStock): StockStatusInfo | null {
  // Saat filter lokasi aktif, total tidak merepresentasikan seluruh stok.
  if (locationFilter.value) return null;

  if (stock.rop === null) {
    return {
      key: "NO_ROP",
      label: "Tanpa ROP",
      className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
    };
  }

  if (stock.total <= stock.rop) {
    return {
      key: "RESTOCK",
      label: "Perlu Restock",
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    };
  }

  if (stock.rop > 0 && stock.total <= Math.ceil(stock.rop * 1.25)) {
    return {
      key: "WARNING",
      label: "Mendekati ROP",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }

  return {
    key: "SAFE",
    label: "Aman",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  };
}

async function loadStocks() {
  loading.value = true;
  try {
    stocks.value = await getStockPositions({
      location: locationFilter.value || undefined,
      category_rack_id: categoryFilter.value || undefined,
      search: searchQuery.value,
    });
  } catch (error: any) {
    console.error("Gagal memuat posisi stok:", error);
    toast.error(error.message || "Gagal memuat posisi stok");
  } finally {
    loading.value = false;
  }
}

async function loadCategoryRacks() {
  try {
    categoryRacks.value = await getCategoryRacks({ is_active: true });
  } catch (error: any) {
    console.error("Gagal memuat kategori & rak:", error);
  }
}

async function loadData() {
  await Promise.all([loadStocks(), loadCategoryRacks()]);
}

function resetFilters() {
  searchQuery.value = "";
  locationFilter.value = "";
  categoryFilter.value = "";
  loadData();
}

function exportCsv() {
  if (groupedStocks.value.length === 0) {
    toast.error("Tidak ada data untuk diexport");
    return;
  }

  const header = ["Nama Barang", "Barcode", "Kategori/Rak", "Zona", "Gudang (Pcs)", "Rak (Pcs)", "Total (Pcs)", "ROP"];
  const rows = groupedStocks.value.map((stock) => [
    stock.nama,
    stock.barcode,
    stock.rackName,
    stock.rackZone,
    String(stock.gudang),
    String(stock.rak),
    String(stock.total),
    stock.rop === null ? "" : String(stock.rop),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `posisi-stok-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Posisi stok berhasil diexport");
}

onMounted(loadData);
</script>
