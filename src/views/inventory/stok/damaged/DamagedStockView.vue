<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (2.3)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Barang Rusak / Hilang
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Catat temuan barang rusak atau hilang, potong stok sesuai lokasi, dan terbitkan nota retur pemasok
          sekaligus untuk temuan dari supplier.
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
          :disabled="loading || filteredRows.length === 0"
          class="flex items-center gap-1.5"
          @click="exportCsv"
        >
          <Download class="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
        <Button
          size="sm"
          class="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
          @click="openReportModal"
        >
          <Plus class="w-4 h-4" />
          <span>Laporkan Temuan</span>
        </Button>
      </div>
    </div>

    <!-- Warning from previous report (retur gagal) -->
    <div
      v-if="lastWarning"
      class="flex items-start justify-between gap-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300"
    >
      <div class="flex items-start gap-2">
        <TriangleAlert class="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          <strong>{{ lastWarning.no_damaged }}</strong> tercatat, tetapi nota retur pemasok tidak terbit.
          <span class="block text-xs mt-1">{{ lastWarning.message }}</span>
        </p>
      </div>
      <button type="button" class="text-rose-500 hover:text-rose-700 shrink-0" title="Tutup" @click="lastWarning = null">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Laporan</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ filteredRows.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Sesuai filter aktif</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <ClipboardList class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Qty</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {{ totalQty.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Stok yang dipotong</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <PackageX class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Kerugian Internal</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {{ internalQty.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">INTERNAL_LOSS</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Ban class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Retur Pemasok</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {{ supplierQty.toLocaleString("id-ID") }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">SUPPLIER_RETURN</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Truck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div class="xl:col-span-2 relative">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nama barang / barcode / no. laporan..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="loadDamaged"
            />
          </div>

          <select
            v-model="kategoriFilter"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Kategori</option>
            <option value="INTERNAL_LOSS">Kerugian Internal</option>
            <option value="SUPPLIER_RETURN">Retur Pemasok</option>
          </select>

          <select
            v-model="statusFilter"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Status</option>
            <option value="WRITTEN_OFF">Ditulis-off</option>
            <option value="RETURNED_TO_SUPPLIER">Diretur ke Pemasok</option>
            <option value="RECORDED">Tercatat</option>
          </select>

          <select
            v-model="locationFilter"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Lokasi</option>
            <option value="RAK">Rak Pajangan</option>
            <option value="GUDANG">Gudang</option>
          </select>

          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="loading" @click="loadDamaged">Terapkan</Button>
            <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilters">Reset</Button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-1">Dari Tanggal</label>
            <Input v-model="startDate" type="date" class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-1">Sampai Tanggal</label>
            <Input v-model="endDate" type="date" class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
          <p class="text-[11px] text-slate-500 leading-snug">
            Filter lokasi dan tanggal dihitung di sisi klien karena endpoint laporan belum menerima parameter tersebut.
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. Laporan</th>
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5 text-center">Lokasi</th>
              <th class="px-4 py-3.5 text-center">Qty</th>
              <th class="px-4 py-3.5">Kategori</th>
              <th class="px-4 py-3.5">Alasan</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5">Pelapor</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 5" :key="'skel-' + n">
                <td colspan="8" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredRows.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-slate-500">
                <PackageX class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada laporan barang rusak</p>
                <p class="text-xs text-slate-400 mt-1">
                  Klik "Laporkan Temuan" saat menemukan barang rusak, cacat, atau hilang.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in filteredRows"
              :key="row.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors align-top"
            >
              <td class="px-4 py-3.5 whitespace-nowrap">
                <div class="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                  {{ row.no_damaged }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">{{ formatDate(row.createdAt) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">
                  {{ row.item?.nama_barang || "-" }}
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {{ row.item?.barcode || "-" }}
                  </span>
                  <span class="text-[11px] text-slate-400">
                    {{ row.category_rack?.nama || "Tanpa kategori" }}
                  </span>
                </div>
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
              <td class="px-4 py-3.5 text-center font-mono font-semibold text-rose-600 dark:text-rose-400">
                -{{ Number(row.qty_pcs).toLocaleString("id-ID") }}
                <div class="text-[11px] font-normal text-slate-400">Pcs</div>
              </td>
              <td class="px-4 py-3.5">
                <Badge variant="outline" :class="categoryClass(row.kategori)">
                  {{ categoryLabel(row.kategori) }}
                </Badge>
              </td>
              <td class="px-4 py-3.5">
                <div class="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {{ reasonLabel(row.alasan) }}
                </div>
                <p
                  v-if="row.catatan"
                  class="text-[11px] text-slate-500 max-w-[220px] truncate mt-0.5"
                  :title="row.catatan"
                >
                  {{ row.catatan }}
                </p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(row.status)">
                  {{ statusLabel(row.status) }}
                </Badge>
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs text-slate-600 dark:text-slate-300">
                  {{ row.user?.name || "Sistem" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-slate-500">
          Menampilkan {{ filteredRows.length }} dari {{ rows.length }} laporan
          <span v-if="hasClientFilter"> (filter lokasi/tanggal aktif)</span>
        </p>
        <div class="flex items-center gap-3 text-xs text-slate-500">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span> Kerugian internal
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-indigo-500"></span> Retur pemasok
          </span>
        </div>
      </div>
    </Card>

    <!-- Report dialog -->
    <GlobalDialog
      v-model:open="isReportOpen"
      title="Laporkan Barang Rusak / Hilang"
      description="Stok pada lokasi terpilih akan langsung dipotong dan tercatat di kartu stok."
      :show-cancel="false"
      content-class="max-w-2xl"
    >
      <form class="space-y-4" @submit.prevent="submitReport">
        <div>
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
            v-model="form.item_id"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Pilih barang...</option>
            <option v-for="item in filteredItemOptions" :key="item.id" :value="item.id">
              {{ item.nama_barang }} ({{ item.barcode }}) &middot; {{ form.location }}:
              {{ itemStock(item.id).toLocaleString("id-ID") }} Pcs
            </option>
          </select>
          <p class="text-[11px] text-slate-500 mt-1">
            Stok {{ form.location }} saat ini:
            <strong class="font-mono">{{ availableStock.toLocaleString("id-ID") }} Pcs</strong>
            <span v-if="selectedItem?.uom"> &middot; satuan {{ selectedItem.uom.satuan_dasar || selectedItem.uom.nama_uom }}</span>
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lokasi <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="form.location"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="RAK">Rak Pajangan</option>
              <option value="GUDANG">Gudang</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Qty (Pcs) <span class="text-rose-500">*</span>
            </label>
            <input
              v-model.number="form.qty_pcs"
              type="number"
              min="1"
              :max="availableStock"
              inputmode="numeric"
              class="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p v-if="qtyError" class="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{{ qtyError }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kategori <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="form.kategori"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="INTERNAL_LOSS">Kerugian Internal</option>
              <option value="SUPPLIER_RETURN">Retur Pemasok</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alasan <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="form.alasan"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="RUSAK_KEMASAN">Rusak Kemasan</option>
              <option value="CACAT_PABRIK">Cacat Pabrik</option>
              <option value="HILANG">Hilang</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
            <Input
              v-model="form.catatan"
              placeholder="Detail temuan (opsional)"
              class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        <!-- PO untuk retur pemasok -->
        <div v-if="form.kategori === 'SUPPLIER_RETURN'" class="rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 space-y-2">
          <div class="flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-300">
            <Truck class="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Pilih PO asal barang untuk menerbitkan <strong>nota retur pemasok</strong> otomatis.
              PO harus sudah memiliki penerimaan barang bagus dan belum ber-invoice.
            </p>
          </div>

          <select
            v-model="form.po_id"
            :disabled="!form.item_id || poLoading"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Tanpa nota retur (catat sebagai temuan)</option>
            <option v-for="po in returnablePos" :key="po.id" :value="po.id">
              {{ po.no_po }} &middot; {{ po.supplier?.nama_supplier || "Supplier" }} &middot; {{ po.status }}
            </option>
          </select>

          <p v-if="!form.item_id" class="text-[11px] text-indigo-700 dark:text-indigo-300">
            Pilih barang terlebih dahulu untuk melihat PO yang memuat barang ini.
          </p>
          <p v-else-if="poLoading" class="text-[11px] text-indigo-700 dark:text-indigo-300">Memuat daftar PO...</p>
          <p v-else-if="poError" class="text-[11px] text-rose-600 dark:text-rose-400">{{ poError }}</p>
          <p v-else-if="returnablePos.length === 0" class="text-[11px] text-indigo-700 dark:text-indigo-300">
            Tidak ada PO dengan penerimaan untuk barang ini. Laporan tetap bisa disimpan tanpa nota retur.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" :disabled="submitting" @click="isReportOpen = false">Batal</Button>
          <Button
            type="submit"
            :disabled="!canSubmitReport"
            class="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
          >
            <RefreshCw v-if="submitting" class="w-4 h-4 animate-spin" />
            <PackageX v-else class="w-4 h-4" />
            <span>{{ submitting ? "Memproses..." : "Simpan & Potong Stok" }}</span>
          </Button>
        </div>
      </form>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  Ban,
  ClipboardList,
  Download,
  PackageX,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  Truck,
  X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import {
  getMinimarketItems,
  type MinimarketItem,
} from "../../master/m_items/minimarketItemService";
import {
  createDamagedReport,
  getDamagedStocks,
  getReturnablePurchaseOrders,
  type CreateDamagedReportPayload,
  type DamagedCategory,
  type DamagedLocation,
  type DamagedReason,
  type DamagedStatus,
  type DamagedStockRow,
  type PurchaseOrderOption,
} from "./damagedStockService";

const rows = ref<DamagedStockRow[]>([]);
const items = ref<MinimarketItem[]>([]);
const loading = ref(false);

const searchQuery = ref("");
const kategoriFilter = ref<"" | DamagedCategory>("");
const statusFilter = ref<"" | DamagedStatus>("");
const locationFilter = ref<"" | DamagedLocation>("");
const startDate = ref("");
const endDate = ref("");

const isReportOpen = ref(false);
const submitting = ref(false);
const itemSearch = ref("");
const lastWarning = ref<{ no_damaged: string; message: string } | null>(null);

const form = ref({
  item_id: "",
  location: "RAK" as DamagedLocation,
  qty_pcs: 1 as number | string,
  kategori: "INTERNAL_LOSS" as DamagedCategory,
  alasan: "RUSAK_KEMASAN" as DamagedReason,
  catatan: "",
  po_id: "",
});

const poOptions = ref<PurchaseOrderOption[]>([]);
const poLoading = ref(false);
const poError = ref("");

const isDocumentQuery = computed(() => /^[A-Za-z]{2,6}-/.test(searchQuery.value.trim()));

const filteredRows = computed(() => {
  const from = startDate.value ? new Date(`${startDate.value}T00:00:00`) : null;
  const to = endDate.value ? new Date(`${endDate.value}T23:59:59.999`) : null;

  const keyword = searchQuery.value.trim().toLowerCase();

  return rows.value.filter((row) => {
    if (locationFilter.value && row.location !== locationFilter.value) return false;

    // Pencarian nomor laporan (mis. DMG-…) dilakukan di klien karena
    // endpoint hanya mencari nama/barcode barang.
    if (isDocumentQuery.value && keyword && !row.no_damaged.toLowerCase().includes(keyword)) {
      return false;
    }

    const created = new Date(row.createdAt);
    if (!Number.isNaN(created.getTime())) {
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    return true;
  });
});

const hasClientFilter = computed(
  () => !!locationFilter.value || !!startDate.value || !!endDate.value,
);

const totalQty = computed(() =>
  filteredRows.value.reduce((sum, row) => sum + (Number(row.qty_pcs) || 0), 0),
);

const internalQty = computed(() =>
  filteredRows.value
    .filter((row) => row.kategori === "INTERNAL_LOSS")
    .reduce((sum, row) => sum + (Number(row.qty_pcs) || 0), 0),
);

const supplierQty = computed(() =>
  filteredRows.value
    .filter((row) => row.kategori === "SUPPLIER_RETURN")
    .reduce((sum, row) => sum + (Number(row.qty_pcs) || 0), 0),
);

const selectedItem = computed(() =>
  items.value.find((item) => item.id === form.value.item_id),
);

function itemStockAt(itemId: string, location: DamagedLocation): number {
  const item = items.value.find((entry) => entry.id === itemId);
  const stock = item?.stocks?.find((entry) => entry.location === location);
  return stock ? Number(stock.qty) || 0 : 0;
}

function itemStock(itemId: string): number {
  return itemStockAt(itemId, form.value.location);
}

const availableStock = computed(() => itemStockAt(form.value.item_id, form.value.location));

const filteredItemOptions = computed(() => {
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

const qtyError = computed(() => {
  if (!form.value.item_id) return "";
  const qty = Number(form.value.qty_pcs);
  if (!Number.isFinite(qty) || qty <= 0) return "Qty harus lebih dari 0";
  if (!Number.isInteger(qty)) return "Qty harus bilangan bulat";
  if (qty > availableStock.value) {
    return `Stok ${form.value.location} tidak mencukupi (tersedia ${availableStock.value.toLocaleString("id-ID")} Pcs)`;
  }
  return "";
});

const canSubmitReport = computed(
  () =>
    !submitting.value &&
    !!form.value.item_id &&
    !!form.value.kategori &&
    !!form.value.alasan &&
    !qtyError.value,
);

const returnablePos = computed(() => {
  if (!form.value.item_id) return [];
  return poOptions.value.filter((po) => {
    if (po.status === "CANCELLED") return false;
    if ((po.goods_receipts?.length || 0) === 0) return false;
    return (po.details || []).some((detail) => detail.item_id === form.value.item_id);
  });
});

const CATEGORY_LABELS: Record<string, string> = {
  INTERNAL_LOSS: "Kerugian Internal",
  SUPPLIER_RETURN: "Retur Pemasok",
};

const STATUS_LABELS: Record<string, string> = {
  WRITTEN_OFF: "Ditulis-off",
  RETURNED_TO_SUPPLIER: "Diretur ke Pemasok",
  RECORDED: "Tercatat",
};

const REASON_LABELS: Record<string, string> = {
  RUSAK_KEMASAN: "Rusak Kemasan",
  CACAT_PABRIK: "Cacat Pabrik",
  HILANG: "Hilang",
};

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] || value;
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value] || value;
}

function reasonLabel(value: string): string {
  return REASON_LABELS[value] || value;
}

function categoryClass(value: string): string {
  if (value === "SUPPLIER_RETURN") {
    return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
  }
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
}

function statusClass(value: string): string {
  if (value === "RETURNED_TO_SUPPLIER") {
    return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
  }
  if (value === "WRITTEN_OFF") {
    return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
  return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadDamaged() {
  loading.value = true;
  try {
    rows.value = await getDamagedStocks({
      kategori: kategoriFilter.value || undefined,
      status: statusFilter.value || undefined,
      search: isDocumentQuery.value ? undefined : searchQuery.value,
    });
  } catch (error: any) {
    console.error("Gagal memuat laporan barang rusak:", error);
    toast.error(error.message || "Gagal memuat laporan barang rusak");
  } finally {
    loading.value = false;
  }
}

async function loadItems() {
  try {
    items.value = await getMinimarketItems();
  } catch (error: any) {
    console.error("Gagal memuat daftar barang:", error);
    toast.error(error.message || "Gagal memuat daftar barang");
  }
}

async function loadPurchaseOrders() {
  poLoading.value = true;
  poError.value = "";
  try {
    poOptions.value = await getReturnablePurchaseOrders();
  } catch (error: any) {
    console.error("Gagal memuat purchase order:", error);
    poError.value = error.message || "Gagal memuat daftar PO";
    poOptions.value = [];
  } finally {
    poLoading.value = false;
  }
}

async function loadData() {
  await Promise.all([loadDamaged(), loadItems()]);
}

function resetFilters() {
  searchQuery.value = "";
  kategoriFilter.value = "";
  statusFilter.value = "";
  locationFilter.value = "";
  startDate.value = "";
  endDate.value = "";
  loadDamaged();
}

function openReportModal() {
  form.value = {
    item_id: "",
    location: "RAK",
    qty_pcs: 1,
    kategori: "INTERNAL_LOSS",
    alasan: "RUSAK_KEMASAN",
    catatan: "",
    po_id: "",
  };
  itemSearch.value = "";
  isReportOpen.value = true;

  if (poOptions.value.length === 0) loadPurchaseOrders();
}

async function submitReport() {
  if (!canSubmitReport.value) return;

  submitting.value = true;
  try {
    const payload: CreateDamagedReportPayload = {
      item_id: form.value.item_id,
      location: form.value.location,
      qty_pcs: Number(form.value.qty_pcs),
      kategori: form.value.kategori,
      alasan: form.value.alasan,
      catatan: form.value.catatan.trim() || undefined,
    };

    if (form.value.kategori === "SUPPLIER_RETURN" && form.value.po_id) {
      payload.po_id = form.value.po_id;
    }

    const result = await createDamagedReport(payload);
    isReportOpen.value = false;

    if (result.purchase_return_error) {
      lastWarning.value = {
        no_damaged: result.damaged.no_damaged,
        message: result.purchase_return_error,
      };
      toast.warning(`${result.damaged.no_damaged} tercatat, nota retur gagal diterbitkan`);
    } else if (result.purchaseReturn) {
      toast.success(
        `${result.damaged.no_damaged} tercatat & nota retur ${result.purchaseReturn.no_retur} terbit`,
      );
    } else {
      toast.success(`${result.damaged.no_damaged} tercatat, stok sudah dipotong`);
    }

    await loadData();
    loadPurchaseOrders();
  } catch (error: any) {
    console.error("Gagal menyimpan laporan barang rusak:", error);
    toast.error(error.message || "Gagal menyimpan laporan barang rusak");
  } finally {
    submitting.value = false;
  }
}

function exportCsv() {
  if (filteredRows.value.length === 0) {
    toast.error("Tidak ada data untuk diexport");
    return;
  }

  const header = [
    "No Laporan",
    "Tanggal",
    "Nama Barang",
    "Barcode",
    "Lokasi",
    "Qty (Pcs)",
    "Kategori",
    "Alasan",
    "Status",
    "Pelapor",
    "Catatan",
  ];

  const data = filteredRows.value.map((row) => [
    row.no_damaged,
    formatDate(row.createdAt),
    row.item?.nama_barang || "-",
    row.item?.barcode || "-",
    row.location,
    String(row.qty_pcs),
    categoryLabel(row.kategori),
    reasonLabel(row.alasan),
    statusLabel(row.status),
    row.user?.name || "Sistem",
    row.catatan || "",
  ]);

  const csv = [header, ...data]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `barang-rusak-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Laporan barang rusak berhasil diexport");
}

watch(
  () => form.value.kategori,
  (value) => {
    if (value !== "SUPPLIER_RETURN") {
      form.value.po_id = "";
    }
  },
);

watch(
  () => form.value.item_id,
  () => {
    form.value.po_id = "";
  },
);

watch(
  () => form.value.location,
  () => {
    form.value.po_id = "";
  },
);

onMounted(async () => {
  await loadData();
});
</script>
