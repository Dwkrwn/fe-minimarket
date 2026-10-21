<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Calendar,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FieldX from "@/components/field/FieldX.vue";
import { useAuthStore } from "@/stores/auth";
import {
  approvePurchaseInvoiceSubcon,
  getPurchaseInvoiceSubconNotifications,
  rejectPurchaseInvoiceSubcon,
  revisePurchaseInvoiceSubcon,
  type PurchaseInvoiceSubconNotification,
} from "./service.purchase_invoice_subcon";
import { getPurchaseInvoiceSubconById } from "@/views/purchasing/subcon/t_purchase_invoice_subcon/service";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<PurchaseInvoiceSubconNotification | null>(null);
const approvalCatatan = ref("");

const notificationId = computed(() => route.params.id as string);
const toNumber = (value: unknown) => Number(value) || 0;

const formatDateTime = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatNum = (value: unknown) =>
  toNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getLineTotalJasa = (d: {
  qty_jasa?: number;
  harga?: number;
  discount_amount?: number;
}) => {
  const qty = Number(d.qty_jasa) || 0;
  const harga = Number(d.harga) || 0;
  const discount = Number(d.discount_amount) || 0;
  return Math.max(qty * harga - discount, 0);
};

const getStatusVariant = (status: string) => {
  switch ((status || "").toUpperCase()) {
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

const getSourcePi = computed(
  () => (notification.value as any)?.t_purchase_invoice_subcon ?? null,
);

const normalizeJadiDetail = (item: any) => {
  const qty = toNumber(
    item.qty ?? item.qty_diterima ?? item.qty_pb ?? item.qty_po,
  );
  const harga = toNumber(item.harga);
  return {
    ...item,
    no_po:
      item.no_po ||
      item.t_purchase_order_subcon?.no_po ||
      item.t_purchase_order_subcon?.n ||
      "-",
    no_penerimaan:
      item.t_penerimaan_barang_subcon?.no_p ||
      item.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
      "-",
    kode: item.kode || item.m_item?.kode_item || item.m_items?.kode_item || "-",
    finish_goods:
      item.finish_goods ||
      item.m_item?.nama_item ||
      item.m_items?.nama_item ||
      "-",
    qty,
    uom: item.uom || item.m_general?.value1 || "-",
    harga,
    netto: qty * harga,
    catatan: item.catatan || "",
  };
};

const normalizeJasaDetail = (item: any) => {
  const qty = toNumber(item.qty_jasa ?? item.qty_diterima ?? item.qty ?? 0);
  const harga = toNumber(item.harga ?? item.biaya_unit);
  const discountAmount = toNumber(
    item.discount_amount ?? item.diskon_amount ?? 0,
  );
  const subtotal = getLineTotalJasa({
    qty_jasa: qty,
    harga,
    discount_amount: discountAmount,
  });
  return {
    ...item,
    no_po:
      item.no_po ||
      item.t_purchase_order_subcon?.no_po ||
      item.t_purchase_order_subcon?.n ||
      "-",
    no_penerimaan:
      item.no_penerimaan ||
      item.t_penerimaan_barang_subcon?.no_penerimaan ||
      item.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
      "-",
    kode: item.kode || item.m_item?.kode_item || item.m_items?.kode_item || "-",
    material:
      item.material || item.m_item?.nama_item || item.m_items?.nama_item || "-",
    finish_goods:
      item.finish_goods ||
      item.t_purchase_invoice_subcon_jadi?.m_item?.nama_item ||
      item.t_purchase_invoice_subcon_jadi?.finish_goods ||
      "-",
    jasa: item.jasa || item.nama_jasa || "-",
    qty,
    uom: item.uom || item.m_general?.value1 || "-",
    harga,
    discount_amount: discountAmount,
    subtotal,
    ppn_amount: toNumber(item.ppn_amount),
    pph_amount: toNumber(item.pph_amount),
    total_stlh_pajak: toNumber(item.total_stlh_pajak),
    catatan: item.catatan || "",
  };
};

const normalizeKirimDetail = (item: any) => {
  const qtyKirim = toNumber(item.qty_kirim);
  const biayaKirim = toNumber(item.biaya_kirim);
  const total = toNumber(item.total) || qtyKirim * biayaKirim;
  return {
    ...item,
    kode: item.kode || item.m_item?.kode_item || item.m_items?.kode_item || "-",
    barang:
      item.barang || item.m_item?.nama_item || item.m_items?.nama_item || "-",
    ekspedisi: item.ekspedisi || "-",
    qty_konversi: toNumber(item.qty_konversi),
    qty_kirim: qtyKirim,
    uom: item.uom || item.m_general?.value1 || "-",
    biaya_kirim: biayaKirim,
    total,
    catatan: item.catatan || "",
  };
};

const piDetails = computed(() => {
  const source = getSourcePi.value as any;
  const jadis = Array.isArray(source?.t_purchase_invoice_subcon_jadis)
    ? source.t_purchase_invoice_subcon_jadis
    : Array.isArray(source?.t_purchase_invoice_subcon_jadi)
      ? source.t_purchase_invoice_subcon_jadi
      : Array.isArray(source?.t_purchase_invoice_subcon_details)
        ? source.t_purchase_invoice_subcon_details
        : [];
  const jasas = Array.isArray(source?.t_purchase_invoice_subcon_jasas)
    ? source.t_purchase_invoice_subcon_jasas
    : Array.isArray(source?.t_purchase_invoice_subcon_jasa)
      ? source.t_purchase_invoice_subcon_jasa
      : Array.isArray(source?.t_purchase_invoice_subcon_details2)
        ? source.t_purchase_invoice_subcon_details2
        : [];
  const kirim = Array.isArray(source?.t_purchase_invoice_subcon_details3)
    ? source.t_purchase_invoice_subcon_details3
    : [];

  return {
    jadis: jadis.map(normalizeJadiDetail),
    jasas: jasas.map(normalizeJasaDetail),
    kirim: kirim.map(normalizeKirimDetail),
  };
});

const dppCalc = computed(() =>
  piDetails.value.jasas.reduce((s: any, d: any) => s + getLineTotalJasa(d), 0),
);

const dppLainnyaCalc = computed(() => {
  const source = getSourcePi.value as any;
  return toNumber(source?.dpp_lainnya);
});

const totalCalc = computed(() => {
  const source = getSourcePi.value as any;
  return toNumber(source?.total) || dppCalc.value + dppLainnyaCalc.value;
});

const totalDiskonCalc = computed(() => {
  const source = getSourcePi.value as any;
  return toNumber(source?.total_diskon);
});

const ppnPercent = computed(() => {
  const source = getSourcePi.value as any;
  return toNumber(source?.persen_ppn);
});

const pphPercent = computed(() => {
  const source = getSourcePi.value as any;
  return toNumber(source?.persen_pph);
});

const isPpnInclude = computed(() => {
  const source = getSourcePi.value as any;
  const key = (source?.ppn_key1 || "").toUpperCase();
  return key === "INC" || key === "INCLUDE";
});

const getLinePpnJasa = (item: any) => {
  const percent = ppnPercent.value;
  if (!percent) return 0;
  const base = getLineTotalJasa(item);
  return isPpnInclude.value
    ? (base * percent) / (100 + percent)
    : (base * percent) / 100;
};

const getLinePphJasa = (item: any) => {
  const percent = pphPercent.value;
  if (!percent) return 0;
  const base = getLineTotalJasa(item);
  return (base * percent) / 100;
};

const getLineTotalAfterTaxJasa = (item: any) => {
  const lineTotal = getLineTotalJasa(item);
  const ppn = getLinePpnJasa(item);
  const pph = getLinePphJasa(item);
  return isPpnInclude.value ? lineTotal - pph : lineTotal + ppn - pph;
};

const totalPpnCalc = computed(() => {
  const base = totalCalc.value - totalDiskonCalc.value;
  const percent = ppnPercent.value;
  return isPpnInclude.value
    ? (base * percent) / (100 + percent)
    : (base * percent) / 100;
});

const totalPphCalc = computed(() => {
  const base = totalCalc.value - totalDiskonCalc.value;
  return (base * pphPercent.value) / 100;
});

const grandTotalCalc = computed(() => {
  const source = getSourcePi.value as any;
  return (
    toNumber(source?.grand_total) ||
    totalCalc.value -
      totalDiskonCalc.value +
      totalPpnCalc.value -
      totalPphCalc.value
  );
});

const createdByLabel = computed(() => {
  const source = getSourcePi.value as any;
  if (!source?.createdBy && !source?.createdAt) return "";
  const name =
    source?.createdBy?.name || source?.createdBy?.username || "admin";
  const dt = source?.createdAt
    ? new Date(source.createdAt).toLocaleString("en-US")
    : "";
  return `Created By ${name}${dt ? ` On ${dt}` : ""}`;
});

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getPurchaseInvoiceSubconNotifications(1, 100);
    const found = response.data.find(
      (item) => item.id === notificationId.value,
    );

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    let hydratedNotification: PurchaseInvoiceSubconNotification = {
      ...found,
    };

    if (found.t_purchase_invoice_subcon_id) {
      try {
        const piRes = await getPurchaseInvoiceSubconById(
          found.t_purchase_invoice_subcon_id,
        );
        if (piRes?.status === "success" && piRes?.data) {
          hydratedNotification = {
            ...hydratedNotification,
            t_purchase_invoice_subcon: piRes.data as any,
          };
        }
      } catch (error) {
        console.warn("Failed to hydrate PI Subcon detail:", error);
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
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (item: any) =>
        item.path === "/purchasing/subcon/t_purchase_invoice_subcon" &&
        item.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk menyetujui Purchase Invoice Subcon",
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
      await revisePurchaseInvoiceSubcon(
        notification.value.t_purchase_invoice_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      await approvePurchaseInvoiceSubcon(
        notification.value.t_purchase_invoice_subcon_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    }

    toast.success(
      `Purchase Invoice Subcon ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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

  submitting.value = true;
  try {
    const approvalList = authStore.getApprovalList();
    const moduleApproval = approvalList.find(
      (item: any) =>
        item.path === "/purchasing/subcon/t_purchase_invoice_subcon" &&
        item.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!moduleApproval) {
      toast.error("Approval level not found", {
        description:
          "Anda tidak memiliki hak untuk reject Purchase Invoice Subcon",
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

    await rejectPurchaseInvoiceSubcon(
      notification.value.t_purchase_invoice_subcon_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Purchase Invoice Subcon berhasil di-reject");
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
          <span class="truncate">Purchase Invoice Subcon Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve Purchase Invoice Subcon request
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
              <span class="font-medium truncate">
                {{
                  (notification as any).tpi_sc_sender?.name ||
                  notification.user_default?.name ||
                  "N/A"
                }}
              </span>
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

      <Card v-if="getSourcePi" class="overflow-hidden">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Purchase Invoice Subcon
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Detail lengkap PI Subcon beserta seluruh rincian item
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-6">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          >
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. PI</Label
              >
              <p class="text-sm md:text-base font-semibold break-all">
                {{ getSourcePi.no_pi_subcon || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tanggal PI</Label
              >
              <p class="text-sm md:text-base">
                {{ formatDate(getSourcePi.tgl_pi) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Status</Label
              >
              <Badge
                :variant="getStatusVariant(getSourcePi.status || '')"
                class="text-xs md:text-sm w-fit"
              >
                {{ getSourcePi.status || "-" }}
              </Badge>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Unit Bisnis</Label
              >
              <p class="text-sm md:text-base">
                {{
                  getSourcePi.m_unit_bisni?.nama_comp ||
                  getSourcePi.m_unit_bisni?.nama ||
                  "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Supplier</Label
              >
              <p class="text-sm md:text-base font-medium">
                {{ getSourcePi.m_supplier?.nama_supp || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >No. Penerimaan</Label
              >
              <p class="text-sm md:text-base">
                {{
                  getSourcePi.t_penerimaan_barang_subcon?.no_penerimaan || "-"
                }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >ToP</Label
              >
              <p class="text-sm md:text-base">
                {{ getSourcePi.top?.value1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tipe PPN</Label
              >
              <p class="text-sm md:text-base">
                {{ getSourcePi.ppn?.value1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tipe PPH</Label
              >
              <p class="text-sm md:text-base">
                {{ getSourcePi.pph?.value1 || "-" }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Catatan</Label
              >
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ getSourcePi.catatan || "-" }}
              </p>
            </div>
          </div>

          <Separator />

          <Tabs default-value="jasa" class="w-full">
            <TabsList class="mb-4 flex flex-wrap h-auto">
              <TabsTrigger value="jasa">Detail Biaya Jasa</TabsTrigger>
              <TabsTrigger value="fg">Detail Finish Goods</TabsTrigger>
            </TabsList>

            <TabsContent value="jasa" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Detail Biaya Jasa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader class="bg-muted">
                        <TableRow>
                          <TableHead class="w-[60px]">No</TableHead>
                          <TableHead class="min-w-[120px]">Kode</TableHead>
                          <TableHead class="min-w-[180px]">Material</TableHead>
                          <TableHead class="w-[90px] text-right">Qty</TableHead>
                          <TableHead class="w-[110px]">UoM</TableHead>
                          <TableHead class="min-w-[140px] text-right"
                            >Biaya/Unit</TableHead
                          >
                          <TableHead class="min-w-[150px] text-right"
                            >Total</TableHead
                          >
                          <TableHead class="min-w-[140px] text-right">
                            PPN
                          </TableHead>
                          <TableHead class="min-w-[140px] text-right">
                            PPH
                          </TableHead>
                          <TableHead class="min-w-[170px] text-right">
                            Total Setelah Pajak
                          </TableHead>
                          <TableHead class="min-w-[220px]">Catatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="piDetails.jasas.length === 0">
                          <TableCell
                            colspan="11"
                            class="py-8 text-center text-muted-foreground"
                          >
                            Tidak ada detail biaya jasa
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="(item, index) in piDetails.jasas"
                          :key="item.id || index"
                        >
                          <TableCell>{{ (index as number) + 1 }}</TableCell>
                          <TableCell>{{ item.kode }}</TableCell>
                          <TableCell>{{ item.material }}</TableCell>
                          <TableCell class="text-right font-medium">{{
                            item.qty
                          }}</TableCell>
                          <TableCell>{{ item.uom }}</TableCell>
                          <TableCell class="text-right">{{
                            formatNum(item.harga)
                          }}</TableCell>
                          <TableCell
                            class="text-right font-semibold text-primary"
                            >{{ formatNum(item.subtotal) }}</TableCell
                          >
                          <TableCell class="text-right">{{
                            formatNum(item.ppn_amount || getLinePpnJasa(item))
                          }}</TableCell>
                          <TableCell class="text-right">{{
                            formatNum(item.pph_amount || getLinePphJasa(item))
                          }}</TableCell>
                          <TableCell class="text-right">{{
                            formatNum(
                              item.total_stlh_pajak ||
                                getLineTotalAfterTaxJasa(item),
                            )
                          }}</TableCell>
                          <TableCell>{{ item.catatan || "-" }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="fg" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Detail Finish Goods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader class="bg-muted">
                        <TableRow>
                          <TableHead class="w-[60px]">No</TableHead>
                          <TableHead class="min-w-[120px]">No. PO</TableHead>
                          <TableHead class="min-w-[150px]"
                            >No. Penerimaan</TableHead
                          >
                          <TableHead class="min-w-[120px]">Kode</TableHead>
                          <TableHead class="min-w-[220px]"
                            >Finish Goods</TableHead
                          >
                          <TableHead class="w-[100px] text-right"
                            >Qty</TableHead
                          >
                          <TableHead class="w-[110px]">UoM</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-if="piDetails.jadis.length === 0">
                          <TableCell
                            colspan="10"
                            class="py-8 text-center text-muted-foreground"
                          >
                            Tidak ada detail finish goods
                          </TableCell>
                        </TableRow>
                        <TableRow
                          v-for="(item, index) in piDetails.jadis"
                          :key="item.id || index"
                        >
                          <TableCell>{{ (index as number) + 1 }}</TableCell>
                          <TableCell>{{ item.no_po }}</TableCell>
                          <TableCell>{{ item.no_penerimaan }}</TableCell>
                          <TableCell>{{ item.kode }}</TableCell>
                          <TableCell
                            ><span class="font-medium">{{
                              item.finish_goods
                            }}</span></TableCell
                          >
                          <TableCell class="text-right font-medium">{{
                            item.qty
                          }}</TableCell>
                          <TableCell>{{ item.uom }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Separator />

          <div class="grid grid-cols-2 gap-x-4 gap-y-1 max-w-sm">
            <span class="text-sm text-muted-foreground">DPP</span>
            <span class="text-sm text-right font-medium">{{
              formatNum(dppCalc)
            }}</span>
            <span class="text-sm text-muted-foreground"
              >PPN {{ ppnPercent }}%</span
            >
            <span class="text-sm text-right font-medium">{{
              formatNum(totalPpnCalc)
            }}</span>
            <span class="text-sm text-muted-foreground"
              >PPH {{ pphPercent }}%</span
            >
            <span class="text-sm text-right font-medium">{{
              formatNum(totalPphCalc)
            }}</span>
            <span class="text-sm font-semibold border-t pt-1">Grand Total</span>
            <span class="text-sm text-right font-semibold border-t pt-1">{{
              formatNum(grandTotalCalc)
            }}</span>
          </div>

          <!-- <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-2">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Created At</Label
              >
              <p class="text-sm md:text-base">
                {{ formatDateTime(getSourcePi.createdAt) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Updated At</Label
              >
              <p class="text-sm md:text-base">
                {{ formatDateTime(getSourcePi.updatedAt) }}
              </p>
            </div>
          </div> -->
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

      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <Check class="h-5 w-5 text-primary shrink-0" />
            Approval Action
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Berikan keputusan Anda untuk PI Subcon ini</CardDescription
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

    <div v-else class="text-center py-16 text-muted-foreground">
      Data notifikasi tidak tersedia.
    </div>

    <div v-if="createdByLabel" class="text-xs text-muted-foreground">
      {{ createdByLabel }}
    </div>
  </div>
</template>
