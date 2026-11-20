<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (2.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Rekomendasi Belanja
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Daftar usulan pembelian otomatis dari perhitungan ROP. Pilih baris lalu konversi menjadi Purchase Order.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          size="sm"
          :disabled="selectedIds.length === 0"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          @click="isConvertDialogOpen = true"
        >
          <ShoppingCart class="w-4 h-4" />
          <span>Konversi ke PO ({{ selectedIds.length }})</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Siap Dipesan</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ convertibleRows.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Usulan menunggu diproses</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Lightbulb class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Stok Kritis</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{{ criticalCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Stok &le; batas ROP</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Dipilih</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ selectedIds.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Baris siap dikonversi</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <CheckSquare class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Estimasi Biaya</p>
            <h3 class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              Rp {{ formatNumber(totalEstimatedCost) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Seluruh rekomendasi</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Wallet class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nomor PR, nama barang, atau barcode..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="searchQuery = ''">Reset</Button>
        </div>
        <p class="text-xs text-slate-500 mt-2">
          Rekomendasi terbentuk otomatis dari barang yang terdaftar di Batasan Pemesanan Barang (ROP)
          dan berstatus selain "Aman". Barang yang sudah punya PO aktif tetap tampil, tetapi tidak bisa dikonversi.
        </p>
      </CardContent>
    </Card>

    <div
      v-if="waitingCount > 0"
      class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        {{ waitingCount }} barang berstatus non-Aman tidak dapat dikonversi karena masih memiliki PO aktif.
        Selesaikan atau batalkan PO tersebut terlebih dahulu.
      </p>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :disabled="selectableFilteredRows.length === 0"
                  class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  @change="toggleAll"
                />
              </th>
              <th class="px-4 py-3.5">No. PR &amp; Barang</th>
              <th class="px-4 py-3.5 text-center">Stok / ROP</th>
              <th class="px-4 py-3.5 text-center">Saran Beli</th>
              <th class="px-4 py-3.5">Supplier Rekomendasi</th>
              <th class="px-4 py-3.5 text-right">Estimasi Biaya</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredRows.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <Lightbulb class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada rekomendasi belanja</p>
                <p class="text-xs text-slate-400 mt-1">
                  Rekomendasi muncul saat barang yang terdaftar di Batasan Pemesanan Barang (ROP)
                  berstatus Perlu Restock atau Mendekati ROP dan Auto-PR-nya aktif.
                </p>
              </td>
            </tr>

            <template v-else>
              <template v-for="(row, index) in filteredRows" :key="row.id">
                <tr v-if="index === firstWaitingIndex" class="bg-amber-50/60 dark:bg-amber-950/20">
                  <td colspan="6" class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Sudah ada PO aktif &mdash; tidak dapat dikonversi
                  </td>
                </tr>
                <tr
                  class="transition-colors"
                  :class="[
                    row.can_convert ? 'hover:bg-slate-50/70 dark:hover:bg-slate-900/40' : 'opacity-80',
                    isSelected(row.id) ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : '',
                  ]"
                >
                  <td class="px-4 py-3.5">
                    <input
                      type="checkbox"
                      :checked="isSelected(row.id)"
                      :disabled="!row.can_convert"
                      :title="row.can_convert ? 'Pilih untuk dikonversi' : 'Barang masih memiliki PO aktif'"
                      class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      @change="toggleRow(row)"
                    />
                  </td>
                  <td class="px-4 py-3.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium text-slate-900 dark:text-white">{{ row.nama_barang }}</span>
                      <Badge
                        v-if="row.has_active_po"
                        variant="outline"
                        class="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30 text-[10px]"
                      >
                        Sudah ada PO{{ row.active_po?.no_po ? ` · ${row.active_po.no_po}` : "" }}
                      </Badge>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {{ row.no_pr }}
                      </span>
                      <span class="font-mono text-xs text-slate-400">{{ row.barcode }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <div>
                      <span :class="['font-semibold', row.rop_status === 'RESTOCK' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200']">
                        {{ formatNumber(row.stok_saat_ini_pcs) }}
                      </span>
                      <span class="text-xs text-slate-400"> / {{ formatNumber(row.rop_threshold_pcs) }} Pcs</span>
                    </div>
                    <Badge
                      v-if="row.rop_status === 'RESTOCK'"
                      variant="outline"
                      class="mt-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px]"
                    >
                      Perlu Restock
                    </Badge>
                    <Badge
                      v-else-if="row.rop_status === 'WARNING'"
                      variant="outline"
                      class="mt-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]"
                    >
                      Mendekati ROP
                    </Badge>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <div class="font-semibold">{{ formatNumber(row.qty_saran_beli) }} {{ row.satuan_beli }}</div>
                    <div class="text-xs text-slate-500">= {{ formatNumber(row.qty_saran_pcs) }} Pcs</div>
                  </td>
                  <td class="px-4 py-3.5">
                    <template v-if="row.supplier_rekomendasi">
                      <div>{{ row.supplier_rekomendasi.nama_supplier }}</div>
                      <div class="text-xs text-slate-500">
                        Rp {{ formatNumber(row.supplier_rekomendasi.harga_modal_pcs) }} / Pcs
                        <span v-if="row.supplier_rekomendasi.term_of_payment">
                          &middot; TOP {{ row.supplier_rekomendasi.term_of_payment }} hari
                        </span>
                      </div>
                    </template>
                    <span v-else class="text-xs text-amber-600 dark:text-amber-400">Belum ada katalog harga</span>
                  </td>
                  <td class="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    Rp {{ formatNumber(row.estimasi_biaya) }}
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
          <tfoot v-if="filteredRows.length > 0" class="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
            <tr>
              <td colspan="5" class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                Total estimasi ({{ filteredRows.length }} baris)
              </td>
              <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Rp {{ formatNumber(filteredTotalCost) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>

    <GlobalDialog
      v-model:open="isConvertDialogOpen"
      title="Konversi Rekomendasi ke Purchase Order"
      description="Baris dipilih akan dikelompokkan per supplier termurah. Setiap supplier memperoleh satu PO terpisah."
      type="info"
      content-class="max-w-lg"
    >
      <form class="space-y-4" @submit.prevent="submitConvert">
        <div class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm">
          <p class="font-semibold">{{ selectedIds.length }} baris dipilih</p>
          <p class="text-xs mt-1">Estimasi nilai: Rp {{ formatNumber(selectedTotalCost) }}</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estimasi Tanggal Tiba
          </label>
          <Input v-model="convertForm.tgl_estimasi_tiba" type="date" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan PO</label>
          <textarea
            v-model="convertForm.catatan"
            rows="2"
            placeholder="Contoh: kirim pagi sebelum jam 10"
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" @click="isConvertDialogOpen = false">Batal</Button>
          <Button type="submit" :disabled="isConverting || selectedIds.length === 0" class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
            <RefreshCw v-if="isConverting" class="w-4 h-4 animate-spin" />
            <span>Buat Purchase Order</span>
          </Button>
        </div>
      </form>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AlertTriangle, CheckSquare, Lightbulb, RefreshCw, Search, ShoppingCart, Wallet } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { convertAutoPrToPo, getAutoPrs, type AutoPrRow } from "./autoPrService";

const rows = ref<AutoPrRow[]>([]);
const loading = ref(false);
const isConverting = ref(false);
const searchQuery = ref("");
const selectedIds = ref<string[]>([]);

const isConvertDialogOpen = ref(false);
const convertForm = ref({
  tgl_estimasi_tiba: "",
  catatan: "",
});

const filteredRows = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return rows.value;
  return rows.value.filter((row) =>
    [row.no_pr, row.nama_barang, row.barcode].some((value) =>
      String(value || "").toLowerCase().includes(keyword),
    ),
  );
});

const convertibleRows = computed(() => rows.value.filter((row) => row.can_convert));
const waitingCount = computed(() => rows.value.filter((row) => !row.can_convert).length);
const selectableFilteredRows = computed(() => filteredRows.value.filter((row) => row.can_convert));
const firstWaitingIndex = computed(() => filteredRows.value.findIndex((row) => !row.can_convert));
const criticalCount = computed(() => rows.value.filter((row) => row.rop_status === "RESTOCK").length);
const totalEstimatedCost = computed(() =>
  rows.value.reduce((acc, row) => acc + Number(row.estimasi_biaya || 0), 0),
);
const selectedRows = computed(() => rows.value.filter((row) => selectedIds.value.includes(row.id)));
const selectedTotalCost = computed(() =>
  selectedRows.value.reduce((acc, row) => acc + Number(row.estimasi_biaya || 0), 0),
);
const allSelected = computed(
  () =>
    selectableFilteredRows.value.length > 0 &&
    selectableFilteredRows.value.every((row) => selectedIds.value.includes(row.id)),
);
const filteredTotalCost = computed(() =>
  filteredRows.value.reduce((acc, row) => acc + Number(row.estimasi_biaya || 0), 0),
);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function isSelected(id: string) {
  return selectedIds.value.includes(id);
}

function toggleRow(row: AutoPrRow) {
  if (!row.can_convert) return;
  selectedIds.value = isSelected(row.id)
    ? selectedIds.value.filter((value) => value !== row.id)
    : [...selectedIds.value, row.id];
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : selectableFilteredRows.value.map((row) => row.id);
}

async function load() {
  loading.value = true;
  try {
    rows.value = await getAutoPrs("PENDING");
    selectedIds.value = selectedIds.value.filter((id) =>
      rows.value.some((row) => row.id === id && row.can_convert),
    );
  } catch (error: any) {
    console.error("Gagal memuat rekomendasi belanja:", error);
    toast.error(error.message || "Gagal memuat rekomendasi belanja");
  } finally {
    loading.value = false;
  }
}

async function submitConvert() {
  if (selectedIds.value.length === 0) {
    toast.error("Pilih minimal satu rekomendasi");
    return;
  }

  isConverting.value = true;
  try {
    const created = await convertAutoPrToPo({
      pr_ids: selectedIds.value,
      tgl_estimasi_tiba: convertForm.value.tgl_estimasi_tiba || null,
      catatan: convertForm.value.catatan.trim() || null,
    });
    toast.success(
      created.length === 1 && created[0]
        ? `PO ${created[0].no_po} berhasil dibuat`
        : `${created.length} Purchase Order berhasil dibuat`,
    );
    isConvertDialogOpen.value = false;
    selectedIds.value = [];
    convertForm.value = { tgl_estimasi_tiba: "", catatan: "" };
    await load();
  } catch (error: any) {
    console.error("Gagal konversi ke PO:", error);
    toast.error(error.message || "Gagal membuat Purchase Order dari rekomendasi");
  } finally {
    isConverting.value = false;
  }
}

onMounted(load);
</script>
