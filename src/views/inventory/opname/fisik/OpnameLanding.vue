<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (3.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Hitung Fisik / Stock Opname
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Buat lembar hitung fisik per lokasi, isi jumlah nyata di lapangan, lalu ajukan ke
          Penyesuaian Stok. Draft yang salah dapat dihapus selama belum diajukan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" class="flex items-center gap-1.5" @click="refreshAll">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canOperate"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          @click="openCreate"
        >
          <Plus class="w-4 h-4" />
          <span>Buat Opname</span>
        </Button>
      </div>
    </div>

    <!-- Role notice -->
    <div
      v-if="!canOperate"
      class="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"
    >
      <ShieldAlert class="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        Hanya role <strong>GUDANG</strong>, <strong>ADMIN</strong>, dan <strong>SUPER_ADMIN</strong>
        yang dapat membuat atau mengisi lembar hitung fisik. Anda tetap dapat melihat riwayatnya.
      </p>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Draft Berjalan</p>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ draftCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Belum diajukan</p>
          </div>
          <div class="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
            <FilePenLine class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Menunggu Penyesuaian</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ submittedCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Status SUBMITTED</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <ClipboardList class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Selesai</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ approvedCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Status APPROVED</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Baris Selisih</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ pageSelisih }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Pada halaman ini</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <TriangleAlert class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Filters -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div class="relative md:col-span-2">
            <label class="block text-[11px] font-medium text-slate-500 mb-1">Pencarian</label>
            <Search class="absolute left-3 top-[30px] w-4 h-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari no. opname / barcode / nama barang..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="applyFilter"
            />
          </div>

          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
            <select v-model="statusFilter" class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Menunggu Penyesuaian</option>
              <option value="APPROVED">Selesai</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-1">Lokasi</label>
            <select v-model="locationFilter" class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Semua Lokasi</option>
              <option value="RAK">Rak Pajangan</option>
              <option value="GUDANG">Gudang</option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-2 mt-3">
          <Button variant="outline" size="sm" :disabled="loading" @click="applyFilter">Terapkan</Button>
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
              <th class="px-4 py-3.5">No. Opname</th>
              <th class="px-4 py-3.5 text-center">Lokasi</th>
              <th class="px-4 py-3.5 text-right">Barang</th>
              <th class="px-4 py-3.5 text-right">Baris Selisih</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5">Dibuat Oleh</th>
              <th class="px-4 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 5" :key="'skel-' + n">
                <td colspan="7" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="rows.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-slate-500">
                <PackageSearch class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada lembar opname</p>
                <p class="text-xs text-slate-400 mt-1">
                  Klik "Buat Opname" untuk memulai hitung fisik di Gudang atau Rak.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in rows"
              :key="row.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors align-top"
            >
              <td class="px-4 py-3.5 whitespace-nowrap">
                <div class="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                  {{ row.no_opname }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">{{ formatDate(row.tgl_opname || row.createdAt) }}</div>
                <p v-if="row.catatan" class="text-[11px] text-slate-500 max-w-[240px] truncate mt-0.5" :title="row.catatan">
                  {{ row.catatan }}
                </p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex flex-wrap justify-center gap-1">
                  <Badge
                    v-for="location in row.locations || []"
                    :key="location"
                    variant="outline"
                    :class="location === 'RAK'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
                  >
                    {{ location }}
                  </Badge>
                  <span v-if="!row.locations || row.locations.length === 0" class="text-xs text-slate-400">-</span>
                </div>
              </td>
              <td class="px-4 py-3.5 text-right font-mono text-slate-800 dark:text-slate-200">
                {{ Number(row.total_item || 0).toLocaleString("id-ID") }}
              </td>
              <td class="px-4 py-3.5 text-right">
                <span :class="row.item_selisih > 0 ? 'font-mono font-semibold text-amber-600 dark:text-amber-400' : 'font-mono text-slate-400'">
                  {{ Number(row.item_selisih || 0).toLocaleString("id-ID") }}
                </span>
                <div v-if="row.qty_selisih > 0" class="text-[11px] text-slate-400">
                  {{ Number(row.qty_selisih).toLocaleString("id-ID") }} Pcs
                </div>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</Badge>
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs text-slate-600 dark:text-slate-300">{{ row.user?.name || "Sistem" }}</span>
              </td>
              <td class="px-4 py-3.5">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="row.status === 'DRAFT' && canOperate"
                    size="sm"
                    variant="outline"
                    class="h-8 text-xs"
                    @click="openCount(row.id)"
                  >
                    Isi Hitung
                  </Button>
                  <Button
                    v-else-if="row.status === 'SUBMITTED' && canManage"
                    size="sm"
                    variant="outline"
                    class="h-8 text-xs"
                    @click="openAdjustment(row.id)"
                  >
                    Sesuaikan
                  </Button>
                  <Button
                    v-else
                    size="sm"
                    variant="outline"
                    class="h-8 text-xs"
                    @click="openCount(row.id)"
                  >
                    Lihat
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-8 w-8 p-0 text-slate-500"
                    title="Cetak formulir"
                    @click="printOpname(row.id)"
                  >
                    <Printer class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="row.status === 'DRAFT' && canManage"
                    size="sm"
                    variant="ghost"
                    class="h-8 w-8 p-0 text-rose-500 hover:text-rose-700"
                    title="Hapus draft"
                    @click="askDelete(row)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-slate-500">
          Menampilkan {{ rows.length }} dari {{ total.toLocaleString("id-ID") }} dokumen
        </p>
        <div class="flex items-center gap-3 text-xs text-slate-500">
          <span>Halaman {{ page }} / {{ totalPages }}</span>
          <div class="flex items-center gap-1">
            <Button variant="outline" size="sm" class="h-8" :disabled="loading || page <= 1" @click="goToPage(page - 1)">
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" class="h-8" :disabled="loading || page >= totalPages" @click="goToPage(page + 1)">
              Berikutnya
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Create dialog -->
    <GlobalDialog
      :open="isCreateOpen"
      type="info"
      title="Buat Lembar Hitung Fisik"
      description="Pilih lokasi yang akan dihitung. Seluruh barang aktif pada lokasi tersebut akan dimasukkan, termasuk barang yang stok sistemnya 0."
      confirm-text="Buat Draft"
      cancel-text="Batal"
      :is-loading="creating"
      :show-cancel="true"
      @update:open="isCreateOpen = $event"
      @confirm="createDraft"
      @cancel="isCreateOpen = false"
    >
      <div class="space-y-3">
        <div>
          <label class="block text-[11px] font-medium text-slate-500 mb-1">Lokasi</label>
          <select v-model="form.location" class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="RAK">Rak Pajangan (RAK)</option>
            <option value="GUDANG">Gudang Belakang (GUDANG)</option>
          </select>
        </div>

        <div>
          <label class="block text-[11px] font-medium text-slate-500 mb-1">Kategori / Rak (opsional)</label>
          <select v-model="form.category_rack_id" class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua kategori pada lokasi ini</option>
            <option v-for="rack in categories" :key="rack.id" :value="rack.id">
              {{ rack.kode }} - {{ rack.nama }}
            </option>
          </select>
          <p class="text-[11px] text-slate-400 mt-1">
            Kosongkan untuk menghitung seluruh barang aktif di lokasi terpilih.
          </p>
        </div>

        <div>
          <label class="block text-[11px] font-medium text-slate-500 mb-1">Catatan (opsional)</label>
          <Input v-model="form.catatan" placeholder="Mis. opname rutin akhir bulan" />
        </div>
      </div>
    </GlobalDialog>

    <!-- Delete dialog -->
    <GlobalDialog
      :open="!!pendingDelete"
      type="danger"
      title="Hapus Draft Opname"
      :description="pendingDelete
        ? `Draft ${pendingDelete.no_opname} akan dihapus permanen beserta seluruh baris hitungnya.`
        : ''"
      confirm-text="Hapus Draft"
      cancel-text="Batal"
      :is-loading="deleting"
      @update:open="!$event && (pendingDelete = null)"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  PackageSearch,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  TriangleAlert,
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
  getCategoryRacks,
  type CategoryRack,
} from "../../master/category_racks/categoryRackService";
import {
  createStockOpnameDraft,
  deleteStockOpnameDraft,
  getStockOpnames,
  type OpnameHeader,
  type OpnameLocation,
  type OpnameStatus,
} from "../opnameService";

const router = useRouter();
const authStore = useAuthStore();

const rows = ref<OpnameHeader[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const loading = ref(false);

const searchQuery = ref("");
const statusFilter = ref<"" | OpnameStatus>("");
const locationFilter = ref<"" | OpnameLocation>("");

const isCreateOpen = ref(false);
const creating = ref(false);
const categories = ref<CategoryRack[]>([]);
const form = ref({
  location: "RAK" as OpnameLocation,
  category_rack_id: "",
  catatan: "",
});

const pendingDelete = ref<OpnameHeader | null>(null);
const deleting = ref(false);

const roleKey = computed(() => authStore.user?.role.system_key || "");
const canOperate = computed(() =>
  ["GUDANG", "ADMIN", "SUPER_ADMIN"].includes(roleKey.value),
);
const canManage = computed(() => authStore.isManager);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));
const stats = ref({ DRAFT: 0, SUBMITTED: 0, APPROVED: 0 });
const draftCount = computed(() => stats.value.DRAFT);
const submittedCount = computed(() => stats.value.SUBMITTED);
const approvedCount = computed(() => stats.value.APPROVED);
const pageSelisih = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.item_selisih) || 0), 0),
);

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Menunggu Penyesuaian",
  APPROVED: "Selesai",
  REJECTED: "Ditolak",
};

function statusLabel(value: string): string {
  return STATUS_LABELS[value] || value;
}

function statusClass(value: string): string {
  if (value === "APPROVED") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
  if (value === "SUBMITTED") {
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
  if (value === "REJECTED") {
    return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
  return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi kesalahan saat memproses permintaan";
}

async function loadStats() {
  try {
    const [draft, submitted, approved] = await Promise.all([
      getStockOpnames({ status: "DRAFT", limit: 1 }),
      getStockOpnames({ status: "SUBMITTED", limit: 1 }),
      getStockOpnames({ status: "APPROVED", limit: 1 }),
    ]);
    stats.value = {
      DRAFT: draft.total,
      SUBMITTED: submitted.total,
      APPROVED: approved.total,
    };
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function loadOpnames() {
  loading.value = true;
  try {
    const res = await getStockOpnames({
      status: statusFilter.value || undefined,
      location: locationFilter.value || undefined,
      search: searchQuery.value,
      page: page.value,
      limit,
    });
    rows.value = res.data;
    total.value = res.total;
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function applyFilter() {
  page.value = 1;
  loadOpnames();
}

function refreshAll() {
  loadOpnames();
  loadStats();
}

function resetFilters() {
  searchQuery.value = "";
  statusFilter.value = "";
  locationFilter.value = "";
  page.value = 1;
  loadOpnames();
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
  loadOpnames();
}

async function loadCategories() {
  try {
    categories.value = await getCategoryRacks({
      is_active: true,
      tipe_zona: form.value.location,
    });
  } catch (error) {
    categories.value = [];
    toast.error(errorMessage(error));
  }
}

function openCreate() {
  form.value = { location: "RAK", category_rack_id: "", catatan: "" };
  isCreateOpen.value = true;
  loadCategories();
}

watch(
  () => form.value.location,
  () => {
    form.value.category_rack_id = "";
    if (isCreateOpen.value) loadCategories();
  },
);

async function createDraft() {
  if (creating.value) return;
  creating.value = true;
  try {
    const created = await createStockOpnameDraft({
      location: form.value.location,
      category_rack_id: form.value.category_rack_id || undefined,
      catatan: form.value.catatan.trim() || undefined,
    });
    toast.success(`Draft ${created.no_opname} dibuat dengan ${created.total_item} barang`);
    isCreateOpen.value = false;
    await loadOpnames();
    await loadStats();
    router.push({ name: "InventoryOpnameCount", params: { id: created.id } });
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    creating.value = false;
  }
}

function askDelete(row: OpnameHeader) {
  pendingDelete.value = row;
}

async function confirmDelete() {
  if (!pendingDelete.value || deleting.value) return;
  deleting.value = true;
  try {
    const target = pendingDelete.value;
    await deleteStockOpnameDraft(target.id);
    toast.success(`Draft ${target.no_opname} dihapus`);
    pendingDelete.value = null;
    if (rows.value.length === 1 && page.value > 1) page.value -= 1;
    await loadOpnames();
    await loadStats();
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    deleting.value = false;
  }
}

function openCount(id: string) {
  router.push({ name: "InventoryOpnameCount", params: { id } });
}

function openAdjustment(id: string) {
  router.push({ name: "InventoryOpnameAdjustment", query: { opname_id: id } });
}

function printOpname(id: string) {
  const href = router.resolve({ name: "InventoryOpnamePrint", params: { id } }).href;
  window.open(href, "_blank", "noopener");
}

onMounted(() => {
  loadOpnames();
  loadStats();
});
</script>
