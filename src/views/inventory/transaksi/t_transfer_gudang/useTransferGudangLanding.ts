import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import {
  getTransferGudangList,
  deleteTransferGudang,
  postTransferGudang,
  type TransferGudangItem,
} from "./service";

interface ColumnFilters {
  [key: string]: string;
}
interface ColumnFilterOperators {
  [key: string]: string;
}
interface DateRangeFilter {
  from: string;
  to: string;
}
interface DateRangeFilters {
  [key: string]: DateRangeFilter;
}

export function useTransferGudangLanding() {
  const router = useRouter();
  const { API_BASE_URL } = useApi();
  const authStore = useAuthStore();
  const {
    selectedItem,
    isActive,
    selectItem,
    deselectItem,
    handleEdit,
    handleDelete,
    handleCopy,
  } = useActionButtons();
  const { currentMenuId, canCreate, canUpdate, canDelete, isSuperAdmin } =
    usePermission();

  // Delete dialog state
  const isDeleteDialogOpen = ref(false);
  const itemToDelete = ref<TransferGudangItem | null>(null);
  const isDeleting = ref(false);

  // Bulk delete state
  const selectedRows = ref<TransferGudangItem[]>([]);
  const isBulkDeleteDialogOpen = ref(false);
  const isBulkDeleting = ref(false);

  // Post dialog state
  const isPostDialogOpen = ref(false);
  const itemToPost = ref<TransferGudangItem | null>(null);
  const isPosting = ref(false);

  // Send approval dialog state
  const isSendApprovalDialogOpen = ref(false);
  const itemToSendApproval = ref<TransferGudangItem | null>(null);
  const approvalCatatan = ref("");
  const isSendingApproval = ref(false);

  const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList();
    return approvalList.find(
      (approval: any) =>
        approval.path === "/inventory/transaksi/t_transfer_gudang" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );
  });

  // Data and pagination state
  const menuData = ref<TransferGudangItem[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const hasMoreData = ref(true);

  // Search and filter state
  const filterStatus = ref<
    "DRAFT" | "POST" | "IN APPROVAL" | "APPROVED" | "REJECT" | "REVISI" | null
  >(null);
  const searchQuery = ref("");
  const searchApiQuery = ref("");
  const isSearching = ref(false);
  const tableColumnFilters = ref<ColumnFilters>({});
  const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
  const tableDateRangeFilters = ref<DateRangeFilters>({});
  const tableWhereFilter = ref("");
  const globalSearchFields = [
    "no_tw",
    "type",
    "catatan",
    "m_unit_bisni.nama_comp",
    "warehouse_asal.nama_gudang",
    "warehouse_tujuan.nama_gudang",
    "m_kary.nama_kary",
  ].join(",");

  const formatRecognizedDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  };

  const getStatusBadgeClass = (status: string) => getApprovalStatusBadgeClass(status);

  const columns = [
    {
      key: "m_unit_bisni.nama_comp",
      label: "Unit Bisnis",
      filterable: true,
      width: "180px",
      valueGetter: (item: TransferGudangItem) =>
        item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || "",
      renderHtml: (item: TransferGudangItem) => {
        return (
          item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || "-"
        );
      },
    },
    {
      key: "no_tw",
      label: "No. Transfer",
      filterable: true,
      width: "150px",
      valueGetter: (item: TransferGudangItem) => item.no_tw || "",
    },
    {
      key: "type",
      label: "Type",
      filterable: true,
      width: "130px",
      valueGetter: (item: TransferGudangItem) => item.type || "",
      renderHtml: (item: TransferGudangItem) => {
        const transferType = (item.type || "-").toString();
        if (transferType === "-") return transferType;
        return transferType.charAt(0).toUpperCase() + transferType.slice(1);
      },
    },
    {
      key: "tgl_tw",
      label: "Tanggal Transfer",
      filterable: true,
      width: "150px",
      filterType: "date" as const,
      valueGetter: (item: TransferGudangItem) => item.tgl_tw || "",
      renderHtml: (item: TransferGudangItem) => {
        return formatRecognizedDate(item.tgl_tw);
      },
    },
    {
      key: "warehouse_asal.nama_gudang",
      label: "Gudang Asal",
      filterable: true,
      width: "180px",
      valueGetter: (item: TransferGudangItem) =>
        item.warehouse_asal?.nama_gudang || "",
      renderHtml: (item: TransferGudangItem) => {
        return item.warehouse_asal?.nama_gudang || "-";
      },
    },
    {
      key: "warehouse_tujuan.nama_gudang",
      label: "Gudang Tujuan",
      filterable: true,
      width: "180px",
      valueGetter: (item: TransferGudangItem) =>
        item.warehouse_tujuan?.nama_gudang || "",
      renderHtml: (item: TransferGudangItem) => {
        return item.warehouse_tujuan?.nama_gudang || "-";
      },
    },
    {
      key: "pic.nama_kary",
      label: "PIC",
      filterable: true,
      width: "150px",
      valueGetter: (item: TransferGudangItem) =>
        item.m_kary?.nama_kary || item.pic?.nama_kary || "",
      renderHtml: (item: TransferGudangItem) => {
        return item.m_kary?.nama_kary || item.pic?.nama_kary || "-";
      },
    },
    { key: "catatan", label: "Catatan", filterable: true, width: "200px" },
    {
      key: "status",
      label: "Status",
      filterable: false,
      width: "120px",
      renderHtml: (item: TransferGudangItem) => {
        const status = item.status?.toUpperCase() || "DRAFT";
        const badgeClass = getStatusBadgeClass(status);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
      },
    },
  ];

  const filteredData = computed(() => {
    return menuData.value.filter((item: TransferGudangItem) => {
      const status = item.status?.toUpperCase() || "DRAFT";
      return filterStatus.value === null ? true : status === filterStatus.value;
    });
  });

  const normalizeStatus = (status?: string | null) =>
    (status || "DRAFT").toUpperCase();

  const isLockedStatus = (item?: TransferGudangItem | null) => {
    if (!item) return true;
    const status = normalizeStatus(item.status);
    return !(status === "DRAFT" || status === "REVISI");
  };

  const needsApprovalByLegacyRule = (item: TransferGudangItem) => {
    const transferType = (item.type || "").toString().toLowerCase();
    const asalId = (
      item.warehouse_asal_id ||
      item.warehouse_asal?.id ||
      ""
    ).toString();
    const tujuanId = (
      item.warehouse_tujuan_id ||
      item.warehouse_tujuan?.id ||
      ""
    ).toString();

    if (transferType === "opname") return true;

    if (transferType === "langsung") {
      if (!asalId || !tujuanId) return true;
      return asalId !== tujuanId;
    }

    return true;
  };

  const parseIsApprovalHeader = (
    item?: TransferGudangItem | null,
  ): boolean | null => {
    if (!item) return null;

    const raw = (item as any).is_approval;
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;

    const normalized = String(raw).trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
    return null;
  };

  const getApprovalValidation = (item: TransferGudangItem) => {
    const legacyNeedApproval = needsApprovalByLegacyRule(item);
    const headerNeedApproval = parseIsApprovalHeader(item);
    const hasHeaderFlag = headerNeedApproval !== null;
    const isMismatch =
      hasHeaderFlag && headerNeedApproval !== legacyNeedApproval;

    return {
      hasHeaderFlag,
      legacyNeedApproval,
      headerNeedApproval,
      isMismatch,
      // Header is primary source, legacy as fallback.
      finalNeedApproval: hasHeaderFlag
        ? !!headerNeedApproval
        : legacyNeedApproval,
    };
  };

  const needsApprovalAction = (item: TransferGudangItem) => {
    return getApprovalValidation(item).finalNeedApproval;
  };

  const shouldShowApprovalHistory = (item?: TransferGudangItem | null) => {
    return parseIsApprovalHeader(item) === true;
  };

  const getDocumentActionType = (
    item?: TransferGudangItem | null,
  ): "approval" | "post" | null => {
    if (!item) return null;
    const status = normalizeStatus(item.status);
    if (status !== "DRAFT" && status !== "REVISI") return null;
    return needsApprovalAction(item) ? "approval" : "post";
  };

  const getDocumentActionLabel = (item?: TransferGudangItem | null) => {
    const actionType = getDocumentActionType(item);
    if (actionType === "approval") return "Send Approval";
    if (actionType === "post") return "Send Post";
    return "";
  };

  const selectedDocumentActionType = computed(() =>
    getDocumentActionType(selectedItem.value),
  );
  const selectedDocumentActionLabel = computed(() =>
    getDocumentActionLabel(selectedItem.value),
  );

  const isSendActionDisabled = computed(() => {
    if (!isActive.value || !selectedItem.value) return true;
    if (isLockedStatus(selectedItem.value)) return true;
    return !selectedDocumentActionType.value;
  });

  const selectedSendTitle = computed(() => {
    if (!isActive.value || !selectedItem.value)
      return "Pilih data terlebih dahulu";
    if (isLockedStatus(selectedItem.value)) {
      return "Status POST / IN APPROVAL / APPROVED / REJECT tidak bisa dikirim";
    }
    return selectedDocumentActionLabel.value;
  });

  const isItemSendDisabled = (item?: TransferGudangItem | null) => {
    if (!item) return true;
    return isLockedStatus(item) || !getDocumentActionType(item);
  };

  const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return "";
    return `Apakah Anda yakin ingin menghapus Transfer Gudang tanggal "${itemToDelete.value.tgl_tw}"? Tindakan ini tidak dapat dibatalkan.`;
  });

  const deleteSelected = () => {
    if (!canDelete.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk menghapus data",
      });
      return;
    }

    const item = handleDelete();
    if (!item) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (isLockedStatus(item)) {
      toast.error("Tidak dapat menghapus", {
        description: `Data dengan status ${normalizeStatus(item.status)} tidak dapat dihapus`,
      });
      return;
    }

    itemToDelete.value = item;
    isDeleteDialogOpen.value = true;
  };

  const confirmDelete = async () => {
    if (!itemToDelete.value) return;

    isDeleting.value = true;
    try {
      const response = await deleteTransferGudang(itemToDelete.value.id);

      if (response.status === "success") {
        menuData.value = menuData.value.filter(
          (m: TransferGudangItem) => m.id !== itemToDelete.value!.id,
        );

        toast.success(
          `Transfer Gudang tanggal "${itemToDelete.value.tgl_tw}" berhasil dihapus`,
          {
            description: response.message || "Item telah dihapus dari database",
          },
        );

        deselectItem();
        isDeleteDialogOpen.value = false;
      } else {
        toast.error("Gagal menghapus Transfer Gudang", {
          description: response.message || "Terjadi kesalahan saat menghapus",
        });
      }
    } catch (error) {
      toast.error("Gagal menghapus Transfer Gudang", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      isDeleting.value = false;
      itemToDelete.value = null;
    }
  };

  const cancelDelete = () => {
    isDeleteDialogOpen.value = false;
    itemToDelete.value = null;
  };

  // ============================================================================
  // BULK DELETE FUNCTIONS
  // ============================================================================
  /** Rows yang lolos filter (DRAFT / REVISI) dari selection */
  const bulkDeletableRows = computed(() =>
    selectedRows.value.filter((item) => !isLockedStatus(item)),
  );

  /** Tombol bulk delete hanya tampil jika selection > 1 DAN ada yg bisa dihapus */
  const showBulkDeleteButton = computed(
    () => selectedRows.value.length > 1 && bulkDeletableRows.value.length > 0,
  );

  /** Deskripsi dialog bulk delete */
  const bulkDeleteDialogDescription = computed(() => {
    const deletable = bulkDeletableRows.value.length;
    const skipped = selectedRows.value.length - deletable;
    let desc = `Anda akan menghapus ${deletable} data Transfer Gudang yang berstatus DRAFT atau REVISI.`;
    if (skipped > 0) {
      desc += ` ${skipped} data dengan status lain akan dilewati.`;
    }
    desc += " Tindakan ini tidak dapat dibatalkan.";
    return desc;
  });

  /** Handler event selectionChange dari DataTable */
  const handleSelectionChange = (items: TransferGudangItem[]) => {
    selectedRows.value = items;
  };

  /** Buka dialog bulk delete */
  const openBulkDeleteDialog = () => {
    if (bulkDeletableRows.value.length === 0) {
      toast.error("Tidak ada data yang dapat dihapus", {
        description: "Pilih data dengan status DRAFT atau REVISI",
      });
      return;
    }
    isBulkDeleteDialogOpen.value = true;
  };

  /** Eksekusi bulk delete satu per satu */
  const confirmBulkDelete = async () => {
    if (bulkDeletableRows.value.length === 0) return;

    isBulkDeleting.value = true;
    const results = { success: 0, failed: 0 };

    try {
      for (const item of bulkDeletableRows.value) {
        try {
          const response = await deleteTransferGudang(item.id);
          if (response.status === "success") {
            menuData.value = menuData.value.filter((m) => m.id !== item.id);
            results.success++;
          } else {
            results.failed++;
          }
        } catch {
          results.failed++;
        }
      }

      if (results.success > 0) {
        toast.success(`${results.success} data berhasil dihapus`, {
          description:
            results.failed > 0
              ? `${results.failed} data gagal dihapus`
              : undefined,
        });
      } else {
        toast.error("Semua data gagal dihapus");
      }
    } finally {
      isBulkDeleting.value = false;
      isBulkDeleteDialogOpen.value = false;
      selectedRows.value = [];
      deselectItem();
    }
  };

  const cancelBulkDelete = () => {
    isBulkDeleteDialogOpen.value = false;
  };

  const postSelected = (item?: TransferGudangItem) => {
    if (!canUpdate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk mengubah data",
      });
      return;
    }

    const targetItem = item || selectedItem.value;
    if (!targetItem) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    const status = normalizeStatus(targetItem.status);
    if (status !== "DRAFT" && status !== "REVISI") {
      toast.error("Status tidak valid untuk POST", {
        description: "Hanya data DRAFT atau REVISI yang bisa dikirim POST",
      });
      return;
    }

    itemToPost.value = targetItem;
    isPostDialogOpen.value = true;
  };

  const confirmPost = async () => {
    if (!itemToPost.value) return;

    isPosting.value = true;
    try {
      const response = await postTransferGudang(itemToPost.value.id);
      const isPostSuccess =
        response.status === "success" ||
        response.message === "Data posted successfully";

      if (isPostSuccess) {
        toast.success(
          `Transfer Gudang "${itemToPost.value.no_tw || itemToPost.value.tgl_tw}" berhasil di-POST`,
          {
            description: "Data tidak bisa diedit atau dihapus lagi",
          },
        );

        const targetId = itemToPost.value.id;
        menuData.value = menuData.value.map((item) =>
          item.id === targetId ? { ...item, status: "POST" } : item,
        );

        deselectItem();
        isPostDialogOpen.value = false;
      } else {
        toast.error("Gagal POST Transfer Gudang", {
          description:
            response.message || response.reason || "Terjadi kesalahan",
        });
      }
    } catch (error: any) {
      toast.error("Gagal POST Transfer Gudang", {
        description:
          error?.reason ||
          (error instanceof Error ? error.message : "Terjadi kesalahan"),
      });
    } finally {
      isPosting.value = false;
      itemToPost.value = null;
    }
  };

  const cancelPost = () => {
    isPostDialogOpen.value = false;
    itemToPost.value = null;
  };

  const openSendApprovalDialog = (item?: TransferGudangItem) => {
    if (!canUpdate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk mengubah data",
      });
      return;
    }

    const targetItem = item || selectedItem.value;
    if (!targetItem) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    const status = normalizeStatus(targetItem.status);
    if (status !== "DRAFT" && status !== "REVISI") {
      toast.error("Status tidak valid untuk approval", {
        description: "Hanya data DRAFT atau REVISI yang bisa dikirim approval",
      });
      return;
    }

    itemToSendApproval.value = targetItem;
    approvalCatatan.value = "";
    isSendApprovalDialogOpen.value = true;
  };

  const confirmSendApproval = async () => {
    if (!itemToSendApproval.value) return;

    isSendingApproval.value = true;
    try {
      const currentApproval = currentApprovalInfo.value;

      if (!currentApproval) {
        toast.error("Gagal mengirim approval", {
          description: "Anda tidak memiliki hak untuk mengajukan approval",
        });
        return;
      }

      if (
        currentApproval.level === null ||
        currentApproval.level === undefined ||
        !currentApproval.sender_id
      ) {
        toast.error("Data approval tidak lengkap", {
          description:
            "Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.",
          duration: 6000,
        });
        return;
      }

      const payload = {
        title: `Request Approval Transfer Gudang: ${itemToSendApproval.value.no_tw || ""}`,
        approval_level: currentApproval.level,
        sender_id: currentApproval.sender_id,
        t_transfer_gudang_id: itemToSendApproval.value.id,
        approval_message: approvalCatatan.value.trim() || null,
        status_name: "IN APPROVAL",
      };

      const response = await fetch(
        `${API_BASE_URL}/dynamic/t_transfer_gudang_notifikasi`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (result.status === "success") {
        const targetId = itemToSendApproval.value.id;
        menuData.value = menuData.value.map((item) =>
          item.id === targetId ? { ...item, status: "IN APPROVAL" } : item,
        );

        toast.success(
          `Transfer Gudang "${itemToSendApproval.value.no_tw || itemToSendApproval.value.tgl_tw}" berhasil dikirim untuk approval`,
        );
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        deselectItem();
        isSendApprovalDialogOpen.value = false;
      } else {
        toast.error("Gagal mengirim approval", {
          description: result.message || "Terjadi kesalahan",
        });
      }
    } catch (error) {
      toast.error("Gagal mengirim approval", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      isSendingApproval.value = false;
      itemToSendApproval.value = null;
      approvalCatatan.value = "";
    }
  };

  const cancelSendApproval = () => {
    isSendApprovalDialogOpen.value = false;
    itemToSendApproval.value = null;
    approvalCatatan.value = "";
  };

  const triggerDocumentSend = (item?: TransferGudangItem) => {
    const targetItem = item || selectedItem.value;
    if (!targetItem) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (isLockedStatus(targetItem)) {
      toast.error("Aksi tidak tersedia", {
        description:
          "Status POST / IN APPROVAL / APPROVED / REJECT tidak dapat dikirim",
      });
      return;
    }

    const approvalValidation = getApprovalValidation(targetItem);
    if (approvalValidation.isMismatch) {
      toast.error("Validasi approval tidak sinkron", {
        description:
          "Nilai header is_approval berbeda dengan rule tipe/gudang. Silakan cek data header transfer gudang.",
      });
      return;
    }

    const actionType = getDocumentActionType(targetItem);
    if (!actionType) {
      toast.error("Aksi tidak tersedia", {
        description: `Data dengan status ${normalizeStatus(targetItem.status)} tidak dapat dikirim`,
      });
      return;
    }

    if (actionType === "post") {
      postSelected(targetItem);
      return;
    }

    openSendApprovalDialog(targetItem);
  };

  const handleDesktopSendClick = () => {
    if (isSendActionDisabled.value) return;
    triggerDocumentSend();
  };

  const handleRowSendClick = (item: TransferGudangItem) => {
    if (isItemSendDisabled(item)) return;
    selectItem(item, 0);
    triggerDocumentSend(item);
  };

  const exportData = () => {
    toast.info("Export feature coming soon");
  };

  const viewItem = (item?: any) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_transfer_gudang/view/${selectedItem.value.id}`);
  };

  const editItem = (item?: any) => {
    if (!canUpdate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk mengubah data",
      });
      return;
    }

    if (item) {
      selectItem(item, 0);
    }
    const selectedItemData = handleEdit(item);
    if (!selectedItemData) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (isLockedStatus(selectedItemData)) {
      toast.error("Data tidak dapat diedit", {
        description:
          "Hanya data dengan status DRAFT atau REVISI yang bisa diedit",
      });
      return;
    }

    router.push(`/inventory/transaksi/t_transfer_gudang/form/${selectedItemData.id}`);
  };

  const copyItem = (item?: any) => {
    if (!canCreate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk membuat data baru",
      });
      return;
    }

    if (item) {
      selectItem(item, 0);
    }
    const selectedItemData = handleCopy(item);
    if (!selectedItemData) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push({
      path: "/inventory/transaksi/t_transfer_gudang/form",
      query: {
        action: "copy",
        source: selectedItemData.id,
      },
    });

    toast.success(
      `Menyalin data Transfer Gudang tanggal "${selectedItemData.tgl_tw}"`,
      {
        description: "Silakan edit dan simpan sebagai Transfer Gudang baru",
      },
    );
    deselectItem();
  };

  const createNew = () => {
    if (!canCreate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk membuat data baru",
      });
      return;
    }

    router.push("/inventory/transaksi/t_transfer_gudang/form");
  };

  const getCompanyIdFromSelectRespo = (): string | undefined => {
    if (isSuperAdmin.value) return undefined;

    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyId || undefined;
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
    }
    return undefined;
  };

  const fetchMenuData = async (
    page: number = 1,
    resetData: boolean = false,
  ) => {
    if (page === 1 || resetData) {
      loading.value = true;
    } else {
      loadingMore.value = true;
    }

    try {
      const companyId = getCompanyIdFromSelectRespo();

      // Split column filters: relation cols (contain '.') → search+searchfield, direct cols → filter_column_{key}
      const colFilters = tableColumnFilters.value;
      const directColumnFilters: Record<string, string> = {};
      const relationSearchParts: Array<{ field: string; value: string }> = [];
      
      // Map frontend column keys to backend relation aliases
      const aliasMap: Record<string, string> = {
        "m_unit_bisni.nama_comp": "m_unit_bisnis.nama_comp",
        "pic.nama_kary": "m_kary.nama_kary",
      };

      Object.entries(colFilters).forEach(([key, value]) => {
        if (!value?.trim()) return;
        
        if (key.includes(".")) {
          const backendField = aliasMap[key] || key;
          relationSearchParts.push({ field: backendField, value: value.trim() });
        } else {
          directColumnFilters[key] = value.trim();
        }
      });

      // Build combined search: global search + relation column searches
      let effectiveSearch = searchApiQuery.value || undefined;
      let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

      if (relationSearchParts.length > 0) {
        // Use the first relation search part as the primary search
        // (multiple relation searches are hard to combine; use the most specific one)
        const firstRelation = relationSearchParts[0]!;
        effectiveSearch = firstRelation.value;
        effectiveSearchFields = firstRelation.field;

        // If there's also a global search, combine them
        if (searchApiQuery.value) {
          effectiveSearch = searchApiQuery.value;
          effectiveSearchFields = [globalSearchFields, firstRelation.field].join(",");
        }
      }

      const response = await getTransferGudangList(
        page,
        pageSize.value,
        "createdAt",
        "DESC",
        effectiveSearch,
        effectiveSearchFields,
        companyId,
        tableWhereFilter.value || undefined,
        Object.keys(directColumnFilters).length > 0 ? directColumnFilters : undefined,
      );

      if (response.status === "success") {
        if (page === 1 || resetData) {
          menuData.value = response.data;
        } else {
          menuData.value.push(...response.data);
        }

        if (response.pagination) {
          hasMoreData.value = response.pagination.next_page !== null;
        }
      }
    } catch (error) {
      toast.error("Gagal memuat data TransferGudang", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const handleLoadMore = () => {
    currentPage.value++;
    fetchMenuData(currentPage.value);
  };

  const handleApiSearch = async () => {
    if (isSearching.value) return;

    isSearching.value = true;
    searchApiQuery.value = searchQuery.value;

    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;

    await fetchMenuData(1, true);

    if (searchQuery.value.trim()) {
      toast.success("Pencarian selesai", {
        description: `Ditemukan ${menuData.value.length} hasil`,
      });
    }

    isSearching.value = false;
  };

  const clearSearch = async () => {
    searchQuery.value = "";
    searchApiQuery.value = "";
    await handleApiSearch();
  };

  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const handleTableFilterChange = (filters: {
    column: Record<string, string>;
    operator: Record<string, string>;
    dateRange: Record<string, { from: string; to: string }>;
    where: string;
  }) => {
    tableColumnFilters.value = filters.column;
    tableColumnFilterOperators.value = filters.operator;
    tableDateRangeFilters.value = filters.dateRange;
    tableWhereFilter.value = filters.where;

    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer);
    }

    filterDebounceTimer = setTimeout(async () => {
      menuData.value = [];
      currentPage.value = 1;
      hasMoreData.value = true;

      await fetchMenuData(1, true);
    }, 500);
  };

  const handleRefresh = async () => {
    searchQuery.value = "";
    searchApiQuery.value = "";
    tableColumnFilters.value = {};
    tableColumnFilterOperators.value = {};
    tableDateRangeFilters.value = {};
    tableWhereFilter.value = "";
    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;
    deselectItem();

    await fetchMenuData(1, true);

    toast.success("Data berhasil dimuat ulang");
  };

  const handleWindowScroll = () => {
    if (loadingMore.value || !hasMoreData.value) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (docHeight - scrollTop - windowHeight < 100) {
      currentPage.value++;
      fetchMenuData(currentPage.value);
    }
  };

  onMounted(async () => {
    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;
    deselectItem();

    await fetchMenuData(1);

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", handleWindowScroll);
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer);
    }

    menuData.value = [];
    deselectItem();
  });

  return {
    // state and computed
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
    itemToDelete,
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

    // helpers
    formatRecognizedDate,
    getStatusBadgeClass,
    isLockedStatus,
    isItemSendDisabled,
    getDocumentActionLabel,
    shouldShowApprovalHistory,

    // actions
    selectItem,
    deselectItem,
    deleteSelected,
    confirmDelete,
    cancelDelete,
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
    triggerDocumentSend,
    exportData,
  };
}
