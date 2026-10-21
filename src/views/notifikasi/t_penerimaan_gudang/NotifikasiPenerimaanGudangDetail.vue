<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  PackageCheck,
  User,
  FileText,
  Calendar,
  AlertCircle,
  Package,
  Paperclip,
  Download,
  Eye,
  ExternalLink,
  Ban,
  Truck,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "vue-sonner";
import {
  getPenerimaanGudangNotifications,
  revisePenerimaanGudang,
  approvePenerimaanGudang,
  rejectPenerimaanGudang,
  type PenerimaanGudangNotification,
} from "./service.penerimaan_gudang";
import { useApi } from "@/composables/useApi";
import FieldX from "@/components/field/FieldX.vue";

const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<PenerimaanGudangNotification | null>(null);
const approvalCatatan = ref("");

const notificationTitle = computed(() => {
  const noPenerimaanGudang =
    notification.value?.t_penerimaan_gudang?.no_penerimaan_gudang;
  if (noPenerimaanGudang)
    return `Request Approval Penerimaan Gudang: ${noPenerimaanGudang}`;
  return notification.value?.title || "Request Approval Penerimaan Gudang";
});

// Preview image dialog
const showPreviewDialog = ref(false);
const previewImageUrl = ref("");
const previewFileName = ref("");

const notificationId = computed(() => route.params.id as string);

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

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getPenerimaanGudangNotifications(1, 100);
    const found = response.data.find((n) => n.id === notificationId.value);

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    notification.value = found;
    approvalCatatan.value = found.approval_catatan || "";
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
    // Ambil approval_level langsung dari notifikasi — tidak perlu cek m_approval config
    const approvalLevel = notification.value.approval_level;

    if (status === "REVISI") {
      await revisePenerimaanGudang(
        notification.value.t_penerimaan_gudang_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      const result = await approvePenerimaanGudang(
        notification.value.t_penerimaan_gudang_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );

      // Show stock sync result from backend (sudah dilakukan di backend saat approve)
      if (result?.data?.stock_sync) {
        const stockInfo = result.data.stock_sync;
        toast.success(
          `Stock berhasil ditambahkan: ${stockInfo.items_processed} item ke gudang penerimaan`,
          {
            duration: 5000,
          },
        );
      }
    }

    toast.success(
      `Penerimaan Gudang ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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
    // Ambil approval_level langsung dari notifikasi — tidak perlu cek m_approval config
    const approvalLevel = notification.value.approval_level;

    await rejectPenerimaanGudang(
      notification.value.t_penerimaan_gudang_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Penerimaan Gudang berhasil di-reject");
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Gagal reject", {
      description: error.message || "Terjadi kesalahan",
    });
  } finally {
    submitting.value = false;
  }
};

// Get status badge variant
const getStatusVariant = (status: string) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "default";
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

// File helpers
const getFileUrl = (path: string) => {
  if (!path) return "";
  const baseUrl = API_BASE_URL.replace("/api", "");
  return `${baseUrl}/${path}`;
};

const getFileName = (path: string) => {
  if (!path) return "Unknown file";
  return path.split("/").pop() || path;
};

// Check if file is an image
const isImageFile = (path: string) => {
  if (!path) return false;
  const ext = path.toLowerCase().split(".").pop();
  return ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg"].includes(
    ext || "",
  );
};

// Check if file is PDF
const isPdfFile = (path: string) => {
  if (!path) return false;
  return path.toLowerCase().endsWith(".pdf");
};

const openFile = (path: string) => {
  if (!path) return;
  const url = getFileUrl(path);

  // If it's an image, show in preview dialog
  if (isImageFile(path)) {
    previewImageUrl.value = url;
    previewFileName.value = getFileName(path);
    showPreviewDialog.value = true;
  } else {
    // For PDF and other files, open in new tab
    window.open(url, "_blank");
  }
};

const openPreviewInNewTab = () => {
  window.open(previewImageUrl.value, "_blank");
};

const downloadPreviewImage = () => {
  const link = document.createElement("a");
  link.href = previewImageUrl.value;
  link.download = previewFileName.value;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadFile = (path: string) => {
  if (!path) return;
  const url = getFileUrl(path);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFileName(path);
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
          <PackageCheck class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Penerimaan Gudang Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve penerimaan gudang
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
                <span class="wrap-break-word">{{ notificationTitle }}</span>
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
                notification.tpen_gudang_send?.name || "N/A"
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

      <!-- Penerimaan Gudang Details Card -->
      <Card v-if="notification.t_penerimaan_gudang">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Penerimaan Gudang
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap Penerimaan Gudang yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. Penerimaan Gudang</Label
              >
              <p class="text-base md:text-lg font-bold text-primary break-all">
                {{
                  notification.t_penerimaan_gudang.no_penerimaan_gudang || "-"
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
                    getStatusVariant(notification.t_penerimaan_gudang.status)
                  "
                  >{{ notification.t_penerimaan_gudang.status }}</Badge
                >
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tanggal Penerimaan</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{
                  formatDate(
                    notification.t_penerimaan_gudang.tgl_penerimaan_gudang,
                  )
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Unit Bisnis</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{
                  notification.t_penerimaan_gudang.m_unit_bisni?.nama_comp ||
                  "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >PIC Penerima</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{
                  notification.t_penerimaan_gudang.pic_penerima_gudang
                    ?.nama_kary || "-"
                }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Gudang Asal & Gudang Penerimaan -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Gudang Asal</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{
                  notification.t_penerimaan_gudang.surat_jalan_gudang?.sj_gd_asl
                    ?.nama_gudang || "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Gudang Penerimaan</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{
                  notification.t_penerimaan_gudang.surat_jalan_gudang?.sj_gd_trm
                    ?.nama_gudang || "-"
                }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Surat Jalan Info -->
          <div
            v-if="notification.t_penerimaan_gudang.surat_jalan_gudang"
            class="space-y-4"
          >
            <Label
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <Truck class="h-4 w-4" />
              Informasi Surat Jalan Gudang
            </Label>
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-md"
            >
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >No. Surat Jalan</Label
                >
                <p class="text-sm md:text-base font-medium">
                  {{
                    notification.t_penerimaan_gudang.surat_jalan_gudang
                      .no_sj_gudang || "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Tipe</Label
                >
                <Badge variant="outline">{{
                  notification.t_penerimaan_gudang.surat_jalan_gudang
                    .tipe_sj_gudang || "-"
                }}</Badge>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Tanggal</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    formatDate(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .tgl_sj_gudang,
                    )
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Status</Label
                >
                <Badge
                  :variant="
                    getStatusVariant(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .status,
                    )
                  "
                >
                  {{
                    notification.t_penerimaan_gudang.surat_jalan_gudang.status
                  }}
                </Badge>
              </div>
              <div
                v-if="notification.t_penerimaan_gudang.surat_jalan_gudang.supir"
                class="space-y-1"
              >
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Supir</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    notification.t_penerimaan_gudang.surat_jalan_gudang.supir
                  }}
                </p>
              </div>
              <div
                v-if="
                  notification.t_penerimaan_gudang.surat_jalan_gudang.no_resi
                "
                class="space-y-1"
              >
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >No. Resi</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    notification.t_penerimaan_gudang.surat_jalan_gudang.no_resi
                  }}
                </p>
              </div>
            </div>

            <!-- Bukti Foto Surat Jalan -->
            <div
              v-if="
                notification.t_penerimaan_gudang.surat_jalan_gudang.bukti_foto
              "
              class="space-y-2"
            >
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Bukti Foto</Label
              >
              <div class="border rounded-lg overflow-hidden bg-muted/20">
                <img
                  :src="
                    getFileUrl(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .bukti_foto,
                    )
                  "
                  :alt="'Bukti Foto SJ Gudang'"
                  class="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  @click="
                    openFile(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .bukti_foto!,
                    )
                  "
                />
              </div>
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-2"
                  @click="
                    openFile(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .bukti_foto!,
                    )
                  "
                >
                  <ExternalLink class="h-4 w-4" />
                  Buka di Tab Baru
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-2"
                  @click="
                    downloadFile(
                      notification.t_penerimaan_gudang.surat_jalan_gudang
                        .bukti_foto!,
                    )
                  "
                >
                  <Download class="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div
            v-if="notification.t_penerimaan_gudang.catatan"
            class="space-y-2"
          >
            <Separator />
            <Label class="text-xs md:text-sm font-semibold"
              >Catatan Penerimaan Gudang</Label
            >
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base">
                {{ notification.t_penerimaan_gudang.catatan }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Tabs: Items -->
      <Tabs
        default-value="items"
        class="w-full"
        v-if="notification.t_penerimaan_gudang"
      >
        <TabsList class="w-full h-auto">
          <TabsTrigger
            value="items"
            class="gap-1 md:gap-2 text-xs md:text-sm py-2"
          >
            <Package class="h-3 w-3 md:h-4 md:w-4" />
            <span class="hidden xs:inline">Items</span> ({{
              notification.t_penerimaan_gudang.t_penerimaan_gudang_ds?.length ||
              0
            }})
          </TabsTrigger>
          <TabsTrigger
            v-if="
              notification.t_penerimaan_gudang.t_penerimaan_gudang_lampirans
                ?.length
            "
            value="lampiran"
            class="gap-1 md:gap-2 text-xs md:text-sm py-2"
          >
            <Paperclip class="h-3 w-3 md:h-4 md:w-4" />
            <span class="hidden xs:inline">Lampiran</span> ({{
              notification.t_penerimaan_gudang.t_penerimaan_gudang_lampirans
                ?.length || 0
            }})
          </TabsTrigger>
        </TabsList>

        <!-- TAB: DETAIL ITEMS -->
        <TabsContent value="items" class="mt-4">
          <Card>
            <CardHeader class="p-4 md:p-6">
              <CardTitle class="text-base md:text-lg flex items-center gap-2">
                <Package class="h-5 w-5 shrink-0" />
                Detail Items
              </CardTitle>
              <CardDescription class="text-xs md:text-sm">
                Daftar item yang diterima ({{
                  notification.t_penerimaan_gudang.t_penerimaan_gudang_ds
                    ?.length || 0
                }}
                items)
              </CardDescription>
            </CardHeader>
            <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
              <div
                v-if="
                  notification.t_penerimaan_gudang.t_penerimaan_gudang_ds &&
                  notification.t_penerimaan_gudang.t_penerimaan_gudang_ds
                    .length > 0
                "
                class="overflow-x-auto -mx-4 md:-mx-6"
              >
                <div class="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow class="bg-muted/50">
                        <TableHead class="min-w-[50px] text-center"
                          >No</TableHead
                        >
                        <TableHead class="min-w-[120px]">Kode Item</TableHead>
                        <TableHead class="min-w-[200px]">Nama Item</TableHead>
                        <TableHead class="min-w-[100px] text-center"
                          >Qty SJ</TableHead
                        >
                        <TableHead class="min-w-[100px] text-center"
                          >Qty Diterima</TableHead
                        >
                        <TableHead class="min-w-[100px] text-center"
                          >Qty Sisa</TableHead
                        >
                        <TableHead class="min-w-[200px]">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow
                        v-for="(item, index) in notification.t_penerimaan_gudang
                          .t_penerimaan_gudang_ds"
                        :key="item.id"
                        class="hover:bg-muted/30"
                      >
                        <TableCell class="text-center font-medium">{{
                          index + 1
                        }}</TableCell>
                        <TableCell class="font-mono text-xs">{{
                          item.m_item?.kode_item || "-"
                        }}</TableCell>
                        <TableCell>
                          <div class="font-medium">
                            {{ item.m_item?.nama_item || "-" }}
                          </div>
                          <div
                            v-if="item.m_item?.nama_singkat"
                            class="text-xs text-muted-foreground"
                          >
                            {{ item.m_item.nama_singkat }}
                          </div>
                        </TableCell>
                        <TableCell class="text-center">{{
                          item.detail_sj?.qty_sj_gud || 0
                        }}</TableCell>
                        <TableCell class="text-center font-bold text-primary">{{
                          item.qty_diterima
                        }}</TableCell>
                        <TableCell class="text-center">
                          <Badge
                            :variant="
                              item.qty_sisa > 0 ? 'destructive' : 'default'
                            "
                            >{{ item.qty_sisa }}</Badge
                          >
                        </TableCell>
                        <TableCell>
                          <div class="text-xs">{{ item.catatan || "-" }}</div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div v-else class="text-center py-8 text-muted-foreground">
                <Package class="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p class="text-sm">Tidak ada item</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB: LAMPIRAN -->
        <TabsContent
          value="lampiran"
          class="mt-4"
          v-if="
            notification.t_penerimaan_gudang.t_penerimaan_gudang_lampirans
              ?.length
          "
        >
          <Card>
            <CardHeader class="p-4 md:p-6">
              <CardTitle class="text-base md:text-lg flex items-center gap-2">
                <Paperclip class="h-5 w-5 shrink-0" />
                Lampiran
              </CardTitle>
              <CardDescription class="text-xs md:text-sm">
                File lampiran ({{
                  notification.t_penerimaan_gudang.t_penerimaan_gudang_lampirans
                    ?.length || 0
                }}
                files)
              </CardDescription>
            </CardHeader>
            <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div
                  v-for="lampiran in notification.t_penerimaan_gudang
                    .t_penerimaan_gudang_lampirans"
                  :key="lampiran.id"
                  class="border rounded-lg p-3 flex items-center gap-3"
                >
                  <div class="shrink-0">
                    <Paperclip class="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">
                      {{
                        lampiran.file_name || getFileName(lampiran.file_path)
                      }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ lampiran.file_type || "Unknown" }}
                    </p>
                  </div>
                  <div class="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      @click="openFile(lampiran.file_path)"
                      title="View"
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      @click="downloadFile(lampiran.file_path)"
                      title="Download"
                    >
                      <Download class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            >Berikan keputusan Anda</CardDescription
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
              variant="default"
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

    <!-- Image Preview Dialog -->
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
                @click="downloadPreviewImage"
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

<style scoped>
/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
