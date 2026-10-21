import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useAuthStore } from "@/stores/auth";
import { apiCall } from "@/lib/api";
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import {
  getPenerimaanGudangList,
  deletePenerimaanGudang,
  sendApprovalPenerimaanGudang,
  sendApprovalPenerimaanGudangV2,
  getHistoryPengiriman,
  type PenerimaanGudangItem,
  type SjGudangHistoryItem,
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

export function usePenerimaanGudangLanding() {
  const router = useRouter();
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

  const { currentMenuId, canCreate, canUpdate, canDelete } = usePermission();

  const normalizeStatus = (status?: string | null) => {
    return (status || "")
      .toUpperCase()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const isDeleteDialogOpen = ref(false);
  const itemToDelete = ref<PenerimaanGudangItem | null>(null);
  const isDeleting = ref(false);

  // ============================================================================
  // BULK DELETE STATE
  // ============================================================================
  const selectedItems = ref<PenerimaanGudangItem[]>([]);
  const isBulkDeleteDialogOpen = ref(false);
  const isBulkDeleting = ref(false);

  const canDeleteItem = (item: PenerimaanGudangItem) => {
    const status = normalizeStatus(item.status);
    return status === "DRAFT" || status === "REVISI";
  };

  const hasBulkSelection = computed(() =>
    selectedItems.value.filter((i) => canDeleteItem(i)).length > 1,
  );

  const bulkDeletableItems = computed(() =>
    selectedItems.value.filter((item) => canDeleteItem(item)),
  );

  const bulkDeleteDialogDescription = computed(() => {
    const total = selectedItems.value.length;
    const deletable = bulkDeletableItems.value.length;
    const skipped = total - deletable;

    if (deletable === 0) {
      return `Tidak ada item yang dapat dihapus. ${total} item yang dipilih memiliki status yang tidak memperbolehkan penghapusan (hanya DRAFT dan REVISI yang dapat dihapus).`;
    }

    let desc = `Anda akan menghapus ${deletable} dari ${total} item yang dipilih. Tindakan ini tidak dapat dibatalkan.`;
    if (skipped > 0) {
      desc += ` ${skipped} item dengan status selain DRAFT/REVISI akan dilewati.`;
    }
    return desc;
  });

  const handleSelectionChange = (items: PenerimaanGudangItem[]) => {
    // Semua status bisa diselect
    selectedItems.value = items;

    // Sync single-select composable ke item terakhir yang dipilih
    if (items.length >= 1) {
      selectItem(items[items.length - 1], 0);
    } else {
      deselectItem();
    }
  };

  const openBulkDeleteDialog = () => {
    if (selectedItems.value.length === 0) {
      toast.error("Pilih minimal satu item terlebih dahulu");
      return;
    }
    if (bulkDeletableItems.value.length === 0) {
      toast.error("Tidak ada item yang dapat dihapus", {
        description: "Hanya item dengan status DRAFT atau REVISI yang dapat dihapus",
      });
      return;
    }
    isBulkDeleteDialogOpen.value = true;
  };

  const confirmBulkDelete = async () => {
    if (bulkDeletableItems.value.length === 0) return;

    isBulkDeleting.value = true;
    const errors: string[] = [];
    const deletedIds: string[] = [];

    for (const item of bulkDeletableItems.value) {
      try {
        const response = await deletePenerimaanGudang(item.id);
        if (response.status === "success") {
          deletedIds.push(item.id);
        } else {
          errors.push(item.no_penerimaan_gudang || item.id);
        }
      } catch {
        errors.push(item.no_penerimaan_gudang || item.id);
      }
    }

    if (deletedIds.length > 0) {
      menuData.value = menuData.value.filter((m) => !deletedIds.includes(m.id));
    }

    isBulkDeleteDialogOpen.value = false;
    selectedItems.value = [];
    deselectItem();

    if (errors.length === 0) {
      toast.success(`${deletedIds.length} item berhasil dihapus`);
    } else if (deletedIds.length > 0) {
      toast.warning(`${deletedIds.length} item dihapus, ${errors.length} gagal`, {
        description: `Gagal menghapus: ${errors.join(", ")}`,
      });
    } else {
      toast.error("Gagal menghapus semua item yang dipilih");
    }

    isBulkDeleting.value = false;
  };

  const cancelBulkDelete = () => {
    isBulkDeleteDialogOpen.value = false;
  };


  const isSendApprovalDialogOpen = ref(false);
  const itemToSendApproval = ref<PenerimaanGudangItem | null>(null);
  const approvalCatatan = ref("");
  const isSendingApproval = ref(false);

  // History Pengiriman state
  const activeRespo = ref<{ id: string; m_gudang_id: string | null; nama: string } | null>(null);
  const hasActiveRespoWithGudang = computed(() => !!activeRespo.value?.m_gudang_id);
  const isHistoryDialogOpen = ref(false);
  const historyPengirimanList = ref<SjGudangHistoryItem[]>([]);
  const isLoadingHistory = ref(false);

  const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList();
    return approvalList.find(
      (approval: any) =>
        approval.path === "/inventory/transaksi/t_penerimaan_gudang" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );
  });

  const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false;
    const status = normalizeStatus(selectedItem.value.status);
    return (
      status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
    );
  });

  const canEditOrDelete = computed(
    () => isActive.value && !isStatusLocked.value,
  );

  const isItemStatusLocked = (item: PenerimaanGudangItem) => {
    const status = normalizeStatus(item.status);
    return (
      status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
    );
  };

  const menuData = ref<PenerimaanGudangItem[]>([]);
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

  const tableColumnFilters = ref<ColumnFilters>({});
  const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
  const tableDateRangeFilters = ref<DateRangeFilters>({});
  const tableWhereFilter = ref("");

  const getStatusStyle = getApprovalStatusBadgeClass;

  const getStatusVariant = (status: string) => {
    const statusUpper = normalizeStatus(status);
    switch (statusUpper) {
      case "DRAFT":
        return "secondary";
      case "IN APPROVAL":
        return "default";
      case "APPROVED":
        return "default";
      case "REJECT":
        return "destructive";
      case "REVISI":
        return "outline";
      default:
        return "secondary";
    }
  };

  const columns = [
    {
      key: "m_unit_bisnis_id",
      label: "Unit Bisnis",
      filterable: false,
      width: "180px",
      valueGetter: (item: PenerimaanGudangItem) =>
        item.m_unit_bisni?.nama_comp || "",
      renderHtml: (item: PenerimaanGudangItem) => {
        return item.m_unit_bisni?.nama_comp || "-";
      },
    },
    {
      key: "no_penerimaan_gudang",
      label: "No. Penerimaan",
      filterable: true,
      width: "180px",
    },
    {
      key: "tgl_penerimaan_gudang",
      label: "Tanggal",
      filterable: true,
      filterType: "date" as const,
      width: "130px",
    },
    {
      key: "t_sj_gudang_id",
      label: "No. SJ Gudang",
      filterable: false,
      width: "180px",
      renderHtml: (item: PenerimaanGudangItem) => {
        return item.surat_jalan_gudang?.no_sj_gudang || "-";
      },
    },
    {
      key: "warehouse_asal_id",
      label: "Gudang Asal",
      filterable: false,
      width: "180px",
      renderHtml: (item: PenerimaanGudangItem) => {
        return item.pen_gd_asl?.nama_gudang || "-";
      },
    },
    {
      key: "warehouse_terima_id",
      label: "Gudang Penerimaan",
      filterable: false,
      width: "180px",
      renderHtml: (item: PenerimaanGudangItem) => {
        return item.pen_gd_trm?.nama_gudang || "-";
      },
    },
    {
      key: "pic_penerima_id",
      label: "PIC Penerima",
      filterable: false,
      width: "150px",
      renderHtml: (item: PenerimaanGudangItem) => {
        return item.pic_penerima_gudang?.nama_kary || "-";
      },
    },
    {
      key: "status",
      label: "Status",
      filterable: true,
      width: "140px",
      renderHtml: (item: PenerimaanGudangItem) => {
        const status = normalizeStatus(item.status || "DRAFT") || "DRAFT";
        const badgeClass = getStatusStyle(status);
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
      },
    },
  ];

  const filteredData = computed(() => {
    if (!filterStatus.value) return menuData.value;

    return menuData.value.filter((item) => {
      const itemStatus = normalizeStatus(item.status);
      return itemStatus === filterStatus.value;
    });
  });

  const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return "";
    return `Apakah Anda yakin ingin menghapus Penerimaan Gudang "${itemToDelete.value.no_penerimaan_gudang}"? Tindakan ini tidak dapat dibatalkan.`;
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

    const status = normalizeStatus(item.status);
    if (status !== "DRAFT" && status !== "REVISI") {
      toast.error("Tidak dapat menghapus", {
        description:
          "Hanya Penerimaan Gudang dengan status DRAFT atau REVISI yang dapat dihapus",
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
      const response = await deletePenerimaanGudang(itemToDelete.value.id);

      if (response.status === "success") {
        menuData.value = menuData.value.filter(
          (m: PenerimaanGudangItem) => m.id !== itemToDelete.value!.id,
        );

        toast.success(
          `Penerimaan Gudang "${itemToDelete.value.no_penerimaan_gudang}" berhasil dihapus`,
          {
            description: response.message || "Item telah dihapus dari database",
          },
        );

        deselectItem();
        isDeleteDialogOpen.value = false;
      } else {
        toast.error("Gagal menghapus Penerimaan Gudang", {
          description: response.message || "Terjadi kesalahan saat menghapus",
        });
      }
    } catch (error) {
      toast.error("Gagal menghapus Penerimaan Gudang", {
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

  const openSendApprovalDialog = (item?: PenerimaanGudangItem) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    const status = normalizeStatus(selectedItem.value.status);
    if (status !== "DRAFT" && status !== "REVISI") {
      toast.error("Tidak dapat mengirim approval", {
        description:
          "Hanya Penerimaan Gudang dengan status DRAFT atau REVISI yang dapat dikirim untuk approval",
      });
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
      // Ambil sender_id: dari approval config jika ada, fallback ke user.id
      const approvalList = authStore.getApprovalList();
      const currentApproval = approvalList.find(
        (approval: any) =>
          approval.path === "/inventory/transaksi/t_penerimaan_gudang" &&
          approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
      );

      const senderId = currentApproval?.sender_id || authStore.user?.id;

      if (!senderId) {
        toast.error("Gagal mengirim approval", {
          description: "User tidak teridentifikasi, silakan login ulang",
        });
        isSendingApproval.value = false;
        return;
      }

      // Gunakan endpoint baru — approver ditentukan dinamis berdasarkan gudang
      const response = await sendApprovalPenerimaanGudangV2({
        t_penerimaan_gudang_id: itemToSendApproval.value.id,
        sender_id: senderId,
        approval_catatan: approvalCatatan.value.trim() || undefined,
      });

      if (response.status === "success") {
        const itemIndex = menuData.value.findIndex(
          (m: PenerimaanGudangItem) => m.id === itemToSendApproval.value!.id,
        );
        if (itemIndex !== -1) {
          const updatedItem = {
            ...menuData.value[itemIndex],
            status: "IN APPROVAL",
          } as PenerimaanGudangItem;
          menuData.value.splice(itemIndex, 1, updatedItem);
        }

        toast.success("Approval berhasil dikirim", {
          description: response.message || `Penerimaan Gudang "${itemToSendApproval.value.no_penerimaan_gudang}" telah dikirim untuk approval`,
        });

        // Notify layout/sidebar to refresh notification badge immediately
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));

        isSendApprovalDialogOpen.value = false;
        deselectItem();
      } else {
        toast.error("Gagal mengirim approval", {
          description: response.message || "Terjadi kesalahan saat mengirim approval",
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

  const viewItem = (item?: any) => {
    if (item) {
      selectItem(item, 0);
    }

    if (!selectedItem.value) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_penerimaan_gudang/view/${selectedItem.value.id}`);
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

    const targetItem = item || selectedItem.value;
    if (targetItem && isItemStatusLocked(targetItem)) {
      toast.error("Tidak dapat mengedit", {
        description: `Data dengan status ${targetItem.status} tidak dapat diubah`,
      });
      return;
    }

    const selectedItemData = handleEdit(item);
    if (!selectedItemData) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }

    router.push(`/inventory/transaksi/t_penerimaan_gudang/form/${selectedItemData.id}`);
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
      path: "/inventory/transaksi/t_penerimaan_gudang/form",
      query: {
        action: "copy",
        source: selectedItemData.id,
      },
    });

    toast.success(`Menyalin data "${selectedItemData.no_penerimaan_gudang}"`, {
      description: "Silakan edit dan simpan sebagai Penerimaan Gudang baru",
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

    router.push("/inventory/transaksi/t_penerimaan_gudang/form");
  };

  // Fetch respo aktif user yang memiliki gudang
  const fetchActiveRespo = async () => {
    try {
      // Coba baca dari SelectRespo localStorage dulu
      const selectRespoStr = localStorage.getItem('SelectRespo');
      if (selectRespoStr) {
        const selectRespo = JSON.parse(selectRespoStr);
        console.log('[fetchActiveRespo] SelectRespo:', JSON.stringify({ 
          respoId: selectRespo.respoId, 
          respoName: selectRespo.respoName,
          gudangId: selectRespo.gudangId,
          companyId: selectRespo.companyId 
        }));
        
        if (selectRespo.gudangId) {
          activeRespo.value = {
            id: selectRespo.respoId || '',
            m_gudang_id: selectRespo.gudangId,
            nama: selectRespo.respoName || '',
          };
          return;
        }

        // gudangId tidak ada di cache — fetch langsung dari API menggunakan respoId
        if (selectRespo.respoId && selectRespo.respoId !== 'super-admin-respo') {
          try {
            const res = await apiCall<{ status: string; data: any }>(
              `/dynamic/m_respo/${selectRespo.respoId}?selectfield=id,nama,m_gudang_id`,
              { method: 'GET' }
            );
            console.log('[fetchActiveRespo] API respo data:', res?.data);
            if (res?.status === 'success' && res.data?.m_gudang_id) {
              activeRespo.value = {
                id: res.data.id,
                m_gudang_id: res.data.m_gudang_id,
                nama: res.data.nama || selectRespo.respoName || '',
              };
              return;
            }
          } catch (apiErr) {
            console.warn('[fetchActiveRespo] API fallback failed:', apiErr);
          }
        }
      }

      // Fallback: baca dari authStore.userDetails (data di memory)
      const userDetails = authStore.userDetails;
      console.log('[fetchActiveRespo] userDetails count:', userDetails.length);
      
      const matchingDetail = userDetails.find((ud: any) => {
        const gudangId = ud.m_respo?.m_gudang_id;
        console.log('[fetchActiveRespo] respo:', ud.m_respo?.nama, '| m_gudang_id:', gudangId, '| is_active:', ud.is_active);
        return ud.is_active && !!gudangId;
      });

      if (matchingDetail) {
        activeRespo.value = {
          id: matchingDetail.id,
          m_gudang_id: matchingDetail.m_respo.m_gudang_id ?? null,
          nama: matchingDetail.m_respo.nama,
        };
      } else {
        activeRespo.value = null;
      }
    } catch (err) {
      console.error('[fetchActiveRespo] error:', err);
      activeRespo.value = null;
    }
  };

  // Fetch history pengiriman untuk gudang aktif user
  const fetchHistoryPengiriman = async () => {
    if (!activeRespo.value?.m_gudang_id) return;

    isLoadingHistory.value = true;
    try {
      const response = await getHistoryPengiriman(activeRespo.value.m_gudang_id);
      if (response.status === 'success') {
        historyPengirimanList.value = response.data;
      }
    } catch (error) {
      toast.error('Gagal memuat history pengiriman', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      });
    } finally {
      isLoadingHistory.value = false;
    }
  };

  // Buka dialog history pengiriman
  const openHistoryDialog = async () => {
    isHistoryDialogOpen.value = true;
    await fetchHistoryPengiriman();
  };

  // Pilih SJ dari history → navigate ke form penerimaan baru
  const selectHistorySj = (sj: SjGudangHistoryItem) => {
    isHistoryDialogOpen.value = false;
    router.push({
      path: '/inventory/transaksi/t_penerimaan_gudang/form',
      query: { t_sj_gudang_id: sj.id },
    });
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
      const response = await getPenerimaanGudangList(
        page,
        pageSize.value,
        "createdAt",
        "DESC",
        searchApiQuery.value || undefined,
        searchApiQuery.value ? "no_penerimaan_gudang,catatan" : undefined,
        undefined,
        tableColumnFilters.value,
        tableColumnFilterOperators.value,
        tableWhereFilter.value || undefined,
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
      toast.error("Gagal memuat data PenerimaanGudang", {
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
    selectedItems.value = [];

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

    await fetchActiveRespo();

    // Re-fetch respo saat user ganti respo (TeamSwitcher)
    window.addEventListener("respoChanged", fetchActiveRespo);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener("respoChanged", fetchActiveRespo);
    window.removeEventListener("scroll", handleWindowScroll);
    menuData.value = [];
    selectedItems.value = [];
    deselectItem();
  });

  return {
    currentMenuId,
    selectedItem,
    isActive,
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
    isDeleteDialogOpen,
    deleteDialogDescription,
    isDeleting,
    isSendApprovalDialogOpen,
    itemToSendApproval,
    approvalCatatan,
    isSendingApproval,
    currentApprovalInfo,
    getStatusVariant,
    isItemStatusLocked,
    selectItem,
    deselectItem,
    deleteSelected,
    confirmDelete,
    cancelDelete,
    openSendApprovalDialog,
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
    activeRespo,
    hasActiveRespoWithGudang,
    isHistoryDialogOpen,
    historyPengirimanList,
    isLoadingHistory,
    fetchActiveRespo,
    fetchHistoryPengiriman,
    openHistoryDialog,
    selectHistorySj,
    selectedItems,
    hasBulkSelection,
    bulkDeletableItems,
    bulkDeleteDialogDescription,
    isBulkDeleteDialogOpen,
    isBulkDeleting,
    handleSelectionChange,
    openBulkDeleteDialog,
    confirmBulkDelete,
    cancelBulkDelete,
  };
}
