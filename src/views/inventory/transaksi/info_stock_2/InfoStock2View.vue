<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, onActivated, onDeactivated } from "vue";
import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  Hash,
  Ruler,
  Barcode,
  Box,
  ShieldCheck,
  History,
  X,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useInfoStock2View } from "./useInfoStock2View";

const {
  itemGroups,
  gudangData,
  loading,
  loadingSummary,
  searchQuery,
  lockFilter,
  summary,
  selectedGudangId,
  pagination,
  currentPage,
  pageSize,
  expandedItems,
  showInfoDialog,
  selectedItem,
  stockHistory,
  loadingHistory,
  historyPage,
  historyPageSize,
  historyPagination,
  historySearch,
  historySearchField,
  historyType,
  totalItems,
  totalPages,
  selectedGudang,
  showTable,
  allExpanded,
  toggleItem,
  expandAll,
  collapseAll,
  toggleAll,
  getStockStatus,
  getStockColorClass,
  getLockStatusText,
  getLockStatusBadgeClass,
  selectGudang,
  closeTable,
  handleGudangChange,
  handlePageChange,
  handleSearch,
  handleLockFilterChange,
  handleRefresh,
  transformHistoryData,
  handleHistoryPageChange,
  handleHistorySearch,
  handleHistoryPageSizeChange,
  handleHistorySearchFieldChange,
  handleHistoryTypeChange,
  handleHistoryRefresh,
  formatDateTime,
} = useInfoStock2View();

const getTransactionCategory = (h: any) => {
  const tipe = (h.tipe_transaksi || "").toUpperCase();
  const hasAsalTujuan = h.asal && h.asal !== "-" && h.tujuan && h.tujuan !== "-";
  if (
    tipe.includes("TRANSFER") ||
    tipe.includes("MUTASI") ||
    tipe.includes("PERPINDAHAN") ||
    hasAsalTujuan
  ) {
    return "perpindahan";
  }
  return h.direction === "MASUK" ? "pembelian" : "penjualan";
};

const gudangInfoBarRef = ref<HTMLElement | null>(null);
const isGudangInfoBarSticky = ref(false);
const gudangInfoBarStyle = ref<Record<string, string>>({});
const stickyTopOffset = 12;
let gudangInfoBarTop = 0;

const updateGudangInfoBarMetrics = () => {
  if (!gudangInfoBarRef.value) return;
  const rect = gudangInfoBarRef.value.getBoundingClientRect();
  gudangInfoBarTop = window.scrollY + rect.top;
  gudangInfoBarStyle.value = {
    width: `${rect.width}px`,
    left: `${rect.left}px`,
  };
};

const handleGudangInfoBarScroll = () => {
  if (!gudangInfoBarRef.value) return;
  isGudangInfoBarSticky.value = window.scrollY + stickyTopOffset >= gudangInfoBarTop;
};

const handleGudangInfoBarResize = () => {
  updateGudangInfoBarMetrics();
  handleGudangInfoBarScroll();
};

watch([showTable, selectedGudangId], async ([visible]) => {
  if (!visible) {
    isGudangInfoBarSticky.value = false;
    return;
  }
  await nextTick();
  updateGudangInfoBarMetrics();
  handleGudangInfoBarScroll();
});

const bindGudangInfoBarListeners = () => {
  window.addEventListener("scroll", handleGudangInfoBarScroll, { passive: true });
  window.addEventListener("resize", handleGudangInfoBarResize, { passive: true });
};

const unbindGudangInfoBarListeners = () => {
  window.removeEventListener("scroll", handleGudangInfoBarScroll);
  window.removeEventListener("resize", handleGudangInfoBarResize);
};

const resetGudangInfoBarSticky = () => {
  isGudangInfoBarSticky.value = false;
  gudangInfoBarStyle.value = {};
  gudangInfoBarTop = 0;
};

onMounted(() => {
  bindGudangInfoBarListeners();
});

onActivated(async () => {
  bindGudangInfoBarListeners();
  await nextTick();
  updateGudangInfoBarMetrics();
  handleGudangInfoBarScroll();
});

onDeactivated(() => {
  unbindGudangInfoBarListeners();
  resetGudangInfoBarSticky();
  showInfoDialog.value = false;
});

onBeforeUnmount(() => {
  unbindGudangInfoBarListeners();
});
</script>

<template>
  <!-- ================================================================ -->
  <!-- MOBILE VIEW (LG:HIDDEN) -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-6">
    <!-- STICKY HEADER -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-3 flex items-center justify-between gap-2">
        <div>
          <h1 class="text-base font-bold">Info Stock per Item</h1>
          <p class="text-xs text-muted-foreground">
            Pilih gudang untuk lihat detail
          </p>
        </div>
        <div class="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            @click="handleRefresh"
            :disabled="loadingSummary"
            class="h-8 gap-1.5"
          >
            <RefreshCw
              :class="['h-3.5 w-3.5', loadingSummary && 'animate-spin']"
            />
          </Button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 pt-3 space-y-3">
      <!-- Gudang Cards Mobile (klik untuk lihat detail) -->
      <h2 class="text-sm font-semibold flex items-center gap-2">
        <Warehouse class="h-4 w-4" /> Pilih Gudang
      </h2>
      <div class="space-y-2">
        <div v-if="loadingSummary">
          <Skeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-lg" />
        </div>
        <Card
          v-else
          v-for="stat in summary.per_gudang"
          :key="stat.id"
          class="cursor-pointer transition-all border-2"
          :class="
            selectedGudangId === stat.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40'
          "
          @click="selectGudang(stat.id)"
        >
          <CardContent class="p-3">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm truncate">
                  {{ stat.nama_gudang }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ stat.nama_unit_bisnis }}
                </p>
              </div>
              <Badge variant="outline" class="text-[10px] shrink-0">{{
                stat.kode_gudang
              }}</Badge>
            </div>
            <div class="border-t pt-2 space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-muted-foreground">Low Stock:</span>
                <span
                  v-if="stat.low_stock > 0"
                  class="font-bold text-destructive"
                  >{{ stat.low_stock }}</span
                >
                <span v-else class="text-muted-foreground/50">-</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Tabel item mobile (tampil jika gudang dipilih) -->

      <!-- Placeholder mobile -->
      <div
        v-if="!showTable && !loadingSummary"
        class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 text-center"
      >
        <Warehouse class="h-10 w-10 text-muted-foreground/30" />
        <p class="text-sm font-semibold text-foreground">
          Pilih Gudang Terlebih Dahulu
        </p>
        <p class="text-xs text-muted-foreground px-4">
          Ketuk salah satu kartu gudang di atas untuk melihat detail stock per
          item
        </p>
      </div>
      <template v-if="showTable">
        <!-- search bar -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            @input="handleSearch"
            placeholder="Cari nama/kode item..."
            class="pl-9 pr-8 h-8 text-sm"
          />
          <Button
            v-if="searchQuery"
            type="button"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-white"
            @click="searchQuery = ''; handleSearch()"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <select
          :value="lockFilter"
          @change="handleLockFilterChange"
          class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Semua Item</option>
          <option value="locked">Item Locking</option>
        </select>

        <!-- loading -->
        <div v-if="loading" class="space-y-2">
          <Card v-for="i in 3" :key="`sk-${i}`"
            ><CardContent class="pt-3 space-y-2">
              <Skeleton class="h-4 w-3/4" /><Skeleton
                class="h-3 w-1/2"
              /> </CardContent
          ></Card>
        </div>

        <!-- empty -->
        <div v-else-if="itemGroups.length === 0" class="text-center py-6">
          <Warehouse class="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p class="text-sm text-muted-foreground">Tidak ada data stock</p>
        </div>

        <!-- item groups -->
        <div v-else class="space-y-2">
          <div v-for="itemGroup in itemGroups" :key="itemGroup.itemId">
            <button
              class="w-full flex items-center justify-between bg-muted/60 rounded-lg px-3 py-2 hover:bg-muted transition-colors"
              @click="toggleItem(itemGroup.itemId)"
            >
              <div class="flex items-center gap-2 text-sm font-semibold">
                <Package class="h-4 w-4 text-primary" />
                <span>{{ itemGroup.itemNama }}</span>
                <Badge variant="outline" class="text-[10px] px-1.5 py-0">{{
                  itemGroup.itemKode
                }}</Badge>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-semibold"
                  :class="getStockColorClass(itemGroup)"
                >
                  {{ (itemGroup.totalStock || 0).toLocaleString("id-ID") }}
                </span>
                <span class="text-xs text-muted-foreground"
                  >{{ itemGroup.totalRakLocations }} lokasi</span
                >
                <ChevronDown
                  v-if="itemGroup.isExpanded"
                  class="h-4 w-4 text-muted-foreground"
                />
                <ChevronRight v-else class="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
            <div v-if="itemGroup.isExpanded" class="space-y-2 pl-2 pt-1">
              <Card
                v-for="rak in itemGroup.rakLocations"
                :key="rak.stockGudangId"
                class="hover:shadow-md transition-all"
              >
                <CardContent class="pt-3 pb-2 space-y-2">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-sm truncate">
                        {{ rak.rakNama }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ rak.rakKode }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <div class="flex items-center gap-1">
                        <Badge
                          :variant="
                            getStockStatus(
                              rak.freeStock,
                              itemGroup.safetyStok,
                              itemGroup.stokOptimum,
                              itemGroup.status,
                            ) === 'low'
                              ? 'destructive'
                              : 'default'
                          "
                        >
                          Stok: {{ rak.freeStock }}
                        </Badge>
                      </div>
                      <span class="text-[10px] text-muted-foreground pr-8">
                        Slot: {{ rak.slotKode || "-" }}
                      </span>
                    </div>
                  </div>
                  <div class="flex justify-end gap-1 pt-1 border-t">
                    <span :class="getLockStatusBadgeClass(rak)">
                      {{ getLockStatusText(rak) }}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <!-- Mobile Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-center gap-2 pt-2 pb-4"
        >
          <Button
            variant="outline"
            size="icon"
            :disabled="currentPage <= 1"
            @click="handlePageChange(currentPage - 1)"
            class="h-8 w-8"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <span class="text-sm text-muted-foreground"
            >{{ currentPage }} / {{ totalPages }}</span
          >
          <Button
            variant="outline"
            size="icon"
            :disabled="currentPage >= totalPages"
            @click="handlePageChange(currentPage + 1)"
            class="h-8 w-8"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </template>
    </div>
  </div>

  <!-- ================================================================ -->
  <!-- DESKTOP VIEW (HIDDEN LG:FLEX) -->
  <!-- ================================================================ -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- HEADER -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Info Stock per Item</h1>
        <p class="text-sm text-muted-foreground">
          Informasi stock barang per item di gudang
        </p>
      </div>
      <Button
        variant="outline"
        @click="handleRefresh"
        :disabled="loadingSummary"
        class="shrink-0 gap-2"
      >
        <RefreshCw :class="['h-4 w-4', loadingSummary && 'animate-spin']" />
        <span class="hidden sm:inline">Refresh</span>
      </Button>
    </div>

    <!-- GUDANG CARDS (klik untuk lihat detail) -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <template v-if="loadingSummary">
        <Card v-for="i in 4" :key="i" class="border">
          <CardContent class="p-5 space-y-3 h-[168px]">
            <Skeleton class="h-5 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
            <Skeleton class="h-px w-full mt-2" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-7 w-full mt-1" />
          </CardContent>
        </Card>
      </template>
      <Card
        v-else
        v-for="stat in summary.per_gudang"
        :key="stat.id"
        class="cursor-pointer hover:shadow-lg transition-all border-2"
        :class="
          selectedGudangId === stat.id
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/40'
        "
        @click="selectGudang(stat.id)"
      >
        <CardContent class="!p-5 flex flex-col h-full">
          <!-- Header: nama + icon -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex-1 min-w-0 space-y-0.5">
              <p
                class="font-bold text-sm truncate text-foreground leading-tight"
              >
                {{ stat.nama_gudang }}
              </p>
              <p class="text-xs text-muted-foreground truncate">
                {{ stat.nama_unit_bisnis }}
              </p>
            </div>
            <Warehouse
              :class="[
                'h-5 w-5 shrink-0 mt-0.5',
                selectedGudangId === stat.id
                  ? 'text-primary'
                  : 'text-primary/50',
              ]"
            />
          </div>

          <!-- Stats -->
          <div class="border-t pt-3 space-y-1.5 flex-1">
            <div
              class="flex items-center justify-between"
              style="min-height: 20px"
            >
              <span class="text-xs text-muted-foreground">Low Stock:</span>
              <span
                v-if="stat.low_stock > 0"
                class="text-sm font-bold text-destructive"
                >{{ stat.low_stock }}</span
              >
              <span v-else class="text-xs text-muted-foreground/50">-</span>
            </div>
          </div>

          <!-- Kode badge -->
          <Badge
            variant="outline"
            class="w-full justify-center text-xs mt-3 py-1"
          >
            {{ stat.kode_gudang }}
          </Badge>
        </CardContent>
      </Card>
    </div>

    <!-- TABLE SECTION — hanya tampil saat gudang dipilih -->

    <!-- PLACEHOLDER saat belum pilih gudang -->
    <div
      v-if="!showTable && !loadingSummary"
      class="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl py-14 text-center"
    >
      <Warehouse class="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p class="text-base font-semibold text-foreground">
          Pilih Gudang Terlebih Dahulu
        </p>
        <p class="text-sm text-muted-foreground mt-1">
          Klik salah satu kartu gudang di atas untuk melihat detail stock per
          item
        </p>
      </div>
    </div>

    <template v-if="showTable">
      <!-- Gudang info bar -->
      <div v-if="selectedGudang">
        <div v-if="isGudangInfoBarSticky" class="h-[52px]" />
        <div
          ref="gudangInfoBarRef"
          :class="[
            'flex items-center gap-3 border border-primary/20 rounded-lg px-4 py-2.5 text-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
            isGudangInfoBarSticky ? 'fixed top-3 z-40 shadow-md' : 'relative shadow-sm',
          ]"
          :style="isGudangInfoBarSticky ? gudangInfoBarStyle : undefined"
                  >
          <MapPin class="h-4 w-4 text-primary shrink-0" />
          <div class="flex items-center gap-4 flex-wrap flex-1">
            <span class="font-semibold text-primary">{{
              selectedGudang.nama_gudang
            }}</span>
            <span class="text-muted-foreground">{{
              selectedGudang.kode_gudang
            }}</span>
            <span class="text-muted-foreground">{{
              selectedGudang.alamat_gudang
            }}</span>
            <span class="text-muted-foreground"
              >{{ selectedGudang.kota }}, {{ selectedGudang.provinsi }}</span
            >
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="text-xs gap-1 shrink-0"
            @click="closeTable"
          >
            Tutup
          </Button>
        </div>
      </div>

      <!-- Search + expand/collapse bar -->
      <div
        class="flex items-center gap-3 bg-muted/50 px-4 py-3 rounded-lg flex-wrap"
        id="stock-table-section"
      >
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            @input="handleSearch"
            placeholder="Cari nama/kode item..."
            class="pl-9 pr-9"
          />
          <Button
            v-if="searchQuery"
            type="button"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
            @click="searchQuery = ''; handleSearch()"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <select
          :value="lockFilter"
          @change="handleLockFilterChange"
          class="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Semua Item</option>
          <option value="locked">Item Locking</option>
        </select>

        <div class="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            @click="toggleAll"
            class="text-xs gap-1.5"
          >
            <ChevronDown v-if="!allExpanded" class="h-3.5 w-3.5" />
            <ChevronRight v-else class="h-3.5 w-3.5" />
            {{ allExpanded ? 'Tutup Semua' : 'Buka Semua' }}
          </Button>
        </div>
        <div class="text-sm text-muted-foreground whitespace-nowrap">
          Total:
          <span class="font-semibold text-foreground">{{ totalItems }}</span>
          item
        </div>
      </div>

      <Card>
        <CardContent class="p-0">
          <!-- Loading State -->
          <div v-if="loading" class="flex items-center justify-center py-12">
            <RefreshCw class="h-6 w-6 animate-spin text-primary" />
            <span class="ml-2 text-muted-foreground">Memuat data...</span>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="itemGroups.length === 0"
            class="flex flex-col items-center justify-center py-12"
          >
            <Warehouse class="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p class="text-muted-foreground">Tidak ada data stock</p>
          </div>

          <!-- Item Groups Table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead class="bg-muted/50 sticky top-0">
                <tr>
                  <th
                    class="border-b px-4 py-3 text-left font-semibold text-muted-foreground w-10"
                  >
                    #
                  </th>
                  <th
                    class="border-b px-4 py-3 text-left font-semibold text-muted-foreground"
                  >
                    Nama Item
                  </th>
                  <th
                    class="border-b px-4 py-3 text-left font-semibold text-muted-foreground w-40"
                  >
                    Kode Item
                  </th>
                  <th
                    class="border-b px-4 py-3 text-right font-semibold text-muted-foreground w-[100px]"
                  >
                    Total Stok
                  </th>
                  <th
                    class="border-b px-4 py-3 text-center font-semibold text-muted-foreground w-[90px]"
                  >
                    Lokasi
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="itemGroup in itemGroups" :key="itemGroup.itemId">
                  <!-- ITEM GROUP HEADER ROW -->
                  <tr
                    class="bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors"
                    @click="toggleItem(itemGroup.itemId)"
                  >
                    <td class="border-b px-4 py-2.5" colspan="5">
                      <div
                        class="grid grid-cols-[minmax(0,1fr)_160px_100px_90px] items-center gap-3"
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <ChevronDown
                            v-if="itemGroup.isExpanded"
                            class="h-4 w-4 text-primary transition-transform shrink-0"
                          />
                          <ChevronRight
                            v-else
                            class="h-4 w-4 text-muted-foreground transition-transform shrink-0"
                          />
                          <Package class="h-4 w-4 text-primary shrink-0" />
                          <span
                            class="font-semibold text-sm text-foreground truncate"
                            >{{ itemGroup.itemNama }}</span
                          >
                        </div>
                        <div>
                          <Badge variant="outline" class="text-xs">{{
                            itemGroup.itemKode
                          }}</Badge>
                        </div>
                        <span
                          class="text-sm font-semibold text-right"
                          :class="getStockColorClass(itemGroup)"
                        >
                          {{ (itemGroup.totalStock || 0).toLocaleString("id-ID") }}
                        </span>
                        <span class="text-xs text-muted-foreground text-center"
                          >{{ itemGroup.totalRakLocations }} lokasi</span
                        >
                      </div>
                    </td>
                  </tr>

                  <!-- RAK LOCATIONS ROW (expanded) -->
                  <template v-if="itemGroup.isExpanded">
                    <tr
                      v-for="(rak, idx) in itemGroup.rakLocations"
                      :key="rak.stockGudangId"
                      :class="[
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                        rak.isOpname ? 'bg-rose-500/20 dark:bg-rose-500/30 hover:bg-rose-500/20 dark:hover:bg-rose-500/30' : 'hover:bg-muted/30',
                        'transition-colors',
                      ]"
                    >
                      <!-- No urut dalam item -->
                      <td
                        class="border-b px-4 py-3 text-center text-muted-foreground text-xs"
                      >
                        {{ idx + 1 }}
                      </td>

                      <!-- Nama Item (dari group) -->
                      <td class="border-b px-4 py-3 font-medium">
                        <div class="flex flex-col gap-1">
                          <span>{{ itemGroup.itemNama }}</span>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs text-muted-foreground">
                              Rak: {{ rak.rakNama }} ({{ rak.rakKode || "-" }}) • Slot: {{ rak.slotKode || "-" }}
                            </span>
                            <span :class="getLockStatusBadgeClass(rak)">
                              {{ getLockStatusText(rak) }}
                            </span>
                          </div>
                        </div>
                      </td>

                      <!-- Kode Item (dari group) -->
                      <td class="border-b px-4 py-3 text-muted-foreground text-xs">
                        {{ itemGroup.itemKode }}
                      </td>

                      <!-- Total Stok -->
                      <td
                        class="border-b px-4 py-3 text-right font-medium"
                        :class="
                          getStockStatus(
                            rak.freeStock,
                            itemGroup.safetyStok,
                            itemGroup.stokOptimum,
                            itemGroup.status,
                          ) === 'low'
                            ? 'text-destructive font-bold'
                            : getStockStatus(
                                  rak.freeStock,
                                  itemGroup.safetyStok,
                                  itemGroup.stokOptimum,
                                  itemGroup.status,
                                ) === 'over'
                              ? 'text-primary font-bold'
                              : 'text-foreground font-bold'
                        "
                        title="Stok item pada rak ini"
                      >
                        {{ (rak.freeStock || 0).toLocaleString("id-ID") }}
                      </td>

                      <!-- Rak Location Info -->
                      <td class="border-b px-4 py-3 text-xs">
                        <div class="flex flex-col gap-1">
                          <span class="font-medium">{{ rak.rakNama }}</span>
                          <span
                            v-if="rak.rakKode"
                            class="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground text-xs"
                          >
                            {{ rak.rakKode }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>

          <!-- Footer + Pagination -->
          <div
            class="flex items-center justify-between px-4 py-3 border-t bg-muted/30 flex-wrap gap-2"
          >
            <span class="text-sm text-muted-foreground">
              Menampilkan {{ itemGroups.length }} dari {{ totalItems }} data
              &nbsp;|&nbsp; Halaman {{ currentPage }} dari {{ totalPages }}
            </span>

            <!-- Pagination Controls -->
            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage <= 1"
                @click="handlePageChange(1)"
              >
                <ChevronsLeft class="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage <= 1"
                @click="handlePageChange(currentPage - 1)"
              >
                <ChevronLeft class="h-4 w-4" />
              </Button>

              <!-- Page numbers -->
              <template v-for="p in totalPages" :key="p">
                <Button
                  v-if="
                    Math.abs(p - currentPage) <= 2 ||
                    p === 1 ||
                    p === totalPages
                  "
                  :variant="p === currentPage ? 'default' : 'outline'"
                  size="sm"
                  class="h-8 min-w-8 px-2"
                  @click="handlePageChange(p)"
                >
                  {{ p }}
                </Button>
                <span
                  v-else-if="Math.abs(p - currentPage) === 3"
                  class="px-1 text-muted-foreground text-sm"
                  >…</span
                >
              </template>

              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage >= totalPages"
                @click="handlePageChange(currentPage + 1)"
              >
                <ChevronRight class="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage >= totalPages"
                @click="handlePageChange(totalPages)"
              >
                <ChevronsRight class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>

  <!-- ================================================================ -->
  <!-- INFO DIALOG — Redesigned -->
  <!-- ================================================================ -->
  <Dialog v-model:open="showInfoDialog">
    <DialogContent class="max-w-4xl! max-h-[85vh] overflow-y-auto p-0!">
      <!-- ── Hero Header ── -->
      <div class="bg-muted/50 border-b px-6 pt-6 pb-5">
        <DialogHeader class="mb-4">
          <DialogTitle class="sr-only">Detail Informasi Stock</DialogTitle>
          <DialogDescription class="sr-only">
            Detail informasi stock dan history pergerakan barang
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedItem" class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0 space-y-1">
            <h2 class="text-lg font-bold text-foreground">
              Detail Informasi Stock
            </h2>
          </div>
        </div>
      </div>

      <div class="px-6 py-5 space-y-6">
        <!-- ── Stock Gauge Section ── -->
        <div class="space-y-4">
          <h3
            class="text-sm font-semibold text-foreground flex items-center gap-2"
          >
            <Box class="h-4 w-4 text-primary" />
            History Pergerakan Stock
          </h3>

          <!-- History Table -->
          <div v-if="loadingHistory" class="flex items-center justify-center py-8">
            <RefreshCw class="h-5 w-5 animate-spin text-primary" />
            <span class="ml-2 text-muted-foreground">Memuat history...</span>
          </div>

          <div v-else-if="stockHistory.length === 0" class="text-center py-8">
            <History class="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p class="text-muted-foreground">Tidak ada history pergerakan</p>
          </div>

          <div v-else class="border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-4 py-2 text-left font-semibold text-muted-foreground">
                    No. Transaksi
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-muted-foreground">
                    Tipe
                  </th>
                  <th class="px-4 py-2 text-center font-semibold text-muted-foreground">
                    Arah
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-muted-foreground w-28">
                    Tanggal
                  </th>
                  <th class="px-4 py-2 text-left font-semibold text-muted-foreground">
                    Keterangan
                  </th>
                  <th class="px-4 py-2 text-right font-semibold text-muted-foreground w-24">
                    Pembelian
                  </th>
                  <th class="px-4 py-2 text-right font-semibold text-muted-foreground w-24">
                    Penjualan
                  </th>
                  <th class="px-4 py-2 text-right font-semibold text-muted-foreground w-36">
                    Perpindahan Rak/Gudang
                  </th>
                  <th class="px-4 py-2 text-right font-semibold text-muted-foreground w-24">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(h, idx) in stockHistory"
                  :key="h.id"
                  :class="idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'"
                >
                  <td class="px-4 py-2 font-medium font-mono text-xs text-foreground">
                    {{ h.no_transaksi || '-' }}
                  </td>
                  <td class="px-4 py-2 text-muted-foreground text-xs">
                    {{ h.tipe_transaksi }}
                  </td>
                  <td class="px-4 py-2 text-center">
                    <Badge
                      :variant="h.direction === 'MASUK' ? 'default' : 'secondary'"
                      class="text-xs"
                    >
                      {{ h.direction }}
                    </Badge>
                  </td>
                  <td class="px-4 py-2 text-muted-foreground text-xs">
                    {{ formatDateTime(h.tanggal) }}
                  </td>
                  <td class="px-4 py-2 text-xs text-muted-foreground">
                    <span v-if="h.asal || h.tujuan">{{ h.asal ?? '-' }} → {{ h.tujuan ?? '-' }}</span>
                    <span v-else>-</span>
                  </td>
                  <!-- Pembelian -->
                  <td class="px-4 py-2 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'pembelian' && h.qty_masuk && h.qty_masuk > 0"
                      class="text-emerald-600 font-semibold"
                    >
                      +{{ h.qty_masuk.toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Penjualan -->
                  <td class="px-4 py-2 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'penjualan' && h.qty_keluar && h.qty_keluar > 0"
                      class="text-destructive font-semibold"
                    >
                      -{{ h.qty_keluar.toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Perpindahan -->
                  <td class="px-4 py-2 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'perpindahan'"
                      :class="[
                        'font-semibold',
                        h.direction === 'MASUK'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive',
                      ]"
                    >
                      {{ h.direction === 'MASUK' ? '+' : '-' }}{{ (h.qty_masuk || h.qty_keluar || 0).toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Saldo -->
                  <td class="px-4 py-2 text-right font-medium text-primary text-xs">
                    {{ h.saldo.toLocaleString("id-ID") }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- History Pagination -->
          <div v-if="historyPagination.total_pages > 1" class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">
                Menampilkan {{ stockHistory.length }} dari {{ historyPagination.total }} data
              </span>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="historyPage <= 1"
                @click="handleHistoryPageChange(historyPage - 1)"
              >
                <ChevronLeft class="h-3.5 w-3.5" />
              </Button>
              <span class="text-sm px-2 text-muted-foreground">
                {{ historyPage }} / {{ historyPagination.total_pages }}
              </span>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="historyPage >= historyPagination.total_pages"
                @click="handleHistoryPageChange(historyPage + 1)"
              >
                <ChevronRight class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

