<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (1.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Katalog Harga Supplier
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Bandingkan harga beli (HPP) per pemasok. Harga termurah otomatis ditandai sebagai rekomendasi.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="openUpsertDialog()"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Harga</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Baris Harga</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ catalogs.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Kombinasi barang &amp; supplier</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Tags class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Barang Tercakup</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ uniqueItemCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Punya minimal satu harga</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier Tercakup</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ uniqueSupplierCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Pemasok dengan harga</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Truck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Rekomendasi Termurah</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ cheapestCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Baris bertanda termurah</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <BadgeCheck class="w-6 h-6" />
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
              placeholder="Cari nama barang atau barcode..."
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
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5">Supplier</th>
              <th class="px-4 py-3.5 text-right">Harga Beli / Pcs</th>
              <th class="px-4 py-3.5">Satuan Beli</th>
              <th class="px-4 py-3.5 text-center">Rekomendasi</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="catalogs.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <Tags class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada harga katalog</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canManage ? 'Klik "+ Tambah Harga" untuk mencatat harga beli dari supplier.' : 'Hubungi admin untuk menambahkan harga katalog.' }}
                </p>
              </td>
            </tr>

            <tr v-else v-for="catalog in catalogs" :key="catalog.id" class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ catalog.item?.nama_barang || '-' }}</div>
                <span class="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1">
                  <Barcode class="w-3.5 h-3.5 text-slate-400" />
                  {{ catalog.item?.barcode || '-' }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <div>{{ catalog.supplier?.nama_supplier || '-' }}</div>
                <span class="font-mono text-xs text-slate-500">{{ catalog.supplier?.kode_supplier }}</span>
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                Rp {{ formatNumber(catalog.harga_modal) }}
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs">
                  1 {{ catalog.item?.uom?.satuan_beli || 'Pcs' }}
                  = {{ catalog.item?.uom?.rasio_konversi || 1 }} Pcs
                </span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  v-if="catalog.is_cheapest_recommendation"
                  variant="outline"
                  class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                >
                  <BadgeCheck class="w-3 h-3 mr-1" />
                  Termurah
                </Badge>
                <span v-else class="text-xs text-slate-400">-</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Ubah harga"
                    @click="openUpsertDialog(catalog)"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Hapus harga"
                    @click="openDeleteDialog(catalog)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                  <span v-if="!canManage" class="text-xs text-slate-400">Read only</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Dialog tambah / ubah harga -->
    <GlobalDialog
      v-model:open="isUpsertDialogOpen"
      :title="editingId ? 'Ubah Harga Supplier' : 'Tambah Harga Supplier'"
      description="Satu supplier hanya boleh punya satu harga per barang. Menyimpan kombinasi yang sama akan memperbarui harga lama."
      type="info"
      content-class="max-w-lg"
    >
      <form class="space-y-4" @submit.prevent="submitUpsert">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Supplier <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="form.supplier_id"
            required
            :disabled="!!editingId"
            class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          >
            <option value="" disabled>Pilih supplier</option>
            <option v-for="supplier in activeSuppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.nama_supplier }} ({{ supplier.kode_supplier }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Barang <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="form.item_id"
            required
            :disabled="!!editingId"
            class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          >
            <option value="" disabled>Pilih barang</option>
            <option v-for="item in items" :key="item.id" :value="item.id">
              {{ item.nama_barang }} - {{ item.barcode }}
            </option>
          </select>
          <p v-if="items.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Belum ada barang aktif. Tambahkan barang di Inventory terlebih dahulu.
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Harga Beli / Pcs <span class="text-rose-500">*</span>
          </label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-slate-500">Rp</span>
            <Input v-model.number="form.harga_modal" type="number" min="1" step="1" required placeholder="0" />
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Harga per Pcs (satuan dasar), bukan per kardus. Dipakai sebagai HPP saat membuat PO.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" @click="isUpsertDialogOpen = false">Batal</Button>
          <Button type="submit" :disabled="isSaving" class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
            <RefreshCw v-if="isSaving" class="w-4 h-4 animate-spin" />
            <span>{{ editingId ? 'Simpan Perubahan' : 'Simpan Harga' }}</span>
          </Button>
        </div>
      </form>
    </GlobalDialog>

    <!-- Dialog hapus -->
    <GlobalDialog
      v-model:open="isDeleteDialogOpen"
      title="Hapus Harga Supplier"
      description="Harga yang dihapus tidak memengaruhi PO yang sudah terbit."
      type="danger"
    >
      <div v-if="catalogToDelete" class="space-y-4">
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
          <p class="font-semibold">{{ catalogToDelete.item?.nama_barang }}</p>
          <p class="text-xs mt-1">
            {{ catalogToDelete.supplier?.nama_supplier }} &middot;
            Rp {{ formatNumber(catalogToDelete.harga_modal) }} / Pcs
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="confirmDelete" class="flex items-center gap-1.5">
            <RefreshCw v-if="isDeleting" class="w-4 h-4 animate-spin" />
            <span>Ya, Hapus Harga</span>
          </Button>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { BadgeCheck, Barcode, Edit, Package, Plus, RefreshCw, Search, Tags, Trash2, Truck } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { getMinimarketItems, type MinimarketItem } from "@/views/inventory/master/m_items/minimarketItemService";
import { getSuppliers, type Supplier } from "../suppliers/supplierService";
import {
  deleteSupplierCatalog,
  getSupplierCatalogs,
  saveSupplierCatalog,
  type SupplierCatalog,
} from "./supplierCatalogService";

const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

const catalogs = ref<SupplierCatalog[]>([]);
const suppliers = ref<Supplier[]>([]);
const items = ref<MinimarketItem[]>([]);
const loading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);

const searchQuery = ref("");
const supplierFilter = ref("");

const isUpsertDialogOpen = ref(false);
const isDeleteDialogOpen = ref(false);
const editingId = ref("");
const catalogToDelete = ref<SupplierCatalog | null>(null);

const form = ref({
  supplier_id: "",
  item_id: "",
  harga_modal: 0,
});

const activeSuppliers = computed(() => suppliers.value.filter((supplier) => supplier.is_active));
const uniqueItemCount = computed(() => new Set(catalogs.value.map((row) => row.item_id)).size);
const uniqueSupplierCount = computed(() => new Set(catalogs.value.map((row) => row.supplier_id)).size);
const cheapestCount = computed(() => catalogs.value.filter((row) => row.is_cheapest_recommendation).length);

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

async function load() {
  loading.value = true;
  try {
    catalogs.value = await getSupplierCatalogs({
      search: searchQuery.value,
      supplier_id: supplierFilter.value || undefined,
    });
  } catch (error: any) {
    console.error("Gagal memuat katalog harga:", error);
    toast.error(error.message || "Gagal memuat katalog harga supplier");
  } finally {
    loading.value = false;
  }
}

async function loadReferences() {
  try {
    const [supplierRows, itemRows] = await Promise.all([
      getSuppliers(),
      getMinimarketItems(),
    ]);
    suppliers.value = supplierRows;
    items.value = itemRows.filter((item) => item.is_active);
  } catch (error: any) {
    console.error("Gagal memuat referensi:", error);
    toast.error(error.message || "Gagal memuat data supplier/barang");
  }
}

function resetFilter() {
  searchQuery.value = "";
  supplierFilter.value = "";
  load();
}

function openUpsertDialog(catalog?: SupplierCatalog) {
  if (catalog) {
    editingId.value = catalog.id;
    form.value = {
      supplier_id: catalog.supplier_id,
      item_id: catalog.item_id,
      harga_modal: Number(catalog.harga_modal) || 0,
    };
  } else {
    editingId.value = "";
    form.value = {
      supplier_id: supplierFilter.value || "",
      item_id: "",
      harga_modal: 0,
    };
  }
  isUpsertDialogOpen.value = true;
}

async function submitUpsert() {
  if (!form.value.supplier_id || !form.value.item_id) {
    toast.error("Supplier dan barang wajib dipilih");
    return;
  }
  if (!form.value.harga_modal || Number(form.value.harga_modal) <= 0) {
    toast.error("Harga beli harus lebih dari 0");
    return;
  }

  isSaving.value = true;
  try {
    await saveSupplierCatalog({
      supplier_id: form.value.supplier_id,
      item_id: form.value.item_id,
      harga_modal: Number(form.value.harga_modal),
    });
    toast.success(editingId.value ? "Harga supplier berhasil diperbarui" : "Harga supplier berhasil disimpan");
    isUpsertDialogOpen.value = false;
    await load();
  } catch (error: any) {
    console.error("Gagal menyimpan harga supplier:", error);
    toast.error(error.message || "Gagal menyimpan harga supplier");
  } finally {
    isSaving.value = false;
  }
}

function openDeleteDialog(catalog: SupplierCatalog) {
  catalogToDelete.value = catalog;
  isDeleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (!catalogToDelete.value) return;
  isDeleting.value = true;
  try {
    await deleteSupplierCatalog(catalogToDelete.value.id);
    toast.success("Harga supplier berhasil dihapus");
    isDeleteDialogOpen.value = false;
    catalogToDelete.value = null;
    await load();
  } catch (error: any) {
    console.error("Gagal menghapus harga supplier:", error);
    toast.error(error.message || "Gagal menghapus harga supplier");
  } finally {
    isDeleting.value = false;
  }
}

onMounted(async () => {
  await loadReferences();
  await load();
});
</script>
