<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (2.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Mutasi Gudang &rarr; Rak
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pindahkan stok dari gudang belakang ke rak pajangan. Saldo gudang berkurang, saldo rak bertambah,
          dan dua baris kartu stok tercatat otomatis.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="loadItems" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <RouterLink
          to="/inventory/stok/positions"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <Boxes class="w-4 h-4" />
          <span>Posisi Stok</span>
        </RouterLink>
      </div>
    </div>

    <!-- Role gate -->
    <Card v-if="!canMutate" class="border-amber-200 dark:border-amber-900/60 shadow-xs">
      <CardContent class="p-6 flex flex-col sm:flex-row items-start gap-4">
        <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
          <ShieldAlert class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Akses terbatas</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Mutasi stok hanya dapat dieksekusi oleh role <strong>GUDANG</strong>, <strong>ADMIN</strong>,
            atau <strong>SUPER ADMIN</strong>. Hubungi petugas gudang untuk memindahkan stok ke rak.
          </p>
          <RouterLink
            to="/inventory/stok/positions"
            class="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-3"
          >
            Lihat posisi stok saat ini <ArrowRight class="w-3.5 h-3.5" />
          </RouterLink>
        </div>
      </CardContent>
    </Card>

    <template v-else>
      <!-- Success panel -->
      <Card
        v-if="successResult"
        class="border-emerald-200 dark:border-emerald-900/60 shadow-xs bg-emerald-50/60 dark:bg-emerald-950/20"
      >
        <CardContent class="p-5">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 class="w-6 h-6" />
              </div>
              <div>
                <h3 class="text-base font-semibold text-slate-900 dark:text-white">Mutasi berhasil dieksekusi</h3>
                <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  No. Mutasi
                  <span class="font-mono font-semibold text-slate-900 dark:text-white">{{ successResult.no_mutasi }}</span>
                  &middot; {{ successResult.details?.length || 0 }} baris &middot;
                  {{ successQty.toLocaleString("id-ID") }} Pcs dipindahkan ke rak.
                </p>
                <p class="text-xs text-slate-500 mt-1">
                  Stok gudang sudah dipotong. Kartu stok mencatat MUTASI_KELUAR (gudang) dan MUTASI_MASUK (rak).
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" @click="resetSuccess">Mutasi Lagi</Button>
              <RouterLink
                to="/inventory/stok/cards"
                class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-medium text-white"
              >
                <BookOpen class="w-4 h-4" />
                Kartu Stok
              </RouterLink>
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Form -->
        <div class="xl:col-span-2 space-y-6">
          <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardContent class="p-4 space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Daftar Barang Mutasi</h3>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Pilih barang dari stok gudang. Qty tidak boleh melebihi saldo gudang yang tersedia.
                  </p>
                </div>
                <Button
                  size="sm"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                  @click="openPicker"
                >
                  <Plus class="w-4 h-4" />
                  <span>Tambah Barang</span>
                </Button>
              </div>

              <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th class="px-4 py-3">Barang</th>
                      <th class="px-4 py-3 text-center">Stok Gudang</th>
                      <th class="px-4 py-3 text-center w-36">Qty Mutasi</th>
                      <th class="px-4 py-3 text-center">Sisa Gudang</th>
                      <th class="px-4 py-3 text-center w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-if="rows.length === 0">
                      <td colspan="5" class="px-4 py-12 text-center text-slate-500">
                        <ArrowRightLeft class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada barang dipilih</p>
                        <p class="text-xs text-slate-400 mt-1">
                          Klik "Tambah Barang" lalu pilih SKU yang akan dipindahkan ke rak.
                        </p>
                      </td>
                    </tr>

                    <tr v-for="row in rows" :key="row.key" class="align-top">
                      <td class="px-4 py-3">
                        <div class="font-medium text-slate-900 dark:text-white">{{ itemName(row.itemId) }}</div>
                        <div class="flex flex-wrap items-center gap-2 mt-1">
                          <span class="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {{ itemBarcode(row.itemId) }}
                          </span>
                          <span class="text-[11px] text-slate-400">{{ itemRack(row.itemId) }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span class="font-mono font-semibold text-amber-700 dark:text-amber-400">
                          {{ gudangQty(row.itemId).toLocaleString("id-ID") }}
                        </span>
                        <div class="text-[11px] text-slate-400">Pcs</div>
                      </td>
                      <td class="px-4 py-3">
                        <input
                          v-model.number="row.qty"
                          type="number"
                          min="1"
                          :max="gudangQty(row.itemId)"
                          inputmode="numeric"
                          class="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-center font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p v-if="rowError(row)" class="text-[11px] text-rose-600 dark:text-rose-400 mt-1 leading-snug">
                          {{ rowError(row) }}
                        </p>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          class="font-mono font-semibold"
                          :class="remainingAfter(row) < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'"
                        >
                          {{ remainingAfter(row).toLocaleString("id-ID") }}
                        </span>
                        <div class="text-[11px] text-slate-400">Pcs</div>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Hapus baris"
                          @click="removeRow(row.key)"
                        >
                          <Trash2 class="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent class="p-4 space-y-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan Mutasi
                </label>
                <textarea
                  v-model="keterangan"
                  rows="3"
                  maxlength="300"
                  placeholder="Contoh: Restock rak minuman shift pagi"
                  class="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
                <p class="text-[11px] text-slate-400 mt-1">{{ keterangan.length }}/300 karakter</p>
              </div>

              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div class="flex items-center gap-4 text-xs text-slate-500">
                  <span><strong class="text-slate-800 dark:text-slate-200">{{ rows.length }}</strong> SKU</span>
                  <span><strong class="text-slate-800 dark:text-slate-200">{{ totalQty.toLocaleString("id-ID") }}</strong> Pcs</span>
                  <span v-if="invalidRows.length > 0" class="text-rose-600 dark:text-rose-400">
                    {{ invalidRows.length }} baris perlu diperbaiki
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="rows.length === 0 || submitting"
                    @click="clearRows"
                  >
                    Kosongkan
                  </Button>
                  <Button
                    size="sm"
                    class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    :disabled="!canSubmit"
                    @click="submitMutation"
                  >
                    <RefreshCw v-if="submitting" class="w-4 h-4 animate-spin" />
                    <ArrowRightLeft v-else class="w-4 h-4" />
                    <span>{{ submitting ? "Memproses..." : "Eksekusi Mutasi" }}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Side info -->
        <div class="space-y-6">
          <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent class="p-4 space-y-4">
              <div class="flex items-center gap-2">
                <div class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <ArrowRightLeft class="w-5 h-5" />
                </div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Ringkasan Mutasi</h3>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3">
                  <p class="text-[11px] text-slate-500">SKU dipilih</p>
                  <p class="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{{ rows.length }}</p>
                </div>
                <div class="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3">
                  <p class="text-[11px] text-slate-500">Total Pcs</p>
                  <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {{ totalQty.toLocaleString("id-ID") }}
                  </p>
                </div>
              </div>

              <div class="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Warehouse class="w-3.5 h-3.5" /> Gudang
                  </span>
                  <span class="font-mono">-{{ totalQty.toLocaleString("id-ID") }} Pcs</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Store class="w-3.5 h-3.5" /> Rak
                  </span>
                  <span class="font-mono">+{{ totalQty.toLocaleString("id-ID") }} Pcs</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <ScrollText class="w-3.5 h-3.5" /> Kartu stok
                  </span>
                  <span class="font-mono">{{ rows.length * 2 }} baris</span>
                </div>
              </div>

              <div class="text-xs text-slate-500 space-y-1.5">
                <p class="flex items-start gap-1.5">
                  <Info class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Mutasi bersifat atomik: jika satu baris gagal, seluruh transaksi dibatalkan.
                </p>
                <p class="flex items-start gap-1.5">
                  <Info class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Barang yang sama cukup satu baris, qty akan digabung.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent class="p-4">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Stok Gudang Teratas</h3>
              <p class="text-xs text-slate-500 mt-0.5">SKU dengan saldo gudang terbanyak.</p>
              <div class="mt-3 space-y-2">
                <div v-if="topGudangItems.length === 0" class="text-xs text-slate-400 italic">
                  Belum ada stok gudang.
                </div>
                <button
                  v-for="item in topGudangItems"
                  :key="item.id"
                  type="button"
                  class="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                  @click="addItem(item)"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-slate-800 dark:text-slate-200">{{ item.nama_barang }}</span>
                    <span class="block font-mono text-[11px] text-slate-400">{{ item.barcode }}</span>
                  </span>
                  <span class="shrink-0 font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {{ gudangQty(item.id).toLocaleString("id-ID") }}
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>

    <!-- Item picker dialog -->
    <GlobalDialog
      v-model:open="isPickerOpen"
      title="Pilih Barang untuk Dimutasi"
      description="Cari nama atau barcode. Hanya barang dengan stok gudang yang dapat dipindahkan."
      :show-cancel="false"
      content-class="max-w-3xl"
    >
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="relative">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="pickerSearch"
              placeholder="Cari nama / barcode barang..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="handlePickerEnter"
            />
          </div>
          <div class="relative">
            <ScanLine class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="barcodeBuffer"
              placeholder="Scan barcode (8+ digit) lalu Enter..."
              class="pl-9 font-mono bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="scanBarcode"
            />
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>{{ pickerItems.length }} barang ditampilkan</span>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input v-model="showEmptyStock" type="checkbox" class="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Tampilkan stok gudang kosong
          </label>
        </div>

        <div class="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <div v-if="filteredPickerItems.length === 0" class="p-8 text-center text-sm text-slate-500">
            <Package class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            Tidak ada barang yang cocok.
          </div>

          <button
            v-for="item in filteredPickerItems"
            :key="item.id"
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
            :class="gudangQty(item.id) > 0
              ? 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20'
              : 'opacity-60 cursor-not-allowed'"
            :disabled="gudangQty(item.id) <= 0"
            @click="addItem(item)"
          >
            <div class="min-w-0">
              <div class="font-medium text-slate-900 dark:text-white truncate">{{ item.nama_barang }}</div>
              <div class="flex flex-wrap items-center gap-2 mt-0.5">
                <span class="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {{ item.barcode }}
                </span>
                <span class="text-[11px] text-slate-400">{{ item.category_rack?.nama || "Tanpa kategori" }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[11px] text-slate-400">Gudang</div>
              <div class="font-mono font-semibold text-amber-700 dark:text-amber-400">
                {{ gudangQty(item.id).toLocaleString("id-ID") }}
              </div>
            </div>
            <span
              class="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium"
              :class="hasRow(item.id)
                ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                : 'bg-emerald-600 text-white'"
            >
              {{ hasRow(item.id) ? "Ditambahkan" : "Tambah" }}
            </span>
          </button>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <p class="text-[11px] text-slate-500">
            Barang yang sama akan menambah qty pada baris yang sudah ada.
          </p>
          <Button variant="outline" size="sm" @click="isPickerOpen = false">Tutup</Button>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  Boxes,
  CheckCircle2,
  Info,
  Package,
  Plus,
  RefreshCw,
  ScanLine,
  ScrollText,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  Warehouse,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import {
  getMinimarketItemByBarcode,
  getMinimarketItems,
  type MinimarketItem,
} from "../../master/m_items/minimarketItemService";
import {
  createStockMutation,
  type StockMutationResult,
} from "./stockMutationService";

interface MutationRow {
  key: string;
  itemId: string;
  qty: number;
}

const authStore = useAuthStore();

const items = ref<MinimarketItem[]>([]);
const loading = ref(false);
const submitting = ref(false);

const rows = ref<MutationRow[]>([]);
const keterangan = ref("");
const successResult = ref<StockMutationResult | null>(null);

const isPickerOpen = ref(false);
const pickerSearch = ref("");
const barcodeBuffer = ref("");
const showEmptyStock = ref(false);

const canMutate = computed(() =>
  ["GUDANG", "ADMIN", "SUPER_ADMIN"].includes(authStore.user?.role.system_key || ""),
);

const itemMap = computed(() => {
  const map = new Map<string, MinimarketItem>();
  for (const item of items.value) map.set(item.id, item);
  return map;
});

function stockQtyOf(item: MinimarketItem, location: "GUDANG" | "RAK"): number {
  const stock = item.stocks?.find((entry) => entry.location === location);
  return stock ? Number(stock.qty) || 0 : 0;
}

function gudangQty(itemId: string): number {
  const item = itemMap.value.get(itemId);
  return item ? stockQtyOf(item, "GUDANG") : 0;
}

function itemName(itemId: string): string {
  return itemMap.value.get(itemId)?.nama_barang || "Barang tidak ditemukan";
}

function itemBarcode(itemId: string): string {
  return itemMap.value.get(itemId)?.barcode || "-";
}

function itemRack(itemId: string): string {
  const rack = itemMap.value.get(itemId)?.category_rack;
  if (!rack) return "Tanpa kategori";
  return `${rack.nama} (${rack.tipe_zona})`;
}

function allocatedQty(itemId: string, excludeKey?: string): number {
  return rows.value
    .filter((row) => row.itemId === itemId && row.key !== excludeKey)
    .reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
}

function totalAllocatedFor(itemId: string): number {
  return allocatedQty(itemId);
}

function availableForRow(row: MutationRow): number {
  return Math.max(0, gudangQty(row.itemId) - allocatedQty(row.itemId, row.key));
}

function remainingAfter(row: MutationRow): number {
  return gudangQty(row.itemId) - totalAllocatedFor(row.itemId);
}

function rowError(row: MutationRow): string {
  const qty = Number(row.qty);
  if (!Number.isFinite(qty) || qty <= 0) return "Qty harus lebih dari 0";
  if (!Number.isInteger(qty)) return "Qty harus bilangan bulat";
  if (qty > availableForRow(row)) {
    return `Maksimal ${availableForRow(row).toLocaleString("id-ID")} Pcs (stok gudang)`;
  }
  return "";
}

const invalidRows = computed(() => rows.value.filter((row) => !!rowError(row)));

const totalQty = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0),
);

const successQty = computed(() =>
  (successResult.value?.details || []).reduce(
    (sum, detail) => sum + (Number(detail.qty_pcs) || 0),
    0,
  ),
);

const canSubmit = computed(
  () => rows.value.length > 0 && invalidRows.value.length === 0 && !submitting.value,
);

const topGudangItems = computed(() =>
  items.value
    .filter((item) => stockQtyOf(item, "GUDANG") > 0)
    .sort((a, b) => stockQtyOf(b, "GUDANG") - stockQtyOf(a, "GUDANG"))
    .slice(0, 5),
);

const filteredPickerItems = computed(() => {
  const keyword = pickerSearch.value.trim().toLowerCase();
  return items.value
    .filter((item) => {
      if (!showEmptyStock.value && stockQtyOf(item, "GUDANG") <= 0) return false;
      if (!keyword) return true;
      return (
        item.nama_barang.toLowerCase().includes(keyword) ||
        item.barcode.toLowerCase().includes(keyword)
      );
    })
    .slice(0, 80);
});

const pickerItems = computed(() =>
  items.value.filter((item) => showEmptyStock.value || stockQtyOf(item, "GUDANG") > 0),
);

function hasRow(itemId: string): boolean {
  return rows.value.some((row) => row.itemId === itemId);
}

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addItem(item: MinimarketItem) {
  const stock = stockQtyOf(item, "GUDANG");
  if (stock <= 0) {
    toast.error(`${item.nama_barang} tidak memiliki stok gudang`);
    return;
  }

  const existing = rows.value.find((row) => row.itemId === item.id);
  if (existing) {
    const nextQty = (Number(existing.qty) || 0) + 1;
    if (nextQty > gudangQty(item.id)) {
      toast.error(`Qty ${item.nama_barang} sudah mencapai stok gudang (${stock} Pcs)`);
      return;
    }
    existing.qty = nextQty;
    toast.info(`${item.nama_barang} ditambah menjadi ${nextQty} Pcs`);
    return;
  }

  successResult.value = null;
  rows.value.push({ key: makeKey(), itemId: item.id, qty: 1 });
}

function removeRow(key: string) {
  rows.value = rows.value.filter((row) => row.key !== key);
}

function clearRows() {
  rows.value = [];
  keterangan.value = "";
}

function resetSuccess() {
  successResult.value = null;
  rows.value = [];
  keterangan.value = "";
}

function openPicker() {
  pickerSearch.value = "";
  barcodeBuffer.value = "";
  isPickerOpen.value = true;
}

async function scanBarcode() {
  const code = barcodeBuffer.value.trim();
  if (code.length < 8) {
    toast.error("Barcode minimal 8 digit");
    return;
  }

  try {
    const found = await getMinimarketItemByBarcode(code);
    if (!items.value.some((item) => item.id === found.id)) {
      items.value = [...items.value, found];
    }
    addItem(found);
    barcodeBuffer.value = "";
  } catch (error: any) {
    console.error("Gagal mencari barcode:", error);
    toast.error(error.message || `Barcode ${code} tidak ditemukan`);
  }
}

function handlePickerEnter() {
  const code = pickerSearch.value.trim();
  if (code.length >= 8 && /^\d+$/.test(code)) {
    barcodeBuffer.value = code;
    pickerSearch.value = "";
    scanBarcode();
  }
}

async function loadItems() {
  loading.value = true;
  try {
    items.value = await getMinimarketItems();
  } catch (error: any) {
    console.error("Gagal memuat barang:", error);
    toast.error(error.message || "Gagal memuat daftar barang");
  } finally {
    loading.value = false;
  }
}

async function submitMutation() {
  if (rows.value.length === 0) {
    toast.error("Tambahkan minimal satu barang");
    return;
  }
  if (invalidRows.value.length > 0) {
    toast.error("Perbaiki qty yang melebihi stok gudang terlebih dahulu");
    return;
  }

  submitting.value = true;
  try {
    const result = await createStockMutation({
      items: rows.value.map((row) => ({
        item_id: row.itemId,
        qty_pcs: Number(row.qty),
      })),
      keterangan: keterangan.value.trim() || undefined,
    });

    successResult.value = result;
    rows.value = [];
    keterangan.value = "";
    toast.success(`Mutasi ${result.no_mutasi} berhasil dieksekusi`);
    await loadItems();
  } catch (error: any) {
    console.error("Gagal eksekusi mutasi:", error);
    toast.error(error.message || "Gagal eksekusi mutasi stok");
  } finally {
    submitting.value = false;
  }
}

onMounted(loadItems);
</script>
