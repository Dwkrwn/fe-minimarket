<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- 1. Header & Quick Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            Modul 2 : Inventory (1.1)
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Daftar Barang Minimarket
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Katalog produk, harga modal, harga jual eceran, dan saldo stok (Pcs) Gudang vs Rak.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="loadAllData"
          class="flex items-center gap-1.5"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>

        <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="openCreateModal"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Barang Baru</span>
        </Button>
      </div>
    </div>

    <!-- 2. KPI Summary Cards -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 gap-4"
      :class="canManage ? 'lg:grid-cols-4' : 'lg:grid-cols-3'"
    >
      <!-- Total SKU -->
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Produk (SKU)</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {{ items.length }}
            </h3>
            <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              {{ activeItemsCount }} produk aktif
            </p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <!-- Stok di Rak -->
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Stok di Rak Pajangan</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ totalRakStock.toLocaleString('id-ID') }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Siap di-scan di kasir POS</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Store class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <!-- Stok di Gudang -->
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Stok di Gudang Belakang</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {{ totalGudangStock.toLocaleString('id-ID') }} <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Buffer stok kardusan</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Warehouse class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <!-- Total Nilai Modal -->
      <Card v-if="canManage" class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nilai Persediaan</p>
            <h3 class="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              Rp {{ formatRupiah(totalAssetValue) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Modal stok (Rak + Gudang)</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Boxes class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 3. Filter & Search Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row items-center gap-3">
          <!-- Search input -->
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari berdasarkan nama barang atau scan barcode..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="handleSearch"
            />
          </div>

          <!-- Filter Kategori / Rak -->
          <div class="w-full md:w-64">
            <select
              v-model="selectedRackFilter"
              @change="handleSearch"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kategori & Zona Rak</option>
              <option v-for="rack in categoryRacks" :key="rack.id" :value="rack.id">
                [{{ rack.tipe_zona }}] {{ rack.nama }}
              </option>
            </select>
          </div>

          <Button variant="ghost" size="sm" @click="resetFilters" class="text-xs text-slate-500 hover:text-slate-800">
            Reset Filter
          </Button>
        </div>

        <div
          v-if="scanNotice"
          class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <span class="flex items-center gap-2">
            <Barcode class="w-4 h-4" />
            Hasil scan barcode: <span class="font-mono font-semibold">{{ scanNotice }}</span>
          </span>
          <button type="button" class="text-emerald-700/70 hover:text-emerald-900 dark:text-emerald-400" @click="resetFilters">
            Tampilkan semua
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- 4. Data Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" class="px-4 py-3.5">Barcode & Nama Barang</th>
              <th scope="col" class="px-4 py-3.5">Kategori & Lokasi Rak</th>
              <th scope="col" class="px-4 py-3.5">Satuan Konversi</th>
              <th v-if="canManage" scope="col" class="px-4 py-3.5 text-right">Harga Modal (HPP)</th>
              <th scope="col" class="px-4 py-3.5 text-right">Harga Jual</th>
              <th scope="col" class="px-4 py-3.5 text-center">Posisi Stok (Pcs)</th>
              <th scope="col" class="px-4 py-3.5 text-center">Status</th>
              <th v-if="canManage" scope="col" class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <!-- Loading Skeletons -->
            <tr v-if="loading" v-for="n in 3" :key="'skel-' + n">
              <td :colspan="columnCount" class="px-4 py-4">
                <Skeleton class="h-6 w-full" />
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-else-if="items.length === 0">
              <td :colspan="columnCount" class="px-4 py-12 text-center text-slate-500">
                <Package class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada data barang minimarket</p>
                <p class="text-xs text-slate-400 mt-1">Klik tombol "+ Tambah Barang Baru" untuk mendaftarkan barang pertama.</p>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-else
              v-for="item in items"
              :key="item.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <!-- Barcode & Nama -->
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{{ item.nama_barang }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    <Barcode class="w-3.5 h-3.5 text-slate-400" />
                    {{ item.barcode }}
                  </span>
                  <button
                    @click="copyBarcode(item.barcode)"
                    title="Salin Barcode"
                    class="text-xs text-slate-400 hover:text-emerald-600"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </td>

              <!-- Kategori & Lokasi Rak -->
              <td class="px-4 py-3.5">
                <div v-if="item.category_rack" class="flex flex-col gap-0.5">
                  <span class="font-medium text-slate-800 dark:text-slate-200">
                    {{ item.category_rack.nama }}
                  </span>
                  <div class="flex items-center gap-1 text-xs text-slate-500">
                    <Badge
                      :variant="item.category_rack.tipe_zona === 'RAK' ? 'default' : 'secondary'"
                      class="text-[10px] py-0 px-1.5"
                    >
                      {{ item.category_rack.tipe_zona }}
                    </Badge>
                    <span>{{ item.category_rack.lokasi || '-' }}</span>
                  </div>
                </div>
                <span v-else class="text-slate-400 text-xs italic">-</span>
              </td>

              <!-- Satuan Konversi -->
              <td class="px-4 py-3.5">
                <div v-if="item.uom" class="text-xs">
                  <span class="font-semibold text-slate-700 dark:text-slate-300">
                    {{ item.uom.nama_uom }}
                  </span>
                  <p class="text-slate-500 text-[11px] mt-0.5">
                    1 {{ item.uom.satuan_beli }} = {{ item.uom.rasio_konversi }} Pcs
                  </p>
                </div>
                <span v-else class="text-xs text-slate-400">Pcs</span>
              </td>

              <!-- Harga Modal (HPP) -->
              <td v-if="canManage" class="px-4 py-3.5 text-right font-mono text-slate-600 dark:text-slate-300">
                Rp {{ formatRupiah(item.harga_modal) }}
              </td>

              <!-- Harga Jual & Margin -->
              <td class="px-4 py-3.5 text-right">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">
                  Rp {{ formatRupiah(item.harga_jual) }}
                </div>
                <span
                  v-if="canManage && calculateMargin(item) > 0"
                  class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded"
                >
                  +{{ calculateMargin(item) }}%
                </span>
              </td>

              <!-- Posisi Stok (Pcs) -->
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1.5 font-mono text-xs">
                  <!-- Stok Rak -->
                  <span
                    class="px-2 py-0.5 rounded-md font-semibold"
                    :class="getRakQty(item) > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'"
                    :title="'Stok di Rak Pajangan: ' + getRakQty(item) + ' Pcs'"
                  >
                    Rak: {{ getRakQty(item) }}
                  </span>
                  <!-- Stok Gudang -->
                  <span
                    class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    :title="'Stok di Gudang Belakang: ' + getGudangQty(item) + ' Pcs'"
                  >
                    Gudang: {{ getGudangQty(item) }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  Total: {{ getTotalQty(item) }} Pcs
                </div>
              </td>

              <!-- Status -->
              <td class="px-4 py-3.5 text-center">
                <Badge
                  :class="item.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
                  variant="outline"
                  class="text-xs"
                >
                  {{ item.is_active ? 'Aktif' : 'Non-aktif' }}
                </Badge>
              </td>

              <!-- Aksi -->
              <td v-if="canManage" class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    @click="openEditModal(item)"
                    title="Edit Barang"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    @click="openDeleteDialog(item)"
                    title="Hapus Barang"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- 5. MODAL FORM: Tambah / Edit Barang -->
    <GlobalDialog
      v-model:open="isFormModalOpen"
      :title="isEditMode ? 'Edit Data Barang Minimarket' : 'Tambah Barang Baru'"
      :description="isEditMode ? 'Perbarui informasi produk dan harga jual.' : 'Daftarkan barcode, nama produk, kategori, dan stok pengaman awal.'"
    >
      <form @submit.prevent="handleSubmitForm" class="space-y-4">
        <!-- Barcode & Nama Barang -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Barcode / SKU <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <Input
                v-model="formData.barcode"
                placeholder="Scan barcode (contoh: 899...)"
                :disabled="isEditMode"
                required
                class="font-mono text-sm"
              />
              <button
                v-if="!isEditMode"
                type="button"
                @click="generateRandomBarcode"
                class="absolute right-2 top-2 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded"
              >
                Acak
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Produk <span class="text-rose-500">*</span>
            </label>
            <Input
              v-model="formData.nama_barang"
              placeholder="Contoh: Susu Ultra Milk 250ml Plain"
              required
            />
          </div>
        </div>

        <!-- Kategori/Rak & UOM Satuan -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kategori & Rak Penempatan <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="formData.category_rack_id"
              required
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              v-model="formData.uom_id"
              required
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>Pilih Satuan UOM</option>
              <option v-for="uom in uoms" :key="uom.id" :value="uom.id">
                {{ uom.nama_uom }} (1 {{ uom.satuan_beli }} = {{ uom.rasio_konversi }} Pcs)
              </option>
            </select>
          </div>
        </div>

        <!-- Harga Modal & Harga Jual -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Harga Modal / HPP (Rp) <span class="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              v-model.number="formData.harga_modal"
              min="0"
              step="100"
              required
              class="font-mono text-sm"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Harga Jual Eceran Kasir (Rp) <span class="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              v-model.number="formData.harga_jual"
              min="0"
              step="100"
              required
              class="font-mono text-sm"
            />
          </div>
        </div>

        <!-- ROP / Safety Stock Setting (Hanya saat tambah baru) -->
        <div v-if="!isEditMode" class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Pengaturan Batas Stok Kulakan Otomatis (Auto-PR / ROP)
          </p>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="text-[11px] text-slate-500">Lead Time (Hari)</label>
              <Input type="number" v-model.number="formData.lead_time_days" min="1" class="text-xs font-mono" />
            </div>
            <div>
              <label class="text-[11px] text-slate-500">Safety Stock (Pcs)</label>
              <Input type="number" v-model.number="formData.safety_stock_pcs" min="0" class="text-xs font-mono" />
            </div>
            <div>
              <label class="text-[11px] text-slate-500">Max Kapasitas (Pcs)</label>
              <Input type="number" v-model.number="formData.max_stock_pcs" min="1" class="text-xs font-mono" />
            </div>
          </div>
        </div>

        <!-- Catatan -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Catatan Tambahan
          </label>
          <Input
            v-model="formData.catatan"
            placeholder="Keterangan opsional produk..."
          />
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" @click="isFormModalOpen = false">
            Batal
          </Button>
          <Button
            type="submit"
            :disabled="isSubmitting"
            class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <span>{{ isEditMode ? 'Simpan Perubahan' : 'Daftarkan Barang' }}</span>
          </Button>
        </div>
      </form>
    </GlobalDialog>

    <!-- 6. MODAL KONFIRMASI HAPUS -->
    <GlobalDialog
      v-model:open="isDeleteDialogOpen"
      title="Hapus Barang Minimarket"
      description="Apakah Anda yakin ingin menghapus data barang ini dari katalog?"
    >
      <div v-if="itemToDelete" class="space-y-4">
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
          <p class="font-semibold">{{ itemToDelete.nama_barang }}</p>
          <p class="text-xs mt-1 font-mono">Barcode: {{ itemToDelete.barcode }}</p>
          <p class="text-xs mt-2 text-rose-600 dark:text-rose-400">
            Peringatan: Seluruh data slot stok dan pengaturan ROP terkait akan ikut terhapus.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" @click="isDeleteDialogOpen = false">
            Batal
          </Button>
          <Button
            variant="destructive"
            :disabled="isDeleting"
            @click="handleConfirmDelete"
            class="flex items-center gap-1.5"
          >
            <RefreshCw v-if="isDeleting" class="w-4 h-4 animate-spin" />
            <span>Ya, Hapus Barang</span>
          </Button>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  Package,
  Store,
  Warehouse,
  Boxes,
  RefreshCw,
  Plus,
  Search,
  Barcode,
  Copy,
  Edit,
  Trash2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";

import {
  getMinimarketItems,
  getMinimarketItemByBarcode,
  getCategoryRacks,
  getUoms,
  createMinimarketItem,
  updateMinimarketItem,
  deleteMinimarketItem,
  type MinimarketItem,
  type CategoryRack,
  type Uom,
} from "./minimarketItemService";

const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

// State
const items = ref<MinimarketItem[]>([]);
const categoryRacks = ref<CategoryRack[]>([]);
const uoms = ref<Uom[]>([]);
const loading = ref(false);
const isSubmitting = ref(false);
const isDeleting = ref(false);

// Filter
const searchQuery = ref("");
const selectedRackFilter = ref("");
const scanNotice = ref<string | null>(null);

// Dialog states
const isFormModalOpen = ref(false);
const isEditMode = ref(false);
const currentEditId = ref<string | null>(null);

const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<MinimarketItem | null>(null);

// Form model
const formData = ref({
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
});

// Computed Metrics
const columnCount = computed(() => (canManage.value ? 8 : 6));

const activeItemsCount = computed(() => {
  return items.value.filter((i) => i.is_active).length;
});

const totalRakStock = computed(() => {
  return items.value.reduce((acc, item) => {
    const rak = item.stocks?.find((s) => s.location === "RAK");
    return acc + (rak ? Number(rak.qty) : 0);
  }, 0);
});

const totalGudangStock = computed(() => {
  return items.value.reduce((acc, item) => {
    const gdg = item.stocks?.find((s) => s.location === "GUDANG");
    return acc + (gdg ? Number(gdg.qty) : 0);
  }, 0);
});

const totalAssetValue = computed(() => {
  return items.value.reduce((acc, item) => {
    const totalQty = (item.stocks || []).reduce((q, s) => q + Number(s.qty), 0);
    return acc + totalQty * Number(item.harga_modal);
  }, 0);
});

// Helper stock extraction
function getRakQty(item: MinimarketItem): number {
  const stock = item.stocks?.find((s) => s.location === "RAK");
  return stock ? Number(stock.qty) : 0;
}

function getGudangQty(item: MinimarketItem): number {
  const stock = item.stocks?.find((s) => s.location === "GUDANG");
  return stock ? Number(stock.qty) : 0;
}

function getTotalQty(item: MinimarketItem): number {
  return getRakQty(item) + getGudangQty(item);
}

function calculateMargin(item: MinimarketItem): number {
  const modal = Number(item.harga_modal);
  const jual = Number(item.harga_jual);
  if (!modal || modal <= 0) return 0;
  return Math.round(((jual - modal) / modal) * 100);
}

function formatRupiah(num: number | string): string {
  const val = Number(num) || 0;
  return val.toLocaleString("id-ID");
}

function copyBarcode(barcode: string) {
  navigator.clipboard.writeText(barcode);
  toast.success(`Barcode ${barcode} disalin ke clipboard!`);
}

function generateRandomBarcode() {
  const prefix = "899";
  const randomPart = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  formData.value.barcode = prefix + randomPart;
}

// API Loaders
async function loadAllData() {
  loading.value = true;
  try {
    const keyword = searchQuery.value.trim();
    scanNotice.value = null;

    let itemList: MinimarketItem[];

    // Exact barcode scan (>= 8 digit) memakai endpoint lookup khusus.
    if (/^\d{8,}$/.test(keyword)) {
      try {
        const scanned = await getMinimarketItemByBarcode(keyword);
        itemList = [scanned];
        scanNotice.value = `${scanned.barcode} — ${scanned.nama_barang}`;
      } catch {
        itemList = await getMinimarketItems(keyword, selectedRackFilter.value);
      }
    } else {
      itemList = await getMinimarketItems(keyword, selectedRackFilter.value);
    }

    const [rackList, uomList] = await Promise.all([getCategoryRacks(), getUoms()]);
    items.value = itemList;
    categoryRacks.value = rackList;
    uoms.value = uomList;
  } catch (error: any) {
    console.error("Gagal memuat data barang:", error);
    toast.error(error.message || "Gagal memuat data dari server");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  loadAllData();
}

function resetFilters() {
  searchQuery.value = "";
  selectedRackFilter.value = "";
  scanNotice.value = null;
  loadAllData();
}

// Modal Handlers
function openCreateModal() {
  isEditMode.value = false;
  currentEditId.value = null;
  formData.value = {
    barcode: "",
    nama_barang: "",
    category_rack_id: categoryRacks.value[0]?.id || "",
    uom_id: uoms.value[0]?.id || "",
    harga_modal: 0,
    harga_jual: 0,
    catatan: "",
    lead_time_days: 3,
    safety_stock_pcs: 10,
    max_stock_pcs: 100,
  };
  generateRandomBarcode();
  isFormModalOpen.value = true;
}

function openEditModal(item: MinimarketItem) {
  isEditMode.value = true;
  currentEditId.value = item.id;
  formData.value = {
    barcode: item.barcode,
    nama_barang: item.nama_barang,
    category_rack_id: item.category_rack_id,
    uom_id: item.uom_id,
    harga_modal: Number(item.harga_modal),
    harga_jual: Number(item.harga_jual),
    catatan: item.catatan || "",
    lead_time_days: 3,
    safety_stock_pcs: 10,
    max_stock_pcs: 100,
  };
  isFormModalOpen.value = true;
}

async function handleSubmitForm() {
  if (!formData.value.nama_barang || !formData.value.category_rack_id || !formData.value.uom_id) {
    toast.error("Mohon lengkapi seluruh kolom wajib");
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEditMode.value && currentEditId.value) {
      await updateMinimarketItem(currentEditId.value, {
        nama_barang: formData.value.nama_barang,
        category_rack_id: formData.value.category_rack_id,
        uom_id: formData.value.uom_id,
        harga_modal: formData.value.harga_modal,
        harga_jual: formData.value.harga_jual,
        catatan: formData.value.catatan,
      });
      toast.success("Data barang berhasil diperbarui!");
    } else {
      await createMinimarketItem({
        barcode: formData.value.barcode,
        nama_barang: formData.value.nama_barang,
        category_rack_id: formData.value.category_rack_id,
        uom_id: formData.value.uom_id,
        harga_modal: formData.value.harga_modal,
        harga_jual: formData.value.harga_jual,
        catatan: formData.value.catatan,
        lead_time_days: formData.value.lead_time_days,
        safety_stock_pcs: formData.value.safety_stock_pcs,
        max_stock_pcs: formData.value.max_stock_pcs,
      });
      toast.success("Barang baru berhasil didaftarkan!");
    }

    isFormModalOpen.value = false;
    await loadAllData();
  } catch (error: any) {
    console.error("Gagal menyimpan barang:", error);
    toast.error(error.message || "Gagal menyimpan data barang");
  } finally {
    isSubmitting.value = false;
  }
}

function openDeleteDialog(item: MinimarketItem) {
  itemToDelete.value = item;
  isDeleteDialogOpen.value = true;
}

async function handleConfirmDelete() {
  if (!itemToDelete.value) return;

  isDeleting.value = true;
  try {
    await deleteMinimarketItem(itemToDelete.value.id);
    toast.success(`Barang ${itemToDelete.value.nama_barang} berhasil dihapus`);
    isDeleteDialogOpen.value = false;
    itemToDelete.value = null;
    await loadAllData();
  } catch (error: any) {
    console.error("Gagal menghapus barang:", error);
    toast.error(error.message || "Gagal menghapus barang");
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  loadAllData();
});
</script>

