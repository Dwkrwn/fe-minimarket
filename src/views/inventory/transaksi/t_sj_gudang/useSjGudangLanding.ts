import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import {
  getSjGudangList,
  deleteSjGudang,
  postSjGudang,
  updateStatusPengirimanSjGudang,
  type SjGudangItem,
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

export function useSjGudangLanding() {
  const router = useRouter();
  const {
    selectedItem,
    isActive,
    selectItem,
    deselectItem,
    handleEdit,
    handleDelete,
    handleCopy,
  } = useActionButtons();

  const {
    currentMenuId,
    canCreate,
    canUpdate,
    canDelete,
    canPrint,
    isSuperAdmin,
  } = usePermission();

  const isDeleteDialogOpen = ref(false);
  const itemToDelete = ref<SjGudangItem | null>(null);
  const isDeleting = ref(false);

  // ============================================================================
  // BULK DELETE STATE
  // ============================================================================
  const selectedRows = ref<SjGudangItem[]>([]);
  const isBulkDeleteDialogOpen = ref(false);
  const isBulkDeleting = ref(false);

  const isPostDialogOpen = ref(false);
  const itemToPost = ref<SjGudangItem | null>(null);
  const isPosting = ref(false);
  const isStatusPengirimanDialogOpen = ref(false);
  const isUpdatingStatusPengiriman = ref(false);
  const itemToUpdateStatusPengiriman = ref<SjGudangItem | null>(null);
  const selectedStatusPengirimanId = ref("");

  const menuData = ref<SjGudangItem[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const hasMoreData = ref(true);

  const filterStatus = ref<"DRAFT" | "POST" | null>(null);
  const searchQuery = ref("");
  const searchApiQuery = ref("");
  const isSearching = ref(false);

  const tableColumnFilters = ref<ColumnFilters>({});
  const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
  const tableDateRangeFilters = ref<DateRangeFilters>({});
  const tableWhereFilter = ref("");
  const globalSearchFields = [
    "no_sj_gudang",
    "tipe_sj_gudang",
    "catatan",
    "as_unit.nama_comp",
    "no_tg.no_tw",
    "status",
  ].join(",");


  const getStatusBadgeClass = (status: string) => getApprovalStatusBadgeClass(status);

  const columns = [
    {
      key: "as_unit.nama_comp",
      label: "Unit Bisnis",
      filterable: true,
      width: "200px",
      valueGetter: (item: any) => item?.as_unit?.nama_comp || "",
      renderHtml: (item: any) => item?.as_unit?.nama_comp || "-",
    },
    {
      key: "no_sj_gudang",
      label: "No. SJ Gudang",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.no_sj_gudang || "",
    },
    {
      key: "tgl_sj_gudang",
      label: "Tanggal",
      filterable: true,
      width: "120px",
      filterType: "date" as const,
      valueGetter: (item: any) => item?.tgl_sj_gudang || "",
    },
    {
      key: "tipe_sj_gudang",
      label: "Tipe",
      filterable: true,
      width: "150px",
      valueGetter: (item: any) => item?.tipe_sj_gudang || "",
    },
    {
      key: "no_tg.no_tw",
      label: "No. Transfer",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.no_tg?.no_tw || "",
      renderHtml: (item: any) => item?.no_tg?.no_tw || "-",
    },
    {
      key: "warehouse_asal_id",
      label: "Warehouse Asal",
      filterable: false,
      width: "180px",
      valueGetter: (item: any) => item?.sj_gd_asl?.nama_gudang || "",
      renderHtml: (item: SjGudangItem) => {
        return item.sj_gd_asl?.nama_gudang || "-";
      },
    },
    {
      key: "status",
      label: "Status",
      filterable: true,
      width: "120px",
      valueGetter: (item: any) => item?.status || "DRAFT",
      renderHtml: (item: SjGudangItem) => {
        const status = (item.status || "DRAFT").toUpperCase();
        const badgeClass = getStatusBadgeClass(status);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
      },
    },
    {
      key: "status_pengiriman.value1",
      label: "Status Pengiriman",
      filterable: true,
      width: "180px",
      valueGetter: (item: any) => item?.status_pengiriman?.value1 || "",
      renderHtml: (item: SjGudangItem) => {
        return item.status_pengiriman?.value1 || "-";
      },
    },
  ];

  const getCompanyIdFromSelectRespo = (): string | undefined => {
    if (isSuperAdmin.value) {
      return undefined;
    }

    try {
      const selectRespoStr = localStorage.getItem("SelectRespo");
      if (selectRespoStr) {
        const selectRespo = JSON.parse(selectRespoStr);
        return selectRespo.companyId || undefined;
      }
    } catch (error) {
      console.error("Error parsing SelectRespo from localStorage:", error);
    }

    return undefined;
  };

  const filteredData = computed(() => {
    return menuData.value.filter((item: SjGudangItem) => {
      const matchStatus =
        filterStatus.value === null ? true : filterStatus.value === item.status;

      return matchStatus;
    });
  });

  const canPrintSelected = computed(() => {
    if (selectedRows.value.length !== 1) {
      return false;
    }

    const item = selectedRows.value[0];
    return (
      !!item &&
      item.status?.toUpperCase() === "POST"
    );
  });

  const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return "";
    return `Apakah Anda yakin ingin menghapus Surat Jalan Gudang "${itemToDelete.value.no_sj_gudang}"? Tindakan ini tidak dapat dibatalkan.`;
  });

  // ============================================================================
  // BULK DELETE COMPUTED
  // ============================================================================
  /** Rows yang bisa dihapus: hanya DRAFT */
  const bulkDeletableRows = computed(() =>
    selectedRows.value.filter(
      (item) => item.status?.toUpperCase() === "DRAFT",
    ),
  );

  /** Tombol bulk delete hanya muncul jika ada lebih dari 1 item DRAFT yang dipilih */
  const showBulkDeleteButton = computed(
    () => bulkDeletableRows.value.length > 1,
  );

  /** Deskripsi dialog bulk delete */
  const bulkDeleteDialogDescription = computed(() => {
    const deletable = bulkDeletableRows.value.length;
    const skipped = selectedRows.value.length - deletable;
    let desc = `Anda akan menghapus ${deletable} data Surat Jalan Gudang yang berstatus DRAFT.`;
    if (skipped > 0) {
      desc += ` ${skipped} data dengan status lain akan dilewati.`;
    }
    desc += " Tindakan ini tidak dapat dibatalkan.";
    return desc;
  });

  const handleSelectionChange = (items: SjGudangItem[]) => {
    selectedRows.value = items;

    if (items.length === 1) {
      selectItem(items[0], 0);
    } else {
      deselectItem();
    }
  };

  const openBulkDeleteDialog = () => {
    if (bulkDeletableRows.value.length === 0) {
      toast.error("Tidak ada data yang dapat dihapus", {
        description: "Pilih data dengan status DRAFT",
      });
      return;
    }
    isBulkDeleteDialogOpen.value = true;
  };

  const confirmBulkDelete = async () => {
    if (bulkDeletableRows.value.length === 0) return;

    isBulkDeleting.value = true;
    const toDelete = [...bulkDeletableRows.value];
    const results = { success: 0, failed: 0 };

    try {
      for (const item of toDelete) {
        try {
          const response = await deleteSjGudang(item.id);
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

    itemToDelete.value = item;
    isDeleteDialogOpen.value = true;
  };

  const confirmDelete = async () => {
    if (!itemToDelete.value) return;

    isDeleting.value = true;
    try {
      const response = await deleteSjGudang(itemToDelete.value.id);

      if (response.status === "success") {
        menuData.value = menuData.value.filter(
          (m: SjGudangItem) => m.id !== itemToDelete.value!.id,
        );

        toast.success(
          `Surat Jalan Gudang "${itemToDelete.value.no_sj_gudang}" berhasil dihapus`,
          {
            description: response.message || "Item telah dihapus dari database",
          },
        );

        deselectItem();
        isDeleteDialogOpen.value = false;
      } else {
        toast.error("Gagal menghapus Sj Gudang", {
          description: response.message || "Terjadi kesalahan saat menghapus",
        });
      }
    } catch (error) {
      toast.error("Gagal menghapus Sj Gudang", {
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

  const postSelected = (item?: SjGudangItem) => {
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

    if (targetItem.status?.toUpperCase() === "POST") {
      toast.error("Item sudah di-POST", {
        description: "Data yang sudah POST tidak bisa diubah lagi",
      });
      return;
    }

    itemToPost.value = targetItem;
    isPostDialogOpen.value = true;
  };

  const confirmPost = async () => {
    if (!itemToPost.value) return;

    if (
      !itemToPost.value.t_sj_gudang_ds ||
      itemToPost.value.t_sj_gudang_ds.length === 0
    ) {
      toast.error("Tidak ada detail item", {
        description: "Surat Jalan harus memiliki minimal 1 item",
      });
      return;
    }

    const gudangAsalId =
      itemToPost.value.no_tg?.m_gudang_id ||
      itemToPost.value.no_tg?.warehouse_asal_id ||
      itemToPost.value.t_transfer_gudang?.warehouse_asal_id;
    if (!gudangAsalId || gudangAsalId.trim() === "") {
      toast.error("Gudang asal tidak ditemukan", {
        description: "Data transfer gudang tidak memiliki gudang asal",
      });
      return;
    }

    const detailsToPost = itemToPost.value.t_sj_gudang_ds.map((detail) => ({
      m_items_id: detail.m_items_id || "",
      qty_sj: detail.qty_sj_gudang || 0,
    }));

    isPosting.value = true;
    try {
      const response = await postSjGudang(
        itemToPost.value.id,
        detailsToPost,
        gudangAsalId,
      );

      if (
        response.status === "success" ||
        response.message === "Data posted successfully"
      ) {
        toast.success(
          `Surat Jalan Gudang "${itemToPost.value.no_sj_gudang}" berhasil di-POST`,
          {
            description: "Data tidak bisa diedit atau dihapus lagi",
          },
        );

        const targetId = itemToPost.value.id;
        menuData.value = menuData.value.map((item) =>
          item.id === targetId
            ? {
                ...item,
                status: "POST",
                status_pengiriman_id: response.data?.status_pengiriman_id,
              }
            : item,
        );

        toast.loading("Sedang mensinkronkan STOCK ITEM di GUDANG...", {
          id: "sync-stock",
        });
        try {
          const { syncStockFromSjGudang } = await import("./service");
          await syncStockFromSjGudang();
          toast.success("Stock berhasil disinkronkan", { id: "sync-stock" });
        } catch {
          toast.error("Gagal sinkronkan stock", {
            id: "sync-stock",
            description: "Silakan jalankan sync manual",
          });
        }

        deselectItem();
        isPostDialogOpen.value = false;
      } else {
        toast.error("Gagal POST Surat Jalan Gudang", {
          description:
            response.message || response.reason || "Terjadi kesalahan",
        });
      }
    } catch (error: any) {
      toast.error("Gagal POST Surat Jalan Gudang", {
        description: error?.reason || error?.message || "Terjadi kesalahan",
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

  const openStatusPengirimanDialog = (item?: SjGudangItem) => {
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

    if (targetItem.status?.toUpperCase() !== "POST") {
      toast.error("Data belum di-POST", {
        description: "Status pengiriman hanya bisa diubah untuk data POST",
      });
      return;
    }

    itemToUpdateStatusPengiriman.value = targetItem;
    selectedStatusPengirimanId.value = targetItem.status_pengiriman_id || "";
    isStatusPengirimanDialogOpen.value = true;
  };

  const confirmUpdateStatusPengiriman = async () => {
    const targetItem = itemToUpdateStatusPengiriman.value;
    if (!targetItem) return;

    if (!selectedStatusPengirimanId.value) {
      toast.error("Pilih status pengiriman terlebih dahulu");
      return;
    }

    isUpdatingStatusPengiriman.value = true;
    try {
      const response = await updateStatusPengirimanSjGudang(
        targetItem.id,
        selectedStatusPengirimanId.value,
      );

      if (response.status === "success") {
        menuData.value = menuData.value.map((item) =>
          item.id === targetItem.id
            ? {
                ...item,
                status_pengiriman_id: response.data?.status_pengiriman_id,
                status_pengiriman: response.data?.status_pengiriman,
              }
            : item,
        );

        if (selectedItem.value?.id === targetItem.id) {
          selectedItem.value = {
            ...selectedItem.value,
            status_pengiriman_id: response.data?.status_pengiriman_id,
            status_pengiriman: response.data?.status_pengiriman,
          };
        }

        toast.success("Status pengiriman berhasil diperbarui");
        isStatusPengirimanDialogOpen.value = false;
        itemToUpdateStatusPengiriman.value = null;
        selectedStatusPengirimanId.value = "";
      } else {
        toast.error("Gagal update status pengiriman", {
          description:
            response.message || response.reason || "Terjadi kesalahan",
        });
      }
    } catch (error: any) {
      toast.error("Gagal update status pengiriman", {
        description: error?.reason || error?.message || "Terjadi kesalahan",
      });
    } finally {
      isUpdatingStatusPengiriman.value = false;
    }
  };

  const cancelUpdateStatusPengiriman = () => {
    isStatusPengirimanDialogOpen.value = false;
    itemToUpdateStatusPengiriman.value = null;
    selectedStatusPengirimanId.value = "";
  };

  const exportData = () => {
    toast.info("Export feature coming soon");
  };

  const printItem = (item?: any) => {
    if (!canPrint.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk mencetak data",
      });
      return;
    }

    if (item) {
      selectItem(item, 0);
    }

    const targetItem = item || selectedRows.value[0] || selectedItem.value;

    if (selectedRows.value.length > 1 && !item) {
      toast.error("Pilih satu data saja", {
        description: "Print hanya dapat dilakukan untuk satu Surat Jalan Gudang",
      });
      return;
    }

    if (!targetItem) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    if (targetItem.status?.toUpperCase() !== "POST") {
      toast.error("Data belum di-POST", {
        description: "Hanya data dengan status POST yang bisa dicetak",
      });
      return;
    }

    router.push(`/inventory/transaksi/t_sj_gudang/print/${targetItem.id}`);
  };

  const viewItem = (item?: any) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_sj_gudang/view/${selectedItem.value.id}`);
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

    if (selectedItemData.status?.toUpperCase() === "POST") {
      toast.error("Data sudah di-POST", {
        description: "Data yang sudah POST tidak bisa diedit",
      });
      return;
    }

    router.push(`/inventory/transaksi/t_sj_gudang/form/${selectedItemData.id}`);
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
      path: "/inventory/transaksi/t_sj_gudang/form",
      query: {
        action: "copy",
        source: selectedItemData.id,
      },
    });

    toast.success(`Menyalin data "${selectedItemData.name}"`, {
      description: "Silakan edit dan simpan sebagai SjGudang baru",
    });
    deselectItem();
  };

  const createNew = () => {
    if (!canCreate.value) {
      toast.error("Akses Ditolak", {
        description: "Anda tidak memiliki izin untuk membuat data baru",
      });
      return;
    }

    router.push("/inventory/transaksi/t_sj_gudang/form");
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

      Object.entries(colFilters).forEach(([key, value]) => {
        if (!value?.trim()) return;
        if (key.includes(".")) {
          relationSearchParts.push({ field: key, value: value.trim() });
        } else {
          directColumnFilters[key] = value.trim();
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

      const response = await getSjGudangList(
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
      toast.error("Gagal memuat data SjGudang", {
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
    selectedRows.value = [];

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
    selectedRows.value = [];
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
  };
}
