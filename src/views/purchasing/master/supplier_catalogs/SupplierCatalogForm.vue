<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (1.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ readOnly ? "Detail Harga Supplier" : isEdit ? "Edit Harga Supplier" : "Tambah Harga Supplier" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ readOnly ? "Informasi lengkap perbandingan harga modal (HPP) dari distributor." : "Tentukan harga beli modal per barang dari distributor rekanan." }}
        </p>
      </div>
      <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/master/supplier-catalogs')">
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </Button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 5" :key="n" class="h-10 w-full" />
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 3" :key="n" class="h-12 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Form Utama & Ringkasan -->
    <form v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4" @submit.prevent="handleSubmit">
      <!-- Kolom Kiri: Form Input Data -->
      <div class="lg:col-span-2 space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Tags class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Parameter Harga Beli (HPP)</span>
            </CardTitle>
            <CardDescription>
              Pilih pemasok dan produk untuk menetapkan harga acuan pembuatan Purchase Order (PO).
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <!-- Pilihan Supplier -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier / Distributor <span class="text-rose-500">*</span>
              </label>
              <div v-if="isEdit || readOnly" class="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ selectedSupplier?.nama_supplier || "-" }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ selectedSupplier?.kode_supplier || "-" }} &middot; Kontak: {{ selectedSupplier?.kontak_sales || "-" }}</p>
                </div>
                <Badge variant="outline" class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs">
                  Terpilih
                </Badge>
              </div>
              <select
                v-else
                v-model="form.supplier_id"
                required
                class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Pilih supplier distributor</option>
                <option v-for="sup in activeSuppliers" :key="sup.id" :value="sup.id">
                  {{ sup.nama_supplier }} ({{ sup.kode_supplier }})
                </option>
              </select>
              <p v-if="!isEdit && !readOnly && activeSuppliers.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Belum ada supplier aktif. Tambahkan supplier di menu Master Supplier terlebih dahulu.
              </p>
            </div>

            <!-- Pilihan Barang -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Barang / Produk Minimarket <span class="text-rose-500">*</span>
              </label>
              <div v-if="isEdit || readOnly" class="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ selectedItem?.nama_barang || "-" }}</p>
                  <p class="text-xs text-slate-500 font-mono">Barcode: {{ selectedItem?.barcode || "-" }} &middot; Satuan: {{ selectedItem?.uom?.satuan_beli || "Pcs" }}</p>
                </div>
                <Badge variant="outline" class="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-xs">
                  Terpilih
                </Badge>
              </div>
              <select
                v-else
                v-model="form.item_id"
                required
                class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Pilih barang...</option>
                <option v-for="it in items" :key="it.id" :value="it.id">
                  {{ it.nama_barang }} ({{ it.barcode }})
                </option>
              </select>
              <p v-if="!isEdit && !readOnly && items.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Belum ada barang aktif. Tambahkan barang di menu Master Barang terlebih dahulu.
              </p>
            </div>

            <!-- Harga Beli Modal (HPP) -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Harga Beli / Pcs (Rp) <span class="text-rose-500">*</span>
              </label>
              <div class="relative max-w-md">
                <span class="absolute left-3 top-2 text-xs text-slate-400 font-semibold">Rp</span>
                <Input
                  v-model.number="form.harga_modal"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="0"
                  :disabled="readOnly"
                  class="font-mono text-sm pl-9"
                />
              </div>
              <p class="text-xs text-slate-500 mt-1">
                Kuantitas dalam 1 Pcs (satuan dasar). Dipakai sebagai harga otomatis saat menerbitkan dokumen Purchase Order (PO).
              </p>
            </div>

            <!-- Tombol Aksi Form -->
            <div v-if="!readOnly" class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" @click="router.push('/purchasing/master/supplier-catalogs')">
                Batal
              </Button>
              <Button type="submit" :disabled="isSubmitting" class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
                <Save v-else class="w-4 h-4" />
                <span>{{ isEdit ? 'Simpan Perubahan' : 'Simpan Harga' }}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Kolom Kanan: Kartu Ringkasan Informasi -->
      <div class="space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Info class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ringkasan Katalog</span>
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex items-start justify-between gap-2">
              <span class="text-slate-500 text-xs">Distributor</span>
              <span class="font-semibold text-right text-xs truncate max-w-[60%] text-slate-800 dark:text-slate-200">
                {{ selectedSupplier?.nama_supplier || "-" }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-xs">Termin (TOP)</span>
              <span class="font-mono text-xs text-slate-800 dark:text-slate-200">
                {{ selectedSupplier?.term_of_payment ? `${selectedSupplier.term_of_payment} Hari` : "Cash on Delivery" }}
              </span>
            </div>
            <div class="flex items-start justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span class="text-slate-500 text-xs">Produk</span>
              <span class="font-semibold text-right text-xs truncate max-w-[60%] text-slate-800 dark:text-slate-200">
                {{ selectedItem?.nama_barang || "-" }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-xs">Barcode</span>
              <span class="font-mono text-xs text-slate-800 dark:text-slate-200">
                {{ selectedItem?.barcode || "-" }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-xs">Satuan Beli</span>
              <span class="text-xs text-slate-800 dark:text-slate-200">
                1 {{ selectedItem?.uom?.satuan_beli || "Pcs" }} = {{ selectedItem?.uom?.rasio_konversi || 1 }} Pcs
              </span>
            </div>

            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <span class="text-slate-500 text-xs block">Harga Kulakan per Pcs:</span>
              <p class="font-mono font-bold text-xl text-emerald-600 dark:text-emerald-400">
                Rp {{ formatNumber(form.harga_modal) }}
              </p>
              <p v-if="selectedItem?.uom?.satuan_beli && selectedItem?.uom?.rasio_konversi > 1" class="text-[11px] text-slate-400">
                &asymp; Rp {{ formatNumber(Number(form.harga_modal || 0) * Number(selectedItem.uom.rasio_konversi)) }} per {{ selectedItem.uom.satuan_beli }}
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Panduan Singkat -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs bg-slate-50/50 dark:bg-slate-900/30">
          <CardContent class="p-4 text-xs text-slate-500 space-y-1.5">
            <p class="font-semibold text-slate-700 dark:text-slate-300">Catatan Pengadaan:</p>
            <p>&bull; Satu barang bisa memiliki banyak harga dari berbagai distributor pemasok.</p>
            <p>&bull; Sistem otomatis mendeteksi distributor dengan harga termurah sebagai rekomendasi saat sistem menerbitkan usulan PO kulakan.</p>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Info, RefreshCw, Save, Tags } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMinimarketItems, type MinimarketItem } from "@/views/inventory/master/m_items/minimarketItemService";
import { getSuppliers, type Supplier } from "../suppliers/supplierService";
import {
  getSupplierCatalogById,
  saveSupplierCatalog,
  updateSupplierCatalog,
  type SupplierCatalog,
} from "./supplierCatalogService";

const route = useRoute();
const router = useRouter();

const catalogId = computed(() => (route.params.id ? String(route.params.id) : ""));
const isEdit = computed(() => !!catalogId.value && route.name !== "PurchasingSupplierCatalogView");
const readOnly = computed(() => route.meta.readOnly === true || route.name === "PurchasingSupplierCatalogView");

const loading = ref(false);
const isSubmitting = ref(false);
const catalog = ref<SupplierCatalog | null>(null);

const suppliers = ref<Supplier[]>([]);
const items = ref<MinimarketItem[]>([]);

const form = ref({
  supplier_id: "",
  item_id: "",
  harga_modal: 0,
});

const activeSuppliers = computed(() => suppliers.value.filter((s) => s.is_active));

const selectedSupplier = computed(() => {
  if (catalog.value?.supplier) return catalog.value.supplier;
  return suppliers.value.find((s) => s.id === form.value.supplier_id) || null;
});

const selectedItem = computed(() => {
  if (catalog.value?.item) return catalog.value.item;
  return items.value.find((i) => i.id === form.value.item_id) || null;
});

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
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
    toast.error(error.message || "Gagal memuat data referensi");
  }
}

async function loadDetail() {
  if (!catalogId.value) return;
  loading.value = true;
  try {
    const data = await getSupplierCatalogById(catalogId.value);
    catalog.value = data;
    form.value = {
      supplier_id: data.supplier_id,
      item_id: data.item_id,
      harga_modal: Number(data.harga_modal) || 0,
    };
  } catch (error: any) {
    console.error("Gagal memuat detail katalog harga:", error);
    toast.error(error.message || "Gagal memuat detail katalog harga");
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (readOnly.value) return;

  if (!form.value.supplier_id) {
    toast.error("Pilih supplier distributor");
    return;
  }
  if (!form.value.item_id) {
    toast.error("Pilih barang minimarket");
    return;
  }
  if (!form.value.harga_modal || Number(form.value.harga_modal) <= 0) {
    toast.error("Harga modal harus lebih dari 0");
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEdit.value) {
      await updateSupplierCatalog(catalogId.value, {
        harga_modal: Number(form.value.harga_modal),
      });
      toast.success("Harga supplier berhasil diperbarui");
    } else {
      await saveSupplierCatalog({
        supplier_id: form.value.supplier_id,
        item_id: form.value.item_id,
        harga_modal: Number(form.value.harga_modal),
      });
      toast.success("Harga supplier berhasil ditambahkan");
    }
    router.push("/purchasing/master/supplier-catalogs");
  } catch (error: any) {
    console.error("Gagal menyimpan harga supplier:", error);
    toast.error(error.message || "Gagal menyimpan harga supplier");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadReferences(), loadDetail()]);
});
</script>
