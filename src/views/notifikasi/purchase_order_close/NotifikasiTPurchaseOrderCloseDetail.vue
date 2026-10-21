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
  Building2,
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
  getTPurchaseOrderCloseNotifications,
  approveTPurchaseOrderClose,
  reviseTPurchaseOrderClose,
  rejectTPurchaseOrderClose,
  type TPurchaseOrderCloseNotification,
} from "./service.purchase_order_close";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import FieldX from "@/components/field/FieldX.vue";

const { API_BASE_URL } = useApi();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<TPurchaseOrderCloseNotification | null>(null);
const approvalCatatan = ref("");

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
    const response = await getTPurchaseOrderCloseNotifications(1, 100);
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
    // Get approval info from auth store
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/transaksi/t_purchase_order_close" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk menyetujui Purchase Order Close",
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
      await reviseTPurchaseOrderClose(
        notification.value.t_purchase_order_close_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approveTPurchaseOrderClose(
        notification.value.t_purchase_order_close_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Purchase Order Close ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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
        a.path === "/purchasing/transaksi/t_purchase_order_close" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk reject Purchase Order Close",
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

    await rejectTPurchaseOrderClose(
      notification.value.t_purchase_order_close_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Purchase Order Close berhasil di-reject");
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
          <span class="truncate">Purchase Order Close Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Order Close request
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
                notification.tpoc_sender?.name || "N/A"
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

      <!-- PO Close Info Card -->
      <Card v-if="notification.t_purchase_order_close">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Package class="h-5 w-5 shrink-0" />
            Informasi Purchase Order Close
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs font-medium text-muted-foreground"
                >No. PO Close</Label
              >
              <p class="text-base font-bold text-primary">
                {{ notification.t_purchase_order_close.no_po_close || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-medium text-muted-foreground"
                >Tanggal PO Close</Label
              >
              <div class="flex items-center gap-2">
                <Calendar class="h-4 w-4 text-muted-foreground" />
                <p class="text-sm">
                  {{
                    formatDate(notification.t_purchase_order_close.tgl_po_close)
                  }}
                </p>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-medium text-muted-foreground"
                >Company</Label
              >
              <div class="flex items-center gap-2">
                <Building2 class="h-4 w-4 text-muted-foreground" />
                <p class="text-sm">
                  {{
                    notification.t_purchase_order_close.m_unit_bisni
                      ?.nama_comp || "-"
                  }}
                </p>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-medium text-muted-foreground"
                >Status</Label
              >
              <div>
                <Badge
                  :variant="
                    getStatusVariant(notification.t_purchase_order_close.status)
                  "
                >
                  {{ notification.t_purchase_order_close.status }}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <!-- PO Info -->
          <div
            v-if="notification.t_purchase_order_close.t_purchase_order"
            class="space-y-3"
          >
            <Label class="text-sm font-semibold"
              >Informasi Purchase Order</Label
            >
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md"
            >
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >No. PO</Label
                >
                <p class="text-sm font-medium">
                  {{
                    notification.t_purchase_order_close.t_purchase_order
                      .no_po || "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Tanggal PO</Label
                >
                <p class="text-sm">
                  {{
                    formatDate(
                      notification.t_purchase_order_close.t_purchase_order
                        .tgl_po,
                    )
                  }}
                </p>
              </div>
              <div class="space-y-1 sm:col-span-2">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Supplier</Label
                >
                <p class="text-sm font-medium">
                  {{
                    notification.t_purchase_order_close.t_purchase_order
                      .m_supplier?.nama_supp || "-"
                  }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Alasan -->
          <div
            v-if="notification.t_purchase_order_close.alasan"
            class="space-y-2"
          >
            <Label class="text-sm font-semibold">Alasan Closing</Label>
            <div class="p-3 bg-muted rounded-md">
              <p class="text-sm whitespace-pre-wrap">
                {{ notification.t_purchase_order_close.alasan }}
              </p>
            </div>
          </div>

          <!-- Catatan -->
          <div
            v-if="notification.t_purchase_order_close.catatan"
            class="space-y-2"
          >
            <Label class="text-sm font-semibold">Catatan</Label>
            <div class="p-3 bg-muted rounded-md">
              <p class="text-sm whitespace-pre-wrap">
                {{ notification.t_purchase_order_close.catatan }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Items Card -->
      <Card
        v-if="
          notification.t_purchase_order_close?.t_purchase_order_close_ds?.length
        "
      >
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Detail Item Purchase Order Close
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Daftar item yang di-close ({{
              notification.t_purchase_order_close.t_purchase_order_close_ds
                .length
            }}
            item)
          </CardDescription>
        </CardHeader>
        <CardContent class="p-0 md:p-0">
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12 text-center">No</TableHead>
                  <TableHead class="min-w-[120px]">Kode Item</TableHead>
                  <TableHead class="min-w-[200px]">Nama Item</TableHead>
                  <TableHead class="text-right min-w-[100px]"
                    >Qty Close</TableHead
                  >
                  <TableHead class="min-w-[80px]">Satuan</TableHead>
                  <TableHead class="min-w-[150px]">Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="item in notification.t_purchase_order_close
                    .t_purchase_order_close_ds"
                  :key="item.id"
                >
                  <TableCell class="text-center font-medium">{{
                    item.no
                  }}</TableCell>
                  <TableCell class="font-mono text-xs">{{
                    item.kode_item
                  }}</TableCell>
                  <TableCell>{{ item.nama_item }}</TableCell>
                  <TableCell class="text-right font-medium">{{
                    item.qty_close?.toLocaleString("id-ID")
                  }}</TableCell>
                  <TableCell>
                    <Badge variant="outline" class="text-xs">{{
                      item.nama_satuan
                    }}</Badge>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{
                    item.catatan || "-"
                  }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
            >Berikan keputusan Anda untuk Purchase Order Close
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
