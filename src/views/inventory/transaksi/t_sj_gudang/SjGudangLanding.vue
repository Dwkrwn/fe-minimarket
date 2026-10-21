<script setup lang="ts">
import { computed, ref, TransitionGroup } from "vue";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  Plus,
  Trash2,
  FileDown,
  Edit,
  Copy,
  Search,
  X,
  Filter,
  RefreshCw,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldSelect } from "@/components/field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/table/DataTable.vue";
import {
  DeleteButton,
  EditButton,
  ExportButton,
  PrintButton,
  ViewButton,
  CopyButton,
  PostButton,
} from "@/components/button";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useSjGudangLanding } from "./useSjGudangLanding";
import { getApprovalStatusFilterClass } from "@/lib/approvalStatus";

const {
  selectedItem,
  isActive,
  currentMenuId,
  menuData,
  loading,
  loadingMore,
  hasMoreData,
  filterStatus,
  searchQuery,
  isSearching,
  columns,
  filteredData,
  canPrintSelected,
  deleteDialogDescription,
  isDeleteDialogOpen,
  isDeleting,
  isPostDialogOpen,
  itemToPost,
  isPosting,
  isStatusPengirimanDialogOpen,
  isUpdatingStatusPengiriman,
  itemToUpdateStatusPengiriman,
  selectedStatusPengirimanId,
  // Bulk delete
  selectedRows,
  isBulkDeleteDialogOpen,
  isBulkDeleting,
  bulkDeletableRows,
  showBulkDeleteButton,
  bulkDeleteDialogDescription,
  handleSelectionChange,
  openBulkDeleteDialog,
  confirmBulkDelete,
  cancelBulkDelete,
  getStatusBadgeClass,
  selectItem,
  deselectItem,
  deleteSelected,
  confirmDelete,
  cancelDelete,
  postSelected,
  confirmPost,
  cancelPost,
  openStatusPengirimanDialog,
  confirmUpdateStatusPengiriman,
  cancelUpdateStatusPengiriman,
  exportData,
  printItem,
  viewItem,
  editItem,
  copyItem,
  createNew,
  handleLoadMore,
  handleApiSearch,
  clearSearch,
  handleTableFilterChange,
  handleRefresh,
} = useSjGudangLanding();
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();

const handleRowSelect = (item: any) => {
  selectItem(item, 0);
};

const filteredMobileData = computed(() => {
  return filteredData.value.filter((item) => {
    if (!searchQuery.value) return true;
    const q = searchQuery.value.toLowerCase();
    return (
      item.no_sj_gudang?.toLowerCase().includes(q) ||
      item.tipe_sj_gudang?.toLowerCase().includes(q) ||
      item.no_tg?.no_tw?.toLowerCase().includes(q)
    );
  });
});

const showFilters = ref(false);
</script>

<template>
  <!-- ================================================================ -->
  <!-- MOBILE VIEW (LG:HIDDEN) -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <!-- STICKY HEADER -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <!-- Title & Refresh -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Transaksi Surat Jalan Gudang</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Surat Jalan Gudang
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            @click="handleRefresh"
            :disabled="loading"
            class="h-8 w-8"
          >
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterStatus = null"
          >
            ALL
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
            @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
          >
            DRAFT
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="
              getApprovalStatusFilterClass('POST', filterStatus === 'POST')
            "
            @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
          >
            POST
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search..."
            class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch"
            :disabled="isSearching"
          />
          <Button
            v-if="searchQuery"
            @click="clearSearch"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- CONTENT AREA -->
    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <!-- Loading Skeletons -->
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredData.length === 0" class="text-center py-8">
        <p class="text-sm text-muted-foreground">Tidak ada data</p>
      </div>

      <!-- Card List with Animation -->
      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card
          v-for="item in filteredData"
          :key="item.id"
          class="cursor-pointer hover:shadow-md transition-all"
          @click="selectItem(item, 0)"
        >
          <CardContent class="pt-3 pb-2 space-y-2">
            <!-- Name & Status Row -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">
                  {{ item.no_sj_gudang || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.tipe_sj_gudang || "-" }}
                </div>
              </div>
              <Badge
                :class="
                  getStatusBadgeClass((item.status || 'DRAFT').toUpperCase())
                "
                class="text-xs shrink-0"
              >
                {{ (item.status || "DRAFT").toUpperCase() }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.tgl_sj_gudang">
                <span class="font-medium">Tanggal:</span>
                {{
                  (() => {
                    const m = String(item.tgl_sj_gudang).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
                    return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(item.tgl_sj_gudang).toLocaleDateString("id-ID");
                  })()
                }}
              </div>
              <div v-if="item.as_unit?.nama_comp">
                <span class="font-medium">Unit Bisnis:</span>
                {{ item.as_unit.nama_comp }}
              </div>
              <div v-if="item.no_tg?.no_tw">
                <span class="font-medium">No Transfer:</span>
                {{ item.no_tg.no_tw }}
              </div>
              <div v-if="item.sj_gd_asl?.nama_gudang">
                <span class="font-medium">Warehouse Asal:</span>
                {{ item.sj_gd_asl.nama_gudang }}
              </div>
              <div v-if="item.status_pengiriman?.value1">
                <span class="font-medium">Status Pengiriman:</span>
                {{ item.status_pengiriman.value1 }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="viewItem(item)"
              />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                :disabled="item.status?.toUpperCase() !== 'DRAFT'"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    deleteSelected();
                  }
                "
              />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
              />
              <PostButton
                v-if="item.status?.toUpperCase() === 'DRAFT'"
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                :show-label="false"
                class="h-7 w-7 text-blue-600"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    postSelected(item);
                  }
                "
              />
              <PrintButton
                v-permission="{ menuId: currentMenuId, action: 'print' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :disabled="item.status?.toUpperCase() !== 'POST'"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    printItem(item);
                  }
                "
              />
              <Button
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs"
                :disabled="item.status?.toUpperCase() !== 'POST'"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    openStatusPengirimanDialog(item);
                  }
                "
              >
                Status Kirim
              </Button>
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>

      <!-- Load More Indicator -->
      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- FAB Button - Teleport -->
    <teleport to="body">
      <Button
        v-permission="{ menuId: currentMenuId, action: 'create' }"
        @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <!-- ================================================================ -->
  <!-- DESKTOP VIEW (HIDDEN LG:FLEX) -->
  <!-- ================================================================ -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- HEADER -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Transaksi Surat Jalan Gudang</h1>
        <p class="text-sm text-muted-foreground">
          Kelola data Surat Jalan Gudang
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="handleRefresh"
          :disabled="loading"
          class="shrink-0"
          title="Refresh data"
        >
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button
          v-if="currentMenuId"
          v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          Create New
        </Button>
        <Button
          v-else
          @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          Create New
        </Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Filter Status Row -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button
          variant="outline"
          size="sm"
          class="text-xs h-8 whitespace-nowrap"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="filterStatus = null"
        >
          ALL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
          @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
        >
          DRAFT
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
          @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
        >
          POST
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              v-model="searchQuery"
              placeholder="Search..."
              class="pl-9 pr-8"
              @keyup.enter="handleApiSearch"
              :disabled="isSearching"
            />
            <Button
              v-if="searchQuery"
              @click="clearSearch"
              size="icon"
              variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button
            @click="handleApiSearch"
            size="icon"
            variant="secondary"
            :disabled="isSearching"
          >
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <!-- Bulk Delete Button: hanya muncul jika ada lebih dari 1 item DRAFT yang dipilih -->
          <Button
            v-if="showBulkDeleteButton"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive"
            size="sm"
            class="gap-2 whitespace-nowrap"
            :disabled="isBulkDeleting"
            @click="openBulkDeleteDialog"
          >
            <Trash2 class="h-4 w-4" />
            Bulk Delete ({{ bulkDeletableRows.length }})
          </Button>
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :status="selectedItem?.status"
            :disabled="
              !isActive
            "
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="
              !isActive
            "
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <PostButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="
              !isActive || selectedItem?.status?.toUpperCase() !== 'DRAFT'
            "
            @click="() => postSelected()"
          />
          <PrintButton
            v-permission="{ menuId: currentMenuId, action: 'print' }"
            :disabled="!canPrintSelected"
            @click="() => printItem()"
          />
          <Button
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            variant="outline"
            :disabled="
              !isActive || selectedItem?.status?.toUpperCase() !== 'POST'
            "
            @click="() => openStatusPengirimanDialog()"
          >
            Update Status Pengiriman
          </Button>
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <DataTable
      :data="filteredData"
      :columns="columns"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMoreData"
      :row-select-mode="true"
      :multi-select-mode="true"
      :selected-items="selectedRows"
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="handleRowSelect"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
      @selection-change="handleSelectionChange"
    >
      <template #empty> Tidak ada data Sj Gudang </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Sj Gudang"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- BULK DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isBulkDeleteDialogOpen"
    title="Hapus Surat Jalan Gudang"
    :description="bulkDeleteDialogDescription"
    type="danger"
    confirm-text="Hapus Semua"
    cancel-text="Batal"
    :is-loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
    @cancel="cancelBulkDelete"
    @update:open="isBulkDeleteDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- POST CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="Post Surat Jalan Gudang"
    :description="`Apakah Anda yakin ingin memposting Surat Jalan Gudang '${itemToPost?.no_sj_gudang || ''}'? Setelah diposting, data tidak dapat diubah atau dihapus.`"
    type="warning"
    confirm-text="Post"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- STATUS PENGIRIMAN DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isStatusPengirimanDialogOpen"
    title="Update Status Pengiriman"
    :description="`Pilih status pengiriman untuk Surat Jalan '${itemToUpdateStatusPengiriman?.no_sj_gudang || ''}'.`"
    type="info"
    confirm-text="Simpan"
    cancel-text="Batal"
    :is-loading="isUpdatingStatusPengiriman"
    @confirm="confirmUpdateStatusPengiriman"
    @cancel="cancelUpdateStatusPengiriman"
    @update:open="isStatusPengirimanDialogOpen = $event"
  >
    <div class="py-2">
      <FieldSelect
        id="status_pengiriman_id"
        label="Status Pengiriman"
        v-model="selectedStatusPengirimanId"
        :api="{
          url: `${API_BASE_URL}/dynamic/m_general`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStore.token}`,
          },
          params: {
            no_pagination: 'true',
            selectfield: 'id,value1',
            filter_column_group: 'STATUS PENGIRIMAN',
            filter_column_is_active: 'true',
          },
        }"
        valueField="id"
        displayField="value1"
        placeholder="Pilih status pengiriman"
        :clearable="false"
      />
    </div>
  </GlobalDialog>
</template>

<style scoped>
/* TransitionGroup animations for list items */
.list-move {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.list-enter-active {
  transition: all 0.4s ease-out;
}

.list-leave-active {
  transition: all 0.3s ease-in;
  position: absolute;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>