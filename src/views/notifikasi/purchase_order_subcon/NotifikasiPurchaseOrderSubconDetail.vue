<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Check,
  Clock,
  FileText,
  Package,
  User,
  X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
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
import FieldX from "@/components/field/FieldX.vue";
import { useAuthStore } from "@/stores/auth";
import {
  approvePurchaseOrderSubcon,
  getPurchaseOrderSubconNotifications,
  rejectPurchaseOrderSubcon,
  revisePurchaseOrderSubcon,
  type PurchaseOrderSubconNotification,
} from "./service.purchase_order_subcon";
import { getPurchaseOrderSubconById } from "@/views/purchasing/subcon/t_purchase_order_subcon/service";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const loading = ref(true);
const submitting = ref(false);
const notification = ref<PurchaseOrderSubconNotification | null>(null);
const approvalCatatan = ref("");

const notificationId = computed(() => route.params.id as string);
const po = computed(() => notification.value?.t_purchase_order_subcon || null);

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const asNumber = (value: any) => Number(value) || 0;

const formatDateTime = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatNumber = (value: any) =>
  asNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const currencySymbol = computed(() => {
  const currency = firstValue((po.value as any)?.m_currency, {});
  const money = firstValue(currency?.money, {});
  return firstValue(money?.value2, currency?.symbol, "Rp");
});

const formatCurrency = (value: any) =>
  `${currencySymbol.value} ${formatNumber(value)}`;

const getStatusVariant = (status?: string) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "default";
    case "IN APPROVAL":
      return "secondary";
    case "REVISI":
    case "REJECT":
      return "destructive";
    case "DRAFT":
      return "outline";
    default:
      return "secondary";
  }
};

const getPoNumber = (data: any) =>
  firstValue(data?.no_po, data?.no_t_purchase_order_subcon, data?.code, "-");

const getPrNumber = (data: any) =>
  firstValue(
    data?.t_purchase_request_subcon?.no_pr_subcon,
    data?.t_purchase_request_subcon?.no_t_purchase_request_subcon,
    data?.no_pr_subcon,
    data?.t_purchase_request_subcon_id,
    "-",
  );

const getUnitBisnisName = (data: any) =>
  firstValue(
    data?.m_unit_bisnis?.nama_comp,
    data?.m_unit_bisni?.nama_comp,
    data?.m_unit_bisnis?.nama,
    data?.unit_bisnis,
    "-",
  );

const getSupplierName = (data: any) =>
  firstValue(
    data?.m_supplier?.nama_supp,
    data?.m_supplier?.nama,
    data?.supplier?.nama_supp,
    data?.supplier?.nama,
    "-",
  );

const getGudangName = (data: any) =>
  firstValue(data?.m_gudang?.nama_gudang, data?.gudang?.nama_gudang, data?.gudang_id, "-");

const getSenderName = (notif: any) =>
  firstValue(
    notif?.tpo_sc_sender?.name,
    notif?.tpr_sc_sender?.name,
    notif?.tpr_sender?.name,
    notif?.user_default?.name,
    "N/A",
  );

const getItem = (detail: any) =>
  firstValue(
    detail?.m_items,
    detail?.m_item,
    detail?.t_purchase_request_subcon_bahan?.m_items,
    detail?.t_purchase_request_subcon_bahan?.m_item,
    detail?.t_purchase_request_subcon_jadi?.m_items,
    detail?.t_purchase_request_subcon_jadi?.m_item,
    detail?.t_purchase_request_subcon_jasa?.m_items,
    detail?.t_purchase_request_subcon_jasa?.m_item,
    {},
  );

const getUom = (detail: any) => {
  const item = getItem(detail);
  return firstValue(
    detail?.m_general?.value1,
    detail?.po_sc_uom?.value1,
    detail?.po_sc_b_uom?.value1,
    detail?.po_sc_j_uom?.value1,
    detail?.m_items?.mi_uom?.value1,
    detail?.m_item?.mi_uom?.value1,
    item?.mi_uom?.value1,
    "-",
  );
};

const calculateLineTotal = (detail: any) => {
  const stored = firstValue(detail?.subtotal, detail?.sub_total, detail?.total);
  if (stored !== undefined) return asNumber(stored);
  const qty = asNumber(
    firstValue(detail?.qty_po_bahan, detail?.qty_po, detail?.qty_jasa, detail?.qty),
  );
  return qty * asNumber(detail?.harga);
};

const getRakLabel = (detail: any) => {
  const rakDetail = firstValue(
    detail?.stock_gudang?.m_rak_d,
    detail?.m_rak_d,
    detail?.rak_detail,
    {},
  );
  const rakMaster = firstValue(rakDetail?.m_rak, detail?.rak_master, {});
  const kode = firstValue(rakDetail?.kode, rakDetail?.kode_rak_d, rakMaster?.kode_rak, "-");
  const nama = firstValue(rakMaster?.nama_rak, rakDetail?.nama_rak, "Tanpa Rak");
  if (kode === "-" && nama === "Tanpa Rak") return "-";
  return `${kode} (${nama})`;
};

const mapDetailBahan = (detail: any) => {
  const item = getItem(detail);
  return {
    id: detail.id,
    kode: firstValue(detail.kode, item.kode_item, item.kode, "-"),
    nama: firstValue(detail.nama_material, item.nama_item, item.nama_material, "-"),
    qty: asNumber(firstValue(detail.qty_po_bahan, detail.qty, 0)),
    uom: getUom(detail),
    harga: asNumber(detail.harga),
    total: calculateLineTotal(detail),
    rak: getRakLabel(detail),
    catatan: firstValue(detail.catatan, "-"),
  };
};

const mapDetailJadi = (detail: any) => {
  const item = getItem(detail);
  return {
    id: detail.id,
    kode: firstValue(detail.kode, item.kode_item, item.kode, "-"),
    nama: firstValue(detail.nama_item, item.nama_item, "-"),
    qty: asNumber(firstValue(detail.qty_po, detail.qty, 0)),
    uom: getUom(detail),
    harga: asNumber(detail.harga),
    total: calculateLineTotal(detail),
    ppn: asNumber(firstValue(detail.ppn_amount, detail.ppn_total, 0)),
    pph: asNumber(firstValue(detail.pph_amount, detail.tota_pph, 0)),
    totalAfterTax: asNumber(
      firstValue(detail.total_stlh_pajak, detail.grand_total, calculateLineTotal(detail)),
    ),
    catatan: firstValue(detail.catatan, "-"),
  };
};

const mapDetailJasa = (detail: any) => {
  const item = getItem(detail);
  return {
    id: detail.id,
    kode: firstValue(detail.kode, item.kode_item, item.kode, "-"),
    nama: firstValue(detail.nama_jasa, detail.nama_item, item.nama_item, "-"),
    qty: asNumber(firstValue(detail.qty_jasa, detail.qty, 0)),
    uom: getUom(detail),
    harga: asNumber(detail.harga),
    total: calculateLineTotal(detail),
    ppn: asNumber(firstValue(detail.ppn_amount, detail.ppn_total, 0)),
    pph: asNumber(firstValue(detail.pph_amount, detail.tota_pph, 0)),
    totalAfterTax: asNumber(
      firstValue(detail.total_stlh_pajak, detail.grand_total, calculateLineTotal(detail)),
    ),
    catatan: firstValue(detail.catatan, "-"),
  };
};

const bahanDetails = computed(() => {
  const rows = firstValue(
    (po.value as any)?.t_purchase_order_subcon_bahans,
    (po.value as any)?.t_purchase_order_subcon_bahan,
    [],
  );
  return rows.map(mapDetailBahan);
});

const jadiDetails = computed(() => {
  const rows = firstValue(
    (po.value as any)?.t_purchase_order_subcon_jadis,
    (po.value as any)?.t_purchase_order_subcon_jadi,
    [],
  );
  return rows.map(mapDetailJadi);
});

const jasaDetails = computed(() => {
  const rows = firstValue(
    (po.value as any)?.t_purchase_order_subcon_jasas,
    (po.value as any)?.t_purchase_order_subcon_jasa,
    [],
  );
  return rows.map(mapDetailJasa);
});

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getPurchaseOrderSubconNotifications(1, 100);
    const found = response.data.find((n) => n.id === notificationId.value);

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    const hydratedNotification: any = { ...found };
    if (found.t_purchase_order_subcon_id) {
      try {
        const poRes = await getPurchaseOrderSubconById(found.t_purchase_order_subcon_id);
        if (poRes?.status === "success" && poRes?.data) {
          hydratedNotification.t_purchase_order_subcon = poRes.data;
        }
      } catch (err) {
        console.warn("Failed to hydrate Purchase Order Subcon detail:", err);
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

const getApprovalLevel = () => {
  const moduleApproval = authStore.getApprovalList().find(
    (a: any) =>
      a.path === "/purchasing/subcon/t_purchase_order_subcon" &&
      a.tipe_approve?.toUpperCase() === "MENYETUJUI",
  );

  if (!moduleApproval) {
    toast.error("Approval level not found", {
      description: "Anda tidak memiliki hak untuk menyetujui Purchase Order Subcon",
    });
    return null;
  }

  if (moduleApproval.level === undefined || moduleApproval.level === null) {
    toast.error("Invalid approval level", {
      description: "Approval level is missing",
    });
    return null;
  }

  return moduleApproval.level;
};

const handleApproval = async (status: "APPROVED" | "REVISI") => {
  if (!notification.value) return;

  if (status === "REVISI" && !approvalCatatan.value?.trim()) {
    toast.error("Alasan Revisi wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan revisi",
    });
    return;
  }

  const approvalLevel = getApprovalLevel();
  if (approvalLevel === null) return;

  submitting.value = true;
  try {
    if (status === "REVISI") {
      await revisePurchaseOrderSubcon(
        notification.value.t_purchase_order_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approvePurchaseOrderSubcon(
        notification.value.t_purchase_order_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Purchase Order Subcon ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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

  if (!approvalCatatan.value?.trim()) {
    toast.error("Alasan Reject wajib diisi", {
      description: "Silakan masukkan alasan sebelum melakukan reject",
    });
    return;
  }

  const approvalLevel = getApprovalLevel();
  if (approvalLevel === null) return;

  submitting.value = true;
  try {
    await rejectPurchaseOrderSubcon(
      notification.value.t_purchase_order_subcon_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Purchase Order Subcon berhasil di-reject");
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
          <span class="truncate">Purchase Order Subcon Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Order Subcon request
        </p>
      </div>
    </div>

    <Separator />

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

    <div v-else-if="notification" class="space-y-4 md:space-y-6">
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
              <CardDescription class="mt-1 text-sm">
                {{ notification.approval_message }}
              </CardDescription>
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
            <Label class="text-xs md:text-sm font-medium text-muted-foreground">
              Catatan dari Pengaju
            </Label>
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
              <span class="font-medium truncate">
                {{ getSenderName(notification) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">
                {{ formatDateTime(notification.createdAt) }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="po">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Order Subcon
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Detail lengkap data PO Subcon yang diajukan
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
          >
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                No. PO Subcon
              </Label>
              <p class="text-sm md:text-base font-semibold">
                {{ getPoNumber(po) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Tanggal PO
              </Label>
              <p class="text-sm md:text-base">
                {{ formatDate(firstValue((po as any).tgl_po, (po as any).tgl_t_purchase_order_subcon)) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                No. PR Subcon
              </Label>
              <p class="text-sm md:text-base">{{ getPrNumber(po) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Unit Bisnis
              </Label>
              <p class="text-sm md:text-base">{{ getUnitBisnisName(po) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Supplier
              </Label>
              <p class="text-sm md:text-base">{{ getSupplierName(po) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Currency
              </Label>
              <p class="text-sm md:text-base">{{ firstValue((po as any).po_sc_uang?.nama_currency, "-") }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                TOP
              </Label>
              <p class="text-sm md:text-base">
                {{ firstValue((po as any).po_sc_top?.value1, (po as any).m_general?.value1, (po as any).top_id, "-") }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Cara Kirim
              </Label>
              <p class="text-sm md:text-base">
                {{ firstValue((po as any).is_ekspedisi, "-") ? 'Ekspedisi Luar' : 'Dikirim Perusahaan' }}
              </p>
            </div>
            <div v-if="firstValue((po as any).is_ekspedisi, '-')" class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Cara Kirim
              </Label>
              <p class="text-sm md:text-base">
                {{ firstValue((po as any).m_ekspedisi?.nama, "-") }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Status
              </Label>
              <div>
                <Badge
                  :variant="getStatusVariant((po as any).status || '')"
                  class="text-xs md:text-sm"
                >
                  {{ (po as any).status || "-" }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Total
              </Label>
              <p class="text-sm md:text-base font-semibold">
                {{ formatCurrency((po as any).total) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Total PPN
              </Label>
              <p class="text-sm md:text-base">
                {{ formatCurrency((po as any).total_ppn) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Total PPH
              </Label>
              <p class="text-sm md:text-base">
                {{ formatCurrency((po as any).tota_pph) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Grand Total
              </Label>
              <p class="text-base md:text-lg font-bold text-primary">
                {{ formatCurrency((po as any).grand_total) }}
              </p>
            </div>
          </div>

          <div v-if="(po as any).catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ (po as any).catatan }}
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
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Material</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Qty PO</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">UoM</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="bahanDetails.length === 0">
                      <td colspan="9" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail bahan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in bahanDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ Number(idx) + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.kode }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.nama }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatNumber(detail.qty) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.uom }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.catatan }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detail2" class="space-y-4 mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[980px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Item</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Qty PO</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">UoM</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="jadiDetails.length === 0">
                      <td colspan="11" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail finish goods.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in jadiDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ Number(idx) + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.kode }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.nama }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatNumber(detail.qty) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.uom }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.catatan }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detail3" class="space-y-4 mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[980px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Kode</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama Jasa</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Qty Jasa</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">UoM</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Harga</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Total</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">PPN</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">PPH</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm text-right">Total Stlh Pajak</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="jasaDetails.length === 0">
                      <td colspan="11" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail jasa.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in jasaDetails"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ Number(idx) + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.kode }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.nama }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatNumber(detail.qty) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.uom }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatCurrency(detail.harga) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatCurrency(detail.total) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatCurrency(detail.ppn) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">{{ formatCurrency(detail.pph) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right font-semibold">{{ formatCurrency(detail.totalAfterTax) }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.catatan }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Nama Approval
              </Label>
              <p class="text-sm md:text-base font-medium">
                {{ notification.menu_info.approval_name }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Level
              </Label>
              <Badge variant="outline" class="text-xs">
                Level {{ notification.menu_info.level }}
              </Badge>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Menu
              </Label>
              <p class="text-sm md:text-base">
                {{ notification.menu_info.menu_name }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Path
              </Label>
              <p class="text-xs text-muted-foreground font-mono break-all">
                {{ notification.menu_info.menu_path }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Berikan keputusan Anda untuk Purchase Order Subcon ini
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            hints="Wajib diisi untuk revisi dan reject"
            :rows="3"
            :disabled="submitting"
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

      <Card v-else class="border-primary/30 bg-primary/10">
        <CardContent class="py-4 md:py-6">
          <div
            class="flex items-center justify-center gap-2 md:gap-3 text-primary"
          >
            <Check class="h-5 w-5 md:h-6 md:w-6" />
            <span class="text-sm md:text-lg font-medium">
              Notifikasi ini sudah diproses
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
