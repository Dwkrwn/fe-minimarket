<script setup lang="ts">
import { ref, watch } from "vue";
import { toast } from "vue-sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Package,
  Lock,
  X,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogScrollContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getHistoryOpnameByRak,
  type StockOpnameItem,
  type StockOpnameDetailItem,
  type Pagination,
} from "@/views/inventory/transaksi/t_stock_opname/service";

// ============================================================================
// PROPS & EMITS
// ============================================================================
const props = defineProps<{
  open: boolean;
  rakId: string;
  rakName?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const opnameList = ref<StockOpnameItem[]>([]);
const openItems = ref<string[]>([]);
const lockModalOpen = ref(false);
const selectedDetailLock = ref<StockOpnameDetailItem | null>(null);
const currentPage = ref(1);
const pageSize = 5;
const pagination = ref<Pagination | null>(null);

// ============================================================================
// FUNCTIONS
// ============================================================================

const fetchData = async (page = currentPage.value) => {
  if (!props.rakId) return;

  loading.value = true;
  try {
    const opnameRes = await getHistoryOpnameByRak(props.rakId, page, pageSize);
    if (opnameRes.status === "success") {
      opnameList.value = opnameRes.data || [];
      pagination.value = opnameRes.pagination ?? null;
      currentPage.value = page;
      openItems.value = [];
    }
  } catch (error) {
    toast.error("Gagal memuat histori opname", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.totalPages))
    return;
  fetchData(page);
};

const getStatusCheckingStyle = (val?: string) => {
  switch (val?.toUpperCase()) {
    case "SELESAI":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "PROSES":
    default:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  }
};

const getStatusCheckingLabel = (val?: string) => {
  switch (val?.toUpperCase()) {
    case "SELESAI":
      return "Selesai";
    case "PROSES":
      return "Proses";
    default:
      return val || "Proses";
  }
};

const openLockModal = (detail: StockOpnameDetailItem) => {
  selectedDetailLock.value = detail;
  lockModalOpen.value = true;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

const toggleItem = (id: string) => {
  const idx = openItems.value.indexOf(id);
  if (idx >= 0) {
    openItems.value.splice(idx, 1);
  } else {
    openItems.value.push(id);
  }
};

// ============================================================================
// WATCHERS
// ============================================================================
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.rakId) {
      currentPage.value = 1;
      pagination.value = null;
      fetchData(1);
    }
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="!max-w-4xl w-[95vw]">
      <DialogHeader>
        <DialogTitle>Histori Stok Opname</DialogTitle>
        <DialogDescription>
          Rak: <strong>{{ rakName || "-" }}</strong>
        </DialogDescription>
      </DialogHeader>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3 py-4">
        <div v-for="i in 3" :key="i" class="space-y-2">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-4 w-2/3" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="opnameList.length === 0" class="text-center py-12">
        <Package class="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p class="text-sm text-muted-foreground">
          Belum ada histori stok opname untuk rak ini
        </p>
      </div>

      <!-- Content -->
      <div v-else class="space-y-3 py-2">
        <Collapsible
          v-for="opname in opnameList"
          :key="opname.id"
          :open="openItems.includes(opname.id || '')"
          @update:open="toggleItem(opname.id || '')"
        >
          <!-- Trigger Header -->
          <CollapsibleTrigger class="w-full">
            <div
              class="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div class="flex items-center gap-3 text-left">
                <div>
                  <div class="font-semibold text-sm">
                    {{ opname.no_stock_opname || "Tanpa Nomor" }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ formatDate(opname.tgl_opname || opname.createdAt) }}
                  </div>
                  <div
                    v-if="opname.rak_opname?.kode_rak"
                    class="text-xs text-muted-foreground"
                  >
                    Rak:
                    <span class="font-medium text-foreground">{{
                      opname.rak_opname.kode_rak
                    }}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="text-xs">
                  {{ opname.status || "-" }}
                </Badge>
                <Badge
                  :class="getStatusCheckingStyle(opname.status_checking)"
                  class="text-xs flex items-center gap-1"
                >
                  <CheckCircle2
                    v-if="opname.status_checking === 'sudah_pengecekan'"
                    class="h-3 w-3"
                  />
                  <Clock v-else class="h-3 w-3" />
                  {{ getStatusCheckingLabel(opname.status_checking) }}
                </Badge>
                <Badge variant="secondary" class="text-xs">
                  {{ opname.t_stock_opname_ds?.length || 0 }} item
                </Badge>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                  :class="
                    openItems.includes(opname.id || '') ? 'rotate-180' : ''
                  "
                />
              </div>
            </div>
          </CollapsibleTrigger>

          <!-- Collapsible Detail Content -->
          <CollapsibleContent>
            <div class="mt-1 ml-2 border-l-2 border-muted pl-4 space-y-2 pb-2">
              <!-- No detail items -->
              <div
                v-if="
                  !opname.t_stock_opname_ds ||
                  opname.t_stock_opname_ds.length === 0
                "
                class="text-xs text-muted-foreground py-2"
              >
                Tidak ada detail item
              </div>

              <!-- Detail items -->
              <div
                v-for="detail in opname.t_stock_opname_ds"
                :key="detail.id"
                class="p-3 rounded-md border bg-muted/30 space-y-2"
              >
                <!-- Item header with status -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">
                      {{
                        detail.item_opname?.nama_item || "Item tidak diketahui"
                      }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ detail.item_opname?.kode_item || "-" }}
                    </div>
                  </div>

                  <!-- is_checking badge + lock button -->
                  <div class="flex flex-col items-end gap-1">
                    <Badge
                      :class="
                        detail.is_checking
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      "
                      class="text-xs whitespace-nowrap flex items-center gap-1"
                    >
                      <Clock v-if="detail.is_checking" class="h-3 w-3" />
                      <CheckCircle2 v-else class="h-3 w-3" />
                      {{
                        detail.is_checking
                          ? "Proses Checking"
                          : "Selesai Checking"
                      }}
                    </Badge>
                    <button
                      v-if="detail.is_checking && detail.itemLock"
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      @click.stop="openLockModal(detail)"
                    >
                      <Lock class="h-3.5 w-3.5" />
                      Lihat Lock Item
                    </button>
                  </div>
                </div>

                <!-- Qty details -->
                <div class="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span class="text-muted-foreground">Kode Detail Rak:</span>
                    <span class="ml-1 font-medium">{{
                      detail.rak_d_opname?.kode || "-"
                    }}</span>
                  </div>

                  <div>
                    <span class="text-muted-foreground">Qty System:</span>
                    <span class="ml-1 font-medium">{{
                      detail.qty_system ?? 0
                    }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Qty Opname:</span>
                    <span class="ml-1 font-medium">{{
                      detail.qty_opname ?? 0
                    }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Qty Selisih:</span>
                    <span
                      class="ml-1 font-semibold"
                      :class="
                        (detail.qty_selisih ?? 0) === 0 ||
                        (detail.qty_selisih ?? 0) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      "
                    >
                      {{ detail.qty_selisih ?? 0 }}
                    </span>
                  </div>
                </div>

                <!-- Catatan -->
                <div
                  v-if="detail.catatan"
                  class="text-xs text-muted-foreground italic"
                >
                  {{ detail.catatan }}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination && pagination.totalPages > 1"
        class="flex items-center justify-between pt-2 border-t border-muted text-sm"
      >
        <span class="text-xs text-muted-foreground">
          Halaman {{ currentPage }} dari {{ pagination.totalPages }}
          <span class="ml-1">({{ pagination.total }} data)</span>
        </span>
        <div class="flex items-center gap-1">
          <button
            :disabled="currentPage <= 1 || loading"
            class="inline-flex items-center justify-center h-7 w-7 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            @click="goToPage(currentPage - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>

          <template v-for="p in pagination.totalPages" :key="p">
            <button
              v-if="
                p === 1 ||
                p === pagination.totalPages ||
                Math.abs(p - currentPage) <= 1
              "
              :class="[
                'inline-flex items-center justify-center h-7 w-7 rounded-md border text-xs transition-colors',
                p === currentPage
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent',
              ]"
              :disabled="loading"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
            <span
              v-else-if="
                (p === currentPage - 2 && currentPage - 2 > 1) ||
                (p === currentPage + 2 &&
                  currentPage + 2 < pagination.totalPages)
              "
              class="px-1 text-muted-foreground"
              >…</span
            >
          </template>

          <button
            :disabled="currentPage >= pagination.totalPages || loading"
            class="inline-flex items-center justify-center h-7 w-7 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            @click="goToPage(currentPage + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>

  <!-- ItemLock Detail Modal -->
  <Dialog :open="lockModalOpen" @update:open="lockModalOpen = $event">
    <DialogScrollContent class="!max-w-lg w-[90vw]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Lock class="h-4 w-4" />
          Detail Lock Item
        </DialogTitle>
      </DialogHeader>

      <div v-if="selectedDetailLock?.itemLock?.length" class="space-y-3 py-2">
        <!-- Item info card -->
        <div
          v-for="(lock, index) in selectedDetailLock.itemLock"
          :key="lock.id || index"
          class="p-3 rounded-lg border bg-muted/30 space-y-2 text-sm"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">
                {{ lock.m_item?.nama_item || "-" }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ lock.m_item?.kode_item || "-" }}
              </div>
            </div>
            <Badge
              :class="
                lock.is_opname
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              "
              class="text-xs whitespace-nowrap"
            >
              {{ lock.is_opname ? "Proses Opname" : "Selesai Opname" }}
            </Badge>
          </div>

          <!-- Stock info -->
          <div class="flex justify-between text-xs pt-1 border-t border-muted">
            <span class="text-muted-foreground">Free Stock</span>
            <span class="font-semibold">{{ lock.free_stock }}</span>
          </div>

          <!-- Rack info -->
          <div
            v-if="lock.m_rak_d"
            class="text-xs space-y-1 pt-1 border-t border-muted"
          >
            <div v-if="lock.m_rak_d.m_rak" class="flex justify-between">
              <span class="text-muted-foreground">Rak</span>
              <span class="font-medium">
                {{ lock.m_rak_d.m_rak.kode_rak }} -
                {{ lock.m_rak_d.m_rak.nama_rak }}
              </span>
            </div>

            <div class="flex justify-between">
              <span class="text-muted-foreground">Kode Detail Rak</span>
              <span class="font-medium">{{ lock.m_rak_d.kode }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Baris / Kolom</span>
              <span class="font-medium">
                {{ lock.m_rak_d.baris ?? "-" }} /
                {{ lock.m_rak_d.kolom ?? "-" }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="py-6 text-center text-sm text-muted-foreground">
        Tidak ada data lock
      </div>
    </DialogScrollContent>
  </Dialog>
</template>
