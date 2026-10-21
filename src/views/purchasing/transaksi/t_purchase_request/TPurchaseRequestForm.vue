<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import {
  FieldX,
  FieldNumber,
  FieldStatus,
  FieldDate,
  FieldSelect,
  FieldPopup,
  FieldTextarea,
  FieldMultiUpload,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  PackageSearch,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseRequest,
  updateTPurchaseRequest,
  getTPurchaseRequestById,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "TPurchaseRequestForm",
);
const isViewMode = computed(() => route.name === "TPurchaseRequestView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);

// Check if status is IN APPROVAL, APPROVED or REJECT - cannot edit or delete
const isStatusLocked = computed(() => {
  const status = values.status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
});

// Check if current user is Super Admin
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

// ReadOnly if view mode OR status is locked (IN APPROVAL/APPROVED/REJECT)
// Exception: Super Admin can always edit
const isReadOnly = computed(() => {
  if (isSuperAdmin.value)
    return isViewMode.value || route.meta.readOnly === true;
  return (
    isViewMode.value || route.meta.readOnly === true || isStatusLocked.value
  );
});

// Check if status is REVISI - needs re-approval on save
// Exception: Super Admin langsung APPROVED, tidak perlu re-approval
const isRevisiStatus = computed(() => {
  if (isSuperAdmin.value) return false; // Super Admin bypass revisi flow
  return values.status?.toUpperCase() === "REVISI";
});

const menuId = computed(() => route.params.id as string);

// ============================================================================
// COMPUTED - COMPANY INFO FROM SELECTRESPO (Unit Bisnis)
// ============================================================================
const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyName || "-";
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
    }
  }
  return "-";
});

// ============================================================================
// UNIT BISNIS -> COMPANY DISPLAY (Super Admin)
// ============================================================================
// Nama company (perusahaan induk) dari Unit Bisnis yang dipilih.
// Tampil sebagai field readonly saat Super Admin memilih Unit Bisnis.
const selectedUnitBisnisCompanyName = ref<string>("");

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
};

// Untuk mode Edit/View/Copy, FieldSelect tidak meng-emit valueFull saat
// load awal, jadi ambil nama company-nya via API sekali saja.
const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = "";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result?.status === "success" && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama || result.data?.m_company?.kode || "-";
    }
  } catch {
    // ignore, field will just stay empty
  }
};

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Request";
  if (isCopyMode.value) return "Salin Purchase Request";
  if (isEditMode.value) return "Edit Purchase Request";
  return "Tambah Purchase Request Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Request";
  if (isCopyMode.value)
    return "Buat Purchase Request baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Request";
  return "Buat Purchase Request baru";
});

// Form values - sesuai struktur t_purchase_request
let values = reactive({
  tgl_pr: new Date().toISOString().split("T")[0],
  no_pr: "",
  tgl_butuh: "",
  catatan: "",
  status: "DRAFT",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  divisi: "",
  is_rfq: false, // [boolean]
  status_transaksi: "",
  req_type_user: authStore.user?.tipe?.value1 || "",
  req_user_by: authStore.user?.name || "",
  // updated_by hanya diisi saat edit mode (PUT), tidak saat create
  created_by: authStore.user?.id || "",
});

// Temp penampung data API mentah sebelum dimasukkan
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays - t_purchase_request_ds dan t_purchase_request_lampirans
const detailItems = ref<any[]>([]);
const detailLampirans = ref<any[]>([]);

// Computed: Get IDs of already selected items to exclude from ButtonMultiSelect
const selectedItemIds = computed(() => {
  return detailItems.value.map((item: any) => item.m_items_id).filter(Boolean);
});

const canSelectItems = computed(() => {
  return Boolean(values.m_gudang_id?.trim()) && !loading.value && !isReadOnly.value;
});

const itemsButtonClass = computed(() => {
  if (canSelectItems.value) return "";
  return "bg-white text-slate-400 border border-slate-200 shadow-none hover:bg-white hover:text-slate-400 disabled:!opacity-100 disabled:bg-white disabled:text-slate-400";
});

// Validation state for min stock warnings
const minStockWarnings = ref<Set<number>>(new Set());

// Min stock confirmation dialog state
const showMinStockDialog = ref(false);
const minStockDialogDescription = ref("");
const pendingSavePayload = ref<any>(null);

// Revisi confirmation dialog state
const isRevisiDialogOpen = ref(false);
const approvalMessage = ref("");
const approvalMessageError = ref("");

// Super Admin confirmation dialog state
const isSuperAdminDialogOpen = ref(false);

// Free Stock Dialog state
const showFreeStockDialog = ref(false);
const freeStockData = ref<any[]>([]);
const freeStockLoading = ref(false);
const freeStockItemName = ref("");

// ============================================================================
// IMAGE PREVIEW STATE & METHODS
// ============================================================================
const showImagePreview = ref(false);
const previewImages = ref<any[]>([]);
const currentPreviewIndex = ref(0);
const previewTitle = ref("");

const openImagePreview = (detail: any) => {
  // Check both location of images: m_items_images (from m_items) or explicit array

  const images =
    detail.m_item?.m_items_images ||
    detail.m_item?.images ||
    detail.images ||
    [];

  console.log(images);

  if (!images.length) {
    toast.info("Tidak ada foto untuk item ini");
    return;
  }

  previewImages.value = images.map((img: any, idx: number) => {
    if (typeof img === "string") {
      return { gambar: img, id: idx };
    }
    return {
      gambar: img.gambar,
      id: img.id || idx,
    };
  });
  previewTitle.value = detail.m_item?.nama_item || "Item Image";
  currentPreviewIndex.value = 0;
  showImagePreview.value = true;
};

const closeImagePreview = () => {
  showImagePreview.value = false;
  previewImages.value = [];
};

const nextPreviewImage = () => {
  if (currentPreviewIndex.value < previewImages.value.length - 1) {
    currentPreviewIndex.value++;
  } else {
    currentPreviewIndex.value = 0;
  }
};

const prevPreviewImage = () => {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--;
  } else {
    currentPreviewIndex.value = previewImages.value.length - 1;
  }
};

const getImageUrl = (imagePath?: string) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  if (imagePath.startsWith("uploads/")) {
    return `${baseUrl}/${imagePath}`;
  }
  return `${baseUrl}/uploads/${imagePath}`;
};

const handlePreviewKeyPress = (event: KeyboardEvent) => {
  if (!showImagePreview.value) return;

  if (event.key === "ArrowRight") {
    nextPreviewImage();
  } else if (event.key === "ArrowLeft") {
    prevPreviewImage();
  } else if (event.key === "Escape") {
    showImagePreview.value = false;
  }
};

// ============================================================================
// AUTO SEND APPROVAL FUNCTION
// ============================================================================
const autoSendApproval = async (
  prId: string,
  noPr: string,
  message?: string,
) => {
  try {
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList();

    if (!approvalList || approvalList.length === 0) {
      throw new Error("Data approval tidak ditemukan. Silakan login ulang.");
    }

    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/transaksi/t_purchase_request" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );

    if (!currentApproval) {
      throw new Error(
        "Anda tidak memiliki hak untuk mengajukan approval pada halaman ini. Tipe approval yang dibutuhkan: MENGAJUKAN",
      );
    }

    // Validate required approval fields
    if (
      currentApproval.level === null ||
      currentApproval.level === undefined ||
      !currentApproval.sender_id
    ) {
      throw new Error(
        "Data approval tidak lengkap. Silakan hubungi administrator.",
      );
    }

    // Prepare payload
    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      t_purchase_request_id: prId,
      approval_message: message?.trim() || null,
    };

    // Call API POST /dynamic/t_purchase_request_notifikasi
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_request_notifikasi`,
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
      toast.success("Approval berhasil dikirim", {
        description: `Purchase Request "${noPr}" telah dikirim untuk approval`,
      });
    } else {
      throw new Error(
        result.message || "Terjadi kesalahan saat mengirim approval",
      );
    }
  } catch (error) {
    console.error("❌ Auto send approval error:", error);
    throw error;
  }
};

// ============================================================================
// DATE VALIDATION HANDLER
// ============================================================================
const handleTglButuhChange = (value: string) => {
  values.tgl_butuh = value;

  // Clear error first
  errors.tgl_butuh = "";

  // Validate if tgl_butuh is less than tgl_pr
  if (value && values.tgl_pr && value < values.tgl_pr) {
    errors.tgl_butuh =
      "Tanggal dibutuhkan tidak boleh lebih kecil dari Tanggal PR";
  }
};

const validateApprovalData = () => {
  const approvalList = authStore.getApprovalList();

  if (!approvalList || approvalList.length === 0) {
    return {
      valid: false,
      error: "Data approval tidak ditemukan di sistem",
      detail:
        "Silakan logout dan login kembali untuk memuat ulang data approval Anda.",
    };
  }

  const currentApproval = approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/transaksi/t_purchase_request" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );

  if (!currentApproval) {
    return {
      valid: false,
      error: "Hak akses approval tidak ditemukan",
      detail:
        "Anda tidak memiliki hak untuk mengajukan approval pada halaman Purchase Request. Tipe approval yang dibutuhkan: MENGAJUKAN",
    };
  }

  const missingFields = [];
  if (currentApproval.level === null || currentApproval.level === undefined)
    missingFields.push("level");
  if (!currentApproval.sender_id) missingFields.push("sender_id");

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: "Data approval tidak lengkap",
      detail: `Field yang kosong: ${missingFields.join(", ")}. Silakan hubungi administrator.`,
    };
  }

  return { valid: true };
};

// ============================================================================
// DETAIL METHODS - t_purchase_request_ds
// ============================================================================

const addDetailItem = () => {
  detailItems.value.push({
    m_items_id: "",
    qty_pr: 0,
    qty_ots: 0,
    qty_free_stok: 0,
    uom_id: "",
    alasan: "",
    catatan: "",
    // updated_by hanya diisi saat edit mode, akan diset di payload saat save
    created_by: authStore.user?.id || "",
  });
};

const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  minStockWarnings.value.delete(index);
  toast.info("Item detail dihapus");
};

// Validate qty_pr against min_stock
const validateQtyPR = (detail: any, index: number) => {
  const minStock = Number(
    detail.m_item?.safety_stok ||
    detail.m_item?.m_items_gudang?.safety_stok ||
    detail.m_item?.m_items_gudangs?.[0]?.safety_stok || 0
  );
  const qtyPr = Number(detail.qty_pr) || 0;
  console.log(detail.m_item);

  if (minStock > 0 && qtyPr < minStock) {
    minStockWarnings.value.add(index);
    toast.warning("Peringatan Safe Stock", {
      description: `Qty PR (${qtyPr}) kurang dari Safe Stock (${minStock}) untuk item "${detail.m_item?.nama_item}"`,
    });
    // return false // Don't block, just warn
  } else {
    minStockWarnings.value.delete(index);
  }

  validateStock(detail);
  return true;
};

const validateStock = (detail: any) => {
  const freeStock = 0;
  const qtyRequest =
    typeof detail.qty_pr === "string"
      ? parseFloat(detail.qty_pr)
      : detail.qty_pr || 0;
  const optimumStock = Number(
    detail.m_item?.stok_optimum ||
    detail.m_item?.m_items_gudang?.stok_optimum ||
    detail.m_item?.m_items_gudangs?.[0]?.stok_optimum || 0
  );
  console.log(detail.m_item);

  if (optimumStock > 0 && freeStock + qtyRequest < optimumStock) {
    toast.warning("Peringatan Stock", {
      description: `Total Stock (${freeStock + qtyRequest}) kurang dari Optimum Stock (${optimumStock}) untuk item ${detail.m_item?.nama_item}`,
      duration: 4000,
    });
  }
};

// Handle free stock button click
const handleFreeStockClick = async (detail: any) => {
  if (!detail.m_items_id) {
    toast.error("Item ID tidak ditemukan");
    return;
  }

  freeStockItemName.value = detail.m_item?.nama_item || "Item";
  freeStockLoading.value = true;
  showFreeStockDialog.value = true;
  freeStockData.value = [];

  try {
    const response = await fetch(
      `${API_BASE_URL}/fn/m_gudang/getFreeStock?m_item_id=${detail.m_items_id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();

    if (result.status === "success" && result.data) {
      freeStockData.value = result.data;

      if (result.data.length === 0) {
        toast.info("Tidak ada stock", {
          description: `Item "${freeStockItemName.value}" tidak memiliki stock di gudang manapun`,
        });
      }
    } else {
      throw new Error(result.message || "Gagal memuat data free stock");
    }
  } catch (error) {
    console.error("Error fetching free stock:", error);
    toast.error("Gagal memuat data free stock", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    showFreeStockDialog.value = false;
  } finally {
    freeStockLoading.value = false;
  }
};

// Helper function to render item image HTML
const renderItemImage = (item: any): string => {
  const firstImage = item.m_items_images?.[0]?.gambar;
  if (firstImage) {
    const baseUrl = API_BASE_URL.replace("/api", "");
    const imageUrl = `${baseUrl}/${firstImage}`;
    return `<img src="${imageUrl}" class="w-12 h-12 object-cover rounded" alt="Item" />`;
  }
  return '<div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">No Img</div>';
};

// Helper function to get active price from pricelist
const getActivePrice = (params: any): string => {
  const item = params.data;
  const activePricelist = item.m_items_pricelists?.find(
    (p: any) => p.is_active,
  );
  if (activePricelist) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(activePricelist.harga);
  }
  return "-";
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    tgl_pr: new Date().toISOString().split("T")[0],
    no_pr: "",
    tgl_butuh: "",
    catatan: "",
    status: "DRAFT",
    status_transaksi: "",
    m_unit_bisnis_id: "",
    divisi: "",

    is_rfq: false,
    req_type_user: authStore.user?.tipe?.value1 || "",
    req_user_by: authStore.user?.name || "",
    // updated_by tidak diset saat reset - hanya diisi saat edit mode
    created_by: authStore.user?.id || "",
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays
  detailItems.value = [];
  detailLampirans.value = [];
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Auto-fill unit bisnis dari SelectRespo untuk non-super admin
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId;
        }
      }
    } catch (e) {
      // ignore parse error
    }
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal
    ? (route.query.source as string)
    : menuId.value;

  // If edit mode, view mode, or copy mode, load existing data
  if ((isEditMode.value || isViewMode.value || isCopyModeLocal) && sourceId) {
    loading.value = true;
    try {
      const response = await getTPurchaseRequestById(sourceId);
      initialValues = response.data;

      auditMeta.value = {
        created_by: initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.update_by || initialValues.updated_by,
        updatedAt: initialValues.updatedAt,
      };

      // Remove ID jika copy mode
      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;
      }

      // Assign hanya key yang sudah ada di state reactive values
      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          // @ts-ignore dynamic assign
          values[key] = initialValues[key];
        }
      }

      // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
      if (isSuperAdmin.value && values.m_unit_bisnis_id) {
        fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
      }

      // Load details - check both possible field names from API
      if (initialValues.t_purchase_request_ds) {
        detailItems.value = initialValues.t_purchase_request_ds.map(
          (d: any) => ({
            ...d,
            uom: d.m_item?.uom || d.uom, // Map uom from m_item.uom
            qty_free_stok: d.qty_free_stok === null ? Number(d.m_item?.stock_gudangs?.free_stock) || 0 : Number(d.qty_free_stok) || 0
          }),
        );
      } else if (initialValues.t_purchase_request_d) {
        detailItems.value = initialValues.t_purchase_request_d.map(
          (d: any) => ({
            ...d,
            uom: d.m_item?.uom || d.uom, // Map uom from m_item.uom
            qty_free_stok: d.qty_free_stok === null ? Number(d.m_item?.stock_gudangs?.free_stock) || 0 : Number(d.qty_free_stok) || 0
          }),
        );
      }

      // Load lampiran and transform to FieldMultiUpload format
      let lampiranData = [];
      if (initialValues.t_purchase_request_lampirans) {
        lampiranData = initialValues.t_purchase_request_lampirans;
      } else if (initialValues.t_purchase_request_lampiran) {
        lampiranData = initialValues.t_purchase_request_lampiran;
      }

      // Transform lampiran data: API returns { id, lampiran: "path" }
      // FieldMultiUpload expects { gambar: "path", lampiran: "path" }
      detailLampirans.value = lampiranData.map((lamp: any) => ({
        id: lamp.id,
        t_purchase_request_id: lamp.t_purchase_request_id,
        gambar: lamp.lampiran, // Map lampiran to gambar for display
        lampiran: lamp.lampiran,
        file_type:
          lamp.file_type ||
          (lamp.lampiran?.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "image/*"),
        file_name: lamp.file_name || lamp.lampiran?.split("/").pop() || "file",
      }));

      // If copy mode, remove IDs from detail items and lampiran
      if (isCopyModeLocal) {
        // Remove auto-generated field from header
        values.no_pr = "";
        values.status = "DRAFT";

        // IMPORTANT: Reset user request fields to current logged-in user
        values.req_type_user = authStore.user?.tipe?.value1 || "";
        values.req_user_by = authStore.user?.name || "";
        values.created_by = authStore.user?.id || "";
        // Copy mode is create new, so updated_by should not be set

        // Remove IDs from detail items (copy mode = create new, no updated_by)
        detailItems.value = detailItems.value.map((item: any) => {
          const {
            id,
            t_purchase_request_id,
            createdAt,
            updatedAt,
            updated_by,
            ...rest
          } = item;
          return {
            ...rest,
            created_by: authStore.user?.id || "",
          };
        });

        // Remove IDs from lampiran (copy mode = create new, no updated_by)
        detailLampirans.value = detailLampirans.value.map((lamp: any) => {
          const {
            id,
            t_purchase_request_id,
            createdAt,
            updatedAt,
            updated_by,
            ...rest
          } = lamp;
          return {
            ...rest,
            created_by: authStore.user?.id || "",
          };
        });
      }

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description: "Silakan edit dan simpan sebagai Purchase Request baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Purchase Request", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () =>
            router.push("/purchasing/transaksi/t_purchase_request"),
        },
      });
    } finally {
      loading.value = false;
    }
  }
});

// Errors object (manual validation)
const errors = reactive({
  tgl_butuh: "",
  prioritas_id: "",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
});

const validateDetailItemsRequired = () => {
  const hasSelectedItem = detailItems.value.some((item: any) =>
    Boolean(item?.m_items_id),
  );

  if (!hasSelectedItem) {
    toast.error("Detail item wajib diisi", {
      description:
        "Pilih minimal satu item terlebih dahulu sebelum menyimpan Purchase Request",
    });
    return false;
  }

  return true;
};

// ============================================================================
// SAVE HANDLER - WITH DETAILS
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.tgl_butuh?.trim()) {
    errors.tgl_butuh = "Tanggal butuh wajib diisi";
    invalid = true;
  } else if (values.tgl_pr && values.tgl_butuh < values.tgl_pr) {
    errors.tgl_butuh =
      "Tanggal dibutuhkan tidak boleh lebih kecil dari Tanggal PR";
    invalid = true;
  }

  // Unit Bisnis required untuk Super Admin yang harus pilih
  if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
    invalid = true;
  }

  if (!values.m_gudang_id?.trim()) {
    errors.m_gudang_id = "Gudang wajib dipilih";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Lengkapi field yang wajib diisi",
    });
    return;
  }

  if (!validateDetailItemsRequired()) {
    loading.value = false;
    return;
  }

  // Validate that all detail items have a quantity >= 1
  const invalidQtyItem = detailItems.value.find(
    (item) => item?.m_items_id && Number(item.qty_pr) < 1,
  );
  if (invalidQtyItem) {
    toast.error('Kuantitas (Qty) PR minimal harus 1', {
      description: `Item "${invalidQtyItem.m_item?.nama_item || 'Tidak diketahui'}" memiliki Qty kurang dari 1`
    });
    loading.value = false;
    return;
  }

  // Check if Super Admin - show confirmation dialog first
  if (isSuperAdmin.value) {
    isSuperAdminDialogOpen.value = true;
    return;
  }

  // Continue with normal save flow
  await proceedWithSave();
};

// Proceed with save after Super Admin confirmation or for normal users
const proceedWithSave = async () => {
  // Check if editing REVISI status - show confirmation dialog
  if (isEditMode.value && isRevisiStatus.value) {
    // Validate approval data BEFORE showing dialog
    const approvalValidation = validateApprovalData();
    if (!approvalValidation.valid) {
      toast.error(approvalValidation.error || "Validasi approval gagal", {
        description: approvalValidation.detail,
        duration: 6000,
      });
      return;
    }

    isRevisiDialogOpen.value = true;
    return;
  }

  // Check min stock warnings
  const itemsWithMinStockIssues: string[] = [];
  detailItems.value.forEach((detail, index) => {
    const minStock = Number(detail.m_item?.safety_stok) || 0;
    const qtyPr = Number(detail.qty_pr) || 0;

    if (minStock > 0 && qtyPr < minStock) {
      itemsWithMinStockIssues.push(
        `${detail.m_item?.nama_item} (Qty: ${qtyPr}, Min Stock: ${minStock})`,
      );
    }
  });

  // Show confirmation dialog if there are min stock warnings
  if (itemsWithMinStockIssues.length > 0) {
    const itemsCount = itemsWithMinStockIssues.length;
    minStockDialogDescription.value =
      `Terdapat ${itemsCount} item dengan Qty PR di bawah Min Stock:\n\n` +
      itemsWithMinStockIssues.join("\n");

    // Store payload untuk digunakan setelah konfirmasi
    pendingSavePayload.value = {
      tgl_pr: values.tgl_pr,
      no_pr: values.no_pr || null,
      divisi: values.divisi || null,

      is_rfq: values.is_rfq,
      status_transaksi: values.status_transaksi || null,
      tgl_butuh: values.tgl_butuh,
      catatan: values.catatan || null,
      // Super Admin selalu APPROVED, user biasa sesuai status
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      m_gudang_id: values.m_gudang_id || null,
      req_type_user: values.req_type_user,
      req_user_by: values.req_user_by,
      // updated_by hanya diisi saat edit mode (PUT)
      ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
      created_by: authStore.user?.id || "",
      t_purchase_request_ds: detailItems.value.map((item: any) => ({
        ...item,
        qty_ots: Number(item.qty_pr) || 0,
        qty_free_stok: Number(item.qty_free_stok) || 0,
        // updated_by hanya diisi saat edit mode (PUT)
        ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
        created_by: item.created_by || authStore.user?.id || "",
      })),
      t_purchase_request_lampirans: isEditMode.value
        ? (detailLampirans.value || []).map((lamp: any) => ({
            ...(lamp.id && { id: lamp.id }),
            ...(lamp.t_purchase_request_id && {
              t_purchase_request_id: lamp.t_purchase_request_id,
            }),
            lampiran: lamp.lampiran || lamp.gambar,
            updated_by: authStore.user?.id || "",
            created_by: lamp.created_by || authStore.user?.id || "",
          }))
        : (detailLampirans.value || []).map((lamp: any) => ({
            lampiran: lamp.lampiran || lamp.gambar,
            created_by: authStore.user?.id || "",
          })),
    };

    showMinStockDialog.value = true;
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const payload = {
      tgl_pr: values.tgl_pr || null,
      no_pr: values.no_pr || null,
      divisi: values.divisi || null,

      is_rfq: values.is_rfq,
      status_transaksi: values.status_transaksi || null,
      tgl_butuh: values.tgl_butuh,
      catatan: values.catatan || null,
      // Super Admin selalu APPROVED, user biasa sesuai status
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      m_gudang_id: values.m_gudang_id || null,
      req_type_user: values.req_type_user,
      req_user_by: values.req_user_by,
      // updated_by hanya diisi saat edit mode (PUT)
      ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
      created_by: authStore.user?.id || "",
      // Detail fields
      t_purchase_request_ds: detailItems.value.map((item: any) => ({
        ...item,
        qty_ots: Number(item.qty_pr) || 0,
        qty_free_stok: Number(item.qty_free_stok) || 0,
        uom_id:
          item.uom_id ||
          item.m_item?.mi_uom?.id ||
          item.m_item?.uom?.id ||
          null,
        // updated_by hanya diisi saat edit mode (PUT)
        ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
        created_by: item.created_by || authStore.user?.id || "",
      })),
      t_purchase_request_lampirans: isEditMode.value
        ? (detailLampirans.value || []).map((lamp: any) => ({
            ...(lamp.id && { id: lamp.id }),
            ...(lamp.t_purchase_request_id && {
              t_purchase_request_id: lamp.t_purchase_request_id,
            }),
            lampiran: lamp.lampiran || lamp.gambar,
            updated_by: authStore.user?.id || "",
            created_by: lamp.created_by || authStore.user?.id || "",
          }))
        : (detailLampirans.value || []).map((lamp: any) => ({
            lampiran: lamp.lampiran || lamp.gambar,
            created_by: authStore.user?.id || "",
          })),
    };

    if (isEditMode.value) {
      await updateTPurchaseRequest(menuId.value, payload as any);
      toast.success("Purchase Request berhasil diperbarui", {
        description: isSuperAdmin.value
          ? `Purchase Request "${values.no_pr}" telah diperbarui dengan status APPROVED`
          : `Purchase Request "${values.no_pr}" telah diperbarui`,
      });
    } else {
      await createTPurchaseRequest(payload as any);
      toast.success("Purchase Request berhasil dibuat", {
        description: isSuperAdmin.value
          ? `Purchase Request "${values.no_pr}" telah dibuat dengan status APPROVED`
          : `Purchase Request "${values.no_pr}" telah ditambahkan`,
      });
    }
    window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    router.replace(
      "/purchasing/transaksi/t_purchase_request?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Purchase Request"
        : "Gagal membuat Purchase Request",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
  }
};

// Handle min stock dialog confirmation
const handleMinStockConfirm = async () => {
  showMinStockDialog.value = false;

  if (!pendingSavePayload.value) return;

  loading.value = true;
  try {
    if (isEditMode.value) {
      await updateTPurchaseRequest(
        menuId.value,
        pendingSavePayload.value as any,
      );
      toast.success("Purchase Request berhasil diperbarui", {
        description: `Purchase Request "${values.no_pr}" telah diperbarui`,
      });
    } else {
      await createTPurchaseRequest(pendingSavePayload.value as any);
      toast.success("Purchase Request berhasil dibuat", {
        description: `Purchase Request "${values.no_pr}" telah ditambahkan`,
      });
    }
    window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    router.replace(
      "/purchasing/transaksi/t_purchase_request?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Purchase Request"
        : "Gagal membuat Purchase Request",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
    pendingSavePayload.value = null;
  }
};

// Handle min stock dialog cancel
const handleMinStockCancel = () => {
  showMinStockDialog.value = false;
  pendingSavePayload.value = null;
  loading.value = false;
};

// ============================================================================
// REVISI DIALOG HANDLERS
// ============================================================================
const cancelRevisiSave = () => {
  isRevisiDialogOpen.value = false;
  approvalMessage.value = "";
  approvalMessageError.value = "";
};

const confirmRevisiSave = async () => {
  if (!validateDetailItemsRequired()) return;

  // Validate approval message is required
  approvalMessageError.value = "";
  if (!approvalMessage.value?.trim()) {
    approvalMessageError.value = "Pesan Approval wajib diisi";
    return;
  }

  isRevisiDialogOpen.value = false;
  loading.value = true;

  try {
    // Build payload with status changed to IN APPROVAL
    const payload = {
      tgl_pr: values.tgl_pr || null,
      no_pr: values.no_pr || null,
      divisi: values.divisi || null,

      is_rfq: values.is_rfq,
      status_transaksi: values.status_transaksi || null,
      tgl_butuh: values.tgl_butuh,
      catatan: values.catatan || null,
      status: "IN APPROVAL", // Change status to IN APPROVAL
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      m_gudang_id: values.m_gudang_id || null,
      req_type_user: values.req_type_user,
      req_user_by: values.req_user_by,
      updated_by: authStore.user?.id || "", // Revisi selalu edit mode jadi updated_by terisi
      t_purchase_request_ds: detailItems.value.map((item: any) => ({
        ...item,
        qty_ots: Number(item.qty_pr) || 0,
        qty_free_stok: Number(item.qty_free_stok) || 0,
        updated_by: authStore.user?.id || "",
      })),
    };

    // Update the PR
    await updateTPurchaseRequest(menuId.value, payload as any);

    // Send approval notification
    await autoSendApproval(
      menuId.value,
      values.no_pr || "",
      approvalMessage.value,
    );

    toast.success("Purchase Request berhasil diperbarui", {
      description: `Purchase Request "${values.no_pr}" telah dikirim untuk approval`,
    });

    approvalMessage.value = "";
    router.replace(
      "/purchasing/transaksi/t_purchase_request?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error("Gagal memperbarui Purchase Request", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// SUPER ADMIN DIALOG HANDLERS
// ============================================================================
const confirmSuperAdminSave = async () => {
  if (!validateDetailItemsRequired()) return;

  isSuperAdminDialogOpen.value = false;
  await proceedWithSave();
};

const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false;
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/transaksi/t_purchase_request");
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ pageDescription }}
        </p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Purchase Request</CardTitle>
          <CardDescription>
            Isi data Purchase Request dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Baris 1: Unit Bisnis, (Company), Tanggal PR, Tanggal Dibutuhkan -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Unit Bisnis) - Super Admin: Select, User Biasa: Auto dari auth -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_comp',
                  filter_column_is_active: 'true',
                  join: 'true',
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
              :clearable="true"
              @update:value-full="
                (item) => {
                  handleUnitBisnisSelected(item);
                  values.m_gudang_id = '';
                }
              "
            />

            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
              hints="Unit Bisnis dari akun Anda"
            />

            <!-- Company - hanya tampil untuk Super Admin, menampilkan
                 perusahaan induk dari Unit Bisnis yang dipilih -->
            <FieldX
              v-if="isSuperAdmin"
              id="m_unit_bisnis_company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Company dari Unit Bisnis yang dipilih"
            />

            <!-- Tanggal PR -->
            <FieldDate
              id="tgl_pr"
              label="Tanggal PR"
              v-model="values.tgl_pr"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Tanggal hari ini"
            />

            <!-- Tanggal Butuh (required) -->
            <FieldDate
              id="tgl_butuh"
              label="Tanggal Dibutuhkan"
              :modelValue="values.tgl_butuh"
              @update:modelValue="handleTglButuhChange"
              :errorname="errors.tgl_butuh ? 'failed' : ''"
              :hints="
                errors.tgl_butuh || 'Tanggal dibutuhkan harus >= Tanggal PR'
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal butuh"
            />
          </div>

          <!-- Baris 2: No PR, Divisi, Gudang -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- No PR -->
            <FieldX
              id="no_pr"
              label="No PR"
              v-model="values.no_pr"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate sistem"
              hints="Nomor dibuat otomatis oleh sistem"
            />

            <!-- Divisi -->
            <FieldSelect
              id="divisi"
              label="Divisi"
              v-model="values.divisi"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :options="[
                { label: 'IT', value: 'IT' },
                { label: 'HRD', value: 'HRD' },
                { label: 'FINANCE', value: 'FINANCE' },
                { label: 'ACCOUNTING', value: 'ACCOUNTING' },
                { label: 'PRODUKSI', value: 'PRODUKSI' },
                { label: 'MARKETING', value: 'MARKETING' },
              ]"
              valueField="value"
              displayField="label"
              placeholder="Pilih Divisi"
              :clearable="true"
            />

            <!-- Gudang -->
            <FieldSelect
              id="m_gudang_id"
              label="Gudang"
              v-model="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              :hints="errors.m_gudang_id || (values.m_unit_bisnis_id ? 'Pilih Gudang' : 'Pilih Unit Bisnis terlebih dahulu')"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode_gudang,nama_gudang',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false;
                  return response;
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih Gudang"
              :clearable="true"
              :key="`gudang-${values.m_unit_bisnis_id}`"
            />
          </div>

          <!-- Baris 3: Status, IS RFQ -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Status (readonly, default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="DRAFT"
              hints="Status akan berubah sesuai proses approval"
            />

            <!-- Is RFQ -->
            <FieldStatus
              id="is_rfq"
              label="IS RFQ"
              v-model="values.is_rfq"
              activeText="Yes"
              inactiveText="No"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
            />
          </div>

          <!-- Baris 4: Catatan -->
          <div class="grid grid-cols-1 gap-6">
            <FieldTextarea
              id="catatan"
              label="Catatan"
              v-model="values.catatan"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan untuk Purchase Request ini"
              :rows="3"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="items" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="items">Detail Items</TabsTrigger>
          <TabsTrigger value="lampiran">Lampiran</TabsTrigger>
        </TabsList>

        <!-- TAB: DETAIL ITEMS (t_purchase_request_ds) -->
        <TabsContent value="items" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Items Purchase Request</CardTitle>
                  <CardDescription
                    >Kelola item yang diminta dalam PR ini</CardDescription
                  >
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Items"
                  :disabled="!canSelectItems"
                  :buttonClass="itemsButtonClass"
                  uniqueKey="m_items_id"
                  @add="
                    (items: any[]) => {
                      items.forEach((item) => {
                        if (
                          !detailItems.find(
                            (d: any) => d.m_items_id === item.m_items_id,
                          )
                        ) {
                          detailItems.push({
                            m_items_id: item.m_items_id,
                            qty_pr:1,
                            qty_ots:1,
                            qty_free_stok: item.free_stock || 0,
                            uom_id: item.uom_id || '',
                            alasan: '',
                            catatan: '',
                            // updated_by akan diset di payload saat save jika edit mode
                            created_by: authStore.user?.id || '',
                            // Untuk display
                            m_item: {
                              ...item,
                              nama_item: item.nama_item,
                              kode_item: item.kode_item,
                              mi_tipe: { value1: item.tipe_name },
                              mi_uom: { value1: item.uom_name },
                              stock_gudang: { free_stock: item.free_stock },
                              safety_stok: item.safety_stok,
                              stok_optimum: item.stok_optimum,
                              images: item.images || [],
                            },
                            nama_gudang: item.nama_gudang,
                            m_gudang_id: item.m_gudang_id,
                            uom: item.uom_name,
                          });
                        }
                      });
                    }
                  "
                  :api="{
                    url: `${API_BASE_URL}/fn/stock_gudang/stock_item_grouped`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'kode_item,nama_item,tipe_name,nama_gudang',
                      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
                      filter_column_m_gudang_id: values.m_gudang_id || undefined,
                      all_data: 'true',
                    },
                    onsuccess: (response: any) => {
                      console.log('m_items API Response:', response);
                      
                      // Tambahkan unique 'id' untuk keperluan checkbox Data Table
                      if (response.data && Array.isArray(response.data)) {
                        response.data = response.data.map((item: any) => ({
                          ...item,
                          id: item.m_items_id + '_' + item.m_gudang_id
                        }));
                      }
                      
                      response.hasNext = response.pagination?.next_page
                        ? true
                        : false;
                      return response;
                    },
                  }"
                  :columns="[
                    {
                      field: 'kode_item',
                      headerName: 'Kode',
                      width: '120px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'nama_item',
                      headerName: 'Nama Item',
                      flex: 1,
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'tipe_name',
                      headerName: 'Tipe Item',
                      width: '100px',
                      sortable: false,
                      filterable: false,
                    },
                     {
                      field: 'nama_gudang',
                      headerName: 'Nama Gudang',
                      width: '180px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'free_stock',
                      headerName: 'Free Stok',
                      width: '100px',
                      sortable: true,
                      filterable: false,
                    },
                    {
                      field: 'safety_stok',
                      headerName: 'Safety Stok',
                      width: '100px',
                      sortable: true,
                      filterable: false,
                    },
                    {
                      field: 'stok_optimum',
                      headerName: 'Stok Optimum',
                      width: '100px',
                      sortable: true,
                      filterable: false,
                    },
                    {
                      field: 'uom_name',
                      headerName: 'UoM',
                      width: '100px',
                      sortable: false,
                      filterable: false,
                    },
                  ]"
                  :excludeIds="selectedItemIds"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">No</TableHead>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead class="w-32">Qty</TableHead>
                      <TableHead v-if="isReadOnly" class="w-32">Qty Sisa</TableHead>
                      <TableHead class="w-32">UoM</TableHead>
                      <TableHead class="w-24">Free Stock</TableHead>
                      <TableHead class="w-24">Safety Stock</TableHead>
                      <TableHead class="w-24">Opt. Stock</TableHead>
                      <TableHead class="w-20 text-center">Foto Item</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead v-if="!isReadOnly" class="w-12 text-center"
                        >Aksi</TableHead
                      >
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="detailItems.length === 0">
                      <TableCell
                        colspan="11"
                        class="text-center py-16 text-muted-foreground"
                      >
                        <div
                          class="flex flex-col items-center justify-center gap-2"
                        >
                          <p class="text-sm">Belum ada item dipilih</p>
                          <p class="text-xs">
                            Klik tombol "Pilih Items" untuk menambahkan
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      v-for="(detail, idx) in detailItems"
                      :key="detail.m_items_id || idx"
                      class="hover:bg-muted/50"
                    >
                      <TableCell>{{ idx + 1 }}</TableCell>
                      <TableCell>{{
                        detail.m_item?.kode_item || "-"
                      }}</TableCell>
                      <TableCell>{{
                        detail.m_item?.nama_item || "-"
                      }}</TableCell>
                      
                      <TableCell>
                        <FieldNumber
                          v-model="detail.qty_pr"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="1"
                          placeholder="1"
                          @blur="validateQtyPR(detail, idx)"
                        />
                      </TableCell>

                      <TableCell v-if="isReadOnly">
                        <span class="text-sm">{{
                          detail.qty_ots || 0
                        }}</span>
                      </TableCell>
                      
                      <TableCell>
                        <span class="text-sm">{{
                          detail.m_item?.mi_uom?.value1 || "-"
                        }}</span>
                      </TableCell>
                      <TableCell>
                        <span class="text-sm">{{
                          detail.qty_free_stok ?? 0
                        }}</span>
                      </TableCell>
                      <TableCell>
                        <span class="text-sm">{{
                          detail.m_item?.safety_stok || detail.m_item?.m_items_gudang?.safety_stok || detail.m_item?.m_items_gudangs?.[0]?.safety_stok || 0
                        }}</span>
                      </TableCell>
                      <TableCell>
                        <span class="text-sm">{{
                          detail.m_item?.stok_optimum || detail.m_item?.m_items_gudang?.stok_optimum || detail.m_item?.m_items_gudangs?.[0]?.stok_optimum || 0
                        }}</span>
                      </TableCell>
                      <TableCell class="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="openImagePreview(detail)"
                          :disabled="!(detail.m_item?.images?.length || detail.m_item?.m_items_images?.length)"
                        >
                          <Eye class="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <FieldX
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan item"
                        />
                      </TableCell>
                      <TableCell v-if="!isReadOnly" class="text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB: LAMPIRAN (t_purchase_request_lampirans) -->
        <TabsContent value="lampiran" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lampiran</CardTitle>
              <CardDescription
                >Upload gambar atau PDF sebagai lampiran
                (opsional)</CardDescription
              >
            </CardHeader>
            <CardContent>
              <FieldMultiUpload
                id="t_purchase_request_lampirans"
                label="Lampiran (Opsional)"
                :value="detailLampirans"
                @input="(v) => (detailLampirans = v)"
                :hints="'Upload gambar (JPG, PNG) atau PDF (max 5MB per file, maksimal 10 file)'"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                accept="image/*,.pdf"
                :maxImages="10"
                class="w-full"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button
          type="button"
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
          class="w-full sm:w-auto"
        >
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button
          v-if="!isReadOnly"
          type="button"
          @click="onSave"
          :disabled="loading"
          class="gap-2 w-full sm:w-auto"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Perbarui" : "Simpan" }}
        </Button>
      </div>
    </form>

    <!-- ================================================================ -->
    <!-- MIN STOCK WARNING DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog
      :open="showMinStockDialog"
      @update:open="showMinStockDialog = $event"
      title="Terdapat 1 item dengan Qty PR di bawah Min Stock:"
      :description="minStockDialogDescription"
      type="warning"
      confirmText="OK"
      cancelText="Cancel"
      @confirm="handleMinStockConfirm"
      @cancel="handleMinStockCancel"
    />

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="isSuperAdminDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-yellow-600">⚠️</span>
            Konfirmasi Super Admin
          </DialogTitle>
          <DialogDescription>
            Anda login sebagai
            <span class="font-semibold text-primary">SUPER ADMIN</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Data yang Anda {{ isEditMode ? "perbarui" : "buat" }} akan
              langsung memiliki status
              <span class="font-bold text-green-600 dark:text-green-400"
                >APPROVED</span
              >
              tanpa melalui proses approval.
            </p>
          </div>

          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Informasi:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>
                Status akan langsung
                <span class="font-semibold text-green-600">APPROVED</span>
              </li>
              <li>Tidak perlu menunggu approval dari atasan</li>
              <li>Data dapat langsung digunakan untuk proses selanjutnya</li>
            </ul>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelSuperAdminSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save class="h-4 w-4" />
            <span>{{
              loading ? "Menyimpan..." : "Ya, Simpan dengan APPROVED"
            }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- FREE STOCK DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="showFreeStockDialog"
      @update:open="showFreeStockDialog = $event"
    >
      <DialogContent class="max-w-5xl! max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <PackageSearch class="h-5 w-5 text-primary" />
            Free Stock - {{ freeStockItemName }}
          </DialogTitle>
          <DialogDescription>
            Informasi stock yang tersedia untuk item ini di berbagai gudang
          </DialogDescription>
        </DialogHeader>

        <div class="py-4">
          <!-- Loading State -->
          <div
            v-if="freeStockLoading"
            class="flex items-center justify-center py-8"
          >
            <Loader2 class="h-8 w-8 animate-spin text-primary" />
            <span class="ml-3 text-muted-foreground">Memuat data stock...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="freeStockData.length === 0" class="text-center py-8">
            <PackageSearch
              class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3"
            />
            <p class="text-sm text-muted-foreground">
              Tidak ada stock tersedia untuk item ini
            </p>
          </div>

          <!-- Data Table -->
          <div v-else class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/50">
                  <TableHead class="w-12">No</TableHead>
                  <TableHead>Kode Gudang</TableHead>
                  <TableHead>Nama Gudang</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead class="text-right">Free Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="(stock, idx) in freeStockData"
                  :key="stock.id"
                  class="hover:bg-muted/50"
                >
                  <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                  <TableCell>
                    <span class="font-mono text-sm">{{
                      stock.kode_gudang
                    }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="font-medium">{{ stock.nama_gudang }}</span>
                  </TableCell>
                  <TableCell>
                    <span class="text-sm text-muted-foreground">{{
                      stock.company
                    }}</span>
                  </TableCell>
                  <TableCell class="text-right">
                    <span
                      class="font-bold text-lg"
                      :class="{
                        'text-green-600 dark:text-green-400':
                          stock.free_stock > 0,
                        'text-red-600 dark:text-red-400':
                          stock.free_stock === 0,
                      }"
                    >
                      {{ stock.free_stock.toLocaleString("id-ID") }}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Summary -->
          <div
            v-if="!freeStockLoading && freeStockData.length > 0"
            class="mt-4 p-4 bg-muted/50 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground"
                >Total Stock di {{ freeStockData.length }} gudang:</span
              >
              <span class="text-lg font-bold text-primary">
                {{
                  freeStockData
                    .reduce((sum, item) => sum + item.free_stock, 0)
                    .toLocaleString("id-ID")
                }}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showFreeStockDialog = false">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- REVISI CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isRevisiDialogOpen"
      @update:open="isRevisiDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Penyimpanan</DialogTitle>
          <DialogDescription>
            Item ini memiliki status
            <span class="font-semibold text-yellow-600">REVISI</span>. Perubahan
            yang Anda simpan akan otomatis mengirim item ini ke proses approval
            kembali dan status akan berubah menjadi
            <span class="font-semibold text-blue-600">IN APPROVAL</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <!-- Information List -->
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Setelah menyimpan:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>Perubahan data akan tersimpan</li>
              <li>Status berubah menjadi IN APPROVAL</li>
              <li>Notifikasi approval akan terkirim otomatis</li>
            </ul>
          </div>

          <!-- Approval Message Field -->
          <div class="border-t pt-4">
            <FieldX
              id="approval-message"
              type="textarea"
              v-model="approvalMessage"
              label="Pesan Approval"
              placeholder="Masukkan pesan untuk approval"
              :hints="
                approvalMessageError ||
                'Pesan ini akan dikirim ke penerima approval'
              "
              :errorname="approvalMessageError ? 'failed' : ''"
              :required="true"
              :disabled="loading"
              :rows="3"
            />
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelRevisiSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmRevisiSave"
            :disabled="loading"
            class="gap-2"
          >
            <Save class="h-4 w-4" />
            <span>{{
              loading ? "Menyimpan..." : "Simpan & Kirim Approval"
            }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- IMAGE PREVIEW DIALOG -->
    <!-- ================================================================ -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showImagePreview"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 dark:bg-black/95 p-4 overflow-hidden"
          @click="closeImagePreview"
          @keydown="handlePreviewKeyPress"
          tabindex="0"
        >
          <div
            class="relative w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center gap-4"
          >
            <!-- Close button -->
            <Button
              variant="ghost"
              size="icon"
              class="absolute top-4 right-4 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click="closeImagePreview"
            >
              <X class="h-6 w-6" />
            </Button>

            <!-- Previous button -->
            <Button
              v-if="previewImages.length > 1"
              variant="ghost"
              size="icon"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="prevPreviewImage"
            >
              <ChevronLeft class="h-8 w-8" />
            </Button>

            <!-- Next button -->
            <Button
              v-if="previewImages.length > 1"
              variant="ghost"
              size="icon"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="nextPreviewImage"
            >
              <ChevronRight class="h-8 w-8" />
            </Button>

            <!-- Image container -->
            <div
              class="flex flex-col items-center justify-center gap-3 w-full h-full px-4 pb-4"
            >
              <!-- Item Title -->
              <h3 class="text-white text-xl font-semibold">
                {{ previewTitle }}
              </h3>

              <!-- Image preview -->
              <div
                class="flex items-center justify-center rounded-lg bg-white dark:bg-gray-900 p-4 max-w-full"
                style="max-height: calc(95vh - 200px)"
              >
                <img
                  :src="getImageUrl(previewImages[currentPreviewIndex]?.gambar)"
                  :alt="`Image ${currentPreviewIndex + 1}`"
                  class="max-w-[85vw] w-auto h-auto object-contain"
                  style="max-height: calc(95vh - 220px)"
                  @click.stop
                  @error="() => toast.error('Gagal memuat gambar')"
                />
              </div>

              <!-- Image counter -->
              <div class="flex items-center gap-2">
                <div
                  class="text-white text-sm bg-black/60 px-4 py-2 rounded-full"
                >
                  {{ currentPreviewIndex + 1 }} / {{ previewImages.length }}
                </div>
              </div>

              <!-- Thumbnail navigation -->
              <div
                v-if="previewImages.length > 1"
                class="flex gap-2 overflow-x-auto max-w-full px-4"
              >
                <button
                  v-for="(img, index) in previewImages"
                  :key="index"
                  type="button"
                  class="shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all flex items-center justify-center bg-muted"
                  :class="
                    index === currentPreviewIndex
                      ? 'border-white'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  "
                  @click.stop="currentPreviewIndex = index"
                >
                  <img
                    :src="getImageUrl(img.gambar)"
                    :alt="`Thumbnail ${index + 1}`"
                    class="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>