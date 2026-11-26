<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header & Action Kembali -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            Modul 2 : Inventory (1.1)
          </span>
          <Badge
            v-if="item && (isEdit || readOnly)"
            :class="item.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
            variant="outline"
            class="text-xs"
          >
            {{ item.is_active ? 'Produk Aktif' : 'Non-aktif' }}
          </Badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ readOnly ? "Detail Barang Minimarket" : isEdit ? "Edit Data Barang Minimarket" : "Tambah Barang Baru" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ readOnly
            ? "Informasi katalog produk, penempatan rak, harga kasir, dan ringkasan saldo stok."
            : isEdit
              ? "Perbarui informasi produk, harga jual, dan penempatan rak."
              : "Daftarkan barcode, nama produk, kategori rak, satuan, dan parameter stok pengaman awal."
          }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5"
          @click="router.push('/inventory/master/items')"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>

        <Button
          v-if="readOnly && canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push(`/inventory/master/items/form/${itemId}`)"
        >
          <Edit class="w-4 h-4" />
          <span>Edit Barang</span>
        </Button>
      </div>
    </div>

    <!-- Skeleton saat memuat data -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 6" :key="n" class="h-10 w-full" />
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Form Utama & Ringkasan Samping -->
    <form v-else @submit.prevent="handleSubmit" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Kolom Kiri: Form Data Produk -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Card 1: Identitas & Penempatan Produk -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Package class="w-4 h-4 text-emerald-600" />
              <span>Identitas & Penempatan Produk</span>
            </CardTitle>
            <CardDescription>
              Barcode unik produk untuk kasir POS dan lokasi penempatan rak display / gudang.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <!-- Barcode & Nama Produk -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode / SKU <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <Input
                    v-model="form.barcode"
                    placeholder="Scan barcode (contoh: 899...)"
                    :disabled="isEdit || readOnly"
                    required
                    class="font-mono text-sm pr-16"
                  />
                  <div class="absolute right-1 top-1.5 flex items-center gap-1">
                    <button
                      v-if="!isEdit && !readOnly"
                      type="button"
                      @click="generateRandomBarcode"
                      class="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded font-medium"
                      title="Buat barcode acak sistem"
                    >
                      Acak
                    </button>
                    <button
                      v-if="form.barcode && (isEdit || readOnly)"
                      type="button"
                      @click="copyBarcode(form.barcode)"
                      class="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded flex items-center gap-1"
                      title="Salin barcode"
                    >
                      <Copy class="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Produk <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.nama_barang"
                  placeholder="Contoh: Susu Ultra Milk 250ml Plain"
                  :disabled="readOnly"
                  required
                />
              </div>
            </div>

            <!-- Kategori / Rak & UOM -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori & Rak Penempatan <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.category_rack_id"
                  required
                  :disabled="readOnly"
                  class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>Pilih Kategori/Rak</option>
                  <option v-for="rack in categoryRacks" :key="rack.id" :value="rack.id">
                    [{{ rack.tipe_zona }}] {{ rack.nama }} ({{ rack.lokasi || '-' }})
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Satuan Beli & Konversi (UOM) <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.uom_id"
                  required
                  :disabled="readOnly"
                  class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>Pilih Satuan UOM</option>
                  <option v-for="uom in uoms" :key="uom.id" :value="uom.id">
                    {{ uom.nama_uom }} (1 {{ uom.satuan_beli }} = {{ uom.rasio_konversi }} Pcs)
                  </option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card 2: Harga Modal & Jual Kasir -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Banknote class="w-4 h-4 text-emerald-600" />
              <span>Harga Modal & Jual Kasir</span>
            </CardTitle>
            <CardDescription>
              Penetapan HPP per Pcs dan harga jual eceran yang tampil di transaksi kasir POS.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Harga Modal / HPP (Rp) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">Rp</span>
                  <Input
                    type="number"
                    v-model.number="form.harga_modal"
                    min="0"
                    step="100"
                    :disabled="readOnly"
                    required
                    class="font-mono text-sm pl-9"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Harga Jual Eceran Kasir (Rp) <span class="text-rose-500">*</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">Rp</span>
                  <Input
                    type="number"
                    v-model.number="form.harga_jual"
                    min="0"
                    step="100"
                    :disabled="readOnly"
                    required
                    class="font-mono text-sm pl-9"
                  />
                </div>
              </div>
            </div>

            <!-- Estimasi Margin Keuntungan -->
            <div class="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div class="space-y-0.5">
                <p class="font-medium text-slate-700 dark:text-slate-300">Estimasi Margin Keuntungan</p>
                <p class="text-slate-500">
                  Laba kotor per Pcs:
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                    Rp {{ profitPerPcs.toLocaleString("id-ID") }}
                  </span>
                </p>
              </div>

              <div class="text-right">
                <Badge
                  :class="marginPercentage >= 20 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : marginPercentage > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'"
                  variant="outline"
                  class="font-mono font-semibold"
                >
                  {{ marginPercentage }}% Margin
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card 3: Batas Stok Kulakan Otomatis (Auto-PR / ROP) -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Batas Stok Kulakan Otomatis (Auto-PR / ROP)</span>
            </CardTitle>
            <CardDescription>
              Parameter pengaman agar sistem dapat merekomendasikan PO belanja secara otomatis saat stok menipis.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Time (Hari)
                </label>
                <Input
                  type="number"
                  v-model.number="form.lead_time_days"
                  min="1"
                  :disabled="readOnly"
                  class="font-mono text-sm"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Waktu kirim distributor</span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Safety Stock (Pcs)
                </label>
                <Input
                  type="number"
                  v-model.number="form.safety_stock_pcs"
                  min="0"
                  :disabled="readOnly"
                  class="font-mono text-sm"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Batas cadangan darurat</span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Kapasitas (Pcs)
                </label>
                <Input
                  type="number"
                  v-model.number="form.max_stock_pcs"
                  min="1"
                  :disabled="readOnly"
                  class="font-mono text-sm"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Daya tampung rak + gudang</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card 4: Catatan & Status Aktif -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <FileText class="w-4 h-4 text-emerald-600" />
              <span>Catatan Tambahan & Status</span>
            </CardTitle>
          </CardHeader>

          <CardContent class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Produk
              </label>
              <textarea
                v-model="form.catatan"
                rows="2"
                :disabled="readOnly"
                placeholder="Keterangan opsional produk (misal: syarat simpan, vendor khusus, dll)..."
                class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>

            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="readOnly"
                class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Produk aktif dan dapat ditransaksikan pada kasir POS serta katalog inventaris</span>
            </label>

            <!-- Action Buttons Simpan / Batal -->
            <div v-if="!readOnly" class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                @click="router.push('/inventory/master/items')"
              >
                Batal
              </Button>

              <Button
                type="submit"
                :disabled="isSubmitting"
                class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
                <span>{{ isEdit ? "Simpan Perubahan" : "Daftarkan Barang" }}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Kolom Kanan: Panel Ringkasan Samping -->
      <div class="space-y-4">
        <!-- Card Ringkasan Stok Fisik -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Store class="w-4 h-4 text-emerald-600" />
              <span>Saldo Stok Fisik</span>
            </CardTitle>
            <CardDescription>
              Posisi barang real-time di rak pajangan kasir vs gudang buffer.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-3 text-sm">
            <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/40">
              <div class="flex items-center gap-2">
                <Store class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span class="text-slate-600 dark:text-slate-300 font-medium">Rak Pajangan</span>
              </div>
              <span class="font-bold text-emerald-700 dark:text-emerald-300">
                {{ rakStock.toLocaleString("id-ID") }} Pcs
              </span>
            </div>

            <div class="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/40">
              <div class="flex items-center gap-2">
                <Warehouse class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span class="text-slate-600 dark:text-slate-300 font-medium">Gudang Belakang</span>
              </div>
              <span class="font-bold text-amber-700 dark:text-amber-300">
                {{ gudangStock.toLocaleString("id-ID") }} Pcs
              </span>
            </div>

            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between text-xs text-slate-500">
                <span>Total Saldo Stok:</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {{ (rakStock + gudangStock).toLocaleString("id-ID") }} Pcs
                </span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-500">
                <span>Estimasi Nilai Modal:</span>
                <span class="font-mono font-medium text-slate-700 dark:text-slate-300">
                  Rp {{ ((rakStock + gudangStock) * Number(form.harga_modal || 0)).toLocaleString("id-ID") }}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card Parameter ROP -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Boxes class="w-4 h-4 text-blue-600" />
              <span>Monitoring ROP & Kulakan</span>
            </CardTitle>
          </CardHeader>

          <CardContent class="space-y-2 text-xs">
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span class="text-slate-500">Lead Time:</span>
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ form.lead_time_days }} hari</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span class="text-slate-500">Safety Stock:</span>
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ form.safety_stock_pcs }} Pcs</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span class="text-slate-500">Kapasitas Maksimal:</span>
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ form.max_stock_pcs }} Pcs</span>
            </div>
            <div class="flex items-center justify-between py-1">
              <span class="text-slate-500">Rekomendasi Auto-PR:</span>
              <Badge variant="outline" class="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Card Info Waktu Audit (hanya saat edit / view) -->
        <Card v-if="item && (isEdit || readOnly)" class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-xs uppercase tracking-wider text-slate-400">Informasi Sistem</CardTitle>
          </CardHeader>
          <CardContent class="space-y-1.5 text-xs text-slate-500">
            <div class="flex justify-between">
              <span>Didaftarkan:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{ formatDate(item.createdAt) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Terakhir diubah:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{ formatDate(item.updatedAt) }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  RefreshCw,
  Package,
  Banknote,
  TrendingUp,
  FileText,
  Store,
  Warehouse,
  Boxes,
  Edit,
  Copy,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";

import {
  getMinimarketItemById,
  getCategoryRacks,
  getUoms,
  createMinimarketItem,
  updateMinimarketItem,
  type MinimarketItem,
  type CategoryRack,
  type Uom,
} from "./minimarketItemService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const canManage = computed(() => authStore.isManager);
const itemId = computed(() => (route.params.id ? String(route.params.id) : ""));
const isEdit = computed(() => !!itemId.value && !route.meta.readOnly);
const readOnly = computed(() => Boolean(route.meta.readOnly));

// State
const loading = ref(false);
const isSubmitting = ref(false);
const item = ref<MinimarketItem | null>(null);
const categoryRacks = ref<CategoryRack[]>([]);
const uoms = ref<Uom[]>([]);

// Form model
const form = ref({
  barcode: "",
  nama_barang: "",
  category_rack_id: "",
  uom_id: "",
  harga_modal: 0,
  harga_jual: 0,
  catatan: "",
  lead_time_days: 3,
  safety_stock_pcs: 10,
  max_stock_pcs: 100,
  is_active: true,
});

// Computed Stok
const rakStock = computed(() => {
  if (!item.value?.stocks) return 0;
  const rak = item.value.stocks.find((s) => s.location === "RAK");
  return rak ? Number(rak.qty) : 0;
});

const gudangStock = computed(() => {
  if (!item.value?.stocks) return 0;
  const gdg = item.value.stocks.find((s) => s.location === "GUDANG");
  return gdg ? Number(gdg.qty) : 0;
});

// Computed Margin & Profit
const profitPerPcs = computed(() => {
  const modal = Number(form.value.harga_modal) || 0;
  const jual = Number(form.value.harga_jual) || 0;
  return Math.max(0, jual - modal);
});

const marginPercentage = computed(() => {
  const modal = Number(form.value.harga_modal) || 0;
  const jual = Number(form.value.harga_jual) || 0;
  if (!modal || modal <= 0) return 0;
  return Math.round(((jual - modal) / modal) * 100);
});

// Helpers
function generateRandomBarcode() {
  const prefix = "899";
  const randomPart = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  form.value.barcode = prefix + randomPart;
}

function copyBarcode(barcode: string) {
  navigator.clipboard.writeText(barcode);
  toast.success(`Barcode ${barcode} disalin ke clipboard!`);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

// Load data master & item detail
async function load() {
  loading.value = true;
  try {
    const [rackList, uomList] = await Promise.all([getCategoryRacks(), getUoms()]);
    categoryRacks.value = rackList;
    uoms.value = uomList;

    if (itemId.value) {
      const data = await getMinimarketItemById(itemId.value);
      item.value = data;

      form.value = {
        barcode: data.barcode,
        nama_barang: data.nama_barang,
        category_rack_id: data.category_rack_id,
        uom_id: data.uom_id,
        harga_modal: Number(data.harga_modal) || 0,
        harga_jual: Number(data.harga_jual) || 0,
        catatan: data.catatan || "",
        lead_time_days: data.rop_setting?.lead_time_days ?? 3,
        safety_stock_pcs: data.rop_setting?.safety_stock_pcs ?? 10,
        max_stock_pcs: data.rop_setting?.max_stock_pcs ?? 100,
        is_active: data.is_active,
      };
    } else {
      // Default untuk tambah barang baru
      form.value.category_rack_id = rackList[0]?.id || "";
      form.value.uom_id = uomList[0]?.id || "";
      generateRandomBarcode();
    }
  } catch (error: any) {
    console.error("Gagal memuat data barang:", error);
    toast.error(error.message || "Gagal memuat data barang");
  } finally {
    loading.value = false;
  }
}

// Submit handler
async function handleSubmit() {
  if (readOnly.value) return;

  if (!form.value.barcode.trim()) {
    toast.error("Barcode / SKU wajib diisi");
    return;
  }
  if (!form.value.nama_barang.trim()) {
    toast.error("Nama produk wajib diisi");
    return;
  }
  if (!form.value.category_rack_id) {
    toast.error("Pilih kategori dan rak penempatan");
    return;
  }
  if (!form.value.uom_id) {
    toast.error("Pilih satuan konversi (UOM)");
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEdit.value) {
      const payload = {
        barcode: form.value.barcode.trim(),
        nama_barang: form.value.nama_barang.trim(),
        category_rack_id: form.value.category_rack_id,
        uom_id: form.value.uom_id,
        harga_modal: Number(form.value.harga_modal) || 0,
        harga_jual: Number(form.value.harga_jual) || 0,
        catatan: form.value.catatan.trim() || undefined,
        is_active: form.value.is_active,
        lead_time_days: Number(form.value.lead_time_days) || 3,
        safety_stock_pcs: Number(form.value.safety_stock_pcs) || 10,
        max_stock_pcs: Number(form.value.max_stock_pcs) || 100,
      };

      await updateMinimarketItem(itemId.value, payload);
      toast.success("Data barang berhasil diperbarui");
    } else {
      const payload = {
        barcode: form.value.barcode.trim(),
        nama_barang: form.value.nama_barang.trim(),
        category_rack_id: form.value.category_rack_id,
        uom_id: form.value.uom_id,
        harga_modal: Number(form.value.harga_modal) || 0,
        harga_jual: Number(form.value.harga_jual) || 0,
        catatan: form.value.catatan.trim() || undefined,
        lead_time_days: Number(form.value.lead_time_days) || 3,
        safety_stock_pcs: Number(form.value.safety_stock_pcs) || 10,
        max_stock_pcs: Number(form.value.max_stock_pcs) || 100,
      };

      await createMinimarketItem(payload);
      toast.success("Barang baru berhasil didaftarkan");
    }

    router.push("/inventory/master/items");
  } catch (error: any) {
    console.error("Gagal menyimpan barang:", error);
    toast.error(error.message || "Gagal menyimpan data barang");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(load);
</script>
