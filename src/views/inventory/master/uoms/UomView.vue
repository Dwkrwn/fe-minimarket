<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (1.3)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Satuan &amp; Konversi
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Multi-satuan berjenjang: beli per kardus/dus, jual per Pcs dengan rasio konversi tetap.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="loadUoms" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push('/inventory/master/uoms/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Satuan</span>
        </Button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Satuan (UOM)</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ uoms.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ activeCount }} satuan aktif</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Ruler class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Rasio Terbesar</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              1 : {{ maxRatio.toLocaleString("id-ID") }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Satuan beli ke Pcs</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Boxes class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Rata-rata Konversi</p>
            <h3 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {{ averageRatio.toLocaleString("id-ID") }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Pcs per satuan beli</p>
          </div>
          <div class="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Calculator class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Satuan Non-aktif</p>
            <h3 class="text-2xl font-bold text-slate-500 mt-1">{{ inactiveCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Tidak dipakai barang baru</p>
          </div>
          <div class="p-3 bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-300 rounded-xl">
            <Archive class="w-6 h-6" />
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
              placeholder="Cari kode, nama satuan, atau satuan beli..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="loadUoms"
            />
          </div>
          <div class="w-full md:w-48">
            <select
              v-model="statusFilter"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Non-aktif</option>
            </select>
          </div>
          <Button variant="outline" size="sm" :disabled="loading" @click="loadUoms">Cari</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilters">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Kode &amp; Nama Satuan</th>
              <th class="px-4 py-3.5">Satuan Beli</th>
              <th class="px-4 py-3.5 text-center">Rasio Konversi</th>
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

            <tr v-else-if="filteredUoms.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <Ruler class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada satuan</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canManage ? 'Klik "+ Tambah Satuan" untuk membuat konversi pertama.' : 'Hubungi admin untuk menambahkan satuan.' }}
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="uom in filteredUoms"
              :key="uom.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ uom.nama_uom }}</div>
                <span class="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1">
                  <Hash class="w-3.5 h-3.5 text-slate-400" />
                  {{ uom.kode_uom }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <Badge variant="secondary" class="font-mono">{{ uom.satuan_beli }}</Badge>
                <p class="text-[11px] text-slate-500 mt-1">dasar: {{ uom.satuan_dasar }}</p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="inline-flex flex-col items-center">
                  <span class="font-mono font-semibold text-slate-900 dark:text-white">
                    1 {{ uom.satuan_beli }} = {{ Number(uom.rasio_konversi).toLocaleString("id-ID") }} {{ uom.satuan_dasar }}
                  </span>
                  <span class="text-[11px] text-slate-400 mt-0.5">
                    {{ Number(uom.rasio_konversi).toLocaleString("id-ID") }} Pcs
                  </span>
                </div>
              </td>
              <td class="px-4 py-3.5">
                <p class="text-xs text-slate-500 max-w-[220px] truncate" :title="uom.catatan || ''">
                  {{ uom.catatan || '-' }}
                </p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="uom.is_active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
                >
                  {{ uom.is_active ? 'Aktif' : 'Non-aktif' }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Lihat Detail Satuan"
                    @click="router.push(`/inventory/master/uoms/view/${uom.id}`)"
                  >
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Edit satuan"
                    @click="router.push(`/inventory/master/uoms/form/${uom.id}`)"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Hapus satuan"
                    @click="openDeleteDialog(uom)"
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
      title="Hapus Satuan"
      description="Apakah Anda yakin ingin menghapus satuan ini?"
    >
      <div v-if="uomToDelete" class="space-y-4">
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
          <p class="font-semibold">{{ uomToDelete.nama_uom }}</p>
          <p class="text-xs mt-1 font-mono">Kode: {{ uomToDelete.kode_uom }}</p>
          <p class="text-xs mt-2 text-rose-600 dark:text-rose-400">
            Satuan yang masih dipakai barang tidak bisa dihapus. Non-aktifkan saja agar data barang tetap valid.
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="handleConfirmDelete" class="flex items-center gap-1.5">
            <RefreshCw v-if="isDeleting" class="w-4 h-4 animate-spin" />
            <span>Ya, Hapus Satuan</span>
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
  Boxes,
  Calculator,
  Edit,
  Eye,
  Hash,
  Plus,
  RefreshCw,
  Ruler,
  Search,
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
  deleteUom,
  getUoms,
  type Uom,
} from "./uomService";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const router = useRouter();
const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

const uoms = ref<Uom[]>([]);
const loading = ref(false);
const isDeleting = ref(false);

const searchQuery = ref("");
const statusFilter = ref<StatusFilter>("ALL");

const isDeleteDialogOpen = ref(false);
const uomToDelete = ref<Uom | null>(null);

const filteredUoms = computed(() =>
  uoms.value.filter((uom) => {
    if (statusFilter.value === "ACTIVE") return uom.is_active;
    if (statusFilter.value === "INACTIVE") return !uom.is_active;
    return true;
  }),
);

const activeCount = computed(() => uoms.value.filter((uom) => uom.is_active).length);
const inactiveCount = computed(() => uoms.value.filter((uom) => !uom.is_active).length);

const maxRatio = computed(() =>
  uoms.value.reduce((max, uom) => Math.max(max, Number(uom.rasio_konversi) || 0), 0),
);

const averageRatio = computed(() => {
  if (uoms.value.length === 0) return 0;
  const total = uoms.value.reduce((sum, uom) => sum + (Number(uom.rasio_konversi) || 0), 0);
  return Math.round(total / uoms.value.length);
});

async function loadUoms() {
  loading.value = true;
  try {
    uoms.value = await getUoms(searchQuery.value);
  } catch (error: any) {
    console.error("Gagal memuat satuan:", error);
    toast.error(error.message || "Gagal memuat data satuan");
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  searchQuery.value = "";
  statusFilter.value = "ALL";
  loadUoms();
}

function openDeleteDialog(uom: Uom) {
  uomToDelete.value = uom;
  isDeleteDialogOpen.value = true;
}

async function handleConfirmDelete() {
  if (!uomToDelete.value) return;

  isDeleting.value = true;
  try {
    await deleteUom(uomToDelete.value.id);
    toast.success(`Satuan ${uomToDelete.value.nama_uom} berhasil dihapus`);
    isDeleteDialogOpen.value = false;
    uomToDelete.value = null;
    await loadUoms();
  } catch (error: any) {
    console.error("Gagal menghapus satuan:", error);
    toast.error(error.message || "Gagal menghapus satuan. Pastikan tidak ada barang yang memakainya.");
  } finally {
    isDeleting.value = false;
  }
}

onMounted(loadUoms);
</script>
