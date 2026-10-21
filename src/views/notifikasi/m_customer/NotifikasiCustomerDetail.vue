<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Check, X, Ban, Clock, User, FileText, AlertCircle } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import FieldX from "@/components/field/FieldX.vue";
import { useAuthStore } from "@/stores/auth";
import { useApi } from "@/composables/useApi";
import {
  approveCustomer,
  getCustomerNotifications,
  rejectCustomer,
  reviseCustomer,
  type CustomerNotification,
} from "./service.m_customer";
import { getCustomerById } from "@/views/marketing/master/m_customer/service";

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

const loading = ref(true);
const submitting = ref(false);
const approvalCatatan = ref("");
const notification = ref<CustomerNotification | null>(null);
const notificationId = computed(() => route.params.id as string);

const customerData = computed(() => (notification.value?.m_customer || {}) as any);
const unitBisnisList = computed(() => customerData.value?.m_customer_unit_bisnis || []);
const imageList = computed(() => customerData.value?.m_customer_images || []);
const creditTopList = computed(() =>
  unitBisnisList.value.map((ub: any) => {
    const kredit = Number(ub.kredit_limit || 0);
    const sisa = Number(ub.sisa_kredit_limit || 0);

    return {
      id: ub.id || ub.unit_bisnis_id,
      unit:
        ub.m_unit_bisni?.nama_comp ||
        ub.m_unit_bisnis?.nama_comp ||
        ub.m_unit_bisnis?.nama_unit_bisnis ||
        ub.unit_bisnis?.nama_comp ||
        ub.unit_bisnis?.nama_unit_bisnis ||
        ub.unit_bisnis_id ||
        "-",
      kredit,
      sisa,
      terpakai: Math.max(kredit - sisa, 0),
      top: Number(ub.top || 0),
    };
  }),
);

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
};

const formatNumber = (value: unknown) => Number(value || 0).toLocaleString("id-ID");
const formatBoolean = (value: unknown) => (value ? "Ya" : "Tidak");
const buildImageUrl = (path: string) =>
  path?.startsWith("http") ? path : `${API_BASE_URL}/${path}`;

const getStatusVariant = (status?: string) => {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "default";
    case "REVISI":
    case "REJECT":
      return "destructive";
    case "IN APPROVAL":
      return "secondary";
    default:
      return "outline";
  }
};

const getSenderName = (notif: any) =>
  firstValue(
    notif?.mc_sender?.name,
    notif?.user_default?.name,
    "N/A",
  );

const getApprovalLevel = () => {
  const approval = authStore.getApprovalList().find(
    (a: any) =>
      a.path === "/marketing/master/m_customer" &&
      a.tipe_approve?.toUpperCase() === "MENYETUJUI",
  );
  return approval?.level ?? null;
};

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;
    const response = await getCustomerNotifications(1, 200);
    const found = response.data.find((n) => n.id === notificationId.value);
    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    const hydrated: any = { ...found };
    if (found.m_customer_id) {
      const customerRes = await getCustomerById(found.m_customer_id);
      if (customerRes?.status === "success") hydrated.m_customer = customerRes.data;
    }

    notification.value = hydrated;
    approvalCatatan.value = hydrated.approval_catatan || "";
  } catch (error: any) {
    toast.error("Failed to load notification", {
      description: error.message || "An error occurred",
    });
    router.push("/notifikasi");
  } finally {
    loading.value = false;
  }
};

const submitApproval = async (status: "APPROVED" | "REVISI" | "REJECT") => {
  if (!notification.value?.m_customer_id) return;
  const level = getApprovalLevel();
  if (level === null) {
    toast.error("Approval level tidak ditemukan");
    return;
  }
  if (status !== "APPROVED" && !approvalCatatan.value.trim()) {
    toast.error("Catatan wajib diisi untuk revisi/reject");
    return;
  }

  submitting.value = true;
  try {
    if (status === "APPROVED") {
      await approveCustomer(
        notification.value.m_customer_id,
        notification.value.id,
        level,
        approvalCatatan.value,
      );
    } else if (status === "REVISI") {
      await reviseCustomer(
        notification.value.m_customer_id,
        notification.value.id,
        level,
        approvalCatatan.value,
      );
    } else {
      await rejectCustomer(
        notification.value.m_customer_id,
        notification.value.id,
        level,
        approvalCatatan.value,
      );
    }

    toast.success(`Customer ${status.toLowerCase()} berhasil`);
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Gagal memproses approval", {
      description: error.message || "Terjadi kesalahan",
    });
  } finally {
    submitting.value = false;
  }
};

onMounted(fetchNotificationDetail);
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <div class="flex items-start gap-3 md:gap-4">
      <Button variant="ghost" size="icon" class="shrink-0 mt-1" @click="router.push('/notifikasi')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="min-w-0">
        <h1 class="text-xl md:text-2xl font-bold text-foreground">Master Customer Approval</h1>
        <p class="text-xs md:text-sm text-muted-foreground">Review dan proses approval customer</p>
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
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="min-w-0">
              <CardTitle class="text-base md:text-lg flex items-center gap-2 flex-wrap">
                <span class="wrap-break-word">{{ notification.title }}</span>
              </CardTitle>
              <CardDescription class="mt-1 text-sm">
                {{ notification.approval_message }}
              </CardDescription>
            </div>
            <Badge :variant="getStatusVariant(notification.status_name || '')" class="shrink-0 self-start">
              {{ notification.status_name || "PENDING" }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div v-if="notification.approval_catatan" class="p-3 bg-muted rounded-md">
            <Label class="text-xs md:text-sm font-medium text-muted-foreground">
              Catatan dari Pengaju
            </Label>
            <p class="text-sm md:text-base mt-1">
              {{ notification.approval_catatan }}
            </p>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
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

      <Card>
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5" />
            Informasi Customer
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">Detail data customer yang diajukan</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
Unit Bisnis
              </Label>
              <div v-if="unitBisnisList.length > 0" class="mt-2 flex flex-wrap gap-2">
                <Badge v-for="ub in unitBisnisList" :key="ub.id" variant="outline">
                  {{ ub.m_unit_bisni?.nama_comp || ub.unit_bisnis_id }}
                </Badge>
              </div>
              <p v-else class="mt-1 text-muted-foreground">-</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Kode Customer
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.kode_customer || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Nama Customer
              </Label>
              <p class="text-sm md:text-base">{{  customerData.nama_customer }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Tipe Customer
              </Label>
              <p class="text-sm md:text-base">{{ customerData.tipe_customer || "-" }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Nama Alias
              </Label>
              <p class="text-sm md:text-base">{{ customerData.alias_customer || "-" }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Tolerance
              </Label>
              <p class="text-sm md:text-base">{{ formatNumber(customerData.tolerance) }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Sistem Pembayaran
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.cust_pembayaran_id?.value1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Cara Pengiriman
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.cust_pengiriman_id?.value1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Cara Penagihan
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.customer_penagihan?.value1|| "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Merk Koli
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.merk_koli || "-" }}
              </p>
            </div>
            
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Status
              </Label>
              <div>
                <Badge :variant="getStatusVariant(notification.m_customer?.status || '')" class="text-xs md:text-sm">
                  {{ customerData.status || "-" }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                No. NPWP
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.no_npwp || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Contact Person 1
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.cp_1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                No. CP 1
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.no_cp_1 || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Email
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.email || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Telepon
              </Label>
              <p class="text-sm md:text-base font-semibold">
                {{ customerData.no_telp_office || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Website
              </Label>
              <p class="text-sm md:text-base">
                {{customerData.website || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Provinsi
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.provinsi || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Kota
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.kota || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Kecamatan
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.kecamatan || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Kode Pos
              </Label>
              <p class="text-sm md:text-base">
                {{ customerData.kodepos || customerData.kode_pos || "-" }}
              </p>
            </div>
            <div class="space-y-1 sm:col-span-2 md:col-span-3">
              <Label class="text-xs md:text-sm font-medium text-muted-foreground">
                Alamat
              </Label>
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ customerData.alamat || "-" }}
              </p>
            </div>
            <div class="space-y-1 sm:col-span-2 md:col-span-3">
              <Label class="text-sm md:text-base font-medium text-muted-foreground">
                Detail Kredit Limit dan ToP
              </Label>
              <div v-if="creditTopList.length > 0" class="mt-2 overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium border-r">Unit Bisnis</th>
                      <th class="px-3 py-2 text-left font-medium border-r">Kredit Limit</th>
                      <th class="px-3 py-2 text-left font-medium border-r">Sisa Kredit Limit</th>
                      <th class="px-3 py-2 text-left font-medium border-r">Kredit Limit Terpakai</th>
                      <th class="px-3 py-2 text-left font-medium">ToP (hari)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in creditTopList" :key="item.id" class="border-t">
                      <td class="px-3 py-2 border-r">{{ item.unit }}</td>
                      <td class="px-3 py-2 border-r">{{ formatNumber(item.kredit) }}</td>
                      <td class="px-3 py-2 border-r">{{ formatNumber(item.sisa) }}</td>
                      <td class="px-3 py-2 border-r">{{ formatNumber(item.terpakai) }}</td>
                      <td class="px-3 py-2">{{ formatNumber(item.top) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="mt-1 text-sm text-muted-foreground">-</p>
            </div>
          
          </div>

          <div v-if="customerData.catatan" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Catatan</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ customerData.catatan }}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card v-if="notification.menu_info">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <AlertCircle class="h-5 w-5" />
            Informasi Approval
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-primary/10 rounded-md">
            <div><Label>Nama Approval</Label>
              <p>{{ notification.menu_info.approval_name }}</p>
            </div>
            <div><Label>Level</Label>
              <p>Level {{ notification.menu_info.level }}</p>
            </div>
            <div><Label>Menu</Label>
              <p>{{ notification.menu_info.menu_name }}</p>
            </div>
            <div><Label>Path</Label>
              <p class="text-xs break-all">{{ notification.menu_info.menu_path }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="!notification.status" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg">Approval Action</CardTitle>
          <CardDescription class="text-xs md:text-sm">Berikan keputusan Anda untuk customer ini</CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 space-y-4">
          <FieldX v-model="approvalCatatan" type="textarea" label="Catatan Approval"
            placeholder="Masukkan catatan approval..." hints="Wajib diisi untuk revisi dan reject" :rows="3"
            :disabled="submitting" />
          <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button @click="submitApproval('REJECT')" variant="outline" :disabled="submitting"
              class="gap-2 border-destructive text-destructive">
              <Ban class="h-4 w-4" /> Reject
            </Button>
            <Button @click="submitApproval('REVISI')" variant="destructive" :disabled="submitting" class="gap-2">
              <X class="h-4 w-4" /> Revisi
            </Button>
            <Button @click="submitApproval('APPROVED')" :disabled="submitting" class="gap-2">
              <Check class="h-4 w-4" /> Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
