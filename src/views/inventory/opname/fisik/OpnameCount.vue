<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-8 px-2 text-slate-500" @click="goBack">
            <ArrowLeft class="w-4 h-4" />
          </Button>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            Modul 2 : Inventory (3.1)
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Formulir Hitung Fisik
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          <span class="font-mono">{{ opname?.no_opname || "-" }}</span>
          <span v-if="opname?.user"> &middot; dibuat oleh {{ opname.user.name }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" class="flex items-center gap-1.5" @click="loadDetail">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" :disabled="!opname" @click="printForm">
          <Printer class="w-4 h-4" />
          <span>Cetak</span>
        </Button>
        <Button
          v-if="isEditable"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          :disabled="saving || rows.length === 0"
          @click="isSubmitOpen = true"
        >
          <Save class="w-4 h-4" />
          <span>Simpan &amp; Ajukan</span>
        </Button>
      </div>
    </div>

    <!-- Status banner -->
    <div
      v-if="opname && opname.status !== 'DRAFT'"
      class="flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      :class="opname.status === 'APPROVED'
        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
        : 'border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300'"
    >
      <div class="flex items-start gap-2">
        <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0" />
        <p v-if="opname.status === 'APPROVED'">
          Opname ini sudah <strong>selesai</strong>. Stok telah disesuaikan
          <span v-if="opname.approved_at"> pada {{ formatDateTime(opname.approved_at) }}</span>.
          Formulir hanya dapat dilihat.
        </p>
        <p v-else>
          Hasil hitung sudah <strong>diajukan</strong> dan menunggu penyesuaian stok oleh Admin.
          Formulir tidak dapat diubah lagi.
        </p>
      </div>
      <Button
        v-if="opname.status === 'SUBMITTED' && canManage"
        size="sm"
        variant="outline"
        class="shrink-0"
        @click="openAdjustment"
      >
        Buka Penyesuaian
      </Button>
    </div>

    <div
      v-if="opname?.status === 'DRAFT' && !canOperate"
      class="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"
    >
      <ShieldAlert class="w-4 h-4 mt-0.5 shrink-0" />
      <p>Role Anda hanya dapat melihat formulir ini. Perubahan hanya untuk GUDANG, ADMIN, atau SUPER_ADMIN.</p>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Baris</p>
          <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{{ rows.length }}</h3>
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Baris Selisih</p>
          <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ selisihCount }}</h3>
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Qty Fisik</p>
          <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
            {{ totalFisik.toLocaleString("id-ID") }}
            <span class="text-xs font-normal text-slate-500">Pcs</span>
          </h3>
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Selisih</p>
          <h3
            class="text-2xl font-bold mt-1"
            :class="totalSelisih !== 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'"
          >
            {{ totalSelisih > 0 ? "+" : "" }}{{ totalSelisih.toLocaleString("id-ID") }}
            <span class="text-xs font-normal text-slate-500">Pcs</span>
          </h3>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            v-model="searchQuery"
            placeholder="Scan barcode atau cari nama barang..."
            class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            @keydown.enter="handleScan"
          />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="isEditable"
            variant="outline"
            size="sm"
            :disabled="saving"
            @click="matchAllToSystem"
          >
            Samakan dengan Sistem
          </Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="searchQuery = ''">
            Bersihkan
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Table -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Barang</th>
              <th class="px-4 py-3.5">Rak / Kategori</th>
              <th class="px-4 py-3.5 text-right">Stok Sistem</th>
              <th class="px-4 py-3.5 text-right w-36">Qty Fisik</th>
              <th class="px-4 py-3.5 text-right">Selisih</th>
              <th class="px-4 py-3.5 w-56">Catatan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 8" :key="'skel-' + n">
                <td colspan="6" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="rows.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-slate-500">
                <PackageSearch class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada barang untuk dihitung</p>
                <p class="text-xs text-slate-400 mt-1">
                  Pastikan sudah ada barang aktif pada lokasi dan kategori yang dipilih.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in filteredRows"
              :id="'opname-row-' + row.id"
              :key="row.id"
              class="align-top transition-colors"
              :class="[
                row.selisih !== 0 ? 'bg-amber-50/60 dark:bg-amber-950/20' : '',
                highlightId === row.id ? 'ring-2 ring-emerald-500 ring-inset' : '',
              ]"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-slate-900 dark:text-white">{{ row.item?.nama_barang || "-" }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {{ row.item?.barcode || "-" }}
                  </span>
                  <Badge
                    variant="outline"
                    :class="row.location === 'RAK'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
                  >
                    {{ row.location }}
                  </Badge>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="text-xs text-slate-700 dark:text-slate-300">
                  {{ row.category_rack?.nama || row.item?.category_rack?.nama || "Tanpa kategori" }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  {{ row.item?.uom?.satuan_dasar || row.item?.uom?.nama_uom || "Pcs" }}
                </div>
              </td>
              <td class="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                {{ Number(row.qty_sistem || 0).toLocaleString("id-ID") }}
              </td>
              <td class="px-4 py-3 text-right">
                <Input
                  v-if="isEditable"
                  :value="row.qty_fisik"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class="h-9 text-right font-mono"
                  @input="onQtyInput(row, $event)"
                />
                <span v-else class="font-mono font-semibold">
                  {{ Number(row.qty_fisik || 0).toLocaleString("id-ID") }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <span
                  class="font-mono font-semibold"
                  :class="row.selisih > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.selisih < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'"
                >
                  {{ row.selisih > 0 ? "+" : "" }}{{ row.selisih.toLocaleString("id-ID") }}
                </span>
              </td>
              <td class="px-4 py-3">
                <Input
                  v-if="isEditable"
                  :model-value="row.catatan ?? ''"
                  placeholder="Opsional"
                  class="h-9 text-xs"
                  @update:model-value="updateNote(row, $event)"
                />
                <span v-else class="text-xs text-slate-500">{{ row.catatan || "-" }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-slate-500">
          Menampilkan {{ filteredRows.length }} dari {{ rows.length }} baris
          <span v-if="searchQuery.trim()"> (filter pencarian aktif)</span>
        </p>
        <p class="text-xs text-slate-500">
          Opname hanya mengoreksi stok; tidak mengubah tagihan pembelian.
        </p>
      </div>
    </Card>

    <!-- Submit dialog -->
    <GlobalDialog
      :open="isSubmitOpen"
      type="warning"
      title="Ajukan Hasil Hitung Fisik"
      :description="`${selisihCount} baris memiliki selisih. Setelah diajukan, formulir tidak dapat diubah dan menunggu penyesuaian Admin.`"
      confirm-text="Ajukan"
      cancel-text="Periksa Lagi"
      :is-loading="saving"
      @update:open="isSubmitOpen = $event"
      @confirm="submitCounts"
      @cancel="isSubmitOpen = false"
    >
      <div class="rounded-lg bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Total baris: <strong>{{ rows.length }}</strong></p>
        <p>Baris selisih: <strong>{{ selisihCount }}</strong></p>
        <p>Total selisih: <strong>{{ totalSelisih > 0 ? "+" : "" }}{{ totalSelisih }}</strong> Pcs</p>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  CheckCircle2,
  PackageSearch,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
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
  getStockOpnameDetail,
  submitStockOpnameCounts,
  type OpnameDetail,
  type OpnameDetailRow,
} from "../opnameService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const opname = ref<OpnameDetail | null>(null);
const rows = ref<OpnameDetailRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const isSubmitOpen = ref(false);
const searchQuery = ref("");
const highlightId = ref("");

const roleKey = computed(() => authStore.user?.role.system_key || "");
const canOperate = computed(() =>
  ["GUDANG", "ADMIN", "SUPER_ADMIN"].includes(roleKey.value),
);
const canManage = computed(() => authStore.isManager);
const isEditable = computed(
  () => !!opname.value && opname.value.status === "DRAFT" && canOperate.value,
);

const filteredRows = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return rows.value;
  return rows.value.filter((row) => {
    const barcode = (row.item?.barcode || "").toLowerCase();
    const nama = (row.item?.nama_barang || "").toLowerCase();
    const rak = (row.category_rack?.nama || row.item?.category_rack?.nama || "").toLowerCase();
    return barcode.includes(keyword) || nama.includes(keyword) || rak.includes(keyword);
  });
});

const selisihCount = computed(() => rows.value.filter((row) => row.selisih !== 0).length);
const totalFisik = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.qty_fisik) || 0), 0),
);
const totalSelisih = computed(() =>
  rows.value.reduce((sum, row) => sum + (Number(row.selisih) || 0), 0),
);

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi kesalahan saat memproses permintaan";
}

async function loadDetail() {
  const id = String(route.params.id || "");
  if (!id) return;
  loading.value = true;
  try {
    const data = await getStockOpnameDetail(id);
    opname.value = data;
    rows.value = (data.details || []).map((row) => ({ ...row }));
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function onQtyInput(row: OpnameDetailRow, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const parsed = raw === "" ? 0 : Number(raw);
  const normalized = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  row.qty_fisik = normalized;
  row.selisih = normalized - Number(row.qty_sistem || 0);
}

function updateNote(row: OpnameDetailRow, value: string | number) {
  row.catatan = String(value ?? "");
}

function matchAllToSystem() {
  rows.value.forEach((row) => {
    row.qty_fisik = Number(row.qty_sistem || 0);
    row.selisih = 0;
  });
  toast.success("Seluruh qty fisik disamakan dengan stok sistem");
}

function handleScan() {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return;

  const exact = rows.value.find(
    (row) => (row.item?.barcode || "").toLowerCase() === keyword,
  );

  if (!exact) {
    const [onlyMatch] = filteredRows.value;
    if (filteredRows.value.length === 1 && onlyMatch) {
      highlight(onlyMatch);
      return;
    }
    toast.info("Barcode tidak ditemukan pada lembar opname ini");
    return;
  }

  searchQuery.value = "";
  highlight(exact);
}

function highlight(row: OpnameDetailRow) {
  highlightId.value = row.id;
  requestAnimationFrame(() => {
    document
      .getElementById(`opname-row-${row.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  window.setTimeout(() => {
    if (highlightId.value === row.id) highlightId.value = "";
  }, 2500);
}

async function submitCounts() {
  if (!opname.value || saving.value) return;

  const invalid = rows.value.find(
    (row) =>
      !Number.isInteger(Number(row.qty_fisik)) || Number(row.qty_fisik) < 0,
  );
  if (invalid) {
    toast.error(
      `Qty fisik '${invalid.item?.nama_barang || invalid.item_id}' harus bilangan bulat >= 0`,
    );
    isSubmitOpen.value = false;
    return;
  }

  saving.value = true;
  try {
    await submitStockOpnameCounts(
      opname.value.id,
      rows.value.map((row) => ({
        detail_id: row.id,
        qty_fisik: Number(row.qty_fisik),
        catatan: row.catatan?.trim() || undefined,
      })),
    );
    toast.success("Hasil hitung fisik diajukan. Menunggu penyesuaian stok oleh Admin.");
    isSubmitOpen.value = false;
    await loadDetail();
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: "InventoryOpnameFisik" });
}

function openAdjustment() {
  if (!opname.value) return;
  router.push({
    name: "InventoryOpnameAdjustment",
    query: { opname_id: opname.value.id },
  });
}

function printForm() {
  if (!opname.value) return;
  const href = router.resolve({
    name: "InventoryOpnamePrint",
    params: { id: opname.value.id },
  }).href;
  window.open(href, "_blank", "noopener");
}

onMounted(loadDetail);
</script>
