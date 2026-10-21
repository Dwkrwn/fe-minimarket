<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  User,
  FileText,
  AlertCircle,
  Calendar,
  Ban,
  ArrowRightLeft,
  Warehouse,
  Boxes,
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
import { toast } from "vue-sonner";
import {
  getTransferGudangNotifications,
  approveTransferGudangNotification,
  reviseTransferGudangNotification,
  rejectTransferGudangNotification,
  type TransferGudangNotification,
} from "./service.transfer_gudang";
import {
  getTransferGudangById,
  type TransferGudangItem,
  type TransferGudangDetailItem,
} from "@/views/inventory/transaksi/t_transfer_gudang/service";
import { useAuthStore } from "@/stores/auth";
import FieldX from "@/components/field/FieldX.vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<TransferGudangNotification | null>(null);
const approvalCatatan = ref("");

// Transfer Gudang full data
const transferGudangData = ref<TransferGudangItem | null>(null);
const detailItems = ref<TransferGudangDetailItem[]>([]);
const loadingDetails = ref(false);

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
    case "POST":
      return "secondary";
    default:
      return "secondary";
  }
};

const getSenderName = (notif: TransferGudangNotification) => {
  const row = notif as any;
  return (
    row.ttransfer_sender?.name ||
    row.tw_sender?.name ||
    notif.user_default?.name ||
    "N/A"
  );
};

const normalizedDetails = computed(() => {
  if (!transferGudangData.value) return [];
  const raw = Array.isArray(transferGudangData.value.t_transfer_gudang_ds)
    ? transferGudangData.value.t_transfer_gudang_ds
    : Array.isArray((transferGudangData.value as any).t_transfer_gudang_d)
      ? (transferGudangData.value as any).t_transfer_gudang_d
      : [];

  return raw as TransferGudangDetailItem[];
});

const getItemCode = (item: TransferGudangDetailItem) => {
  const row = item as any;
  return (
    item.m_item?.kode_item ||
    row.m_items?.kode_item ||
    row.item_transfer?.kode_item ||
    "-"
  );
};

const getItemName = (item: TransferGudangDetailItem) => {
  const row = item as any;
  return (
    item.m_item?.nama_item ||
    row.m_items?.nama_item ||
    row.item_transfer?.nama_item ||
    "-"
  );
};

const getRackAsal = (item: TransferGudangDetailItem) => {
  const row = item as any;
  return item.rak_asal?.nama_rak || row.m_rak?.nama_rak || "-";
};

const getRackAsalDetail = (item: TransferGudangDetailItem) => {
  const row = item as any;
  return item.rak_asal_d?.kode || row.m_rak_d?.kode || "-";
};

const getRackTujuan = (item: TransferGudangDetailItem) => {
  const row = item as any;
  if (item.rak_tujuan_rel?.nama_rak) return item.rak_tujuan_rel.nama_rak;
  if (typeof row.rak_tujuan === "object" && row.rak_tujuan?.nama_rak) {
    return row.rak_tujuan.nama_rak;
  }
  return row.nama_rak_tujuan || "-";
};

const getRackTujuanDetail = (item: TransferGudangDetailItem) => {
  const row = item as any;
  if (item.rak_tujuan_d?.kode) return item.rak_tujuan_d.kode;
  if (typeof row.rak_tujuan_d === "object" && row.rak_tujuan_d?.kode) {
    return row.rak_tujuan_d.kode;
  }
  return row.kode_rak_tujuan_d || "-";
};

const showRackTujuanColumns = computed(() => {
  const data = transferGudangData.value as any;
  if (!data) return true;

  const transferType = String(data.type || "").toLowerCase();
  if (transferType !== "langsung") return true;

  const sourceWarehouseId = String(
    data.warehouse_asal_id || data.warehouse_asal?.id || "",
  );
  const targetWarehouseId = String(
    data.warehouse_tujuan_id || data.warehouse_tujuan?.id || "",
  );

  if (!sourceWarehouseId || !targetWarehouseId) return true;
  return sourceWarehouseId === targetWarehouseId;
});

const fetchTransferGudangDetails = async (transferGudangId: string) => {
  try {
    loadingDetails.value = true;
    const response = await getTransferGudangById(transferGudangId);
    if (response.status === "success" && response.data) {
      transferGudangData.value = response.data;
      detailItems.value = normalizedDetails.value;
    }
  } catch (error) {
    console.error("Failed to fetch Transfer Gudang details:", error);
  } finally {
    loadingDetails.value = false;
  }
};

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getTransferGudangNotifications(1, 100);
    const found = response.data.find((n) => n.id === notificationId.value);

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    notification.value = found;
    approvalCatatan.value = found.approval_catatan || "";

    if (found.t_transfer_gudang_id) {
      await fetchTransferGudangDetails(found.t_transfer_gudang_id);
    }
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
  if (!notification.value || !notification.value.t_transfer_gudang_id) return;

  if (status === "REVISI" && !approvalCatatan.value?.trim()) {
    toast.error("Alasan Revisi wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan revisi",
    });
    return;
  }

  submitting.value = true;
  try {
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (a: any) =>
        a.path === "/inventory/transaksi/t_transfer_gudang" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description: "Anda tidak memiliki hak untuk menyetujui Transfer Gudang",
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
      await reviseTransferGudangNotification(
        notification.value.t_transfer_gudang_id,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approveTransferGudangNotification(
        notification.value.t_transfer_gudang_id,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Transfer Gudang ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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
  if (!notification.value || !notification.value.t_transfer_gudang_id) return;

  if (!approvalCatatan.value?.trim()) {
    toast.error("Alasan Reject wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan reject",
    });
    return;
  }

  submitting.value = true;
  try {
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (a: any) =>
        a.path === "/inventory/transaksi/t_transfer_gudang" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description: "Anda tidak memiliki hak untuk reject Transfer Gudang",
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

    await rejectTransferGudangNotification(
      notification.value.t_transfer_gudang_id,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Transfer Gudang berhasil di-reject");
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Gagal reject", {
      description: error.message || "Terjadi kesalahan",
    });
  } finally {
    submitting.value = false;
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
          <ArrowRightLeft class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Transfer Gudang Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Transfer Gudang request
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
                getSenderName(notification)
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

      <!-- Transfer Gudang Details Card -->
      <Card v-if="transferGudangData">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Transfer Gudang
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap data yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. Transfer</Label
              >
              <p class="text-base md:text-lg font-bold text-primary font-mono">
                {{ transferGudangData.no_tw || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Status</Label
              >
              <div>
                <Badge
                  :variant="getStatusVariant(transferGudangData.status)"
                  class="text-xs md:text-sm"
                >
                  {{ transferGudangData.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tanggal Transfer</Label
              >
              <p class="text-sm md:text-base flex items-center gap-2">
                <Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
                {{
                  transferGudangData.tgl_tw
                    ? formatDate(transferGudangData.tgl_tw)
                    : "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Type Transfer</Label
              >
              <p class="text-sm md:text-base">
                {{ transferGudangData.type || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Perusahaan</Label
              >
              <p class="text-sm md:text-base">
                {{
                  transferGudangData.m_unit_bisni?.nama_comp ||
                  transferGudangData.m_unit_bisnis?.nama_comp ||
                  "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >PIC</Label
              >
              <p class="text-sm md:text-base flex items-center gap-2">
                <User class="h-4 w-4 text-muted-foreground shrink-0" />
                {{
                  transferGudangData.pic?.nama_kary ||
                  transferGudangData.m_kary?.nama_kary ||
                  "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Gudang Asal</Label
              >
              <p class="text-sm md:text-base flex items-center gap-2">
                <Warehouse class="h-4 w-4 text-muted-foreground shrink-0" />
                {{ transferGudangData.warehouse_asal?.nama_gudang || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Gudang Tujuan</Label
              >
              <p class="text-sm md:text-base flex items-center gap-2">
                <Warehouse class="h-4 w-4 text-muted-foreground shrink-0" />
                {{ transferGudangData.warehouse_tujuan?.nama_gudang || "-" }}
              </p>
            </div>
          </div>

          <div v-if="transferGudangData.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold"
              >Catatan Transfer Gudang</Label
            >
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ transferGudangData.catatan }}
              </p>
            </div>
          </div>

          <Separator />

          <div class="space-y-3">
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <Boxes class="h-4 w-4" />
              Detail Barang ({{ normalizedDetails.length }} item)
            </h4>

            <div v-if="loadingDetails" class="space-y-2">
              <Skeleton class="h-8 w-full" />
              <Skeleton class="h-8 w-full" />
              <Skeleton class="h-8 w-full" />
            </div>

            <div
              v-else-if="normalizedDetails.length > 0"
              class="border rounded-md overflow-auto"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12 text-center">No</TableHead>
                    <TableHead>Kode Barang</TableHead>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead>Rak Asal</TableHead>
                    <TableHead>Rak Asal Detail</TableHead>
                    <TableHead v-if="showRackTujuanColumns"
                      >Rak Tujuan</TableHead
                    >
                    <TableHead v-if="showRackTujuanColumns"
                      >Rak Tujuan Detail</TableHead
                    >
                    <TableHead class="text-center">Qty</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(item, index) in normalizedDetails"
                    :key="item.id || index"
                  >
                    <TableCell class="text-center">{{ index + 1 }}</TableCell>
                    <TableCell class="font-mono text-xs md:text-sm">
                      {{ getItemCode(item) }}
                    </TableCell>
                    <TableCell>
                      {{ getItemName(item) }}
                    </TableCell>
                    <TableCell>
                      {{ getRackAsal(item) }}
                    </TableCell>
                    <TableCell class="font-mono text-xs md:text-sm">
                      {{ getRackAsalDetail(item) }}
                    </TableCell>
                    <TableCell v-if="showRackTujuanColumns">
                      {{ getRackTujuan(item) }}
                    </TableCell>
                    <TableCell
                      v-if="showRackTujuanColumns"
                      class="font-mono text-xs md:text-sm"
                    >
                      {{ getRackTujuanDetail(item) }}
                    </TableCell>
                    <TableCell class="text-center font-medium">
                      {{ item.qty ?? 0 }}
                    </TableCell>
                    <TableCell
                      class="text-xs text-muted-foreground max-w-[180px] truncate"
                    >
                      {{ item.catatan || "-" }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div v-else class="text-center py-6 border rounded-md bg-muted/20">
              <Boxes class="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p class="text-sm text-muted-foreground">
                Tidak ada detail barang
              </p>
            </div>
          </div>
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
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4 bg-primary/10 rounded-md"
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
            >Berikan keputusan Anda untuk Transfer Gudang ini</CardDescription
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
  </div>
</template>
