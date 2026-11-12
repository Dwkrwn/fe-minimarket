<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (2.4)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Kartu Stok Kronologis
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Buku besar mutasi per barang: penerimaan, mutasi rak, penjualan POS, barang rusak, dan penyesuaian opname.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="refresh" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading || rows.length === 0"
          class="flex items-center gap-1.5"
          @click="exportCsv"
        >
          <Download class="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>

    <!-- Filter -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div class="xl:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Barang <span class="text-rose-500">*</span>
            </label>
            <div class="relative mb-2">
              <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                v-model="itemSearch"
                placeholder="Cari nama / barcode barang..."
                class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>
            <select
              v-model="selectedItemId"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Pilih barang...</option>
              <option v-for="item in filteredItems" :key="item.id" :value="item.id">
                {{ item.nama_barang }} ({{ item.barcode }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lokasi</label>
            <select
              v-model="locationFilter"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Lokasi</option>
              <option value="GUDANG">Gudang</option>
              <option value="RAK">Rak Pajangan</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dari Tanggal</label>
            <Input v-model="startDate" type="date" class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sampai Tanggal</label>
            <Input v-model="endDate" type="date" class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span>Baris per halaman</span>
            <select
              v-model.number="limit"
              class="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-slate-100"
              @change="handleLimitChange"
            >
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilters">Reset</Button>
            <Button
              size="sm"
              :disabled="loading || !selectedItemId"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
              @click="applyFilters"
            >
              Tampilkan Kartu Stok
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Selected item summary -->
    <div
      v-if="currentItem"
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
    >
      <div>
        <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ currentItem.nama_barang }}</p>
        <p class="text-xs text-slate-500 mt-0.5">
          <span class="font-mono">{{ currentItem.barcode }}</span>
          &middot; {{ currentItem.uom?.nama_uom || "Pcs" }}
          &middot; {{ currentItem.category_rack?.nama || "Tanpa kategori" }}
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <Badge variant="outline" class="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Rak: {{ selectedItemRak }}
        </Badge>
        <Badge variant="outline" class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Gudang: {{ selectedItemGudang }}
        </Badge>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Mutasi</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ total.toLocaleString("id-ID") }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Baris sesuai filter</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <ScrollText class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Masuk (halaman ini)</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ pageQtyIn.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">GR, mutasi masuk, retur</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ArrowDownToLine class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Keluar (halaman ini)</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {{ pageQtyOut.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Penjualan, mutasi keluar, rusak</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <ArrowUpFromLine class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo Terakhir</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {{ latestSaldo.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Baris terbaru pada hasil</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Wallet class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Tanggal</th>
              <th class="px-4 py-3.5">No. Dokumen</th>
              <th class="px-4 py-3.5">Jenis Mutasi</th>
              <th class="px-4 py-3.5 text-center">Lokasi</th>
              <th class="px-4 py-3.5 text-center">Masuk</th>
              <th class="px-4 py-3.5 text-center">Keluar</th>
              <th class="px-4 py-3.5 text-center">Saldo</th>
              <th class="px-4 py-3.5">Keterangan</th>
              <th class="px-4 py-3.5">User</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 5" :key="'skel-' + n">
                <td colspan="9" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="!selectedItemId">
              <td colspan="9" class="px-4 py-12 text-center text-slate-500">
                <BookOpen class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Pilih barang terlebih dahulu</p>
                <p class="text-xs text-slate-400 mt-1">
                  Gunakan pencarian di atas, lalu klik "Tampilkan Kartu Stok".
                </p>
              </td>
            </tr>

            <tr v-else-if="rows.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-slate-500">
                <ScrollText class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada mutasi</p>
                <p class="text-xs text-slate-400 mt-1">
                  Tidak ada pergerakan stok untuk barang ini pada rentang tanggal yang dipilih.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in rows"
              :key="row.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5 whitespace-nowrap">
                <div class="text-xs font-medium text-slate-800 dark:text-slate-200">{{ formatDate(row.tanggal) }}</div>
                <div class="text-[11px] text-slate-400">{{ formatTime(row.tanggal) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <span class="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {{ row.no_dokumen || "-" }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <Badge variant="outline" :class="mutationClass(row.jenis_mutasi)">
                  {{ mutationLabel(row.jenis_mutasi) }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="row.location === 'RAK'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
                >
                  {{ row.location }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center font-mono">
                <span v-if="Number(row.qty_in) > 0" class="text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{{ Number(row.qty_in).toLocaleString("id-ID") }}
                </span>
                <span v-else class="text-slate-300 dark:text-slate-600">-</span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono">
                <span v-if="Number(row.qty_out) > 0" class="text-rose-600 dark:text-rose-400 font-semibold">
                  -{{ Number(row.qty_out).toLocaleString("id-ID") }}
                </span>
                <span v-else class="text-slate-300 dark:text-slate-600">-</span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono font-semibold text-slate-900 dark:text-white">
                {{ Number(row.saldo_akhir).toLocaleString("id-ID") }}
              </td>
              <td class="px-4 py-3.5">
                <p class="text-xs text-slate-500 max-w-[220px] truncate" :title="row.keterangan || ''">
                  {{ row.keterangan || "-" }}
                </p>
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs text-slate-600 dark:text-slate-300">
                  {{ row.user?.name || row.user?.username || "Sistem" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-slate-500">
          Menampilkan {{ rows.length }} dari {{ total.toLocaleString("id-ID") }} mutasi
        </p>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" :disabled="loading || page <= 1" @click="goToPage(page - 1)">
            Sebelumnya
          </Button>
          <span class="text-xs text-slate-500">Halaman {{ page }} / {{ totalPages }}</span>
          <Button variant="outline" size="sm" :disabled="loading || page >= totalPages" @click="goToPage(page + 1)">
            Berikutnya
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Download,
  RefreshCw,
  ScrollText,
  Search,
  Wallet,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMinimarketItems,
  type MinimarketItem,
} from "../../master/m_items/minimarketItemService";
import {
  getStockCards,
  type StockCardLocation,
  type StockCardRow,
} from "./stockCardService";

const route = useRoute();

const items = ref<MinimarketItem[]>([]);
const rows = ref<StockCardRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const loading = ref(false);

const itemSearch = ref("");
const selectedItemId = ref("");
const locationFilter = ref<"" | StockCardLocation>("");
const startDate = ref("");
const endDate = ref("");

const filteredItems = computed(() => {
  const keyword = itemSearch.value.trim().toLowerCase();
  const list = keyword
    ? items.value.filter(
        (item) =>
          item.nama_barang.toLowerCase().includes(keyword) ||
          item.barcode.toLowerCase().includes(keyword),
      )
    : items.value;

  return list.slice(0, 100);
});

const currentItem = computed(() =>
  items.value.find((item) => item.id === selectedItemId.value),
);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));

const pageQtyIn = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.qty_in) || 0), 0),
);

const pageQtyOut = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.qty_out) || 0), 0),
);

const latestSaldo = computed(() => (rows.value.length > 0 ? Number(rows.value[0]?.saldo_akhir) || 0 : 0));

function stockQty(location: "RAK" | "GUDANG"): number {
  const stock = currentItem.value?.stocks?.find((entry) => entry.location === location);
  return stock ? Number(stock.qty) : 0;
}

const selectedItemRak = computed(() => stockQty("RAK"));
const selectedItemGudang = computed(() => stockQty("GUDANG"));

const MUTATION_LABELS: Record<string, string> = {
  GR_MASUK: "Penerimaan Barang",
  MUTASI_KELUAR: "Mutasi Keluar",
  MUTASI_MASUK: "Mutasi Masuk",
  POS_PENJUALAN: "Penjualan POS",
  BARANG_RUSAK: "Barang Rusak",
  RETUR_BELI: "Retur Pembelian",
  OPNAME_ADJUST: "Penyesuaian Opname",
};

function mutationLabel(type: string): string {
  return MUTATION_LABELS[type] || type;
}

function mutationClass(type: string): string {
  if (type === "GR_MASUK" || type === "MUTASI_MASUK") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
  if (type === "POS_PENJUALAN" || type === "MUTASI_KELUAR" || type === "RETUR_BELI") {
    return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
  if (type === "BARANG_RUSAK") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
  if (type === "OPNAME_ADJUST") {
    return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
  }
  return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

async function loadItems() {
  try {
    items.value = await getMinimarketItems();
  } catch (error: any) {
    console.error("Gagal memuat daftar barang:", error);
    toast.error(error.message || "Gagal memuat daftar barang");
  }
}

async function loadCards() {
  if (!selectedItemId.value) return;

  if (startDate.value && endDate.value && startDate.value > endDate.value) {
    toast.error("Tanggal awal tidak boleh melebihi tanggal akhir");
    return;
  }

  loading.value = true;
  try {
    const result = await getStockCards({
      item_id: selectedItemId.value,
      location: locationFilter.value || undefined,
      startDate: startDate.value ? new Date(`${startDate.value}T00:00:00`).toISOString() : undefined,
      endDate: endDate.value ? new Date(`${endDate.value}T23:59:59.999`).toISOString() : undefined,
      page: page.value,
      limit: limit.value,
    });

    rows.value = result.data || [];
    total.value = result.total || 0;
    page.value = result.page || page.value;
  } catch (error: any) {
    console.error("Gagal memuat kartu stok:", error);
    toast.error(error.message || "Gagal memuat kartu stok");
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  if (!selectedItemId.value) {
    toast.error("Pilih barang terlebih dahulu");
    return;
  }
  page.value = 1;
  loadCards();
}

function handleLimitChange() {
  page.value = 1;
  if (selectedItemId.value) loadCards();
}

async function goToPage(target: number) {
  if (target < 1 || target > totalPages.value) return;
  page.value = target;
  await loadCards();
}

async function refresh() {
  if (selectedItemId.value) {
    await loadCards();
  } else {
    await loadItems();
  }
}

function resetFilters() {
  itemSearch.value = "";
  selectedItemId.value = "";
  locationFilter.value = "";
  startDate.value = "";
  endDate.value = "";
  rows.value = [];
  total.value = 0;
  page.value = 1;
}

function exportCsv() {
  if (rows.value.length === 0) {
    toast.error("Tidak ada data untuk diexport");
    return;
  }

  const header = ["Tanggal", "No Dokumen", "Jenis Mutasi", "Lokasi", "Masuk", "Keluar", "Saldo", "Keterangan", "User"];
  const data = rows.value.map((row) => [
    new Date(row.tanggal).toLocaleString("id-ID"),
    row.no_dokumen,
    mutationLabel(row.jenis_mutasi),
    row.location,
    String(row.qty_in),
    String(row.qty_out),
    String(row.saldo_akhir),
    row.keterangan || "",
    row.user?.name || row.user?.username || "Sistem",
  ]);

  const csv = [header, ...data]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const itemName = currentItem.value?.nama_barang || "barang";
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kartu-stok-${itemName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Kartu stok berhasil diexport");
}

onMounted(async () => {
  await loadItems();

  const queryItemId = typeof route.query.item_id === "string" ? route.query.item_id : "";
  if (queryItemId && items.value.some((item) => item.id === queryItemId)) {
    selectedItemId.value = queryItemId;
    await loadCards();
  }
});
</script>
