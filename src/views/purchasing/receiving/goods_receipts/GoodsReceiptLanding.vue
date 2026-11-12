<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (3.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Penerimaan Barang</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Verifikasi barang datang dari supplier. Qty bagus langsung menambah stok gudang.
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
          @click="router.push('/purchasing/receiving/goods-receipts/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Terima Barang</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Penerimaan</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ receipts.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Dokumen GR</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <PackagePlus class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Qty Bagus Masuk</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {{ formatNumber(totalGoodPcs) }} <span class="text-sm font-normal">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Menambah stok gudang</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <PackageCheck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Qty Ditolak</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {{ formatNumber(totalRejectedPcs) }} <span class="text-sm font-normal">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Tidak masuk stok</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <PackageX class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier Terlibat</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ uniqueSupplierCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Pemasok dengan GR</p>
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
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nomor GR, surat jalan, PO, atau supplier..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="load"
            />
          </div>
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
          <Button variant="outline" size="sm" :disabled="loading" @click="load">Cari</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. GR &amp; Tanggal</th>
              <th class="px-4 py-3.5">PO / Supplier</th>
              <th class="px-4 py-3.5">Surat Jalan</th>
              <th class="px-4 py-3.5 text-center">Barang</th>
              <th class="px-4 py-3.5 text-center">Qty Bagus</th>
              <th class="px-4 py-3.5 text-center">Ditolak</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="7" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="receipts.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-slate-500">
                <PackagePlus class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada penerimaan barang</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canCreate ? 'Klik "+ Terima Barang" untuk mencatat barang datang.' : 'Belum ada barang masuk yang dicatat.' }}
                </p>
              </td>
            </tr>

            <tr v-else v-for="receipt in receipts" :key="receipt.id" class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ receipt.no_gr }}</div>
                <div class="text-xs text-slate-500">{{ formatDate(receipt.tgl_gr) }}</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="font-mono text-xs">{{ receipt.po?.no_po || "-" }}</div>
                <div class="text-xs text-slate-500">{{ receipt.po?.supplier?.nama_supplier || "-" }}</div>
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs font-mono">{{ receipt.no_surat_jalan || "-" }}</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span class="font-semibold">{{ receipt.total_item ?? receipt.details?.length ?? 0 }}</span>
                <span class="text-xs text-slate-400"> item</span>
              </td>
              <td class="px-4 py-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                {{ formatNumber(receipt.total_qty_bagus_pcs ?? sumGood(receipt)) }}
              </td>
              <td class="px-4 py-3.5 text-center" :class="(receipt.total_qty_ditolak_pcs ?? sumRejected(receipt)) > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-400'">
                {{ formatNumber(receipt.total_qty_ditolak_pcs ?? sumRejected(receipt)) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Detail penerimaan"
                    @click="router.push(`/purchasing/receiving/goods-receipts/view/${receipt.id}`)"
                  >
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Buka PO"
                    @click="router.push(`/purchasing/order/purchase-orders/view/${receipt.po_id}`)"
                  >
                    <ClipboardList class="w-4 h-4" />
                  </Button>
                </div>
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
import {
  ClipboardList,
  Eye,
  PackageCheck,
  PackagePlus,
  PackageX,
  Plus,
  RefreshCw,
  Search,
  Truck,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import { getSuppliers, type Supplier } from "../../master/suppliers/supplierService";
import { getGoodsReceipts, type GoodsReceipt } from "./goodsReceiptService";

const router = useRouter();
const authStore = useAuthStore();
const canCreate = computed(() => authStore.isManager || authStore.user?.role.system_key === "GUDANG");

const receipts = ref<GoodsReceipt[]>([]);
const suppliers = ref<Supplier[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const supplierFilter = ref("");

const totalGoodPcs = computed(() =>
  receipts.value.reduce((acc, receipt) => acc + Number(receipt.total_qty_bagus_pcs ?? sumGood(receipt)), 0),
);
const totalRejectedPcs = computed(() =>
  receipts.value.reduce((acc, receipt) => acc + Number(receipt.total_qty_ditolak_pcs ?? sumRejected(receipt)), 0),
);
const uniqueSupplierCount = computed(
  () => new Set(receipts.value.map((receipt) => receipt.po?.supplier?.id).filter(Boolean)).size,
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

function sumGood(receipt: GoodsReceipt) {
  return (receipt.details || []).reduce((acc, row) => acc + Number(row.qty_bagus_pcs || 0), 0);
}

function sumRejected(receipt: GoodsReceipt) {
  return (receipt.details || []).reduce((acc, row) => acc + Number(row.qty_ditolak_pcs || 0), 0);
}

async function load() {
  loading.value = true;
  try {
    receipts.value = await getGoodsReceipts({
      search: searchQuery.value,
      supplier_id: supplierFilter.value || undefined,
    });
  } catch (error: any) {
    console.error("Gagal memuat penerimaan barang:", error);
    toast.error(error.message || "Gagal memuat data penerimaan barang");
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
  searchQuery.value = "";
  supplierFilter.value = "";
  load();
}

onMounted(async () => {
  await loadSuppliers();
  await load();
});
</script>
