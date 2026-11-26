<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (1.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Kategori &amp; Rak
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Master zona penyimpanan: rak pajangan toko (RAK) dan blok gudang belakang (GUDANG).
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="loadRacks" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push('/inventory/master/category-racks/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Kategori / Rak</span>
        </Button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Zona Rak Pajangan</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ rakCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Lokasi tampilan produk</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Store class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Blok Gudang</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ gudangCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Penyimpanan stok cadangan</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Warehouse class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Zona Aktif</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ activeCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Dari {{ racks.length }} total zona</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Layers class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Zona Non-aktif</p>
            <h3 class="text-2xl font-bold text-slate-500 mt-1">{{ inactiveCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Tidak dipakai penempatan baru</p>
          </div>
          <div class="p-3 bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-300 rounded-xl">
            <Archive class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4 space-y-3">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari kode, nama, atau lokasi zona..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="loadRacks"
            />
          </div>
          <Button variant="outline" size="sm" :disabled="loading" @click="loadRacks">Cari</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilters">
            Reset
          </Button>
        </div>

        <Tabs :model-value="activeTab" class="w-full">
          <TabsList class="w-full justify-start h-auto flex-wrap gap-1 bg-slate-50 dark:bg-slate-900/70 p-1">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="text-xs h-8 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
              <Badge variant="secondary" class="ml-1 text-[10px]">{{ tabCount(tab.value) }}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Kode &amp; Nama Zona</th>
              <th class="px-4 py-3.5">Tipe Zona</th>
              <th class="px-4 py-3.5">Lokasi / Blok</th>
              <th class="px-4 py-3.5">Catatan</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredRacks.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <Tags class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada kategori / rak</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canManage ? 'Klik "+ Tambah Kategori / Rak" untuk membuat zona pertama.' : 'Hubungi admin untuk menambahkan zona penyimpanan.' }}
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="rack in filteredRacks"
              :key="rack.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ rack.nama }}</div>
                <span class="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1">
                  <Hash class="w-3.5 h-3.5 text-slate-400" />
                  {{ rack.kode }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <Badge
                  variant="outline"
                  :class="rack.tipe_zona === 'RAK'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
                >
                  {{ rack.tipe_zona === 'RAK' ? 'RAK PAJANGAN' : 'GUDANG' }}
                </Badge>
              </td>
              <td class="px-4 py-3.5">
                <span v-if="rack.lokasi" class="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin class="w-3.5 h-3.5 text-slate-400" />
                  {{ rack.lokasi }}
                </span>
                <span v-else class="text-xs text-slate-400 italic">-</span>
              </td>
              <td class="px-4 py-3.5">
                <p class="text-xs text-slate-500 max-w-[240px] truncate" :title="rack.catatan || ''">
                  {{ rack.catatan || '-' }}
                </p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="rack.is_active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
                >
                  {{ rack.is_active ? 'Aktif' : 'Non-aktif' }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Lihat Detail Zona"
                    @click="router.push(`/inventory/master/category-racks/view/${rack.id}`)"
                  >
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Edit zona"
                    @click="router.push(`/inventory/master/category-racks/form/${rack.id}`)"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Hapus zona"
                    @click="openDeleteDialog(rack)"
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

    <!-- Delete Dialog -->
    <GlobalDialog
      v-model:open="isDeleteDialogOpen"
      title="Hapus Kategori / Rak"
      description="Apakah Anda yakin ingin menghapus zona penyimpanan ini?"
    >
      <div v-if="rackToDelete" class="space-y-4">
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
          <p class="font-semibold">{{ rackToDelete.nama }}</p>
          <p class="text-xs mt-1 font-mono">Kode: {{ rackToDelete.kode }} ({{ rackToDelete.tipe_zona }})</p>
          <p class="text-xs mt-2 text-rose-600 dark:text-rose-400">
            Zona yang masih dipakai barang tidak bisa dihapus. Non-aktifkan saja agar riwayat tetap utuh.
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="handleConfirmDelete" class="flex items-center gap-1.5">
            <RefreshCw v-if="isDeleting" class="w-4 h-4 animate-spin" />
            <span>Ya, Hapus Zona</span>
          </Button>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Archive,
  Edit,
  Eye,
  Hash,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Store,
  Tags,
  Trash2,
  Warehouse,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import {
  deleteCategoryRack,
  getCategoryRacks,
  type CategoryRack,
  type ZoneType,
} from "./categoryRackService";

type TabValue = "SEMUA" | ZoneType;

const router = useRouter();
const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

const racks = ref<CategoryRack[]>([]);
const loading = ref(false);
const isDeleting = ref(false);

const searchQuery = ref("");
const activeTab = ref<TabValue>("SEMUA");

const tabs: Array<{ label: string; value: TabValue }> = [
  { label: "Semua Zona", value: "SEMUA" },
  { label: "Rak Pajangan", value: "RAK" },
  { label: "Gudang", value: "GUDANG" },
];

const isDeleteDialogOpen = ref(false);
const rackToDelete = ref<CategoryRack | null>(null);

const filteredRacks = computed(() =>
  racks.value.filter((rack) => activeTab.value === "SEMUA" || rack.tipe_zona === activeTab.value),
);

const rakCount = computed(() => racks.value.filter((rack) => rack.tipe_zona === "RAK").length);
const gudangCount = computed(() => racks.value.filter((rack) => rack.tipe_zona === "GUDANG").length);
const activeCount = computed(() => racks.value.filter((rack) => rack.is_active).length);
const inactiveCount = computed(() => racks.value.filter((rack) => !rack.is_active).length);

function tabCount(tab: TabValue): number {
  if (tab === "SEMUA") return racks.value.length;
  return racks.value.filter((rack) => rack.tipe_zona === tab).length;
}

async function loadRacks() {
  loading.value = true;
  try {
    racks.value = await getCategoryRacks({ search: searchQuery.value });
  } catch (error: any) {
    console.error("Gagal memuat kategori & rak:", error);
    toast.error(error.message || "Gagal memuat data kategori & rak");
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  searchQuery.value = "";
  activeTab.value = "SEMUA";
  loadRacks();
}

function openDeleteDialog(rack: CategoryRack) {
  rackToDelete.value = rack;
  isDeleteDialogOpen.value = true;
}

async function handleConfirmDelete() {
  if (!rackToDelete.value) return;

  isDeleting.value = true;
  try {
    await deleteCategoryRack(rackToDelete.value.id);
    toast.success(`Zona ${rackToDelete.value.nama} berhasil dihapus`);
    isDeleteDialogOpen.value = false;
    rackToDelete.value = null;
    await loadRacks();
  } catch (error: any) {
    console.error("Gagal menghapus kategori / rak:", error);
    toast.error(error.message || "Gagal menghapus zona. Pastikan tidak ada barang yang memakai zona ini.");
  } finally {
    isDeleting.value = false;
  }
}

onMounted(loadRacks);
</script>
