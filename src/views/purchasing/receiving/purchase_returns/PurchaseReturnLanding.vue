<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (3.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Retur Pembelian</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pengembalian barang rusak/expired ke supplier dan penerbitan nota potong tagihan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canCreate"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push('/purchasing/receiving/purchase-returns/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Buat Retur</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Retur</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ returns.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Dokumen nota potong</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <PackageX class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Potongan</p>
            <h3 class="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">Rp {{ formatNumber(totalPotongan) }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Nilai tagihan dikurangi</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <Scissors class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Qty Diretur</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {{ formatNumber(totalQty) }} <span class="text-sm font-normal">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Akumulasi seluruh retur</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Boxes class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier Terlibat</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ uniqueSupplierCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Pemasok penerima retur</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Truck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <select
            v-model="statusFilter"
            class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-56"
            @change="load"
          >
            <option value="">Semua status</option>
            <option value="ISSUED">Terbit</option>
            <option value="MATCHED_INVOICE">Dipotong ke Invoice</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
          <select
            v-model="supplierFilter"
            class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-64"
            @change="load"
          >
            <option value="">Semua supplier</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.nama_supplier }}
            </option>
          </select>
          <Button variant="outline" size="sm" :disabled="loading" @click="load">Terapkan</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. Retur &amp; Tanggal</th>
              <th class="px-4 py-3.5">PO / Supplier</th>
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5 text-center">Qty Retur</th>
              <th class="px-4 py-3.5 text-right">Potongan</th>
              <th class="px-4 py-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="returns.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <PackageX class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada retur pembelian</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canCreate ? 'Klik "+ Buat Retur" untuk mengembalikan barang rusak ke supplier.' : 'Belum ada barang yang diretur.' }}
                </p>
              </td>
            </tr>

            <tr v-else v-for="ret in returns" :key="ret.id" class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ ret.no_retur }}</div>
                <div class="text-xs text-slate-500">{{ formatDate(ret.tgl_retur) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="font-mono text-xs">{{ ret.po?.no_po || "-" }}</div>
                <div class="text-xs text-slate-500">{{ ret.supplier?.nama_supplier || "-" }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="text-xs">
                  {{ ret.details?.[0]?.item?.nama_barang || "-" }}
                  <span v-if="(ret.details?.length ?? 0) > 1" class="text-slate-400">
                    +{{ (ret.details?.length ?? 1) - 1 }} lainnya
                  </span>
                </div>
                <div v-if="ret.catatan" class="text-[11px] text-slate-400 truncate max-w-[220px]">{{ ret.catatan }}</div>
              </td>
              <td class="px-4 py-3.5 text-center font-semibold">
                {{ formatNumber(totalQtyOf(ret)) }} <span class="text-xs text-slate-400">Pcs</span>
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                Rp {{ formatNumber(ret.total_potongan) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(ret.status)">{{ statusLabel(ret.status) }}</Badge>
                <div class="text-[11px] text-slate-400 mt-1">{{ ret.user?.name || "-" }}</div>
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
import { useRouter } from "vue-router";
import { Boxes, PackageX, Plus, RefreshCw, Scissors, Truck } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import { getSuppliers, type Supplier } from "../../master/suppliers/supplierService";
import { getPurchaseReturns, type PurchaseReturn } from "./purchaseReturnService";

const router = useRouter();
const authStore = useAuthStore();
const canCreate = computed(() => authStore.isManager || authStore.user?.role.system_key === "GUDANG");

const returns = ref<PurchaseReturn[]>([]);
const suppliers = ref<Supplier[]>([]);
const loading = ref(false);
const statusFilter = ref("");
const supplierFilter = ref("");

const totalPotongan = computed(() =>
  returns.value.reduce((acc, ret) => acc + Number(ret.total_potongan || 0), 0),
);
const totalQty = computed(() =>
  returns.value.reduce((acc, ret) => acc + totalQtyOf(ret), 0),
);
const uniqueSupplierCount = computed(
  () => new Set(returns.value.map((ret) => ret.supplier_id).filter(Boolean)).size,
);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function totalQtyOf(ret: PurchaseReturn) {
  return (ret.details || []).reduce((acc, row) => acc + Number(row.qty_pcs || 0), 0);
}

function statusLabel(status: string) {
  if (status === "MATCHED_INVOICE") return "Dipotong ke Invoice";
  if (status === "CANCELLED") return "Dibatalkan";
  return "Terbit";
}

function statusClass(status: string) {
  if (status === "MATCHED_INVOICE") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  if (status === "CANCELLED") return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
}

async function load() {
  loading.value = true;
  try {
    returns.value = await getPurchaseReturns({
      status: statusFilter.value || undefined,
      supplier_id: supplierFilter.value || undefined,
    });
  } catch (error: any) {
    console.error("Gagal memuat retur pembelian:", error);
    toast.error(error.message || "Gagal memuat data retur pembelian");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    suppliers.value = await getSuppliers();
  } catch (error) {
    console.error("Gagal memuat supplier:", error);
  }
}

function resetFilter() {
  statusFilter.value = "";
  supplierFilter.value = "";
  load();
}

onMounted(async () => {
  await loadSuppliers();
  await load();
});
</script>
