import { toast } from "vue-sonner";
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  CompanyStructureFormValues,
  CompanyStructureRecord,
  CompanyStructureTreeNode,
} from "./service";
import {
  buildCompanyStructureTree,
  createCompanyStructure,
  createCompanyStructureFormValues,
  deleteCompanyStructure,
  filterCompanyStructureRecords,
  getCompanyStructureRecords,
  mapCompanyStructureFormToPayload,
  mapCompanyStructureRecordToFormValues,
  summarizeCompanyStructure,
  updateCompanyStructure,
} from "./service";

type DialogMode = "create" | "edit" | "view";

function countSiblingSequence(
  records: CompanyStructureRecord[],
  companyId: string,
  parentId: string | null,
  excludeId?: string | null,
) {
  return (
    records.filter(
      (record) =>
        record.companyId === companyId &&
        record.parentId === parentId &&
        (!excludeId || record.id !== excludeId),
    ).length + 1
  );
}

export function useCompanyStructure() {
  const records = ref<CompanyStructureRecord[]>([]);
  const selectedCompanyId = ref("");
  const selectedCompanyName = ref("");
  const showInactive = ref(false);
  const isManageMode = ref(false);
  const search = ref("");
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isSubmitting = ref(false);
  const pageErrorMessage = ref("");
  const dialogErrorMessage = ref("");
  const selectedNodeId = ref<string | null>(null);
  const isDialogOpen = ref(false);
  const isDeleteDialogOpen = ref(false);
  const dialogMode = ref<DialogMode>("create");
  const editingId = ref<string | null>(null);
  const pendingDeleteNode = ref<CompanyStructureTreeNode | null>(null);
  const isReady = ref(false);

  const form = reactive<CompanyStructureFormValues>(createCompanyStructureFormValues());

  const filteredRecords = computed(() =>
    filterCompanyStructureRecords(records.value, {
      search: search.value,
      showInactive: showInactive.value,
    }),
  );

  const summary = computed(() => summarizeCompanyStructure(filteredRecords.value));
  const treeNodes = computed(() => buildCompanyStructureTree(filteredRecords.value));

  const companyLabel = computed(() => {
    return (
      selectedCompanyName.value ||
      records.value[0]?.companyName ||
      "Company Structure"
    );
  });

  const findNodeById = (
    nodes: CompanyStructureTreeNode[],
    targetId: string | null | undefined,
  ): CompanyStructureTreeNode | null => {
    if (!targetId) return null;

    for (const node of nodes) {
      if (node.id === targetId) return node;

      const childMatch = findNodeById(node.children, targetId);
      if (childMatch) return childMatch;
    }

    return null;
  };

  const selectedNode = computed<CompanyStructureTreeNode | null>(() =>
    findNodeById(treeNodes.value, selectedNodeId.value),
  );

  const selectedParent = computed<CompanyStructureTreeNode | null>(() =>
    findNodeById(treeNodes.value, selectedNode.value?.parentId),
  );

  const isDialogReadonly = computed(() => dialogMode.value === "view");

  const dialogTitle = computed(() =>
    dialogMode.value === "create"
      ? "Tambah Struktur Company"
      : dialogMode.value === "edit"
        ? "Edit Struktur Company"
        : "Detail Struktur Company",
  );

  const dialogDescription = computed(() =>
    dialogMode.value === "create"
      ? "Buat node jabatan baru dan tentukan parent, user, serta urutan tampilnya."
      : dialogMode.value === "edit"
        ? "Perbarui jabatan, parent, user default, dan informasi aktif node struktur ini."
        : "Lihat detail struktur tanpa mengubah data.",
  );

  const deleteDialogDescription = computed(() => {
    const node = pendingDeleteNode.value;
    return node
      ? `Hapus posisi "${node.jabatan}"? Tindakan ini tidak bisa dibatalkan.`
      : "Tindakan ini tidak bisa dibatalkan.";
  });

  const excludedParentIds = computed<string[]>(() => {
    const excludedIds = new Set<string>();

    if (dialogMode.value === "edit" && editingId.value) {
      excludedIds.add(editingId.value);

      const findDescendants = (parentId: string) => {
        records.value
          .filter((record) => record.parentId === parentId)
          .forEach((record) => {
            excludedIds.add(record.id);
            findDescendants(record.id);
          });
      };

      findDescendants(editingId.value);
    }

    return Array.from(excludedIds);
  });

  const loadStructure = async (options: { silent?: boolean } = {}) => {
    if (!selectedCompanyId.value) {
      records.value = [];
      isLoading.value = false;
      isRefreshing.value = false;
      return;
    }

    if (options.silent) {
      isRefreshing.value = true;
    } else {
      isLoading.value = true;
    }

    pageErrorMessage.value = "";

    try {
      const items = await getCompanyStructureRecords(selectedCompanyId.value);
      records.value = items;
    } catch (error) {
      pageErrorMessage.value =
        error instanceof Error ? error.message : "Gagal memuat struktur company.";
      records.value = [];
    } finally {
      isLoading.value = false;
      isRefreshing.value = false;
    }
  };

  const resetForm = (partial: Partial<CompanyStructureFormValues> = {}) => {
    const next = createCompanyStructureFormValues({
      companyId: selectedCompanyId.value,
      ...partial,
    });

    form.companyId = next.companyId;
    form.unitBisnisId = next.unitBisnisId;
    form.parentId = next.parentId;
    form.userDefaultId = next.userDefaultId;
    form.jabatan = next.jabatan;
    form.level = next.level;
    form.sequence = next.sequence;
    form.effectiveStart = next.effectiveStart;
    form.effectiveEnd = next.effectiveEnd;
    form.isActive = next.isActive;
    form.catatan = next.catatan;
  };

  const openCreateDialog = (parentNode?: CompanyStructureRecord) => {
    const companyId = parentNode?.companyId || selectedCompanyId.value;
    const parentId = parentNode?.id ?? null;

    dialogMode.value = "create";
    editingId.value = null;
    dialogErrorMessage.value = "";

    resetForm({
      companyId,
      unitBisnisId: parentNode?.unitBisnisId ?? null,
      parentId,
      level: parentNode ? parentNode.level + 1 : 1,
      sequence: countSiblingSequence(records.value, companyId, parentId),
    });

    isDialogOpen.value = true;
  };

  const openEditDialog = (node: CompanyStructureRecord) => {
    dialogMode.value = "edit";
    editingId.value = node.id;
    dialogErrorMessage.value = "";
    resetForm(mapCompanyStructureRecordToFormValues(node));
    selectedNodeId.value = node.id;
    isDialogOpen.value = true;
  };

  const openReadDialog = (node: CompanyStructureRecord) => {
    dialogMode.value = "view";
    editingId.value = node.id;
    dialogErrorMessage.value = "";
    resetForm(mapCompanyStructureRecordToFormValues(node));
    selectedNodeId.value = node.id;
    isDialogOpen.value = true;
  };

  const closeDialog = () => {
    isDialogOpen.value = false;
    dialogErrorMessage.value = "";
  };

  const setSelectedCompany = (value: string | number | null | undefined) => {
    selectedCompanyId.value = value == null ? "" : String(value).trim();
  };

  const setSelectedCompanyDetail = (item: Record<string, unknown> | null) => {
    const nextCompanyId = item?.id ?? item?.company_id;
    if (nextCompanyId != null && !selectedCompanyId.value) {
      selectedCompanyId.value = String(nextCompanyId).trim();
    }

    selectedCompanyName.value = item
      ? String(
          item.nama_comp ??
            item.nama_company ??
            item.nama ??
            item.name ??
            item.label ??
            "",
        ).trim()
      : "";
  };

  const setDialogOpen = (value: boolean) => {
    if (value) {
      isDialogOpen.value = true;
      return;
    }

    closeDialog();
  };

  const toggleManageMode = () => {
    isManageMode.value = !isManageMode.value;
  };

  const handleRefresh = async () => {
    await loadStructure({ silent: true });

    if (!pageErrorMessage.value) {
      toast.success("Struktur company berhasil diperbarui");
    }
  };

  const deleteNode = async (node: CompanyStructureTreeNode) => {
    if (node.children.length > 0) {
      toast.error("Posisi ini masih punya bawahan. Hapus atau pindahkan child lebih dulu.");
      return;
    }

    pendingDeleteNode.value = node;
    isDeleteDialogOpen.value = true;
  };

  const cancelDelete = () => {
    isDeleteDialogOpen.value = false;
    pendingDeleteNode.value = null;
  };

  const confirmDelete = async () => {
    const node = pendingDeleteNode.value;
    if (!node) return;

    isSubmitting.value = true;
    dialogErrorMessage.value = "";

    try {
      await deleteCompanyStructure(node.id);

      if (selectedNodeId.value === node.id) {
        selectedNodeId.value = node.parentId;
      }

      await loadStructure({ silent: true });
      cancelDelete();
      toast.success("Struktur berhasil dihapus");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menghapus struktur company.";

      dialogErrorMessage.value = message;
      toast.error(message);
    } finally {
      isSubmitting.value = false;
    }
  };

  const submitDialog = async () => {
    if (dialogMode.value === "view") {
      isDialogOpen.value = false;
      return;
    }

    if (!form.companyId || !form.jabatan.trim()) {
      dialogErrorMessage.value = "Company dan jabatan wajib diisi.";
      return;
    }

    if (form.effectiveStart && form.effectiveEnd && form.effectiveEnd < form.effectiveStart) {
      dialogErrorMessage.value = "Effective End tidak boleh kurang dari Effective Start.";
      return;
    }

    isSubmitting.value = true;
    dialogErrorMessage.value = "";

    try {
      const payload = mapCompanyStructureFormToPayload(form);

      if (dialogMode.value === "create") {
        await createCompanyStructure(payload);
        toast.success("Struktur berhasil ditambahkan");
      } else if (editingId.value) {
        await updateCompanyStructure(editingId.value, payload);
        toast.success("Struktur berhasil diperbarui");
      }

      if (selectedCompanyId.value !== form.companyId) {
        selectedCompanyId.value = form.companyId;
        isDialogOpen.value = false;
        return;
      }

      await loadStructure({ silent: true });
      isDialogOpen.value = false;
    } catch (error) {
      dialogErrorMessage.value =
        error instanceof Error ? error.message : "Gagal menyimpan struktur company.";
    } finally {
      isSubmitting.value = false;
    }
  };

  watch(
    selectedCompanyId,
    async (companyId, previousCompanyId) => {
      if (!isReady.value) return;

      if (!companyId) {
        records.value = [];
        selectedNodeId.value = null;
        selectedCompanyName.value = "";
        pageErrorMessage.value = "";
        isLoading.value = false;
        isRefreshing.value = false;
        return;
      }

      if (companyId === previousCompanyId) return;
      await loadStructure();
    },
  );

  watch(
    treeNodes,
    (nodes) => {
      if (!nodes.length) {
        selectedNodeId.value = null;
        return;
      }

      const firstNode = nodes[0]?.id ?? null;
      const containsSelected = selectedNodeId.value
        ? filteredRecords.value.some((record) => record.id === selectedNodeId.value)
        : false;

      if (!containsSelected) {
        selectedNodeId.value = firstNode;
      }
    },
    { immediate: true },
  );

  watch(
    () => form.parentId,
    (parentId) => {
      if (dialogMode.value === "view") return;

      const parent = records.value.find((record) => record.id === parentId);
      form.level = parent ? parent.level + 1 : 1;

      if (!form.companyId) return;

      form.sequence = countSiblingSequence(
        records.value,
        form.companyId,
        parentId ?? null,
        dialogMode.value === "edit" ? editingId.value : null,
      );
    },
  );

  watch(
    () => form.companyId,
    (companyId) => {
      if (dialogMode.value === "view") return;
      if (!companyId) return;

      const selectedParent = records.value.find((record) => record.id === form.parentId);
      const parentExists = records.value.some(
        (record) =>
          record.id === form.parentId &&
          record.companyId === companyId &&
          !excludedParentIds.value.includes(record.id),
      );
      if (!parentExists) {
        form.parentId = null;
      }

      if (selectedParent?.companyId !== companyId) {
        form.unitBisnisId = null;
      }

      form.sequence = countSiblingSequence(
        records.value,
        companyId,
        form.parentId,
        dialogMode.value === "edit" ? editingId.value : null,
      );
    },
  );

  watch(
    () => form.parentId,
    (parentId) => {
      if (!parentId) return;

      const parent = records.value.find((record) => record.id === parentId);
      if (!parent) return;

      if (parent.companyId && parent.companyId !== form.companyId) {
        form.companyId = parent.companyId;
      }

      form.unitBisnisId = parent.unitBisnisId ?? null;
    },
  );

  onMounted(async () => {
    isReady.value = true;
  });

  return {
    records,
    selectedCompanyId,
    selectedCompanyName,
    showInactive,
    isManageMode,
    search,
    isLoading,
    isRefreshing,
    isSubmitting,
    pageErrorMessage,
    dialogErrorMessage,
    selectedNodeId,
    selectedNode,
    selectedParent,
    companyLabel,
    filteredRecords,
    summary,
    treeNodes,
    isDialogOpen,
    isDeleteDialogOpen,
    dialogTitle,
    dialogDescription,
    deleteDialogDescription,
    dialogMode,
    isDialogReadonly,
    form,
    excludedParentIds,
    handleRefresh,
    deleteNode,
    cancelDelete,
    confirmDelete,
    openCreateDialog,
    openEditDialog,
    openReadDialog,
    closeDialog,
    setSelectedCompany,
    setSelectedCompanyDetail,
    setDialogOpen,
    toggleManageMode,
    submitDialog,
  };
}
