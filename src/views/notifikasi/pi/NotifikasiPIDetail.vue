<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  FileText,
  User,
  Calendar,
  AlertCircle,
  Ban,
  Building,
  Package,
  DollarSign,
  Truck,
  ShoppingCart,
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
import { toast } from "vue-sonner";
import {
  getPurchaseInvoiceNotifications,
  revisePurchaseInvoice,
  approvePurchaseInvoice,
  rejectPurchaseInvoice,
  type PINotification,
} from "./service.pi";
import { useAuthStore } from "@/stores/auth";
import { finalizeNotificationAction } from "@/lib/notificationState";
import FieldX from "@/components/field/FieldX.vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<PINotification | null>(null);
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

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "Rp 0";
  return `Rp ${Number(value).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Detail items dari t_purchase_invoice_ds (atau fallback ke t_purchase_invoice_d)
const detailItems = computed(() => {
  const pi = notification.value?.t_purchase_invoice;
  return pi?.t_purchase_invoice_ds ??  [];
});

const fmtNum = (v: any, dec = 2) =>
  Number(v || 0).toLocaleString('id-ID', { minimumFractionDigits: dec });

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getPurchaseInvoiceNotifications(1, 100);
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
    // Get approval info from localStorage
    const approvalList = authStore.getApprovalList();
    const piApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/transaksi/t_purchase_invoice" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!piApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk menyetujui Purchase Invoice",
      });
      return;
    }

    const approvalLevel = piApproval.level;

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error("Invalid approval level", {
        description: "Approval level is missing",
      });
      return;
    }

    if (status === "REVISI") {
      await revisePurchaseInvoice(
        notification.value.t_purchase_invoice_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approvePurchaseInvoice(
        notification.value.t_purchase_invoice_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    finalizeNotificationAction(notification.value.id);
    toast.success(
      `Purchase Invoice ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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
    // Get approval info from localStorage
    const approvalList = authStore.getApprovalList();
    const piApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/transaksi/t_purchase_invoice" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!piApproval) {
      toast.error("Approval level not found", {
        description: "Anda tidak memiliki hak untuk reject Purchase Invoice",
      });
      return;
    }

    const approvalLevel = piApproval.level;

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error("Invalid approval level", {
        description: "Approval level is missing",
      });
      return;
    }

    await rejectPurchaseInvoice(
      notification.value.t_purchase_invoice_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    finalizeNotificationAction(notification.value.id);
    toast.success("Purchase Invoice berhasil di-reject");
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
          <FileText class="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <span class="truncate">Purchase Invoice Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve purchase invoice
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
                notification.tpi_sender?.name || "N/A"
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

      <!-- Purchase Invoice Details Card -->
      <Card v-if="notification.t_purchase_invoice">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Invoice
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap Purchase Invoice yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          >
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. PI</Label
              >
              <p class="text-base md:text-lg font-bold text-primary break-all">
                {{ notification.t_purchase_invoice.no_pi || "-" }}
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
                    getStatusVariant(notification.t_purchase_invoice.status)
                  "
                  class="text-xs md:text-sm"
                >
                  {{ notification.t_purchase_invoice.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1"
              >
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal PI
              </Label>
              <p class="text-sm md:text-base">
                {{ formatDate(notification.t_purchase_invoice.tgl_pi) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1"
              >
                <Calendar class="h-3 w-3 md:h-4 md:w-4" />
                Tanggal Jatuh Tempo
              </Label>
              <p class="text-sm md:text-base">
                {{
                  formatDate(notification.t_purchase_invoice.tgl_jatuh_tempo)
                }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Unit Bisnis Info -->
          <div
            v-if="notification.t_purchase_invoice.m_unit_bisnis"
            class="space-y-3"
          >
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <Building class="h-4 w-4" />
              Unit Bisnis
            </h4>
            <div class="p-3 md:p-4 bg-muted/50 rounded-md">
              <p class="text-sm md:text-base font-medium">
                {{ notification.t_purchase_invoice.m_unit_bisnis.nama_comp }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Supplier Info -->
          <div
            v-if="notification.t_purchase_invoice.m_supplier"
            class="space-y-3"
          >
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <Truck class="h-4 w-4" />
              Informasi Supplier
            </h4>
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 md:p-4 bg-muted/50 rounded-md"
            >
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Kode Supplier</Label
                >
                <p class="text-sm font-medium">
                  {{ notification.t_purchase_invoice.m_supplier.kode_supplier }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Nama Supplier</Label
                >
                <p class="text-sm font-bold text-primary">
                  {{ notification.t_purchase_invoice.m_supplier.nama_supp }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Alamat</Label
                >
                <p class="text-sm">
                  {{
                    notification.t_purchase_invoice.m_supplier.alamat_supp ||
                    "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Email</Label
                >
                <p class="text-sm">
                  {{ notification.t_purchase_invoice.m_supplier.email || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Contact Person</Label
                >
                <p class="text-sm">
                  {{ notification.t_purchase_invoice.m_supplier.cp1 || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >No. Telp CP</Label
                >
                <p class="text-sm">
                  {{ notification.t_purchase_invoice.m_supplier.no_cp1 || "-" }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Currency Info -->
          <div class="space-y-3">
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <DollarSign class="h-4 w-4" />
              Informasi Mata Uang
            </h4>
            <div
              class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 md:p-4 bg-blue-50 dark:bg-blue-950/30 rounded-md"
            >
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Mata Uang</Label
                >
                <p class="text-sm font-medium">
                  {{
                    notification.t_purchase_invoice.m_currency?.nama_currency ||
                    "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Kurs/Rate</Label
                >
                <p class="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {{
                    formatCurrency(
                      notification.t_purchase_invoice.m_currency_d?.rate ||
                        notification.t_purchase_invoice.exchange_rate,
                    )
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Tanggal Mulai Rate</Label
                >
                <p class="text-sm">
                  {{
                    notification.t_purchase_invoice.m_currency_d?.tgl_mulai
                      ? formatDate(
                          notification.t_purchase_invoice.m_currency_d
                            .tgl_mulai,
                        )
                      : "-"
                  }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- PO Reference -->
          <div
            v-if="notification.t_purchase_invoice.t_purchase_order"
            class="space-y-3"
          >
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <ShoppingCart class="h-4 w-4" />
              Referensi Purchase Order
            </h4>
            <div
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 md:p-4 bg-green-50 dark:bg-green-950/30 rounded-md"
            >
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >No. PO</Label
                >
                <p class="text-sm font-bold text-green-600 dark:text-green-400">
                  {{ notification.t_purchase_invoice.t_purchase_order.no_po }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Tanggal PO</Label
                >
                <p class="text-sm">
                  {{
                    notification.t_purchase_invoice.t_purchase_order.tgl_po
                      ? formatDate(
                          notification.t_purchase_invoice.t_purchase_order
                            .tgl_po,
                        )
                      : "-"
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Status PO</Label
                >
                <Badge variant="outline" class="text-xs">{{
                  notification.t_purchase_invoice.t_purchase_order.status
                }}</Badge>
              </div>
              <div class="space-y-1">
                <Label class="text-xs font-medium text-muted-foreground"
                  >Status Transaksi</Label
                >
                <Badge variant="secondary" class="text-xs">{{
                  notification.t_purchase_invoice.t_purchase_order
                    .status_transaksi
                }}</Badge>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Financial Info -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold flex items-center gap-2">
              <FileText class="h-4 w-4" />
              Informasi Keuangan
            </h4>
            <div class="p-3 md:p-4 bg-muted/50 rounded-md space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Total Diskon</span>
                <span class="text-destructive font-medium">{{ formatCurrency(notification.t_purchase_invoice.total_diskon) }}</span>
              </div>
              <div class="flex justify-between border-t pt-2">
                <span class="text-muted-foreground font-medium">Total (DPP)</span>
                <span class="font-semibold">{{ formatCurrency(notification.t_purchase_invoice.total) }}</span>
              </div>
              <div class="flex justify-between text-xs pl-2">
                <span class="text-muted-foreground">DPP Nilai Lain (DPP × 11/12)</span>
                <span class="text-blue-600 dark:text-blue-400 font-medium">{{ formatCurrency(notification.t_purchase_invoice.dpp_lainnya) }}</span>
              </div>
              <div class="flex justify-between text-xs pl-2">
                <span class="text-muted-foreground">Seri Pajak</span>
                <span class="font-medium">{{ notification.t_purchase_invoice.seri_pajak || '-' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Total PPN</span>
                <span class="font-medium text-green-600 dark:text-green-400">+{{ formatCurrency(notification.t_purchase_invoice.total_ppn) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Total PPH</span>
                <span class="font-medium text-destructive">-{{ formatCurrency(notification.t_purchase_invoice.total_pph) }}</span>
              </div>
              <div class="flex justify-between border-t-2 pt-2">
                <span class="font-bold">Grand Total</span>
                <span class="text-lg font-bold text-primary">{{ formatCurrency(notification.t_purchase_invoice.grand_total) }}</span>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <div v-if="notification.t_purchase_invoice.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold"
              >Catatan Purchase Invoice</Label
            >
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.t_purchase_invoice.catatan }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Detail Items Card -->
      <Card v-if="detailItems.length">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Package class="h-5 w-5 shrink-0" />
            Detail Item ({{ detailItems.length }} item)
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Daftar item dalam Purchase Invoice</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <!-- Desktop Table -->
          <div class="overflow-x-auto hidden md:block">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b bg-muted/50">
                  <th class="text-left p-2 font-medium">No</th>
                  <th class="text-left p-2 font-medium">No PB</th>
                  <th class="text-left p-2 font-medium">No PO</th>
                  <th class="text-left p-2 font-medium">Kode Item</th>
                  <th class="text-left p-2 font-medium">Nama Item</th>
                  <th class="text-left p-2 font-medium">UOM</th>
                  <th class="text-right p-2 font-medium">Qty PO</th>
                  <th class="text-right p-2 font-medium">Qty Terima</th>
                  <th class="text-right p-2 font-medium">Qty Retur</th>
                  <th class="text-right p-2 font-medium">Qty PI</th>
                  <th class="text-right p-2 font-medium">Harga</th>
                  <th class="text-right p-2 font-medium">Disc 1%</th>
                  <th class="text-right p-2 font-medium">Disc 2%</th>
                  <th class="text-right p-2 font-medium">Disc Amt</th>
                  <th class="text-right p-2 font-medium">Total (DPP)</th>
                  <th class="text-left p-2 font-medium">PPN</th>
                  <th class="text-right p-2 font-medium">PPN Amt</th>
                  <th class="text-right p-2 font-medium">PPH Amt</th>
                  <th class="text-right p-2 font-medium">Grand Total</th>
                  <th class="text-left p-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in detailItems" :key="item.id" class="border-b hover:bg-muted/30">
                  <td class="p-2">{{ index + 1 }}</td>
                  <td class="p-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    {{ item.tpenerimaan_barangs?.no_penerimaan || '-' }}
                  </td>
                  <td class="p-2 font-mono text-xs text-green-600 dark:text-green-400">
                    {{ item.t_purchase_order?.no_po || '-' }}
                  </td>
                  <td class="p-2 font-mono text-xs">{{ item.m_items?.kode_item || '-' }}</td>
                  <td class="p-2">
                    <div class="font-medium">{{ item.m_items?.nama_item || '-' }}</div>
                  </td>
                  <td class="p-2">{{ item.pi_d_uom?.value1 || item.m_items?.mi_uom?.value1 || '-' }}</td>
                  <td class="p-2 text-right">{{ fmtNum(item.t_purchase_order_d?.qty_po, 0) }}</td>
                  <td class="p-2 text-right text-green-600 dark:text-green-400">{{ fmtNum(item.qty_diterima, 0) }}</td>
                  <td class="p-2 text-right text-destructive">{{ fmtNum(item.qty_retur, 0) }}</td>
                  <td class="p-2 text-right font-medium">{{ fmtNum(item.qty_pi, 0) }}</td>
                  <td class="p-2 text-right">{{ fmtNum(item.harga) }}</td>
                  <td class="p-2 text-right text-orange-600">{{ fmtNum(item.r_disc1, 0) }}%</td>
                  <td class="p-2 text-right text-orange-600">{{ fmtNum(item.r_disc2, 0) }}%</td>
                  <td class="p-2 text-right text-destructive">{{ fmtNum(item.disc_amt) }}</td>
                  <td class="p-2 text-right font-semibold">{{ fmtNum(item.subtotal) }}</td>
                  <td class="p-2 text-xs">
                    <Badge variant="outline" class="text-xs">{{ item.pi_d_ppn?.value1 || '-' }}</Badge>
                  </td>
                  <td class="p-2 text-right text-green-600 dark:text-green-400">+{{ fmtNum(item.ppn_amt) }}</td>
                  <td class="p-2 text-right text-destructive">-{{ fmtNum(item.pph_amt) }}</td>
                  <td class="p-2 text-right font-bold text-primary">{{ fmtNum(item.grand_total) }}</td>
                  <td class="p-2 text-xs text-muted-foreground">{{ item.catatan || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards -->
          <div class="md:hidden space-y-3 mt-2">
            <div v-for="(item, index) in detailItems" :key="item.id" class="p-3 border rounded-md space-y-2 text-sm">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-medium">{{ item.m_items?.nama_item || '-' }}</p>
                  <p class="text-xs text-muted-foreground font-mono">{{ item.m_items?.kode_item || '-' }}</p>
                </div>
                <Badge variant="outline" class="text-xs">{{ item.pi_d_uom?.value1 || '-' }}</Badge>
              </div>
              <div class="grid grid-cols-2 gap-1 text-xs bg-muted/30 p-2 rounded">
                <div><span class="text-muted-foreground">No PB:</span> <span class="font-medium text-blue-600">{{ item.tpenerimaan_barangs?.no_penerimaan || '-' }}</span></div>
                <div><span class="text-muted-foreground">No PO:</span> <span class="font-medium text-green-600">{{ item.t_purchase_order?.no_po || '-' }}</span></div>
              </div>
              <div class="grid grid-cols-3 gap-1 text-xs">
                <div><span class="text-muted-foreground">Qty PI:</span> <span class="font-bold">{{ fmtNum(item.qty_pi, 0) }}</span></div>
                <div><span class="text-muted-foreground">Terima:</span> <span class="font-medium text-green-600">{{ fmtNum(item.qty_diterima, 0) }}</span></div>
                <div><span class="text-muted-foreground">Retur:</span> <span class="font-medium text-destructive">{{ fmtNum(item.qty_retur, 0) }}</span></div>
              </div>
              <div class="grid grid-cols-2 gap-1 text-xs">
                <div><span class="text-muted-foreground">Harga:</span> <span class="font-medium">{{ fmtNum(item.harga) }}</span></div>
                <div><span class="text-muted-foreground">Disc:</span> <span class="text-orange-600">{{ fmtNum(item.r_disc1, 0) }}% / {{ fmtNum(item.r_disc2, 0) }}%</span></div>
              </div>
              <Separator />
              <div class="space-y-1 text-xs">
                <div class="flex justify-between"><span class="text-muted-foreground">Total DPP:</span> <span class="font-semibold">{{ fmtNum(item.subtotal) }}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">PPN ({{ item.pi_d_ppn?.value1 || '-' }}):</span> <span class="text-green-600">+{{ fmtNum(item.ppn_amt) }}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">PPH:</span> <span class="text-destructive">-{{ fmtNum(item.pph_amt) }}</span></div>
                <div class="flex justify-between border-t pt-1"><span class="font-bold">Grand Total:</span> <span class="font-bold text-primary">{{ fmtNum(item.grand_total) }}</span></div>
              </div>
              <div v-if="item.catatan" class="text-xs text-muted-foreground bg-muted p-2 rounded">📝 {{ item.catatan }}</div>
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
