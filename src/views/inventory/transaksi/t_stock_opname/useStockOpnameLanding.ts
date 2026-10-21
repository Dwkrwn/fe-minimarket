import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import {
  getStockOpnameList,
  deleteStockOpname,
  type StockOpnameItem,
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

export function useStockOpnameLanding() {
  const router = useRouter();
  const { API_BASE_URL } = useApi();
  const authStore = useAuthStore();
  const { selectedItem, isActive, selectItem, deselectItem } =
    useActionButtons();
  const { currentMenuId, isSuperAdmin } = usePermission();

  const isDeleteDialogOpen = ref(false);
  const itemToDelete = ref<StockOpnameItem | null>(null);
  const isDeleting = ref(false);

  const selectedRows = ref<StockOpnameItem[]>([]);
  const isBulkDeleteDialogOpen = ref(false);
  const isBulkDeleting = ref(false);

  const isSendApprovalDialogOpen = ref(false);
  const itemToSendApproval = ref<StockOpnameItem | null>(null);
  const approvalCatatan = ref("");
  const isSendingApproval = ref(false);

  const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList();
    return approvalList.find(
      (approval: any) =>
        approval.path === "/inventory/transaksi/t_stock_opname" &&
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
    return isActive.value && !isStatusLocked.value;
  });

  const canDeleteItem = (item: StockOpnameItem) => {
    const status = item.status?.toUpperCase();
    return status === "LOCK" || status === "REVISI";
  };

  const canEditItem = (item: StockOpnameItem) => {
    const status = item.status?.toUpperCase();
    return status === "LOCK" || status === "REVISI";
  };

  const menuData = ref<StockOpnameItem[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const hasMoreData = ref(true);

  const filterStatus = ref<
    "LOCK" | "IN APPROVAL" | "REJECT" | "REVISI" | "APPROVED" | null
  >(null);
  const searchQuery = ref("");
  const searchApiQuery = ref("");
  const isSearching = ref(false);
  const tableColumnFilters = ref<ColumnFilters>({});
  const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
  const tableDateRangeFilters = ref<DateRangeFilters>({});
  const tableWhereFilter = ref("");

  const getStatusChecking = (item: StockOpnameItem): string => {
    if (item.status_checking) return item.status_checking;
    const status = (item.status || "").toUpperCase();
    if (status === "APPROVED") return "SELESAI";
    return "PROSES";
  };

  const getStatusCheckingStyle = (val: string) => {
    switch (val?.toUpperCase()) {
      case "SELESAI":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "PROSES":
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  const getStatusCheckingLabel = (val: string) => {
    switch (val?.toUpperCase()) {
      case "SELESAI":
        return "Selesai Checking";
      case "PROSES":
      default:
        return "Proses Checking";
    }
  };

  const getStatusStyle = (status: string) => getApprovalStatusBadgeClass(status);

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("id-ID");
  };

  const getPeriode = (item: StockOpnameItem) => {
    return (
      (item as any).t_stock_opname_periode ||
      (item as any).periode_opname ||
      {}
    );
  };



  const columns = [
    {
      key: "m_unit_bisni.nama_comp",
      label: "Unit Bisnis",
      filterable: true,
      width: "200px",
      valueGetter: (item: any) => item?.m_unit_bisni?.nama_comp || "",
      renderHtml: (item: StockOpnameItem) => {
        return (item as any).m_unit_bisni?.nama_comp || "-";
      },
    },
    {
      key: "no_stock_opname",
      label: "No. Stock Opname",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.no_stock_opname || "",
      renderHtml: (item: StockOpnameItem) => {
        return (item as any).no_stock_opname || "-";
      },
    },
    {
      key: "tgl_mulai",
      label: "Tgl Mulai",
      filterable: true,
      filterType: "date" as const,
      width: "150px",
      valueGetter: (item: any) => formatDate(getPeriode(item).tgl_mulai) || "",
      renderHtml: (item: StockOpnameItem) => {
        return formatDate(getPeriode(item).tgl_mulai) || "-";
      },
    },
    {
      key: "tgl_akhir",
      label: "Tgl Akhir",
      filterable: true,
      filterType: "date" as const,
      width: "150px",
      valueGetter: (item: any) => formatDate(getPeriode(item).tgl_akhir) || "",
      renderHtml: (item: StockOpnameItem) => {
        return formatDate(getPeriode(item).tgl_akhir) || "-";
      },
    },
    {
      key: "tgl_opname",
      label: "Tgl Stock Opname",
      filterable: true,
      filterType: "date" as const,
      width: "160px",
      valueGetter: (item: any) => formatDate(item?.tgl_opname) || "",
      renderHtml: (item: StockOpnameItem) => {
        return formatDate((item as any).tgl_opname) || "-";
      },
    },
    {
      key: "pic_opname.nama_kary",
      label: "PIC",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.pic_opname?.nama_kary || "",
      renderHtml: (item: StockOpnameItem) => {
        return (item as any).pic_opname?.nama_kary || "-";
      },
    },
    {
      key: "gudang_opname.nama_gudang",
      label: "Warehouse",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.gudang_opname?.nama_gudang || "",
      renderHtml: (item: StockOpnameItem) => {
        return (item as any).gudang_opname?.nama_gudang || "-";
      },
    },
    {
      key: "catatan",
      label: "Catatan",
      filterable: true,
      width: "200px",
      valueGetter: (item: any) => item?.catatan || "",
      renderHtml: (item: StockOpnameItem) => {
        return (item as any).catatan || "-";
      },
    },
    {
      key: "status",
      label: "Status",
      filterable: true,
      width: "120px",
      valueGetter: (item: any) => item?.status || "LOCK",
      renderHtml: (item: StockOpnameItem) => {
        const status = (item as any).status || "LOCK";
        const badgeClass = getStatusStyle(status);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
      },
    },
    {
      key: "status_checking",
      label: "Status Checking",
      filterable: false,
      width: "160px",
      renderHtml: (item: StockOpnameItem) => {
        const val = getStatusChecking(item);
        const badgeClass = getStatusCheckingStyle(val);
        const label = getStatusCheckingLabel(val);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${label}</span>`;
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
    return `Apakah Anda yakin ingin menghapus Stock Opname "${itemToDelete.value.no_stock_opname || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
  });

  const createNew = () => {
    router.push("/inventory/transaksi/t_stock_opname/form");
  };

  const editItem = (item?: StockOpnameItem) => {
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

    router.push(`/inventory/transaksi/t_stock_opname/form/${selectedItem.value.id}`);
  };

  const copyItem = (item?: StockOpnameItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push({
      path: "/inventory/transaksi/t_stock_opname/form",
      query: { action: "copy", source: selectedItem.value.id }
    });
  };

  const viewItem = (item?: StockOpnameItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_stock_opname/view/${selectedItem.value.id}`);
  };

  const printItem = (item?: StockOpnameItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_stock_opname/print/${selectedItem.value.id}`);
  };

  const deleteSelected = (item?: StockOpnameItem) => {
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
      const response = await deleteStockOpname(itemToDelete.value.id);

      if (response.status === "success") {
        menuData.value = menuData.value.filter(
          (m: StockOpnameItem) => m.id !== itemToDelete.value!.id,
        );

        toast.success("Stock Opname berhasil dihapus");
        isDeleteDialogOpen.value = false;
        deselectItem();
      } else {
        toast.error("Gagal menghapus Stock Opname", {
          description: response.message || "Terjadi kesalahan saat menghapus",
        });
      }
    } catch (error) {
      toast.error("Gagal menghapus Stock Opname", {
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
  const bulkDeletableRows = computed(() =>
    selectedRows.value.filter((item) => canDeleteItem(item)),
  );

  const showBulkDeleteButton = computed(
    () => selectedRows.value.length > 1 && bulkDeletableRows.value.length > 1,
  );

  const bulkDeleteDialogDescription = computed(() => {
    const deletable = bulkDeletableRows.value.length;
    const skipped = selectedRows.value.length - deletable;
    let desc = `Anda akan menghapus ${deletable} data Stock Opname yang berstatus LOCK atau REVISI.`;
    if (skipped > 0) {
      desc += ` ${skipped} data dengan status lain akan dilewati.`;
    }
    desc += " Tindakan ini tidak dapat dibatalkan.";
    return desc;
  });

  const handleSelectionChange = (items: StockOpnameItem[]) => {
    selectedRows.value = items;
  };

  const openBulkDeleteDialog = () => {
    if (bulkDeletableRows.value.length === 0) {
      toast.error("Tidak ada data yang dapat dihapus", {
        description: "Pilih data dengan status LOCK atau REVISI",
      });
      return;
    }
    isBulkDeleteDialogOpen.value = true;
  };

  const confirmBulkDelete = async () => {
    if (bulkDeletableRows.value.length === 0) return;

    isBulkDeleting.value = true;
    const results = { success: 0, failed: 0 };

    try {
      for (const item of bulkDeletableRows.value) {
        try {
          const response = await deleteStockOpname(item.id);
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

  const openSendApprovalDialog = (item?: StockOpnameItem) => {
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
          approval.path === "/inventory/transaksi/t_stock_opname" &&
          approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
      );

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
        title: `Request Approval Stock Opname: ${itemToSendApproval.value.no_stock_opname || ""}`,
        approval_level: currentApproval.level,
        sender_id: currentApproval.sender_id,
        t_stock_opname_id: itemToSendApproval.value.id,
        approval_message: approvalCatatan.value.trim() || null,
        status_name: "IN APPROVAL",
      };

      const response = await fetch(
        `${API_BASE_URL}/dynamic/t_stock_opname_notifikasi`,
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
        const approvalItemId = itemToSendApproval.value!.id;

        const itemIndex = menuData.value.findIndex(
          (m: StockOpnameItem) => m.id === approvalItemId,
        );
        if (itemIndex !== -1) {
          const updatedItem = {
            ...menuData.value[itemIndex],
            status: "IN APPROVAL",
          } as StockOpnameItem;
          menuData.value.splice(itemIndex, 1, updatedItem);
        }

        toast.success("Approval berhasil dikirim", {
          description: `Stock Opname "${itemToSendApproval.value.no_stock_opname || "tanpa nomor"}" telah dikirim untuk approval`,
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

  const globalSearchFields = [
    "no_stock_opname",
    "catatan",
    "m_unit_bisni.nama_comp",
    "pic_opname.nama_kary",
    "gudang_opname.nama_gudang",
  ].join(",");

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
        } catch {
          // ignore
        }
      }

      const filterCreatedBy = canViewAllData.value
        ? undefined
        : authStore.user?.id;
      // Clean where clause to remove relation columns (tgl_mulai and tgl_akhir) to prevent SQL errors
      const cleanWhere = tableWhereFilter.value
        ? tableWhereFilter.value
            .split("|")
            .filter((cond) => {
              const trimmed = cond.trim();
              return !trimmed.startsWith("tgl_mulai") && !trimmed.startsWith("tgl_akhir");
            })
            .join("|")
        : "";

      // Build relation filter parameters for tgl_mulai and tgl_akhir
      const relationFilters: Record<string, string | number | boolean> = {};
      const dateRangeFilters = tableDateRangeFilters.value;
      if (dateRangeFilters.tgl_mulai?.from) {
        relationFilters["filter_column_t_stock_opname_periode.tgl_mulai"] = dateRangeFilters.tgl_mulai.from;
        relationFilters["filter_operator_t_stock_opname_periode.tgl_mulai"] = "=>";
      }
      if (dateRangeFilters.tgl_akhir) {
        const val = dateRangeFilters.tgl_akhir.to || dateRangeFilters.tgl_akhir.from;
        if (val) {
          relationFilters["filter_column_t_stock_opname_periode.tgl_akhir"] = val;
          relationFilters["filter_operator_t_stock_opname_periode.tgl_akhir"] = "=<";
        }
      }

      // Handle text column filters
      const colFilters = tableColumnFilters.value;
      const relationSearchParts: Array<{ field: string; value: string }> = [];

      Object.entries(colFilters).forEach(([key, value]) => {
        if (!value?.trim()) return;
        if (key.includes(".")) {
          relationSearchParts.push({ field: key, value: value.trim() });
        } else {
          relationFilters[`filter_column_${key}`] = value.trim();
        }
      });

      // Build combined search: global search + relation column searches
      let effectiveSearch = searchApiQuery.value || undefined;
      let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

      if (relationSearchParts.length > 0) {
        const firstRelation = relationSearchParts[0]!;
        effectiveSearch = firstRelation.value;
        effectiveSearchFields = firstRelation.field;

        if (searchApiQuery.value) {
          effectiveSearch = searchApiQuery.value;
          effectiveSearchFields = [globalSearchFields, firstRelation.field].join(",");
        }
      }

      const response = await getStockOpnameList(
        page,
        pageSize.value,
        "createdAt",
        "DESC",
        effectiveSearch,
        effectiveSearchFields,
        companyId,
        filterCreatedBy,
        cleanWhere || undefined,
        Object.keys(relationFilters).length > 0 ? relationFilters as Record<string, string> : undefined,
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
      toast.error("Gagal memuat data Stock Opname", {
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
    isSendApprovalDialogOpen,
    itemToSendApproval,
    currentApprovalInfo,
    approvalCatatan,
    isSendingApproval,
    canEditOrDelete,

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

    getStatusStyle,
    getStatusChecking,
    getStatusCheckingStyle,
    getStatusCheckingLabel,
    canDeleteItem,
    canEditItem,

    selectItem,
    deselectItem,
    deleteSelected,
    confirmDelete,
    cancelDelete,
    viewItem,
    editItem,
    printItem,
    copyItem,
    createNew,
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
