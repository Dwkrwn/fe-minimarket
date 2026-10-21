<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  FileX2,
  User,
  FileText,
  AlertCircle,
  Calendar,
  Ban,
  Package,
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
import { toast } from "vue-sonner";
import {
  getTPurchaseRequestCloseNotifications,
  approveTPurchaseRequestClose,
  reviseTPurchaseRequestClose,
  rejectTPurchaseRequestClose,
  type TPurchaseRequestCloseNotification,
} from "./service.purchase_request_close";
import { useAuthStore } from "@/stores/auth";
import FieldX from "@/components/field/FieldX.vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<TPurchaseRequestCloseNotification | null>(null);
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
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// Helper to get flat item data
const getItemData = (item: any) => {
  return {
    kode_item: item.kode_item || item.m_item?.kode_item || "-",
    nama_item: item.nama_item || item.m_item?.nama_item || "N/A",
    qty_prc: item.qty_prc || item.qty_close || 0,
    satuan: item.satuan || "PCS",
  };
};

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getTPurchaseRequestCloseNotifications(1, 100);
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
        a.path === "/purchasing/transaksi/t_purchase_request_close" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk menyetujui Purchase Request Close",
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
      await reviseTPurchaseRequestClose(
        notification.value.t_purchase_request_close_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approveTPurchaseRequestClose(
        notification.value.t_purchase_request_close_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Purchase Request Close ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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
        a.path === "/purchasing/transaksi/t_purchase_request_close" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk reject Purchase Request Close",
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

    await rejectTPurchaseRequestClose(
      notification.value.t_purchase_request_close_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Purchase Request Close berhasil di-reject");
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
          <FileX2 class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Purchase Request Close Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Request Close
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
                notification.tprc_sender?.name ||
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

      <!-- Purchase Request Close Details Card -->
      <Card v-if="notification.t_purchase_request_close">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Request Close
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap PR Close yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. PR Close</Label
              >
              <p class="text-base md:text-lg font-bold text-primary break-all">
                {{ notification.t_purchase_request_close.no_preq_close || "-" }}
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
                      notification.t_purchase_request_close.status,
                    )
                  "
                  class="text-xs md:text-sm"
                >
                  {{ notification.t_purchase_request_close.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1"
              >
                <Calendar class="h-3 w-3" />
                Tanggal Close
              </Label>
              <p class="text-sm md:text-base">
                {{
                  formatDate(notification.t_purchase_request_close.tgl_close)
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Unit Bisnis</Label
              >
              <p class="text-sm md:text-base">
                {{
                  notification.t_purchase_request_close.m_unit_bisni
                    ?.nama_comp || "-"
                }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Reference PR Info -->
          <div
            class="space-y-3"
            v-if="notification.t_purchase_request_close.t_purchase_request"
          >
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <FileText class="h-4 w-4" />
              Referensi Purchase Request
            </h4>
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 md:p-4 bg-muted/50 rounded-md"
            >
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >No. PR</Label
                >
                <p class="text-sm md:text-base font-medium">
                  {{
                    notification.t_purchase_request_close.t_purchase_request
                      .no_pr || "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Tanggal PR</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    formatDate(
                      notification.t_purchase_request_close.t_purchase_request
                        .tgl_pr,
                    )
                  }}
                </p>
              </div>
              <div
                class="space-y-1"
                v-if="
                  notification.t_purchase_request_close.t_purchase_request
                    .req_user_by
                "
              >
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Request By</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    notification.t_purchase_request_close.t_purchase_request
                      .req_user_by
                  }}
                </p>
              </div>
            </div>
          </div>

          <!-- Alasan Close -->
          <div
            v-if="notification.t_purchase_request_close.alasan"
            class="space-y-2"
          >
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Alasan Close</Label>
            <div
              class="p-3 md:p-4 bg-destructive/10 rounded-md border border-destructive/20"
            >
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.t_purchase_request_close.alasan }}
              </p>
            </div>
          </div>

          <!-- Catatan -->
          <div
            v-if="notification.t_purchase_request_close.catatan"
            class="space-y-2"
          >
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.t_purchase_request_close.catatan }}
              </p>
            </div>
          </div>

          <!-- Creator Info -->
          <div
            class="space-y-3"
            v-if="notification.t_purchase_request_close.prqc_ctr"
          >
            <Separator />
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <User class="h-4 w-4" />
              Informasi Pembuat
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Dibuat Oleh</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.t_purchase_request_close.prqc_ctr.name }}
                </p>
              </div>
              <div
                class="space-y-1"
                v-if="notification.t_purchase_request_close.createdAt"
              >
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Tanggal Dibuat</Label
                >
                <p class="text-sm md:text-base">
                  {{
                    formatDateTime(
                      notification.t_purchase_request_close.createdAt,
                    )
                  }}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Items Tab (if any) -->
      <Tabs
        default-value="items"
        class="w-full"
        v-if="
          notification.t_purchase_request_close?.t_purchase_request_close_ds
            ?.length
        "
      >
        <TabsList class="w-full grid grid-cols-1 h-auto">
          <TabsTrigger
            value="items"
            class="gap-1 md:gap-2 text-xs md:text-sm py-2"
          >
            <Package class="h-3 w-3 md:h-4 md:w-4" />
            Items ({{
              notification.t_purchase_request_close.t_purchase_request_close_ds
                .length
            }})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" class="mt-4">
          <Card>
            <CardHeader class="p-4 md:p-6">
              <CardTitle class="text-base md:text-lg flex items-center gap-2">
                <Package class="h-5 w-5 shrink-0" />
                Detail Items Close
              </CardTitle>
              <CardDescription class="text-xs md:text-sm"
                >Daftar item yang akan di-close</CardDescription
              >
            </CardHeader>
            <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
              <!-- Mobile View -->
              <div class="md:hidden space-y-3">
                <Card
                  v-for="(item, idx) in notification.t_purchase_request_close
                    .t_purchase_request_close_ds"
                  :key="item.id"
                  class="p-3"
                >
                  <div class="flex justify-between items-start gap-2 mb-2">
                    <span class="text-xs font-medium text-muted-foreground"
                      >#{{ idx + 1 }}</span
                    >
                    <Badge variant="secondary" class="text-xs"
                      >{{ getItemData(item).qty_prc }}
                      {{ getItemData(item).satuan }}</Badge
                    >
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-medium">
                      {{ getItemData(item).nama_item }}
                    </p>
                    <p class="text-xs text-muted-foreground font-mono">
                      {{ getItemData(item).kode_item }}
                    </p>
                    <p
                      v-if="item.catatan"
                      class="text-xs text-muted-foreground mt-1"
                    >
                      {{ item.catatan }}
                    </p>
                  </div>
                </Card>
              </div>

              <!-- Desktop View -->
              <div class="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">#</TableHead>
                      <TableHead>Kode Item</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead class="text-right">Qty PR Close</TableHead>
                      <TableHead class="text-center">Satuan</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="(item, idx) in notification
                        .t_purchase_request_close.t_purchase_request_close_ds"
                      :key="item.id"
                    >
                      <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                      <TableCell class="font-mono text-xs">{{
                        getItemData(item).kode_item
                      }}</TableCell>
                      <TableCell>{{ getItemData(item).nama_item }}</TableCell>
                      <TableCell class="text-right font-medium">{{
                        getItemData(item).qty_prc
                      }}</TableCell>
                      <TableCell class="text-center">{{
                        getItemData(item).satuan
                      }}</TableCell>
                      <TableCell class="text-muted-foreground">{{
                        item.catatan || "-"
                      }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
            >Berikan keputusan Anda untuk PR Close ini</CardDescription
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
