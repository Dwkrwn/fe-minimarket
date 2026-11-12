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
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Rekomendasi Pending</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ rows.length }}</h3>
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
          Rekomendasi terbentuk otomatis saat stok menyentuh batas ROP (modul Inventory). Halaman ini tidak membuat usulan baru.
        </p>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :disabled="filteredRows.length === 0"
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
                  Rekomendasi muncul saat ada barang yang stoknya menyentuh batas ROP.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in filteredRows"
              :key="row.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
              :class="isSelected(row.id) ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''"
            >
              <td class="px-4 py-3.5">
                <input
                  type="checkbox"
                  :checked="isSelected(row.id)"
                  class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  @change="toggleRow(row.id)"
                />
              </td>
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ row.nama_barang }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {{ row.no_pr }}
                  </span>
                  <span class="font-mono text-xs text-slate-400">{{ row.barcode }}</span>
                </div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span :class="['font-semibold', row.peringatan_merah ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200']">
                  {{ formatNumber(row.stok_saat_ini_pcs) }}
                </span>
                <span class="text-xs text-slate-400"> / {{ formatNumber(row.rop_threshold_pcs) }} Pcs</span>
                <Badge
                  v-if="row.peringatan_merah"
                  variant="outline"
                  class="ml-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px]"
                >
                  Kritis
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

const criticalCount = computed(() => rows.value.filter((row) => row.peringatan_merah).length);
const totalEstimatedCost = computed(() =>
  rows.value.reduce((acc, row) => acc + Number(row.estimasi_biaya || 0), 0),
);
const selectedRows = computed(() => rows.value.filter((row) => selectedIds.value.includes(row.id)));
const selectedTotalCost = computed(() =>
  selectedRows.value.reduce((acc, row) => acc + Number(row.estimasi_biaya || 0), 0),
);
const allSelected = computed(
  () => filteredRows.value.length > 0 && filteredRows.value.every((row) => selectedIds.value.includes(row.id)),
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

function toggleRow(id: string) {
  selectedIds.value = isSelected(id)
    ? selectedIds.value.filter((value) => value !== id)
    : [...selectedIds.value, id];
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : filteredRows.value.map((row) => row.id);
}

async function load() {
  loading.value = true;
  try {
    rows.value = await getAutoPrs("PENDING");
    selectedIds.value = selectedIds.value.filter((id) => rows.value.some((row) => row.id === id));
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
