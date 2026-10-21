<script setup lang="ts">
import { Search, RefreshCw, X, Plus, Send, Info, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import DataTable from "@/components/table/DataTable.vue";
import { FieldX } from "@/components/field";
import {
  DeleteButton,
  EditButton,
  CopyButton,
  ViewButton,
  HistoryApprovalButton,
} from "@/components/button";
import { useTransferGudangLanding } from "./useTransferGudangLanding";
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
  deleteDialogDescription,
  isDeleteDialogOpen,
  isDeleting,
  isPostDialogOpen,
  itemToPost,
  isPosting,
  isSendApprovalDialogOpen,
  itemToSendApproval,
  currentApprovalInfo,
  approvalCatatan,
  isSendingApproval,
  selectedDocumentActionLabel,
  isSendActionDisabled,
  selectedSendTitle,
  formatRecognizedDate,
  getStatusBadgeClass,
  isLockedStatus,
  isItemSendDisabled,
  getDocumentActionLabel,
  shouldShowApprovalHistory,
  selectItem,
  deselectItem,
  deleteSelected,
  confirmDelete,
  cancelDelete,
  confirmPost,
  cancelPost,
  confirmSendApproval,
  cancelSendApproval,
  viewItem,
  editItem,
  copyItem,
  createNew,
  handleLoadMore,
  handleApiSearch,
  clearSearch,
  handleTableFilterChange,
  handleRefresh,
  handleDesktopSendClick,
  handleRowSendClick,
  // Bulk delete
  isBulkDeleteDialogOpen,
  isBulkDeleting,
  bulkDeletableRows,
  showBulkDeleteButton,
  bulkDeleteDialogDescription,
  handleSelectionChange,
  openBulkDeleteDialog,
  confirmBulkDelete,
  cancelBulkDelete,
} = useTransferGudangLanding();
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
            <h1 class="text-lg font-bold">Transaksi Transfer Gudang</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Transfer Gudang
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
            :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
            @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
          >
            POST
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
            @click="
              filterStatus =
                filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
            "
          >
            IN APPROVAL
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
            @click="
              filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
            "
          >
            APPROVED
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
            @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
          >
            REJECT
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
            @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
          >
            REVISI
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
                  {{ item.no_tw || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ formatRecognizedDate(item.tgl_tw) }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  Type: {{ item.type || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.warehouse_asal?.nama_gudang || "-" }} →
                  {{ item.warehouse_tujuan?.nama_gudang || "-" }}
                </div>
              </div>
              <Badge
                :class="getStatusBadgeClass(item.status || 'DRAFT')"
                class="text-xs shrink-0"
              >
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.m_kary?.nama_kary || item.pic?.nama_kary">
                <span class="font-medium">PIC:</span>
                {{ item.m_kary?.nama_kary || item.pic?.nama_kary }}
              </div>
              <div v-if="item.catatan">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
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
                :disabled="isLockedStatus(item)"
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
                :disabled="isLockedStatus(item)"
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
              />
              <Button
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                :variant="isItemSendDisabled(item) ? 'ghost' : 'default'"
                size="icon"
                :class="[
                  'h-7 w-7 p-0 inline-flex items-center justify-center',
                  isItemSendDisabled(item) && 'opacity-50',
                ]"
                :disabled="isItemSendDisabled(item)"
                :title="
                  isItemSendDisabled(item)
                    ? 'Status POST / IN APPROVAL / APPROVED / REJECT tidak bisa dikirim'
                    : getDocumentActionLabel(item)
                "
                @click.stop="handleRowSendClick(item)"
              >
                <Send class="h-3.5 w-3.5" />
              </Button>
              <HistoryApprovalButton
                v-if="shouldShowApprovalHistory(item)"
                :record-id="item.id || ''"
                notification-endpoint="t_transfer_gudang_notifikasi"
                foreign-key-column="t_transfer_gudang_id"
                :record-label="item.no_tw || 'Tanpa Nomor'"
                variant="ghost"
                size="sm"
                :show-label="false"
                class="h-7 w-7"
                @click.stop
              />
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
        <h1 class="text-2xl font-bold">Transaksi Transfer Gudang</h1>
        <p class="text-sm text-muted-foreground">Kelola data Transfer Gudang</p>
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
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
          @click="
            filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
          "
        >
          IN APPROVAL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
          @click="
            filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
          "
        >
          APPROVED
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
          @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
        >
          REJECT
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
          @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
        >
          REVISI
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
          <!-- Bulk Delete: hanya muncul jika selection > 1 DAN ada yg berstatus DRAFT/REVISI -->
          <Button
            v-if="showBulkDeleteButton"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive"
            size="default"
            class="gap-2 whitespace-nowrap"
            @click="openBulkDeleteDialog"
          >
            <Trash2 class="h-4 w-4" />
            Bulk Delete ({{ bulkDeletableRows.length }})
          </Button>
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :status="selectedItem?.status"
            :disabled="!isActive"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="!isActive"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <Button
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :variant="isSendActionDisabled ? 'outline' : 'default'"
            size="sm"
            :class="[
              'gap-2 text-center align-content-center',
              selectedDocumentActionLabel === 'Send Approval' ||
              selectedDocumentActionLabel === 'Send Post'
                ? ' min-w-[138px]'
                : '',
              isSendActionDisabled && 'pointer-events-none opacity-50',
            ]"
            :disabled="isSendActionDisabled"
            :title="selectedSendTitle"
            @click="handleDesktopSendClick"
          >
            <Send class="h-4 w-4" />
            <span>{{ selectedDocumentActionLabel }}</span>
          </Button>
          <HistoryApprovalButton
            v-if="shouldShowApprovalHistory(selectedItem)"
            :disabled="!isActive"
            notification-endpoint="t_transfer_gudang_notifikasi"
            :record-id="selectedItem?.id || ''"
            foreign-key-column="t_transfer_gudang_id"
            :record-label="selectedItem?.no_tw || ''"
          />
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
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
      @selection-change="handleSelectionChange"
    >
      <template #empty> Tidak ada data Transfer Gudang </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Transfer Gudang"
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
    title="Bulk Hapus Transfer Gudang"
    :description="bulkDeleteDialogDescription"
    type="danger"
    confirm-text="Hapus Semua"
    cancel-text="Batal"
    :is-loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
    @cancel="cancelBulkDelete"
    @update:open="isBulkDeleteDialogOpen = $event"
  />

  <GlobalDialog
    :open="isPostDialogOpen"
    title="Post Transfer Gudang"
    :description="`Apakah Anda yakin ingin memposting transfer gudang '${itemToPost?.no_tw || itemToPost?.tgl_tw || ''}'? Setelah diposting, data tidak dapat diubah atau dihapus.`"
    type="warning"
    confirm-text="Post"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />

  <Dialog
    :open="isSendApprovalDialogOpen"
    @update:open="isSendApprovalDialogOpen = $event"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div
            class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50"
          >
            <Info class="w-5 h-5 text-blue-600" />
          </div>
          <DialogTitle class="text-lg">Kirim Approval</DialogTitle>
        </div>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
          <p class="text-sm font-medium">Transfer Gudang:</p>
          <p class="text-sm text-muted-foreground">
            {{ itemToSendApproval.no_tw || itemToSendApproval.tgl_tw || "-" }}
          </p>
        </div>

        <div v-if="currentApprovalInfo" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Pengirim:</p>
            <p class="text-sm text-muted-foreground">
              {{ currentApprovalInfo.sender_name || "-" }}
            </p>
          </div>

          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Tipe Approval:</p>
            <p class="text-sm font-medium text-primary">
              {{ currentApprovalInfo.tipe_approve || "-" }}
            </p>
          </div>
        </div>

        <div class="border-t pt-4">
          <FieldX
            id="approval-catatan"
            type="textarea"
            v-model="approvalCatatan"
            label="Catatan Approval"
            placeholder="Masukkan catatan untuk approval (opsional)"
            hints="Catatan ini akan dikirim ke penerima approval"
            :disabled="isSendingApproval"
            :rows="4"
          />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          @click="cancelSendApproval"
          :disabled="isSendingApproval"
        >
          Batal
        </Button>
        <Button
          variant="default"
          @click="confirmSendApproval"
          :disabled="isSendingApproval"
          class="gap-2"
        >
          <span v-if="isSendingApproval">Mengirim...</span>
          <span v-else>Kirim</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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