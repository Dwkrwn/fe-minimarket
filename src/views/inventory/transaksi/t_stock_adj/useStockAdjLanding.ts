import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import { getStockAdjList, deleteStockAdj, type StockAdjItem } from "./service";

export function useStockAdjLanding() {
  const router = useRouter();
  const { selectedItem, isActive, selectItem, deselectItem } =
    useActionButtons();
  const { currentMenuId, isSuperAdmin } = usePermission();
  const { API_BASE_URL } = useApi();
  const authStore = useAuthStore();

  const isDeleteDialogOpen = ref(false);
  const itemToDelete = ref<StockAdjItem | null>(null);
  const isDeleting = ref(false);

  // ============================================================================
  // BULK DELETE STATE
  // ============================================================================
  const selectedRows = ref<StockAdjItem[]>([]);
  const isBulkDeleteDialogOpen = ref(false);
  const isBulkDeleting = ref(false);

  const isSendApprovalDialogOpen = ref(false);
  const itemToSendApproval = ref<StockAdjItem | null>(null);
  const approvalCatatan = ref("");
  const isSendingApproval = ref(false);

  const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList();
    return approvalList.find(
      (approval: any) =>
        approval.path === "/inventory/transaksi/t_stock_adj" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );
  });

  const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false;
    const status = selectedItem.value.status?.toUpperCase();
    return (
      status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
    );
  });

  const canEditOrDelete = computed(() => {
    if (!isActive.value) return false;
    const status = selectedItem.value?.status?.toUpperCase();
    if (status === "APPROVED") return false;
    // if (isSuperAdmin.value) return true;
    return !isStatusLocked.value;
  });

  const canDeleteItem = (item: StockAdjItem) => {
    const status = item.status?.toUpperCase();
    return status === "DRAFT" || status === "REVISI";
  };

  const canEditItem = (item: StockAdjItem) => {
    const status = item.status?.toUpperCase();
    return status === "DRAFT" || status === "REVISI";
  };

  const menuData = ref<StockAdjItem[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const hasMoreData = ref(true);

  const filterStatus = ref<
    "DRAFT" | "IN APPROVAL" | "REJECT" | "REVISI" | "APPROVED" | null
  >(null);
  const searchQuery = ref("");
  const searchApiQuery = ref("");
  const isSearching = ref(false);

  const tableColumnFilters = ref<Record<string, string>>({});
  const tableColumnFilterOperators = ref<Record<string, string>>({});
  const tableDateRangeFilters = ref<
    Record<string, { from: string; to: string }>
  >({});
  const tableWhereFilter = ref("");

  const getStatusStyle = getApprovalStatusBadgeClass;

  const columns = [
    {
      key: "m_unit_bisni",
      label: "Unit BIsnis",
      filterable: false,
      width: "200px",
      renderHtml: (item: StockAdjItem) => {
        return (item as any).m_unit_bisni?.nama_comp || "-";
      },
    },
    {
      key: "no_stock_adj",
      label: "No Stock Adj",
      filterable: true,
      width: "150px",
    },
    {
      key: "tgl_adj",
      label: "Tgl Stock Adjustment",
      filterable: true,
      filterType: "date" as const,
      width: "150px",
      renderHtml: (item: StockAdjItem) => {
        return item.tgl_adj
          ? new Date(item.tgl_adj).toLocaleDateString("id-ID")
          : "-";
      },
    },
    {
      key: "tipe_referensi",
      label: "Tipe Adjustment",
      filterable: true,
      width: "150px",
      renderHtml: (item: StockAdjItem) => {
        return item.tipe_referensi == "OPNAME"
          ? "Stock Opname"
          : item.tipe_referensi == "ADJUSTMENT"
            ? "Adjustment"
            : "-";
      },
    },
    {
      key: "pic_adj.nama_kary",
      label: "PIC",
      filterable: true,
      width: "180px",
      renderHtml: (item: StockAdjItem) => {
        return (item as any).pic_adj?.nama_kary || "-";
      },
    },
    {
      key: "gudang_adj.nama_gudang",
      label: "Gudang",
      filterable: false,
      width: "200px",
      renderHtml: (item: StockAdjItem) => {
        return (item as any).gudang_adj?.nama_gudang || "-";
      },
    },
    { key: "catatan", label: "Catatan", filterable: true, width: "250px" },
    {
      key: "status",
      label: "Status",
      filterable: true,
      width: "150px",
      renderHtml: (item: StockAdjItem) => {
        const status = item.status || "DRAFT";
        const badgeClass = getStatusStyle(status);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
      },
    },
  ];

  const filteredData = computed(() => {
    if (!filterStatus.value) return menuData.value;

    return menuData.value.filter((item) => {
      const itemStatus = (item.status || "").toUpperCase();
      return itemStatus === filterStatus.value;
    });
  });

  const canViewAllData = computed(() => {
    // if (isSuperAdmin.value) return true;

    const tipeUser = authStore.user?.tipe?.value1?.toUpperCase();
    if (!tipeUser) return false;

    const allowedTypes = ["SUPER ADMIN", "DEVELOPER", "ADMIN"];
    return allowedTypes.some((type) => tipeUser.includes(type));
  });

  const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return "";
    return `Apakah Anda yakin ingin menghapus Stock Adj "${itemToDelete.value.no_stock_adj || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
  });

  const createNew = () => {
    router.push("/inventory/transaksi/t_stock_adj/form");
  };

  const editItem = (item?: StockAdjItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (!canEditItem(selectedItem.value)) {
      toast.error("Tidak dapat mengedit", {
        description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah`,
      });
      return;
    }

    router.push(`/inventory/transaksi/t_stock_adj/form/${selectedItem.value.id}`);
  };

  const copyItem = (item?: StockAdjItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push({
      path: "/inventory/transaksi/t_stock_adj/form",
      query: { action: "copy", source: selectedItem.value.id },
    });
  };

  const viewItem = (item?: StockAdjItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_stock_adj/view/${selectedItem.value.id}`);
  };

  const deleteSelected = (item?: StockAdjItem) => {
    if (item) {
      selectItem(item, 0);
      itemToDelete.value = item;
    } else {
      itemToDelete.value = selectedItem.value;
    }

    if (!itemToDelete.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (!canDeleteItem(itemToDelete.value)) {
      toast.error("Tidak dapat menghapus", {
        description: `Data dengan status ${itemToDelete.value.status} tidak dapat dihapus`,
      });
      itemToDelete.value = null;
      return;
    }

    isDeleteDialogOpen.value = true;
  };

  const confirmDelete = async () => {
    if (!itemToDelete.value?.id) return;

    isDeleting.value = true;
    try {
      const response = await deleteStockAdj(itemToDelete.value.id);

      if (response.status === "success") {
        menuData.value = menuData.value.filter(
          (m: StockAdjItem) => m.id !== itemToDelete.value!.id,
        );

        toast.success("Stock Adj berhasil dihapus");
        isDeleteDialogOpen.value = false;
        deselectItem();
      } else {
        toast.error("Gagal menghapus Stock Adj", {
          description: response.message || "Terjadi kesalahan saat menghapus",
        });
      }
    } catch (error) {
      toast.error("Gagal menghapus Stock Adj", {
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
  /** Rows yang lolos canDeleteItem (DRAFT / REVISI) dari selection */
  const bulkDeletableRows = computed(() =>
    selectedRows.value.filter((item) => canDeleteItem(item)),
  );

  /** Tombol bulk delete hanya tampil jika selection > 1 DAN ada yg bisa dihapus */
  const showBulkDeleteButton = computed(
    () => selectedRows.value.length > 1 && bulkDeletableRows.value.length > 0,
  );

  /** Deskripsi dialog bulk delete */
  const bulkDeleteDialogDescription = computed(() => {
    const deletable = bulkDeletableRows.value.length;
    const skipped = selectedRows.value.length - deletable;
    let desc = `Anda akan menghapus ${deletable} data Stock Adjustment yang berstatus DRAFT atau REVISI.`;
    if (skipped > 0) {
      desc += ` ${skipped} data dengan status lain akan dilewati.`;
    }
    desc += " Tindakan ini tidak dapat dibatalkan.";
    return desc;
  });

  /** Handler event selectionChange dari DataTable */
  const handleSelectionChange = (items: StockAdjItem[]) => {
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
          const response = await deleteStockAdj(item.id);
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

  const openSendApprovalDialog = (item?: StockAdjItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    itemToSendApproval.value = selectedItem.value;
    approvalCatatan.value = "";
    isSendApprovalDialogOpen.value = true;
  };

  const confirmSendApproval = async () => {
    if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;

    isSendingApproval.value = true;
    try {
      const approvalList = authStore.getApprovalList();
      const currentApproval = approvalList.find(
        (approval: any) =>
          approval.path === "/inventory/transaksi/t_stock_adj" &&
          approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
      );

      if (!currentApproval) {
        toast.error("Gagal mengirim approval", {
          description: "Anda tidak memiliki hak untuk mengajukan approval",
        });
        isSendingApproval.value = false;
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
        isSendingApproval.value = false;
        return;
      }

      const payload = {
        title: `Request Approval Stock Adjustment: ${itemToSendApproval.value.no_stock_adj || ""}`,
        approval_level: currentApproval.level,
        sender_id: currentApproval.sender_id,
        t_stock_adj_id: itemToSendApproval.value.id,
        approval_message: approvalCatatan.value.trim() || null,
        status_name: "IN APPROVAL",
      };

      const response = await fetch(
        `${API_BASE_URL}/dynamic/t_stock_adj_notifikasi`,
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
        const itemIndex = menuData.value.findIndex(
          (m: StockAdjItem) => m.id === itemToSendApproval.value!.id,
        );
        if (itemIndex !== -1) {
          const updatedItem = {
            ...menuData.value[itemIndex],
            status: "IN APPROVAL",
          } as StockAdjItem;
          menuData.value.splice(itemIndex, 1, updatedItem);
        }

        toast.success("Approval berhasil dikirim", {
          description: `Stock Adj "${itemToSendApproval.value.no_stock_adj || "tanpa nomor"}" telah dikirim untuk approval`,
        });

        window.dispatchEvent(new CustomEvent("notificationsUpdated"));

        isSendApprovalDialogOpen.value = false;
        deselectItem();
      } else {
        toast.error("Gagal mengirim approval", {
          description:
            result.message || "Terjadi kesalahan saat mengirim approval",
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
      if (resetData) {
        menuData.value = [];
      }

      let companyId: string | undefined = undefined;
      const userRole = authStore.tipeUser?.value1?.trim().toUpperCase();
      const canViewAllCompanies =
        isSuperAdmin.value ||
        (userRole &&
          (userRole.includes("SUPER ADMIN") || userRole.includes("DEVELOPER")));

      if (!canViewAllCompanies) {
        try {
          const selectRespo = localStorage.getItem("SelectRespo");
          if (selectRespo) {
            const parsed = JSON.parse(selectRespo);
            if (parsed.companyId) companyId = parsed.companyId;
          }
        } catch (e) {
          // ignore
        }
      }

      const filterCreatedBy = canViewAllData.value
        ? undefined
        : authStore.user?.id;

      const response = await getStockAdjList(
        page,
        pageSize.value,
        "createdAt",
        "DESC",
        searchApiQuery.value || undefined,
        searchApiQuery.value ? "no_stock_adj,catatan" : undefined,
        companyId,
        filterCreatedBy,
        tableWhereFilter.value || undefined,
      );

      if (response.status === "success" && response.data) {
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
      toast.error("Gagal memuat data Stock Adj", {
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

    menuData.value = [];
    deselectItem();
  });

  return {
    selectedItem,
    isActive,
    currentMenuId,
    API_BASE_URL,
    menuData,
    loading,
    loadingMore,
    hasMoreData,
    filterStatus,
    searchQuery,
    isSearching,
    columns,
    filteredData,
    canEditOrDelete,
    currentApprovalInfo,
    isDeleteDialogOpen,
    deleteDialogDescription,
    isDeleting,
    isSendApprovalDialogOpen,
    itemToSendApproval,
    approvalCatatan,
    isSendingApproval,
    getStatusStyle,
    canDeleteItem,
    canEditItem,
    selectItem,
    deselectItem,
    createNew,
    editItem,
    copyItem,
    viewItem,
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
    openSendApprovalDialog,
    confirmSendApproval,
    cancelSendApproval,
    handleLoadMore,
    handleApiSearch,
    clearSearch,
    handleTableFilterChange,
    handleRefresh,
  };
}
