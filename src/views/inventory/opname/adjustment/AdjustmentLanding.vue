<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 2 : Inventory (3.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Penyesuaian Stok
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Terapkan koreksi stok dari lembar hitung fisik yang sudah diajukan. Setiap koreksi
          tercatat di Kartu Stok dan tidak mengubah tagihan pembelian.
        </p>
      </div>

      <Button variant="outline" size="sm" :disabled="loadingPending || loadingAdjustments" class="flex items-center gap-1.5" @click="refreshAll">
        <RefreshCw :class="['w-4 h-4', loadingPending || loadingAdjustments ? 'animate-spin' : '']" />
        <span>Refresh</span>
      </Button>
    </div>

    <div
      v-if="!canManage"
      class="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"
    >
      <ShieldAlert class="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        Anda dapat melihat selisih hasil hitung, tetapi hanya <strong>ADMIN</strong> atau
        <strong>SUPER_ADMIN</strong> yang boleh menerapkan penyesuaian stok.
      </p>
    </div>

    <!-- Result panel -->
    <div
      v-if="lastResult"
      class="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2">
          <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p class="font-semibold">
              {{ lastResult.adjustment
                ? `Penyesuaian ${lastResult.no_adjustment} berhasil diterapkan`
                : "Opname disetujui tanpa penyesuaian stok" }}
            </p>
            <p class="text-xs mt-0.5">
              <template v-if="lastResult.adjustment">
                {{ lastResult.total_selisih }} barang dikoreksi. Jejaknya tersedia di Kartu Stok.
              </template>
              <template v-else>
                Tidak ada selisih fisik, sehingga saldo stok tidak berubah.
              </template>
            </p>
          </div>
        </div>
        <button type="button" class="text-emerald-600 hover:text-emerald-800 shrink-0" title="Tutup" @click="lastResult = null">
          <X class="w-4 h-4" />
        </button>
      </div>
      <Button
        v-if="lastResult.details.length > 0"
        size="sm"
        variant="outline"
        class="mt-3"
        @click="openStockCard(firstDetailItemId(lastResult.details))"
      >
        Buka Kartu Stok Barang Pertama
      </Button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <!-- Pending list -->
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Menunggu Penyesuaian</h2>
            <p class="text-xs text-slate-500">Status SUBMITTED</p>
          </div>
          <Badge variant="outline" class="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            {{ pendingList.length }}
          </Badge>
        </div>

        <div class="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          <template v-if="loadingPending">
            <div v-for="n in 4" :key="'p-skel-' + n" class="p-3">
              <Skeleton class="h-10 w-full" />
            </div>
          </template>

          <div v-else-if="pendingList.length === 0" class="px-4 py-10 text-center text-slate-500">
            <ClipboardCheck class="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Tidak ada antrean</p>
            <p class="text-xs text-slate-400 mt-1">
              Ajukan lembar hitung fisik terlebih dahulu di menu Hitung Fisik.
            </p>
          </div>

          <button
            v-else
            v-for="item in pendingList"
            :key="item.id"
            type="button"
            class="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            :class="{ 'bg-emerald-50/70 dark:bg-emerald-950/20': selected?.id === item.id }"
            @click="selectOpname(item.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                {{ item.no_opname }}
              </span>
              <Badge variant="outline" class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                {{ item.item_selisih }} selisih
              </Badge>
            </div>
            <div class="text-[11px] text-slate-500 mt-1">
              {{ formatDate(item.tgl_opname || item.createdAt) }}
              &middot; {{ item.total_item }} baris
              &middot; {{ item.user?.name || "Sistem" }}
            </div>
          </button>
        </div>
      </Card>

      <!-- Detail -->
      <Card class="lg:col-span-3 border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {{ selected ? selected.no_opname : "Pilih Dokumen" }}
            </h2>
            <p class="text-xs text-slate-500">
              <template v-if="selected">
                {{ selected.details.length }} baris &middot;
                {{ selected.details.filter((row) => row.selisih !== 0).length }} selisih
              </template>
              <template v-else>Klik salah satu dokumen di antrean</template>
            </p>
          </div>

          <div v-if="selected" class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="openOpnameDoc(selected.id)">Lihat Dokumen</Button>
            <Button
              v-if="canManage && selected.status === 'SUBMITTED'"
              size="sm"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
              :disabled="applying"
              @click="isApplyOpen = true"
            >
              Terapkan Penyesuaian
            </Button>
          </div>
        </div>

        <div v-if="!selected" class="px-4 py-16 text-center text-slate-500">
          <MousePointerClick class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada dokumen dipilih</p>
          <p class="text-xs text-slate-400 mt-1">Selisih per barang akan tampil di sini.</p>
        </div>

        <div v-else class="max-h-[420px] overflow-y-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="sticky top-0 bg-slate-50 dark:bg-slate-900/90 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-2.5">Barang</th>
                <th class="px-3 py-2.5 text-right">Sistem</th>
                <th class="px-3 py-2.5 text-right">Fisik</th>
                <th class="px-3 py-2.5 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-if="loadingDetail">
                <td colspan="4" class="px-4 py-6"><Skeleton class="h-6 w-full" /></td>
              </tr>
              <tr v-else-if="selectedRows.length === 0">
                <td colspan="4" class="px-4 py-10 text-center text-slate-500">
                  Tidak ada selisih pada dokumen ini. Penyesuaian tetap dapat diterapkan untuk
                  menutup opname.
                </td>
              </tr>
              <tr
                v-else
                v-for="row in selectedRows"
                :key="row.id"
                class="align-top"
              >
                <td class="px-4 py-2.5">
                  <div class="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {{ row.item?.nama_barang || "-" }}
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">{{ row.item?.barcode || "-" }}</div>
                </td>
                <td class="px-3 py-2.5 text-right font-mono">{{ Number(row.qty_sistem).toLocaleString("id-ID") }}</td>
                <td class="px-3 py-2.5 text-right font-mono">{{ Number(row.qty_fisik).toLocaleString("id-ID") }}</td>
                <td class="px-3 py-2.5 text-right">
                  <span
                    class="font-mono font-semibold"
                    :class="row.selisih > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                  >
                    {{ row.selisih > 0 ? "+" : "" }}{{ row.selisih.toLocaleString("id-ID") }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <!-- History -->
    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Riwayat Penyesuaian</h2>
          <p class="text-xs text-slate-500">Koreksi stok yang sudah diterapkan ke Kartu Stok</p>
        </div>
        <Badge variant="outline" class="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
          {{ adjustments.length }}
        </Badge>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3">No. Penyesuaian</th>
              <th class="px-4 py-3">Opname</th>
              <th class="px-4 py-3 text-center">Barang</th>
              <th class="px-4 py-3">Oleh</th>
              <th class="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loadingAdjustments">
              <tr v-for="n in 3" :key="'a-skel-' + n">
                <td colspan="5" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="adjustments.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                <History class="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Belum ada penyesuaian</p>
                <p class="text-xs text-slate-400 mt-1">Riwayat muncul setelah Admin menerapkan selisih opname.</p>
              </td>
            </tr>

            <template v-else>
              <tr v-for="adjustment in adjustments" :key="adjustment.id" class="align-top">
                <td class="px-4 py-3">
                  <div class="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                    {{ adjustment.no_adjustment }}
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    {{ formatDateTime(adjustment.tgl_adjustment || adjustment.createdAt) }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="font-mono text-xs">{{ adjustment.opname?.no_opname || "-" }}</span>
                  <p v-if="adjustment.catatan" class="text-[11px] text-slate-500 max-w-[260px] truncate mt-0.5" :title="adjustment.catatan">
                    {{ adjustment.catatan }}
                  </p>
                </td>
                <td class="px-4 py-3 text-center">
                  <button
                    type="button"
                    class="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                    @click="toggleExpanded(adjustment.id)"
                  >
                    {{ adjustment.details.length }} baris
                  </button>
                </td>
                <td class="px-4 py-3 text-xs">{{ adjustment.user?.name || "Sistem" }}</td>
                <td class="px-4 py-3 text-right">
                  <Button
                    v-if="adjustment.details.length > 0"
                    variant="ghost"
                    size="sm"
                    class="h-8 text-xs"
                    @click="openStockCard(firstDetailItemId(adjustment.details))"
                  >
                    Kartu Stok
                  </Button>
                </td>
              </tr>
              <tr v-if="expandedId" :key="'expanded-' + expandedId">
                <td colspan="5" class="bg-slate-50/70 dark:bg-slate-900/40 px-4 py-3">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      v-for="detail in expandedDetails"
                      :key="detail.id"
                      class="flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      <div class="min-w-0">
                        <div class="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {{ detail.item?.nama_barang || detail.item_id }}
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">{{ detail.item?.barcode || "-" }}</div>
                      </div>
                      <Badge
                        variant="outline"
                        :class="detail.direction === 'IN'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'"
                      >
                        {{ detail.direction === "IN" ? "+" : "-" }}{{ Number(detail.qty_adjustment).toLocaleString("id-ID") }}
                      </Badge>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Apply dialog -->
    <GlobalDialog
      :open="isApplyOpen"
      type="warning"
      title="Terapkan Penyesuaian Stok"
      :description="selected
        ? `Stok sistem akan diubah mengikuti qty fisik pada ${selected.no_opname}. Tindakan ini tidak dapat dibatalkan.`
        : ''"
      confirm-text="Terapkan"
      cancel-text="Batal"
      :is-loading="applying"
      @update:open="isApplyOpen = $event"
      @confirm="applyAdjustment"
      @cancel="isApplyOpen = false"
    >
      <div class="space-y-3">
        <div class="rounded-lg bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Baris dikoreksi: <strong>{{ selectedRows.length }}</strong></p>
          <p>
            Total qty: <strong>{{ totalQtyAdjustment.toLocaleString("id-ID") }}</strong> Pcs
          </p>
        </div>
        <div>
          <label class="block text-[11px] font-medium text-slate-500 mb-1">Catatan (opsional)</label>
          <Input v-model="applyNote" placeholder="Mis. opname mingguan rak depan" />
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import {
  applyStockAdjustment,
  getStockAdjustments,
  getStockOpnameDetail,
  getStockOpnames,
  type AdjustmentResult,
  type AdjustmentRow,
  type OpnameDetail,
  type OpnameDetailRow,
  type OpnameHeader,
} from "../opnameService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const pendingList = ref<OpnameHeader[]>([]);
const adjustments = ref<AdjustmentRow[]>([]);
const selected = ref<OpnameDetail | null>(null);

const loadingPending = ref(false);
const loadingAdjustments = ref(false);
const loadingDetail = ref(false);
const applying = ref(false);

const isApplyOpen = ref(false);
const applyNote = ref("");
const expandedId = ref("");
const lastResult = ref<AdjustmentResult | null>(null);

const canManage = computed(() => authStore.isManager);

const selectedRows = computed<OpnameDetailRow[]>(
  () => (selected.value?.details || []).filter((row) => row.selisih !== 0),
);

const totalQtyAdjustment = computed(() =>
  selectedRows.value.reduce((sum, row) => sum + Math.abs(Number(row.selisih) || 0), 0),
);

const expandedDetails = computed(() => {
  if (!expandedId.value) return [];
  const target = adjustments.value.find((row) => row.id === expandedId.value);
  return target?.details || [];
});

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

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

async function loadPending() {
  loadingPending.value = true;
  try {
    const res = await getStockOpnames({ status: "SUBMITTED", limit: 100 });
    pendingList.value = res.data;
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loadingPending.value = false;
  }
}

async function loadAdjustments() {
  loadingAdjustments.value = true;
  try {
    const res = await getStockAdjustments({ limit: 50 });
    adjustments.value = res.data;
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loadingAdjustments.value = false;
  }
}

async function selectOpname(id: string) {
  loadingDetail.value = true;
  expandedId.value = "";
  try {
    selected.value = await getStockOpnameDetail(id);
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loadingDetail.value = false;
  }
}

async function applyAdjustment() {
  if (!selected.value || applying.value) return;
  applying.value = true;
  try {
    const result = await applyStockAdjustment(
      selected.value.id,
      applyNote.value.trim() || undefined,
    );
    lastResult.value = result;
    isApplyOpen.value = false;
    applyNote.value = "";
    toast.success(
      result.adjustment
        ? `Penyesuaian ${result.no_adjustment} diterapkan`
        : "Opname disetujui tanpa selisih",
    );
    selected.value = await getStockOpnameDetail(selected.value.id);
    await Promise.all([loadPending(), loadAdjustments()]);
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    applying.value = false;
  }
}

function toggleExpanded(id: string) {
  expandedId.value = expandedId.value === id ? "" : id;
}

function openOpnameDoc(id: string) {
  router.push({ name: "InventoryOpnameCount", params: { id } });
}

function firstDetailItemId(
  details?: Array<{ item_id: string }> | null,
): string {
  return details?.[0]?.item_id || "";
}

function openStockCard(itemId?: string) {
  if (!itemId) return;
  router.push({ path: "/inventory/stok/cards", query: { item_id: itemId } });
}

async function refreshAll() {
  await Promise.all([loadPending(), loadAdjustments()]);
  if (selected.value) await selectOpname(selected.value.id);
}

onMounted(async () => {
  await Promise.all([loadPending(), loadAdjustments()]);
  const preset = String(route.query.opname_id || "");
  if (preset) {
    await selectOpname(preset);
  } else {
    const [firstPending] = pendingList.value;
    if (firstPending) await selectOpname(firstPending.id);
  }
});
</script>
