<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <span
          class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
        >
          Modul 2 : Inventory (1.4)
        </span>
        <h1
          class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1"
        >
          Batas Pemesanan Barang (ROP)
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Reorder Point per barang: pemicu usulan Purchase Request otomatis saat
          stok menyentuh batas.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="loadData"
          class="flex items-center gap-1.5"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <!-- <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          :disabled="availableItems.length === 0"
          @click="openAttachModal"
        >
          <Plus class="w-4 h-4" />
          <span>Atur ROP Barang</span>
        </Button> -->
      </div>
    </div>

    <!-- Formula Info
    <div class="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
      <Info class="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        Rumus ROP = <span class="font-semibold">(rata-rata penjualan harian &times; lead time) + safety stock</span>.
        Nilai ROP dihitung otomatis oleh server saat pengaturan disimpan.
      </p>
    </div> -->

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Item Terpantau
            </p>
            <h3
              class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1"
            >
              {{ ropSettings.length }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Punya pengaturan ROP</p>
          </div>
          <div
            class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl"
          >
            <Target class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Perlu Restock
            </p>
            <h3
              class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1"
            >
              {{ belowRopCount }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Total stok &le; ROP</p>
          </div>
          <div
            class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl"
          >
            <TriangleAlert class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Auto-PR Aktif
            </p>
            <h3
              class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1"
            >
              {{ autoPrCount }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">PR dibuat otomatis</p>
          </div>
          <div
            class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl"
          >
            <Zap class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Estimasi Kebutuhan
            </p>
            <h3
              class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1"
            >
              {{ suggestedRestock.toLocaleString("id-ID") }}
              <span class="text-xs font-normal text-slate-500">Pcs</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Sampai kapasitas maksimum
            </p>
          </div>
          <div
            class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl"
          >
            <PackagePlus class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nama barang atau barcode..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="loadRopSettings"
            />
          </div>
          <div class="w-full md:w-52">
            <select
              v-model="statusFilter"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status Stok</option>
              <option value="RESTOCK">Perlu Restock</option>
              <option value="WARNING">Mendekati ROP</option>
              <option value="SAFE">Aman</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="loadRopSettings"
            >Cari</Button
          >
          <Button
            variant="ghost"
            size="sm"
            class="text-xs text-slate-500"
            @click="resetFilters"
            >Reset</Button
          >
        </div>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card
      class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table
          class="w-full text-left text-sm text-slate-600 dark:text-slate-300"
        >
          <thead
            class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800"
          >
            <tr>
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5 text-center">Stok (Gudang / Rak)</th>
              <th class="px-4 py-3.5 text-center">Lead Time</th>
              <th class="px-4 py-3.5 text-center">Safety Stock</th>
              <th class="px-4 py-3.5 text-center">Avg / Hari</th>
              <th class="px-4 py-3.5 text-center">ROP</th>
              <th class="px-4 py-3.5 text-center">Max</th>
              <th class="px-4 py-3.5 text-center">Auto-PR</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <!-- <th v-if="canManage" class="px-4 py-3.5 text-center">Aksi</th> -->
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="10" class="px-4 py-4">
                  <Skeleton class="h-6 w-full" />
                </td>
              </tr>
            </template>

            <tr v-else-if="filteredSettings.length === 0">
              <td colspan="10" class="px-4 py-12 text-center text-slate-500">
                <Target
                  class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2"
                />
                <p class="font-medium text-slate-700 dark:text-slate-300">
                  Belum ada pengaturan ROP
                </p>
                <p class="text-xs text-slate-400 mt-1">
                  {{
                    canManage
                      ? 'Klik "Atur ROP Barang" untuk memilih barang dan menentukan batas pemesanan.'
                      : "Hubungi admin untuk mengatur batas pemesanan barang."
                  }}
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="setting in filteredSettings"
              :key="setting.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">
                  {{ setting.item?.nama_barang || "-" }}
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    class="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                  >
                    {{ setting.item?.barcode || "-" }}
                  </span>
                  <span class="text-[11px] text-slate-400">{{
                    setting.item?.uom?.satuan_beli || "Pcs"
                  }}</span>
                </div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div
                  class="flex items-center justify-center gap-1.5 font-mono text-xs"
                >
                  <span
                    class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                    :title="'Stok gudang'"
                  >
                    G: {{ gudangQty(setting) }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                    :title="'Stok rak'"
                  >
                    R: {{ rakQty(setting) }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  Total {{ totalQty(setting) }} Pcs
                </div>
              </td>
              <td class="px-4 py-3.5 text-center font-mono text-xs">
                {{ setting.lead_time_days }} hari
              </td>
              <td class="px-4 py-3.5 text-center font-mono text-xs">
                {{ setting.safety_stock_pcs }} Pcs
              </td>
              <td class="px-4 py-3.5 text-center font-mono text-xs">
                {{ formatDecimal(setting.avg_daily_sales) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <span
                  class="font-mono font-semibold text-slate-900 dark:text-white"
                  >{{ setting.rop_pcs }}</span
                >
                <span class="text-[11px] text-slate-400"> Pcs</span>
              </td>
              <td class="px-4 py-3.5 text-center font-mono text-xs">
                {{ setting.max_stock_pcs }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="
                    setting.is_auto_pr
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                  "
                >
                  {{ setting.is_auto_pr ? "Aktif" : "Mati" }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="stockStatus(setting).className"
                >
                  {{ stockStatus(setting).label }}
                </Badge>
              </td>
              <!-- <td v-if="canManage" class="px-4 py-3.5 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  title="Edit pengaturan ROP"
                  @click="openEditModal(setting)"
                >
                  <Edit class="w-4 h-4" />
                </Button>
              </td> -->
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Form Dialog -->
    <GlobalDialog
      v-model:open="isFormModalOpen"
      :title="isEditMode ? 'Edit Pengaturan ROP' : 'Atur ROP Barang'"
      :description="
        isEditMode
          ? 'Perbarui parameter batas pemesanan barang.'
          : 'Pilih barang yang belum memiliki pengaturan ROP.'
      "
    >
      <form @submit.prevent="handleSubmitForm" class="space-y-4">
        <!-- Item selector (attach mode) -->
        <div v-if="!isEditMode">
          <label
            class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Barang <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="selectedItemId"
            required
            class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="" disabled>Pilih barang...</option>
            <option
              v-for="item in availableItems"
              :key="item.id"
              :value="item.id"
            >
              {{ item.nama_barang }} ({{ item.barcode }})
            </option>
          </select>
          <p
            v-if="availableItems.length === 0"
            class="text-xs text-amber-600 dark:text-amber-400 mt-1"
          >
            Semua barang aktif sudah memiliki pengaturan ROP.
          </p>
        </div>

        <!-- Selected item summary -->
        <div
          v-else-if="activeSetting"
          class="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-lg"
        >
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {{ activeSetting.item?.nama_barang }}
          </p>
          <p class="text-xs text-slate-500 mt-0.5 font-mono">
            {{ activeSetting.item?.barcode }}
          </p>
          <p class="text-xs text-slate-500 mt-1">
            Stok saat ini: {{ totalQty(activeSetting) }} Pcs (Gudang
            {{ gudangQty(activeSetting) }} / Rak {{ rakQty(activeSetting) }})
          </p>
          <p
            v-if="activeSetting.last_calculated_at"
            class="text-[11px] text-slate-400 mt-1"
          >
            Terakhir dihitung:
            {{ formatDate(activeSetting.last_calculated_at) }}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Lead Time (Hari) <span class="text-rose-500">*</span>
            </label>
            <Input
              v-model.number="formData.lead_time_days"
              type="number"
              min="1"
              step="1"
              required
              class="font-mono text-sm"
            />
          </div>
          <div>
            <label
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Safety Stock (Pcs) <span class="text-rose-500">*</span>
            </label>
            <Input
              v-model.number="formData.safety_stock_pcs"
              type="number"
              min="0"
              step="1"
              required
              class="font-mono text-sm"
            />
          </div>
          <div>
            <label
              class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kapasitas Max (Pcs) <span class="text-rose-500">*</span>
            </label>
            <Input
              v-model.number="formData.max_stock_pcs"
              type="number"
              min="1"
              step="1"
              required
              class="font-mono text-sm"
            />
          </div>
        </div>

        <div
          class="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300"
        >
          Preview ROP:
          <span class="font-semibold font-mono">
            ({{ formatDecimal(currentAvgSales) }} &times;
            {{ formData.lead_time_days || 0 }}) +
            {{ formData.safety_stock_pcs || 0 }} = {{ previewRop }} Pcs
          </span>
          <p
            class="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80"
          >
            Nilai final dihitung ulang oleh server berdasarkan rata-rata
            penjualan harian terbaru.
          </p>
        </div>

        <label
          class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <input
            v-model="formData.is_auto_pr"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Buat Purchase Request otomatis saat stok menyentuh ROP
        </label>

        <div
          class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
        >
          <Button
            type="button"
            variant="outline"
            @click="isFormModalOpen = false"
            >Batal</Button
          >
          <Button
            type="submit"
            :disabled="isSubmitting"
            class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <span>{{
              isEditMode ? "Simpan Perubahan" : "Simpan Pengaturan"
            }}</span>
          </Button>
        </div>
      </form>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Edit,
  Info,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Target,
  TriangleAlert,
  Zap,
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
  type MinimarketItem,
} from "../m_items/minimarketItemService";
import {
  getRopSettings,
  updateRopSetting,
  type RopSetting,
} from "./ropService";

type StatusFilter = "ALL" | "RESTOCK" | "WARNING" | "SAFE";

const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

const ropSettings = ref<RopSetting[]>([]);
const allItems = ref<MinimarketItem[]>([]);
const loading = ref(false);
const isSubmitting = ref(false);

const searchQuery = ref("");
const statusFilter = ref<StatusFilter>("ALL");

const isFormModalOpen = ref(false);
const isEditMode = ref(false);
const activeSetting = ref<RopSetting | null>(null);
const selectedItemId = ref("");

const formData = ref({
  lead_time_days: 3,
  safety_stock_pcs: 10,
  max_stock_pcs: 100,
  is_auto_pr: true,
});

const availableItems = computed(() =>
  allItems.value.filter((item) => item.is_active && !item.rop_setting),
);

const belowRopCount = computed(
  () =>
    ropSettings.value.filter(
      (setting) => totalQty(setting) <= Number(setting.rop_pcs),
    ).length,
);

const autoPrCount = computed(
  () => ropSettings.value.filter((setting) => setting.is_auto_pr).length,
);

const suggestedRestock = computed(() =>
  ropSettings.value.reduce((sum, setting) => {
    const total = totalQty(setting);
    if (total > Number(setting.rop_pcs)) return sum;
    return sum + Math.max(0, Number(setting.max_stock_pcs) - total);
  }, 0),
);

const filteredSettings = computed(() =>
  ropSettings.value.filter((setting) => {
    if (statusFilter.value === "ALL") return true;
    return stockStatus(setting).key === statusFilter.value;
  }),
);

const currentAvgSales = computed(() => {
  if (activeSetting.value)
    return Number(activeSetting.value.avg_daily_sales) || 0;
  return 0;
});

const previewRop = computed(() =>
  Math.ceil(
    currentAvgSales.value * (formData.value.lead_time_days || 0) +
      (formData.value.safety_stock_pcs || 0),
  ),
);

function getStocks(setting: RopSetting) {
  return setting.item?.stocks || [];
}

function rakQty(setting: RopSetting): number {
  const stock = getStocks(setting).find((s) => s.location === "RAK");
  return stock ? Number(stock.qty) : 0;
}

function gudangQty(setting: RopSetting): number {
  const stock = getStocks(setting).find((s) => s.location === "GUDANG");
  return stock ? Number(stock.qty) : 0;
}

function totalQty(setting: RopSetting): number {
  return getStocks(setting).reduce((sum, stock) => sum + Number(stock.qty), 0);
}

function stockStatus(setting: RopSetting): {
  key: "RESTOCK" | "WARNING" | "SAFE";
  label: string;
  className: string;
} {
  const total = totalQty(setting);
  const rop = Number(setting.rop_pcs) || 0;

  if (total <= rop) {
    return {
      key: "RESTOCK",
      label: "Perlu Restock",
      className:
        "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    };
  }

  if (rop > 0 && total <= Math.ceil(rop * 1.25)) {
    return {
      key: "WARNING",
      label: "Mendekati ROP",
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }

  return {
    key: "SAFE",
    label: "Aman",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  };
}

function formatDecimal(value: number | string): string {
  return (Number(value) || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function loadRopSettings() {
  loading.value = true;
  try {
    ropSettings.value = await getRopSettings(searchQuery.value);
  } catch (error: any) {
    console.error("Gagal memuat pengaturan ROP:", error);
    toast.error(error.message || "Gagal memuat pengaturan ROP");
  } finally {
    loading.value = false;
  }
}

async function loadItems() {
  try {
    allItems.value = await getMinimarketItems();
  } catch (error: any) {
    console.error("Gagal memuat daftar barang:", error);
  }
}

async function loadData() {
  await Promise.all([loadRopSettings(), loadItems()]);
}

function resetFilters() {
  searchQuery.value = "";
  statusFilter.value = "ALL";
  loadRopSettings();
}

function openAttachModal() {
  isEditMode.value = false;
  activeSetting.value = null;
  selectedItemId.value = "";
  formData.value = {
    lead_time_days: 3,
    safety_stock_pcs: 10,
    max_stock_pcs: 100,
    is_auto_pr: true,
  };
  isFormModalOpen.value = true;
}

function openEditModal(setting: RopSetting) {
  isEditMode.value = true;
  activeSetting.value = setting;
  formData.value = {
    lead_time_days: Number(setting.lead_time_days) || 1,
    safety_stock_pcs: Number(setting.safety_stock_pcs) || 0,
    max_stock_pcs: Number(setting.max_stock_pcs) || 1,
    is_auto_pr: Boolean(setting.is_auto_pr),
  };
  isFormModalOpen.value = true;
}

async function handleSubmitForm() {
  const itemId = isEditMode.value
    ? activeSetting.value?.item_id
    : selectedItemId.value;

  if (!itemId) {
    toast.error("Pilih barang terlebih dahulu");
    return;
  }
  if (!formData.value.lead_time_days || formData.value.lead_time_days < 1) {
    toast.error("Lead time minimal 1 hari");
    return;
  }
  if (formData.value.safety_stock_pcs < 0) {
    toast.error("Safety stock tidak boleh negatif");
    return;
  }
  if (!formData.value.max_stock_pcs || formData.value.max_stock_pcs < 1) {
    toast.error("Kapasitas maksimum minimal 1 Pcs");
    return;
  }

  isSubmitting.value = true;
  try {
    await updateRopSetting(itemId, {
      lead_time_days: Number(formData.value.lead_time_days),
      safety_stock_pcs: Number(formData.value.safety_stock_pcs),
      max_stock_pcs: Number(formData.value.max_stock_pcs),
      is_auto_pr: formData.value.is_auto_pr,
    });

    toast.success("Pengaturan ROP berhasil disimpan");
    isFormModalOpen.value = false;
    await loadData();
  } catch (error: any) {
    console.error("Gagal menyimpan pengaturan ROP:", error);
    toast.error(error.message || "Gagal menyimpan pengaturan ROP");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(loadData);
</script>
