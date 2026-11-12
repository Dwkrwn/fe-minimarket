<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (5.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Laporan Riwayat Pembelian</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Rekap belanja modal toko, potongan retur, pembayaran, dan sisa hutang supplier.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          :disabled="loading"
          @click="printReport"
        >
          <Printer class="w-4 h-4" />
          <span>Cetak</span>
        </Button>
      </div>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
      <CardContent class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dari Tanggal</label>
            <Input
              v-model="filters.startDate"
              type="date"
              class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sampai Tanggal</label>
            <Input
              v-model="filters.endDate"
              type="date"
              class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Supplier</label>
            <select
              v-model="filters.supplier_id"
              class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua supplier</option>
              <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                {{ supplier.nama_supplier }}
              </option>
            </select>
          </div>
          <div class="flex items-end gap-2">
            <Button
              size="sm"
              class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              :disabled="loading"
              @click="load"
            >
              <Search class="w-4 h-4" />
              <span>Terapkan</span>
            </Button>
            <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span class="text-[11px] font-semibold uppercase text-slate-400">Cepat:</span>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="applyPreset('month')">Bulan Ini</Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="applyPreset('last30')">30 Hari Terakhir</Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="applyPreset('today')">Hari Ini</Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="applyPreset('all')">Semua Periode</Button>
        </div>
      </CardContent>
    </Card>

    <div class="hidden print:block mb-2">
      <h1 class="text-xl font-bold text-black">Laporan Riwayat Pembelian</h1>
      <p class="text-sm text-black">Periode: {{ periodLabel }}</p>
      <p class="text-sm text-black">Supplier: {{ selectedSupplierName }}</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Nota</p>
          <p class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ summary.total_invoices }}</p>
          <p class="text-[11px] text-slate-400">nota terverifikasi</p>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Belanja Kotor</p>
          <p class="text-base font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">
            Rp {{ formatNumber(summary.total_belanja_kotor) }}
          </p>
          <p class="text-[11px] text-slate-400">nilai bukti masuk</p>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Potongan Retur</p>
          <p class="text-base font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
            -Rp {{ formatNumber(summary.total_potongan_retur) }}
          </p>
          <p class="text-[11px] text-slate-400">barang rusak / kembali</p>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tagihan Bersih</p>
          <p class="text-base font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            Rp {{ formatNumber(summary.total_tagihan_bersih) }}
          </p>
          <p class="text-[11px] text-slate-400">nilai yang dikunci</p>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Modal Terbayar</p>
          <p class="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            Rp {{ formatNumber(summary.total_uang_modal_terbayar) }}
          </p>
          <p class="text-[11px] text-slate-400">akumulasi pembayaran</p>
        </CardContent>
      </Card>

      <Card class="border-rose-200 dark:border-rose-900 shadow-xs bg-rose-50/50 dark:bg-rose-950/10">
        <CardContent class="p-3">
          <p class="text-[11px] font-medium text-rose-600 dark:text-rose-400">Sisa Hutang</p>
          <p class="text-base font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
            Rp {{ formatNumber(summary.sisa_hutang_modal) }}
          </p>
          <p class="text-[11px] text-rose-500/80">belum dibayar</p>
        </CardContent>
      </Card>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden print:border-0 print:shadow-none">
      <CardHeader class="pb-2 print:hidden">
        <CardTitle class="text-base">Rincian Riwayat Pembelian</CardTitle>
        <CardDescription>{{ periodLabel }} &middot; {{ selectedSupplierName }}</CardDescription>
      </CardHeader>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300 print:text-black">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800 print:bg-white print:text-black">
            <tr>
              <th class="px-4 py-3">No. Nota / PO</th>
              <th class="px-4 py-3">Supplier</th>
              <th class="px-4 py-3">Tanggal</th>
              <th class="px-4 py-3 text-right">Belanja Kotor</th>
              <th class="px-4 py-3 text-right">Potongan</th>
              <th class="px-4 py-3 text-right">Tagihan Bersih</th>
              <th class="px-4 py-3 text-right">Terbayar</th>
              <th class="px-4 py-3 text-right">Sisa</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n" class="print:hidden">
                <td colspan="9" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="rows.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-slate-500">
                <History class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada riwayat pembelian</p>
                <p class="text-xs text-slate-400 mt-1">
                  Coba ubah rentang tanggal, atau verifikasi nota pada 4.1 terlebih dahulu.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in rows"
              :key="`${row.no_invoice}-${row.no_po}`"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors print:hover:bg-white"
            >
              <td class="px-4 py-3">
                <div class="font-mono font-semibold text-slate-900 dark:text-white print:text-black">{{ row.no_invoice }}</div>
                <div class="font-mono text-[11px] text-slate-500 print:text-black">{{ row.no_po }}</div>
              </td>
              <td class="px-4 py-3">{{ row.supplier }}</td>
              <td class="px-4 py-3 text-xs">{{ formatDate(row.tgl_invoice) }}</td>
              <td class="px-4 py-3 text-right font-mono">Rp {{ formatNumber(row.gross_amount) }}</td>
              <td class="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 print:text-black">
                -Rp {{ formatNumber(row.return_deduction) }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400 print:text-black">
                Rp {{ formatNumber(row.net_payable) }}
              </td>
              <td class="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 print:text-black">
                Rp {{ formatNumber(row.total_paid) }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 print:text-black">
                Rp {{ formatNumber(row.remaining) }}
              </td>
              <td class="px-4 py-3 text-center">
                <Badge variant="outline" :class="statusClass(row.status)">{{ row.status_label }}</Badge>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="rows.length > 0" class="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 print:bg-white print:text-black">
            <tr>
              <td colspan="3" class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 print:text-black">
                Total ({{ summary.total_invoices }} nota)
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold">Rp {{ formatNumber(summary.total_belanja_kotor) }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 print:text-black">
                -Rp {{ formatNumber(summary.total_potongan_retur) }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 print:text-black">
                Rp {{ formatNumber(summary.total_tagihan_bersih) }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 print:text-black">
                Rp {{ formatNumber(summary.total_uang_modal_terbayar) }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 print:text-black">
                Rp {{ formatNumber(summary.sisa_hutang_modal) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { History, Printer, RefreshCw, Search } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSuppliers, type Supplier } from "../../master/suppliers/supplierService";
import {
  emptySummary,
  getPurchaseHistoryReport,
  type PurchaseHistoryRow,
  type PurchaseHistorySummary,
} from "./purchaseReportService";

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstDayOfMonth() {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

const suppliers = ref<Supplier[]>([]);
const rows = ref<PurchaseHistoryRow[]>([]);
const summary = ref<PurchaseHistorySummary>(emptySummary());
const loading = ref(false);

const filters = ref({
  startDate: firstDayOfMonth(),
  endDate: toDateInput(new Date()),
  supplier_id: "",
});

const periodLabel = computed(() => {
  if (!filters.value.startDate && !filters.value.endDate) return "Semua periode";
  if (filters.value.startDate && filters.value.endDate) {
    return `${formatDate(filters.value.startDate)} s.d. ${formatDate(filters.value.endDate)}`;
  }
  if (filters.value.startDate) return `Sejak ${formatDate(filters.value.startDate)}`;
  return `Sampai ${formatDate(filters.value.endDate)}`;
});

const selectedSupplierName = computed(() => {
  if (!filters.value.supplier_id) return "Semua supplier";
  return (
    suppliers.value.find((supplier) => supplier.id === filters.value.supplier_id)?.nama_supplier ||
    "Semua supplier"
  );
});

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: string) {
  if (status === "PAID") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
  if (status === "PARTIAL") {
    return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
  }
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
}

function applyPreset(preset: "month" | "last30" | "today" | "all") {
  const now = new Date();
  if (preset === "all") {
    filters.value.startDate = "";
    filters.value.endDate = "";
  } else if (preset === "today") {
    filters.value.startDate = toDateInput(now);
    filters.value.endDate = toDateInput(now);
  } else if (preset === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    filters.value.startDate = toDateInput(start);
    filters.value.endDate = toDateInput(now);
  } else {
    filters.value.startDate = firstDayOfMonth();
    filters.value.endDate = toDateInput(now);
  }
  load();
}

function resetFilter() {
  filters.value = {
    startDate: firstDayOfMonth(),
    endDate: toDateInput(new Date()),
    supplier_id: "",
  };
  load();
}

function printReport() {
  window.print();
}

async function loadSuppliers() {
  try {
    suppliers.value = await getSuppliers();
  } catch (error) {
    console.error("Gagal memuat supplier untuk laporan:", error);
  }
}

async function load() {
  if (filters.value.startDate && filters.value.endDate && filters.value.startDate > filters.value.endDate) {
    toast.error("Tanggal awal tidak boleh melebihi tanggal akhir");
    return;
  }

  loading.value = true;
  try {
    const report = await getPurchaseHistoryReport({
      startDate: filters.value.startDate || undefined,
      endDate: filters.value.endDate || undefined,
      supplier_id: filters.value.supplier_id || undefined,
    });
    rows.value = report.data || [];
    summary.value = report.summary || emptySummary();
  } catch (error: any) {
    console.error("Gagal memuat laporan pembelian:", error);
    toast.error(error.message || "Gagal memuat laporan riwayat pembelian");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadSuppliers();
  await load();
});
</script>
