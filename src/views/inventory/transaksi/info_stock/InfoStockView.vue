<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, onActivated, onDeactivated } from "vue";
import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  Hash,
  Ruler,
  Barcode,
  Box,
  ShieldCheck,
  Target,
  History,
  FileDown,
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
import { useInfoStockView } from "./useInfoStockView";

const {
  stockData,
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
  expandedRaks,
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
  rakGroups,
  totalItems,
  totalPages,
  selectedGudang,
  activeSummary,
  showTable,
  stockGaugePercent,
  stockGaugeColor,
  toggleRak,
  allExpanded,
  toggleAll,
  getStockStatus,
  getStockColorClass,
  getStatusText,
  getStatusBadgeClass,
  getLockStatusText,
  getLockStatusBadgeClass,
  selectGudang,
  closeTable,
  handleGudangChange,
  handlePageChange,
  handleSearch,
  handleLockFilterChange,
  handleRefresh,
  isExporting,
  handleExport,
  openInfoDialog,
  handleHistoryPageChange,
  handleHistorySearch,
  handleHistoryPageSizeChange,
  handleHistorySearchFieldChange,
  handleHistoryTypeChange,
  handleHistoryRefresh,
  formatDateTime,
} = useInfoStockView();

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
          <h1 class="text-base font-bold">Info Stock Gudang</h1>
          <p class="text-xs text-muted-foreground">
            Pilih gudang untuk lihat detail
          </p>
        </div>
        <div class="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            @click="handleExport('low')"
            :disabled="isExporting || loadingSummary || !selectedGudangId"
            class="h-8 gap-1.5 px-2"
            title="Export Low Stock"
          >
            <FileDown
              :class="['h-3.5 w-3.5', isExporting && 'animate-pulse']"
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="handleExport('over')"
            :disabled="isExporting || loadingSummary || !selectedGudangId"
            class="h-8 gap-1.5 px-2"
            title="Export Over Stock"
          >
            <FileDown
              :class="['h-3.5 w-3.5', isExporting && 'animate-pulse']"
            />
          </Button>
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
      <!-- Summary Cards Mobile -->
      <div class="grid grid-cols-2 gap-2">
        <Card class="bg-destructive/5 border-destructive/20">
          <CardContent class="p-3 flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p class="text-xs text-muted-foreground">Low Stock</p>
              <p class="text-lg font-bold text-destructive">
                {{ activeSummary.low_stock }}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card class="bg-amber-500/10 border-amber-500/30">
          <CardContent class="p-3 flex items-center gap-2">
            <Target class="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p class="text-xs text-muted-foreground">Over Stock</p>
              <p class="text-lg font-bold text-amber-500">
                {{ activeSummary.over_stock }}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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

      <!-- Tabel rak mobile (tampil jika gudang dipilih) -->

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
          rak
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
            placeholder="Cari nama item..."
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
        <div v-else-if="rakGroups.length === 0" class="text-center py-6">
          <Warehouse class="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p class="text-sm text-muted-foreground">Tidak ada data stock</p>
        </div>

        <!-- rak groups -->
        <div v-else class="space-y-2">
          <div v-for="rak in rakGroups" :key="rak.rakId">
            <button
              class="w-full flex items-center justify-between bg-muted/60 rounded-lg px-3 py-2 hover:bg-muted transition-colors"
              @click="toggleRak(rak.rakId)"
            >
              <div class="flex items-center gap-2 text-sm font-semibold">
                <LayoutGrid class="h-4 w-4 text-primary" />
                <span>{{ rak.rakNama }}</span>
                <Badge variant="outline" class="text-[10px] px-1.5 py-0">{{
                  rak.rakKode
                }}</Badge>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground"
                  >{{ rak.totalItemsInRak || rak.items.length }} item</span
                >
                <ChevronDown
                  v-if="rak.isExpanded"
                  class="h-4 w-4 text-muted-foreground"
                />
                <ChevronRight v-else class="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
            <div v-if="rak.isExpanded" class="space-y-2 pl-2 pt-1">
              <Card
                v-for="item in rak.items"
                :key="item.id"
                class="hover:shadow-md transition-all"
              >
                <CardContent class="pt-3 pb-2 space-y-2">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-sm truncate">
                        {{ item.m_item?.nama_item || "-" }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ item.m_item?.kode_item || "-" }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <div class="flex items-center gap-1">
                        <Badge
                          :variant="
                            getStockStatus(
                              item.free_stock,
                              item.m_item?.safety_stok,
                              item.m_item?.stok_optimum,
                              item.m_item?.status,
                            ) === 'low'
                              ? 'destructive'
                              : 'default'
                          "
                        >
                          Rak: {{ item.free_stock }}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7"
                          @click="openInfoDialog(item)"
                        >
                          <Info class="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </div>
                      <span class="text-[10px] text-muted-foreground pr-8">
                        Tot:
                        <span :class="getStockColorClass(item)">{{
                          item.total_stok_gudang
                        }}</span>
                      </span>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-1 text-xs">
                    <div>
                      <span class="text-muted-foreground">Slot:</span>
                      <span class="font-mono">{{
                        item.m_rak_d?.kode || "-"
                      }}</span>
                    </div>
                    <div>
                      <span class="text-muted-foreground">Safety:</span>
                      {{ (item as any).safety_stok || "0" }}
                    </div>
                  </div>
                  <div class="flex justify-end gap-1 pt-1 border-t">
                    <span :class="getStatusBadgeClass(item)">
                      {{ getStatusText(item) }}
                    </span>
                    <span :class="getLockStatusBadgeClass(item)">
                      {{ getLockStatusText(item) }}
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
        <h1 class="text-2xl font-bold">Info Stock Gudang</h1>
        <p class="text-sm text-muted-foreground">
          Informasi stock barang per rak di gudang
        </p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          @click="handleExport('low')"
          :disabled="isExporting || loadingSummary || !selectedGudangId"
          class="shrink-0 gap-2"
          title="Export Low Stock"
        >
          <FileDown :class="['h-4 w-4', isExporting && 'animate-pulse']" />
          <span class="hidden sm:inline">Export Low Stock</span>
        </Button>
        <Button
          variant="outline"
          @click="handleExport('over')"
          :disabled="isExporting || loadingSummary || !selectedGudangId"
          class="shrink-0 gap-2"
          title="Export Over Stock"
        >
          <FileDown :class="['h-4 w-4', isExporting && 'animate-pulse']" />
          <span class="hidden sm:inline">Export Over Stock</span>
        </Button>
        <Button
          variant="outline"
          @click="handleRefresh"
          :disabled="loadingSummary"
          class="shrink-0 gap-2"
        >
          <RefreshCw :class="['h-4 w-4', loadingSummary && 'animate-spin']" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <!-- SUMMARY STATS CARDS -->
    <div class="grid grid-cols-2 gap-4">
      <Card
        class="bg-linear-to-br from-destructive/5 to-destructive/10 border-destructive/20"
      >
        <CardContent class="!p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Low Stock</p>
              <p class="text-2xl font-bold text-destructive">
                <Skeleton v-if="loadingSummary" class="h-8 w-16" />
                <span v-else>{{ activeSummary.low_stock }}</span>
              </p>
            </div>
            <AlertTriangle class="h-8 w-8 text-destructive/50" />
          </div>
        </CardContent>
      </Card>

      <Card
        class="bg-linear-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20"
      >
        <CardContent class="!p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Over Stock</p>
              <p class="text-2xl font-bold text-amber-500">
                <Skeleton v-if="loadingSummary" class="h-8 w-16" />
                <span v-else>{{ activeSummary.over_stock }}</span>
              </p>
            </div>
            <Target class="h-8 w-8 text-amber-500/50" />
          </div>
        </CardContent>
      </Card>
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
          rak
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
            placeholder="Cari nama item..."
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
            v-else-if="rakGroups.length === 0"
            class="flex flex-col items-center justify-center py-12"
          >
            <Warehouse class="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p class="text-muted-foreground">Tidak ada data stock</p>
          </div>

          <!-- Rak Groups Table -->
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
                    class="border-b px-4 py-3 text-left font-semibold text-muted-foreground w-[110px]"
                  >
                    Slot Rak
                  </th>
                  <th
                    class="border-b px-4 py-3 text-right font-semibold text-muted-foreground w-[100px]"
                  >
                    Stok di Rak
                  </th>
                  <th
                    class="border-b px-4 py-3 text-right font-semibold text-muted-foreground w-[110px]"
                  >
                    Total Gudang
                  </th>
                  <th
                    class="border-b px-4 py-3 text-right font-semibold text-muted-foreground w-[90px]"
                  >
                    Safety
                  </th>
                  <th
                    class="border-b px-4 py-3 text-right font-semibold text-muted-foreground w-[90px]"
                  >
                    Optimum
                  </th>
                  <th
                    class="border-b px-4 py-3 text-center font-semibold text-muted-foreground w-[110px]"
                  >
                    Status
                  </th>
                  <th
                    class="border-b px-4 py-3 text-center font-semibold text-muted-foreground w-[60px]"
                  >
                    Info
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="rak in rakGroups" :key="rak.rakId">
                  <!-- RAK GROUP HEADER ROW -->
                  <tr
                    class="bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors"
                    @click="toggleRak(rak.rakId)"
                  >
                    <td class="border-b px-4 py-2.5" colspan="10">
                      <div class="flex items-center gap-3">
                        <ChevronDown
                          v-if="rak.isExpanded"
                          class="h-4 w-4 text-primary transition-transform"
                        />
                        <ChevronRight
                          v-else
                          class="h-4 w-4 text-muted-foreground transition-transform"
                        />
                        <LayoutGrid class="h-4 w-4 text-primary" />
                        <span class="font-semibold text-sm text-foreground">{{
                          rak.rakNama
                        }}</span>
                        <Badge variant="outline" class="text-xs">{{
                          rak.rakKode
                        }}</Badge>
                        <span class="text-xs text-muted-foreground ml-auto"
                          >{{
                            rak.totalItemsInRak || rak.items.length
                          }}
                          item</span
                        >
                      </div>
                    </td>
                  </tr>

                  <!-- ITEMS ROW (expanded) -->
                  <template v-if="rak.isExpanded">
                    <tr
                      v-for="(item, idx) in rak.items"
                      :key="item.id"
                      :class="[
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                        item.is_opname ? 'bg-rose-500/20 dark:bg-rose-500/30 hover:bg-rose-500/20 dark:hover:bg-rose-500/30' : 'hover:bg-muted/30',
                        'transition-colors',
                      ]"
                    >
                      <!-- No urut dalam rak -->
                      <td
                        class="border-b px-4 py-3 text-center text-muted-foreground text-xs"
                      >
                        {{ idx + 1 }}
                      </td>

                      <!-- Nama Item -->
                      <td class="border-b px-4 py-3 font-medium">
                        {{ item.m_item?.nama_item || "-" }}
                      </td>

                      <!-- Kode Item -->
                      <td
                        class="border-b px-4 py-3 text-muted-foreground text-xs"
                      >
                        {{ item.m_item?.kode_item || "-" }}
                      </td>

                      <!-- Slot Rak (kode slot) -->
                      <td class="border-b px-4 py-3 text-xs">
                        <span
                          v-if="item.m_rak_d"
                          class="font-mono bg-muted px-2 py-0.5 rounded text-foreground"
                        >
                          {{ item.m_rak_d.kode }}
                        </span>
                        <span v-else class="text-muted-foreground">-</span>
                      </td>

                      <!-- Stok di Rak (Free Stock) -->
                      <td
                        class="border-b px-4 py-3 text-right font-medium"
                        :class="getStockColorClass(item)"
                        title="Stok hanya di rak/slot ini"
                      >
                        {{ (item.free_stock || 0).toLocaleString("id-ID") }}
                      </td>

                      <!-- Total Stok Gudang -->
                      <td
                        class="border-b px-4 py-3 text-right"
                        :class="getStockColorClass(item)"
                        title="Total stok alat ini di seluruh rak gudang"
                      >
                        {{
                          (item.total_stok_gudang || 0).toLocaleString("id-ID")
                        }}
                      </td>

                      <!-- Safety Stock -->
                      <td
                        class="border-b px-4 py-3 text-right text-muted-foreground"
                      >
                        {{
                          parseInt(
                            (item as any).safety_stok || "0",
                          ).toLocaleString("id-ID")
                        }}
                      </td>

                      <!-- Stok Optimum -->
                      <td
                        class="border-b px-4 py-3 text-right text-muted-foreground"
                      >
                        {{
                          parseInt(
                            (item as any).stok_optimum || "0",
                          ).toLocaleString("id-ID")
                        }}
                      </td>

                      <!-- Status -->
                      <td class="border-b px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <span :class="getStatusBadgeClass(item)">
                            {{ getStatusText(item) }}
                          </span>
                          <span :class="getLockStatusBadgeClass(item)">
                            {{ getLockStatusText(item) }}
                          </span>
                        </div>
                      </td>

                      <!-- Info Button -->
                      <td class="border-b px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-8 w-8"
                          @click.stop="openInfoDialog(item)"
                        >
                          <Info class="h-4 w-4 text-primary" />
                        </Button>
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
              Menampilkan {{ stockData.length }} dari {{ totalItems }} data
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
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-bold text-foreground truncate">
                {{ selectedItem.m_item?.nama_item || "-" }}
              </h2>
              <span :class="getStatusBadgeClass(selectedItem)">
                {{ getStatusText(selectedItem) }}
              </span>
            </div>
            <div
              class="flex items-center gap-3 text-sm text-muted-foreground flex-wrap"
            >
              <span class="inline-flex items-center gap-1.5">
                <Barcode class="h-3.5 w-3.5" />
                <span class="font-mono">{{
                  selectedItem.m_item?.kode_item || "-"
                }}</span>
              </span>
              <span class="text-border">•</span>
              <span class="inline-flex items-center gap-1.5">
                <Warehouse class="h-3.5 w-3.5" />
                {{ selectedItem.m_gudang?.nama_gudang || "-" }}
              </span>
              <template v-if="selectedItem.m_rak_d">
                <span class="text-border">•</span>
                <span class="inline-flex items-center gap-1.5">
                  <LayoutGrid class="h-3.5 w-3.5" />
                  {{ selectedItem.m_rak_d.m_rak?.nama_rak || "-" }}
                  <code
                    class="text-xs bg-background px-1.5 py-0.5 rounded border"
                  >
                    {{ selectedItem.m_rak_d.kode }}
                  </code>
                </span>
              </template>
            </div>
          </div>
          <div class="shrink-0">
            <Package class="h-10 w-10 text-primary/30" />
          </div>
        </div>
      </div>

      <div v-if="selectedItem" class="px-6 py-5 space-y-6">
        <!-- ── Stock Gauge Section ── -->
        <div class="space-y-4">
          <h3
            class="text-sm font-semibold text-foreground flex items-center gap-2"
          >
            <Box class="h-4 w-4 text-primary" />
            Ringkasan Stock
          </h3>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <!-- Safety Stock -->
            <div
              class="relative p-4 rounded-xl border bg-background text-center flex flex-col justify-center"
            >
              <div class="absolute top-2.5 left-3">
                <ShieldCheck class="h-4 w-4 text-destructive/40" />
              </div>
              <p class="text-xs text-muted-foreground mb-1">Safety Stock</p>
              <p class="text-2xl font-bold text-destructive">
                {{
                  parseInt(selectedItem.safety_stok || "0").toLocaleString(
                    "id-ID",
                  )
                }}
              </p>
            </div>

            <!-- Free Stock (Stok di Rak) -->
            <div
              class="relative p-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-center flex flex-col justify-center"
            >
              <div class="absolute top-2.5 left-3">
                <Package class="h-4 w-4 text-primary/40" />
              </div>
              <p class="text-xs text-muted-foreground mb-1">Stok di Rak ini</p>
              <p class="text-3xl font-bold text-primary">
                {{ (selectedItem.free_stock || 0).toLocaleString("id-ID") }}
              </p>
            </div>

            <!-- Total Stok Gudang -->
            <div
              class="relative p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5 text-center flex flex-col justify-center"
            >
              <div class="absolute top-2.5 left-3">
                <Warehouse class="h-4 w-4 text-blue-500/40" />
              </div>
              <p class="text-xs text-muted-foreground mb-1">
                Stok Total di Gudang
              </p>
              <p class="text-3xl font-bold text-blue-600/90">
                {{
                  (selectedItem.total_stok_gudang || 0).toLocaleString("id-ID")
                }}
              </p>
            </div>

            <!-- Stok Optimum -->
            <div
              class="relative p-4 rounded-xl border bg-background text-center flex flex-col justify-center"
            >
              <div class="absolute top-2.5 left-3">
                <Target class="h-4 w-4 text-muted-foreground/40" />
              </div>
              <p class="text-xs text-muted-foreground mb-1">Stok Optimum</p>
              <p class="text-2xl font-bold text-foreground">
                {{
                  parseInt(selectedItem.stok_optimum || "0").toLocaleString(
                    "id-ID",
                  )
                }}
              </p>
            </div>
          </div>

          <!-- Visual Gauge Bar -->
          <div class="space-y-1.5 mt-4">
            <div class="relative h-4 text-xs text-muted-foreground w-full">
              <span class="absolute left-0 bottom-0 whitespace-nowrap">0</span>

              <span
                v-if="
                  parseInt(selectedItem.stok_optimum || '0') > 0 &&
                  parseInt(selectedItem.safety_stok || '0') > 0
                "
                class="absolute bottom-0 text-destructive font-medium -translate-x-1/2 whitespace-nowrap"
                :style="{
                  left:
                    Math.min(
                      (parseInt(selectedItem.safety_stok || '0') /
                        parseInt(selectedItem.stok_optimum || '1')) *
                        100,
                      100,
                    ) + '%',
                }"
              >
                Safety: {{ selectedItem.safety_stok }}
              </span>

              <span
                v-if="parseInt(selectedItem.stok_optimum || '0') > 0"
                class="absolute right-0 bottom-0 whitespace-nowrap"
              >
                Optimum: {{ selectedItem.stok_optimum }}
              </span>
            </div>
            <div
              class="h-3 w-full bg-muted rounded-full overflow-hidden relative"
            >
              <!-- Safety line marker -->
              <div
                v-if="
                  parseInt(selectedItem.stok_optimum || '0') > 0 &&
                  parseInt(selectedItem.safety_stok || '0') > 0
                "
                class="absolute top-0 bottom-0 w-px bg-destructive/50 z-10"
                :style="{
                  left:
                    Math.min(
                      (parseInt(selectedItem.safety_stok || '0') /
                        parseInt(selectedItem.stok_optimum || '1')) *
                        100,
                      100,
                    ) + '%',
                }"
              />
              <!-- Fill bar -->
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="stockGaugeColor"
                :style="{ width: stockGaugePercent + '%' }"
              />
            </div>
          </div>
        </div>

        <Separator />

        <!-- ── Detail Info Grid ── -->
        <div class="space-y-3">
          <h3
            class="text-sm font-semibold text-foreground flex items-center gap-2"
          >
            <Info class="h-4 w-4 text-primary" />
            Detail Item
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 rounded-lg border bg-background space-y-1">
              <p
                class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
              >
                Ukuran
              </p>
              <p class="text-sm font-semibold text-foreground">
                {{ selectedItem.m_item?.ukuran || "-" }}
              </p>
            </div>
            <div class="p-3 rounded-lg border bg-background space-y-1">
              <p
                class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
              >
                HS Code
              </p>
              <p class="text-sm font-semibold text-foreground font-mono">
                {{ selectedItem.m_item?.hs_code || "-" }}
              </p>
            </div>
            <div class="p-3 rounded-lg border bg-background space-y-1">
              <p
                class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
              >
                Gudang
              </p>
              <p class="text-sm font-semibold text-foreground">
                {{ selectedItem.m_gudang?.nama_gudang || "-" }}
              </p>
            </div>
            <div class="p-3 rounded-lg border bg-background space-y-1">
              <p
                class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
              >
                Rak / Slot
              </p>
              <p class="text-sm font-semibold text-foreground">
                {{ selectedItem.m_rak_d?.m_rak?.nama_rak || "-" }}
                <code
                  v-if="selectedItem.m_rak_d"
                  class="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded"
                >
                  {{ selectedItem.m_rak_d.kode }}
                </code>
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <!-- ── History Pergerakan Stock (single table) ── -->
        <div class="space-y-3">
          <!-- Header row: title + controls -->
          <div class="flex items-center gap-2 flex-wrap">
            <h3
              class="text-sm font-semibold text-foreground flex items-center gap-2 shrink-0"
            >
              <History class="h-4 w-4 text-primary" />
              History Pergerakan Stock
              <!-- <span
                v-if="!loadingHistory"
                class="text-xs font-normal text-muted-foreground"
              >
                ({{ historyPagination.total }})
              </span> -->
            </h3>

            <!-- Page size -->
            <select
              :value="historyPageSize"
              @change="handleHistoryPageSizeChange"
              class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>

            <!-- Search field selector -->
            <select
              :value="historySearchField"
              @change="handleHistorySearchFieldChange"
              class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="no_transaksi">No. Transaksi</option>
              <option value="asal">Asal</option>
              <option value="tujuan">Tujuan</option>
            </select>

            <!-- Search input -->
            <div class="relative flex-1 min-w-[120px] max-w-[200px]">
              <Search
                class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
              />
              <Input
                v-model="historySearch"
                @input="handleHistorySearch"
                placeholder="Cari..."
                class="pl-8 pr-8 h-8 text-xs"
              />
              <Button
                v-if="historySearch"
                type="button"
                size="icon"
                variant="ghost"
                class="absolute right-0 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-white"
                @click="historySearch = ''; handleHistorySearch()"
              >
                <X class="h-3.5 w-3.5" />
              </Button>
            </div>

            <!-- Type filter -->
            <select
              :value="historyType"
              @change="handleHistoryTypeChange"
              class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua</option>
              <option value="masuk">MASUK</option>
              <option value="keluar">KELUAR</option>
            </select>

            <!-- Refresh button -->
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 shrink-0"
              :disabled="loadingHistory"
              @click="handleHistoryRefresh"
            >
              <RefreshCw
                :class="['h-3.5 w-3.5', loadingHistory && 'animate-spin']"
              />
            </Button>
          </div>

          <!-- Loading -->
          <div
            v-if="loadingHistory"
            class="flex items-center justify-center py-8 rounded-lg border bg-muted/30"
          >
            <RefreshCw class="h-5 w-5 animate-spin text-primary" />
            <span class="ml-2 text-sm text-muted-foreground"
              >Memuat history...</span
            >
          </div>

          <!-- Empty -->
          <div
            v-else-if="stockHistory.length === 0"
            class="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border"
          >
            <RefreshCw class="h-8 w-8 mb-2 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">
              Tidak ada history pergerakan stock
            </p>
          </div>

          <!-- Table -->
          <div v-else class="rounded-lg overflow-hidden border">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-muted/50">
                  <th
                    class="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-10"
                  >
                    #
                  </th>
                  <th
                    class="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    No. Transaksi
                  </th>
                  <th
                    class="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    Tipe
                  </th>
                  <th
                    class="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    Arah
                  </th>
                  <th
                    class="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[120px]"
                  >
                    Tanggal
                  </th>
                  <th
                    class="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    Keterangan
                  </th>
                  <th
                    class="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[110px]"
                  >
                    Pembelian
                  </th>
                  <th
                    class="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[110px]"
                  >
                    Penjualan
                  </th>
                  <th
                    class="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[150px]"
                  >
                    Perpindahan Rak/Gudang
                  </th>
                  <th
                    class="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[110px]"
                  >
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(h, idx) in stockHistory"
                  :key="h.id"
                  class="border-t hover:bg-muted/30 transition-colors"
                  :class="idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'"
                >
                  <td class="px-3 py-2.5 text-muted-foreground text-xs">
                    {{ (historyPage - 1) * historyPageSize + idx + 1 }}
                  </td>
                  <td class="px-3 py-2.5 font-medium font-mono text-xs text-foreground">
                    {{ h.no_transaksi || '-' }}
                  </td>
                  <td class="px-3 py-2.5 text-muted-foreground text-xs">
                    {{ h.tipe_transaksi }}
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <span
                      v-if="h.direction === 'MASUK'"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    >
                      <ArrowDownToLine class="h-3 w-3" />
                      MASUK
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    >
                      <ArrowUpFromLine class="h-3 w-3" />
                      KELUAR
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                    {{ h.tanggal }}
                  </td>
                  <td class="px-3 py-2.5 text-xs text-muted-foreground">
                    <span v-if="h.asal || h.tujuan">{{ h.asal ?? '-' }} → {{ h.tujuan ?? '-' }}</span>
                    <span v-else>-</span>
                  </td>
                  <!-- Pembelian -->
                  <td class="px-3 py-2.5 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'pembelian' && h.qty_masuk && h.qty_masuk > 0"
                      class="font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      +{{ h.qty_masuk.toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Penjualan -->
                  <td class="px-3 py-2.5 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'penjualan' && h.qty_keluar && h.qty_keluar > 0"
                      class="font-bold text-red-600 dark:text-red-400"
                    >
                      -{{ h.qty_keluar.toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Perpindahan -->
                  <td class="px-3 py-2.5 text-right text-xs">
                    <span
                      v-if="getTransactionCategory(h) === 'perpindahan'"
                      :class="[
                        'font-bold',
                        h.direction === 'MASUK'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      ]"
                    >
                      {{ h.direction === 'MASUK' ? '+' : '-' }}{{ (h.qty_masuk || h.qty_keluar || 0).toLocaleString("id-ID") }}
                    </span>
                    <span v-else class="text-muted-foreground/40">-</span>
                  </td>
                  <!-- Saldo -->
                  <td class="px-3 py-2.5 text-right font-medium text-primary text-xs">
                    {{ h.saldo.toLocaleString("id-ID") }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Footer: info + pagination -->
            <div
              class="flex items-center justify-between px-3 py-2 border-t bg-muted/30 flex-wrap gap-2"
            >
              <span class="text-xs text-muted-foreground">
                {{ stockHistory.length }} dari {{ historyPagination.total }}
                transaksi &nbsp;|&nbsp; Hal.
                {{ historyPagination.page }} /
                {{ historyPagination.total_pages }}
              </span>

              <!-- Pagination controls -->
              <div
                v-if="historyPagination.total_pages > 1"
                class="flex items-center gap-1"
              >
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="historyPage <= 1"
                  @click="handleHistoryPageChange(1)"
                >
                  <ChevronsLeft class="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="historyPage <= 1"
                  @click="handleHistoryPageChange(historyPage - 1)"
                >
                  <ChevronLeft class="h-3.5 w-3.5" />
                </Button>
                <template v-for="p in historyPagination.total_pages" :key="p">
                  <Button
                    v-if="
                      Math.abs(p - historyPage) <= 1 ||
                      p === 1 ||
                      p === historyPagination.total_pages
                    "
                    :variant="p === historyPage ? 'default' : 'outline'"
                    size="sm"
                    class="h-7 min-w-7 px-2 text-xs"
                    @click="handleHistoryPageChange(p)"
                  >
                    {{ p }}
                  </Button>
                  <span
                    v-else-if="Math.abs(p - historyPage) === 2"
                    class="px-1 text-muted-foreground text-xs"
                    >…</span
                  >
                </template>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="historyPage >= historyPagination.total_pages"
                  @click="handleHistoryPageChange(historyPage + 1)"
                >
                  <ChevronRight class="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="historyPage >= historyPagination.total_pages"
                  @click="
                    handleHistoryPageChange(historyPagination.total_pages)
                  "
                >
                  <ChevronsRight class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* rak group header row hover */
tr.cursor-pointer:hover td {
  background-color: hsl(var(--muted) / 0.6);
}
</style>

