<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  Package,
  User,
  FileText,
  AlertCircle,
  Download,
  Eye,
  ExternalLink,
  Calendar,
  Ban,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "vue-sonner";
import {
  getPurchaseRequestSubconNotifications,
  approvePurchaseRequestSubcon,
  revisePurchaseRequestSubcon,
  rejectPurchaseRequestSubcon,
  type PurchaseRequestSubconNotification,
} from "./service.purchase_request_subcon";
import { getPurchaseRequestSubconById } from "@/views/purchasing/subcon/t_purchase_request_subcon/service";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import FieldX from "@/components/field/FieldX.vue";

const { API_BASE_URL } = useApi();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<PurchaseRequestSubconNotification | null>(null);
const approvalCatatan = ref("");

// Preview dialog
const showPreviewDialog = ref(false);
const previewImageUrl = ref("");
const previewFileName = ref("");

const notificationId = computed(() => route.params.id as string);

const getFileUrl = (filePath: string | null) => {
  if (!filePath) return null;
  const baseUrl = API_BASE_URL.replace("/api", "");
  return `${baseUrl}/${filePath}`;
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const mapDetailBahanFromDb = (item: any) => ({
  id: item.id,
  kode: item.m_item?.kode_item || "-",
  nama_material: item.m_item?.nama_item || "-",
  uom: item.prqb_sc_uom?.value1 || "-",
  qty: parseFloat(item.qty_pr_bahan) || 0,
  qty_free_stok: Number(item.qty_free_stok ?? item.free_stock) || 0,
  rak_list: item.stock_gudang?.m_rak_d || item.m_rak_d || {},
  rak_kode: item.stock_gudang?.m_rak_d?.kode || item.m_rak_d?.kode || undefined,
  rak_nama:
    item.stock_gudang?.m_rak_d?.m_rak?.nama_rak ||
    item.m_rak_d?.m_rak?.nama_rak ||
    undefined,
  rak_detail: item.stock_gudang?.m_rak_d || item.m_rak_d || null,
  rak_master: item.stock_gudang?.m_rak_d?.m_rak || item.m_rak_d?.m_rak || null,
  catatan: item.catatan || "",
});

const mapDetailJadiFromDb = (item: any) => ({
  id: item.id,
  kode: item.m_item?.kode_item || "-",
  nama_item: item.m_item?.nama_item || "-",
  uom: item.prqj_sc_uom?.value1 || "-",
  qty: parseFloat(item.qty_pr_jadi) || 0,
  qty_free_stok: Number(item.qty_free_stok ?? item.free_stock) || 0,
  catatan: item.catatan || "",
});

const mapDetailJasaFromDb = (item: any) => ({
  id: item.id,
  kode: item.m_item?.kode_item || "-",
  nama_jasa: item.m_item?.nama_item || "-",
  uom: item.m_general?.value1 || "-",
  qty: Number(item.qty_pr_jasa ?? item.qty) || 0,
  is_manual:
    item.is_manual === true || item.is_manual === 1 || item.is_manual === "1",
  catatan: item.catatan || "",
});

const subconDetail = computed(
  () => notification.value?.t_purchase_request_subcon || null,
);

const bahanDetails = computed(() => {
  const rows =
    (subconDetail.value as any)?.t_purchase_request_subcon_bahans ||
    (subconDetail.value as any)?.t_purchase_request_subcon_bahan ||
    [];
  return rows.map(mapDetailBahanFromDb);
});

const jadiDetails = computed(() => {
  const rows =
    (subconDetail.value as any)?.t_purchase_request_subcon_jadis ||
    (subconDetail.value as any)?.t_purchase_request_subcon_jadi ||
    [];
  return rows.map(mapDetailJadiFromDb);
});

const jasaDetails = computed(() => {
  const rows =
    (subconDetail.value as any)?.t_purchase_request_subcon_jasas ||
    (subconDetail.value as any)?.t_purchase_request_subcon_jasa ||
    [];
  return rows.map(mapDetailJasaFromDb);
});

const getRakLabel = (detail: any) => {
  console.log("rak nama", detail.rak_nama);
  const rak = detail.rak_list;

  if (detail.rak_kode || detail.rak_nama) {
    const kode = detail.rak_kode || "-";
    const nama = detail.rak_nama || "Tanpa Rak";
    return `${kode} (${nama})`;
  }
  if (!rak || (Array.isArray(rak) && rak.length === 0)) return "-";

  const resolvedRak = Array.isArray(rak) ? rak[0] : rak;
  const rakObj = resolvedRak?.m_rak_d ? resolvedRak.m_rak_d : resolvedRak;
  const rakMaster = detail.rak_master || rakObj?.m_rak || resolvedRak?.m_rak;

  const kode =
    rakObj?.kode || rakObj?.kode_rak_d || rakObj?.m_rak?.kode_rak || "-";
  const nama =
    rakMaster?.nama_rak ||
    rakMaster?.nama ||
    rakObj?.nama_rak ||
    rakObj?.nama ||
    rakObj?.name ||
    "Tanpa Rak";
  return `${kode} (${nama})`;
};

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getPurchaseRequestSubconNotifications(1, 100);
    const found = response.data.find((n) => n.id === notificationId.value);

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    let hydratedNotification: any = { ...found };

    const hasSubconDetail = !!found.t_purchase_request_subcon;
    if (!hasSubconDetail && found.t_purchase_request_subcon_id) {
      try {
        const subconRes = await getPurchaseRequestSubconById(
          found.t_purchase_request_subcon_id,
        );
        if (subconRes?.status === "success" && subconRes?.data) {
          hydratedNotification.t_purchase_request_subcon = subconRes.data;
        }
      } catch (err) {
        console.warn("Failed to hydrate Purchase Request Subcon detail:", err);
      }
    }

    notification.value = hydratedNotification;
    approvalCatatan.value = hydratedNotification.approval_catatan || "";
  } catch (error: any) {
    toast.error("Failed to load notification", {
      description: error.message || "An error occurred",
    });
    router.push("/notifikasi");
  } finally {
    loading.value = false;
  }
};

const handleApproval = async (status: "APPROVED" | "REVISI") => {
  if (!notification.value) return;

  if (status === "REVISI" && !approvalCatatan.value?.trim()) {
    toast.error("Alasan Revisi wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan revisi",
    });
    return;
  }

  submitting.value = true;
  try {
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/subcon/t_purchase_request_subcon" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk menyetujui Purchase Request Subcon",
      });
      return;
    }

    const approvalLevel = moduleApproval.level;

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error("Invalid approval level", {
        description: "Approval level is missing",
      });
      return;
    }

    if (status === "REVISI") {
      await revisePurchaseRequestSubcon(
        notification.value.t_purchase_request_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approvePurchaseRequestSubcon(
        notification.value.t_purchase_request_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Purchase Request Subcon ${status === "APPROVED" ? "approved" : "revised"} successfully`,
    );
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Failed to submit approval", {
      description: error.message || "An error occurred",
    });
  } finally {
    submitting.value = false;
  }
};

const handleReject = async () => {
  if (!notification.value) return;

  // Validate catatan is required
  if (!approvalCatatan.value?.trim()) {
    toast.error("Alasan Reject wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan reject",
    });
    return;
  }

  submitting.value = true;
  try {
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/subcon/t_purchase_request_subcon" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk reject Purchase Request Subcon",
      });
      return;
    }

    const approvalLevel = moduleApproval.level;

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error("Invalid approval level", {
        description: "Approval level is missing",
      });
      return;
    }

    await rejectPurchaseRequestSubcon(
      notification.value.t_purchase_request_subcon_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Purchase Request Subcon berhasil di-reject");
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Gagal reject", {
      description: error.message || "Terjadi kesalahan",
    });
  } finally {
    submitting.value = false;
  }
};

// Preview file
const openFilePreview = (filePath: string) => {
  const url = getFileUrl(filePath);
  if (url) {
    previewImageUrl.value = url;
    previewFileName.value = filePath.split("/").pop() || "file";
    showPreviewDialog.value = true;
  }
};

const openPreviewInNewTab = () => {
  window.open(previewImageUrl.value, "_blank");
};

const downloadPreviewFile = () => {
  const link = document.createElement("a");
  link.href = previewImageUrl.value;
  link.download = previewFileName.value;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Get status badge variant
const getStatusVariant = (status: string) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return 'default';
    case "IN APPROVAL":
      return "secondary";
    case "REVISI":
      return "destructive";
    case "REJECT":
      return "destructive";
    case "DRAFT":
      return "outline";
    default:
      return "secondary";
  }
};

onMounted(() => {
  fetchNotificationDetail();
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <!-- Header -->
    <div class="flex items-start gap-3 md:gap-4">
      <Button
        variant="ghost"
        size="icon"
        class="shrink-0 mt-1"
        @click="router.push('/notifikasi')"
      >
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="min-w-0">
        <h1
          class="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"
        >
          <Package class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Purchase Request Subcon Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Request Subcon request
        </p>
      </div>
    </div>

    <Separator />

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <Skeleton class="h-6 w-64" />
          <Skeleton class="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent class="space-y-4">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-32 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Content -->
    <div v-else-if="notification" class="space-y-4 md:space-y-6">
      <!-- Notification Info Card -->
      <Card class="border-l-4 border-l-primary">
        <CardHeader class="p-4 md:p-6">
          <div
            class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
          >
            <div class="min-w-0">
              <CardTitle
                class="text-base md:text-lg flex items-center gap-2 flex-wrap"
              >
                <span class="wrap-break-word">{{ notification.title }}</span>
              </CardTitle>
              <CardDescription class="mt-1 text-sm">{{
                notification.approval_message
              }}</CardDescription>
            </div>
            <Badge
              :variant="getStatusVariant(notification.status_name || '')"
              class="shrink-0 self-start"
            >
              {{ notification.status_name || "PENDING" }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div
            v-if="notification.approval_catatan"
            class="p-3 bg-muted rounded-md"
          >
            <Label class="text-xs md:text-sm font-medium text-muted-foreground"
              >Catatan dari Pengaju</Label
            >
            <p class="text-sm md:text-base mt-1">
              {{ notification.approval_catatan }}
            </p>
          </div>

          <div
            class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm"
          >
            <div class="flex items-center gap-2">
              <User class="h-4 w-4 text-muted-foreground shrink-0" />
              <Label class="text-muted-foreground shrink-0">Pengaju:</Label>
              <span class="font-medium truncate">{{
                (notification as any).tpr_sc_sender?.name ||
                notification.user_default?.name ||
                "N/A"
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">{{
                formatDateTime(notification.createdAt)
              }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Data Details Card -->
      <Card v-if="notification.t_purchase_request_subcon">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Request Subcon
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap data yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
          >
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                Unit Bisnis
              </Label>
              <p class="text-sm md:text-base">
                {{
                  (notification.t_purchase_request_subcon as any)?.m_unit_bisni
                    ?.nama_comp || "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                Tanggal PR Subcon
              </Label>
              <p class="text-sm md:text-base">
                {{
                  notification.t_purchase_request_subcon.tgl_pr_subcon
                    ? formatDate(
                        notification.t_purchase_request_subcon.tgl_pr_subcon,
                      )
                    : "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                Tanggal Dibutuhkan
              </Label>
              <p class="text-sm md:text-base">
                {{
                  notification.t_purchase_request_subcon.tgl_butuh
                    ? formatDate(
                        notification.t_purchase_request_subcon.tgl_butuh,
                      )
                    : "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                No. PR Subcon
              </Label>
              <p class="text-sm md:text-base font-semibold">
                {{ notification.t_purchase_request_subcon.no_pr_subcon || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                Gudang
              </Label>
              <p class="text-sm md:text-base">
                {{
                  (notification.t_purchase_request_subcon as any)?.m_gudang
                    ?.nama_gudang ||
                  notification.t_purchase_request_subcon.m_gudang_id ||
                  "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
              >
                Jenis PR Subcon
              </Label>
              <p class="text-sm md:text-base">
                {{
                  notification.t_purchase_request_subcon.jenis_pr_subcon?.value1 ||
                  "-"
                }}
              </p>
            </div>
           
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Status</Label
              >
              <div>
                <Badge
                  :variant="
                    getStatusVariant(
                      notification.t_purchase_request_subcon.status || 'default',
                    )
                  "
                  class="text-xs md:text-sm"
                >
                  {{ notification.t_purchase_request_subcon.status }}
                </Badge>
              </div>
            </div>
            <!-- Add more fields as needed -->
          </div>

          <!-- Catatan -->
          <div
            v-if="notification.t_purchase_request_subcon.catatan"
            class="space-y-2"
          >
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.t_purchase_request_subcon.catatan }}
              </p>
            </div>
          </div>

          <Tabs default-value="detail1" class="w-full">
            <TabsList
              class="w-full overflow-x-auto flex justify-start scrollbar-hide"
            >
              <TabsTrigger value="detail1">Detail Bahan</TabsTrigger>
              <TabsTrigger value="detail2">Detail Finish Goods</TabsTrigger>
              <TabsTrigger value="detail3">Detail Jasa</TabsTrigger>
            </TabsList>

            <TabsContent value="detail1" class="space-y-4 mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[980px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Material
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Free Stock
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Rak
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="bahanDetails.length === 0">
                      <td
                        colspan="8"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada detail bahan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in bahanDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ Number(idx) + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_material }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_free_stok }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ getRakLabel(detail) }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.catatan || "-" }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detail2" class="space-y-4 mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[900px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Item
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Free Stock
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="jadiDetails.length === 0">
                      <td
                        colspan="7"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada detail finish goods.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in jadiDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ Number(idx) + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_free_stok }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.catatan || "-" }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detail3" class="space-y-4 mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[820px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Jasa
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Manual
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="jasaDetails.length === 0">
                      <td
                        colspan="7"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada detail jasa.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in jasaDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ Number(idx) + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_jasa }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.is_manual ? "-" : detail.qty }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.is_manual ? "Ya" : "Tidak" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.catatan || "-" }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <!-- Approval Info Card -->
      <Card v-if="notification.menu_info">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <AlertCircle class="h-5 w-5 shrink-0" />
            Informasi Approval
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4 bg-primary/10 dark:bg-primary/10 rounded-md"
          >
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Nama Approval</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{ notification.menu_info.approval_name }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Level</Label
              >
              <Badge variant="outline" class="text-xs"
                >Level {{ notification.menu_info.level }}</Badge
              >
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Menu</Label
              >
              <p class="text-sm md:text-base">
                {{ notification.menu_info.menu_name }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Path</Label
              >
              <p class="text-xs text-muted-foreground font-mono break-all">
                {{ notification.menu_info.menu_path }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Approval Section -->
      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Berikan keputusan Anda untuk Purchase Request Subcon
            ini</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            hints="Catatan ini wajib diisi"
            :rows="3"
            :disabled="submitting"
            :required="true"
          />

          <div
            class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-end pt-2 md:pt-4"
          >
            <Button
              @click="handleReject"
              variant="outline"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Ban class="h-4 w-4" />
              Reject
            </Button>
            <Button
              @click="() => handleApproval('REVISI')"
              variant="destructive"
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto"
            >
              <X class="h-4 w-4" />
              Revisi
            </Button>
            <Button
              @click="() => handleApproval('APPROVED')"
              variant='default'
              :disabled="submitting"
              class="gap-2 w-full sm:w-auto"
            >
              <Check class="h-4 w-4" />
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Already Processed -->
      <Card v-else class="border-primary/30 bg-primary/10">
        <CardContent class="py-4 md:py-6">
          <div
            class="flex items-center justify-center gap-2 md:gap-3 text-primary"
          >
            <Check class="h-5 w-5 md:h-6 md:w-6" />
            <span class="text-sm md:text-lg font-medium"
              >Notifikasi ini sudah diproses</span
            >
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- File Preview Dialog -->
    <Dialog :open="showPreviewDialog" @update:open="showPreviewDialog = $event">
      <DialogContent
        class="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader class="p-3 md:p-4 border-b shrink-0">
          <DialogTitle class="flex items-center gap-2 md:gap-3">
            <span class="truncate flex-1 text-xs md:text-sm">{{
              previewFileName
            }}</span>
            <div class="flex items-center gap-1 md:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                class="gap-1 h-7 md:h-8 px-2"
                @click="openPreviewInNewTab"
              >
                <ExternalLink class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Buka</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="gap-1 h-7 md:h-8 px-2"
                @click="downloadPreviewFile"
              >
                <Download class="h-3 w-3" />
                <span class="hidden sm:inline text-xs">Unduh</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div
          class="flex-1 p-2 md:p-4 flex items-center justify-center bg-muted/50 overflow-auto min-h-0"
        >
          <img
            :src="previewImageUrl"
            :alt="previewFileName"
            class="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
