<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Ban,
  Clock,
  User,
  FileText,
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import FieldX from "@/components/field/FieldX.vue";
import { useAuthStore } from "@/stores/auth";
import {
  getCustomerById,
  type CustomerChangeValue,
} from "@/views/marketing/master/m_customer/service";
import { getUnifiedNotifications } from "../service";
import {
  approveCustomerChange,
  getCustomerChangeLogById,
  getCustomerChangeNotificationById,
  rejectCustomerChange,
  reviseCustomerChange,
  type CustomerChangeNotification,
} from "./service.m_customer_change";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const loading = ref(true);
const submitting = ref(false);
const approvalCatatan = ref("");
const customerData = ref<any>(null);
const groupedNotifications = ref<CustomerChangeNotification[]>([]);

const notificationId = computed(() => String(route.params.id || ""));
const currentSection = computed(() => {
  const section = route.query.section;
  if (section === "pending" || section === "revisi" || section === "approval") {
    return section;
  }

  return "approval" as const;
});

const latestNotification = computed(() => groupedNotifications.value[0] || null);
const customerId = computed(() => {
  const notification = latestNotification.value;
  return String(
    notification?.m_customer_change_log?.customer_id ||
      (notification as any)?.m_customer_id ||
      "",
  );
});
const isApprovalSection = computed(() => currentSection.value === "approval");
const sectionTitle = computed(() => {
  switch (currentSection.value) {
    case "pending":
      return "Perubahan Customer Menunggu Persetujuan";
    case "revisi":
      return "Perubahan Customer Revisi";
    default:
      return "Approval Perubahan Customer";
  }
});

const customerUnitMap = computed(() => {
  const map = new Map<string, any>();

  for (const unit of customerData.value?.m_customer_unit_bisnis || []) {
    const key = String(unit.id || unit.customer_ub_id || unit.unit_bisnis_id || "");
    if (key) map.set(key, unit);
  }

  return map;
});

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
};

const formatNumber = (value: unknown) => Number(value || 0).toLocaleString("id-ID");

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

const parseChangeValues = (changeValues: unknown): CustomerChangeValue[] => {
  if (Array.isArray(changeValues)) return changeValues as CustomerChangeValue[];

  if (typeof changeValues === "string") {
    try {
      const parsed = JSON.parse(changeValues);
      return Array.isArray(parsed) ? (parsed as CustomerChangeValue[]) : [];
    } catch {
      return [];
    }
  }

  return [];
};

const comparisonRows = computed(() => {
  const rowMap = new Map<
    string,
    {
      key: string;
      unitName: string;
      oldKreditLimit: unknown;
      newKreditLimit: unknown;
      oldTop: unknown;
      newTop: unknown;
    }
  >();

  for (const notification of groupedNotifications.value) {
    const changeLog = notification.m_customer_change_log;
    if (!changeLog) continue;

    const unitKey = String(
      changeLog.customer_ub_id || changeLog.customer_ub?.id || notification.id,
    );
    const currentUnit = customerUnitMap.value.get(unitKey);
    const unitName =
      firstValue(
        changeLog.customer_ub?.m_unit_bisnis?.nama_comp,
        changeLog.customer_ub?.m_unit_bisnis?.nama_unit_bisnis,
        currentUnit?.m_unit_bisni?.nama_comp,
        currentUnit?.m_unit_bisnis?.nama_comp,
        currentUnit?.m_unit_bisnis?.nama_unit_bisnis,
        currentUnit?.unit_bisnis?.nama_comp,
        currentUnit?.unit_bisnis?.nama_unit_bisnis,
        changeLog.customer_ub?.unit_bisnis_id,
        currentUnit?.unit_bisnis_id,
        "-",
      ) || "-";

    const row =
      rowMap.get(unitKey) ||
      {
        key: unitKey,
        unitName,
        oldKreditLimit: firstValue(currentUnit?.kredit_limit, "-"),
        newKreditLimit: "-",
        oldTop: firstValue(currentUnit?.top, "-"),
        newTop: "-",
      };

    for (const change of parseChangeValues(changeLog.change_values)) {
      if (change.field === "kredit_limit") {
        row.oldKreditLimit = firstValue(currentUnit?.kredit_limit, change.old_value, "-");
        row.newKreditLimit = firstValue(change.new_value, "-");
      }

      if (change.field === "top") {
        row.oldTop = firstValue(currentUnit?.top, change.old_value, "-");
        row.newTop = firstValue(change.new_value, "-");
      }
    }

    rowMap.set(unitKey, row);
  }

  return Array.from(rowMap.values()).sort((a, b) =>
    a.unitName.localeCompare(b.unitName),
  );
});

const getSenderName = (notif: CustomerChangeNotification | null) =>
  firstValue(notif?.user_default?.name, "N/A");

const getApprovalLevel = () => {
  const approval = authStore.getApprovalList().find(
    (item: any) =>
      item.path === "/marketing/master/m_customer" &&
      item.tipe_approve?.toUpperCase() === "MENYETUJUI",
  );
  return approval?.level ?? null;
};

const getSectionRows = (response: Awaited<ReturnType<typeof getUnifiedNotifications>>) => {
  switch (currentSection.value) {
    case "pending":
      return response.data.pending_approval || [];
    case "revisi":
      return response.data.revisi || [];
    default:
      return response.data.approval || [];
  }
};

const hydrateCustomerChangeNotification = async (item: any) => {
  const detail = await getCustomerChangeNotificationById(String(item.id));
  const logId = detail.m_customer_log_id || (item as any).m_customer_log_id;
  const changeLog =
    detail.m_customer_change_log ||
    (logId ? await getCustomerChangeLogById(String(logId)) : null);

  return {
    ...item,
    ...detail,
    m_customer_change_log: changeLog,
  } as CustomerChangeNotification;
};

const fetchNotificationDetail = async () => {
  try {
    loading.value = true;

    const unified = await getUnifiedNotifications(1, 200, true);
    const rows = getSectionRows(unified).filter(
      (item: any) =>
        item.notification_type === "m_customer_change" ||
        item.notification_type === "customer_change",
    );

    const currentRow = rows.find(
      (item: any) => String(item.id) === notificationId.value,
    );

    if (!currentRow) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    const currentNotification = await hydrateCustomerChangeNotification(currentRow);
    const selectedCustomerId = String(
      currentNotification.m_customer_change_log?.customer_id || "",
    );

    if (!selectedCustomerId) {
      toast.error("Customer change log tidak memiliki customer_id");
      router.push("/notifikasi");
      return;
    }

    const hydratedNotifications = await Promise.all(
      rows.map((item: any) => hydrateCustomerChangeNotification(item)),
    );

    const detailNotifications = hydratedNotifications.filter(
      (item) =>
        String(item.m_customer_change_log?.customer_id || "") ===
        selectedCustomerId,
    );

    groupedNotifications.value = detailNotifications.sort(
      (a, b) =>
        new Date(b.createdAt || b.updatedAt || 0).getTime() -
        new Date(a.createdAt || a.updatedAt || 0).getTime(),
    );

    approvalCatatan.value = latestNotification.value?.approval_catatan || "";

    const customerResponse = await getCustomerById(selectedCustomerId);
    if (customerResponse?.status === "success") {
      customerData.value = customerResponse.data;
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


const submitApproval = async (status: "APPROVED" | "REVISI" | "REJECT") => {
  if (!groupedNotifications.value.length) return;

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
    for (const notification of groupedNotifications.value) {
      if (status === "APPROVED") {
        await approveCustomerChange(notification, level, approvalCatatan.value);
      } else if (status === "REVISI") {
        await reviseCustomerChange(notification, level, approvalCatatan.value);
      } else {
        await rejectCustomerChange(notification, level, approvalCatatan.value);
      }
    }

    toast.success(`Perubahan customer ${status.toLowerCase()} berhasil`);
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
        <h1 class="text-xl md:text-2xl font-bold text-foreground">{{ sectionTitle }}</h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review perbandingan kredit limit dan ToP customer
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

    <div v-else-if="latestNotification" class="space-y-4 md:space-y-6">
      <Card class="border-l-4 border-l-primary">
        <CardHeader class="p-4 md:p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="min-w-0">
              <CardTitle class="text-base md:text-lg flex items-center gap-2 flex-wrap">
                <RefreshCw class="h-5 w-5" />
                <span>{{ customerData?.nama_customer || latestNotification.title }}</span>
              </CardTitle>
              <CardDescription class="mt-1 text-sm">
                {{ latestNotification.approval_message || 'Pengajuan perubahan customer' }}
              </CardDescription>
            </div>
            <Badge :variant="getStatusVariant(latestNotification.status_name || '')" class="shrink-0 self-start">
              {{ latestNotification.status_name || 'PENDING' }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div class="space-y-1">
              <Label class="text-muted-foreground">Kode Customer</Label>
              <p class="font-medium">{{ customerData?.kode_customer || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-muted-foreground">Nama Customer</Label>
              <p class="font-medium">{{ customerData?.nama_customer || '-' }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-muted-foreground">Jumlah Perubahan</Label>
              <p class="font-medium">{{ groupedNotifications.length }}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-muted-foreground">Pengaju</Label>
              <p class="font-medium">{{ getSenderName(latestNotification) }}</p>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
            <div class="flex items-center gap-2">
              <User class="h-4 w-4 text-muted-foreground shrink-0" />
              <Label class="text-muted-foreground shrink-0">Pengaju:</Label>
              <span class="font-medium truncate">
                {{ getSenderName(latestNotification) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-xs md:text-sm">
                {{ formatDateTime(latestNotification.createdAt) }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5" />
            Perbandingan Kredit Limit dan ToP
          </CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Data lama diambil dari master customer saat ini, data baru dari change log yang diajukan.
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0">
          <div v-if="comparisonRows.length > 0" class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium border-r">Unit Bisnis</th>
                  <th class="px-3 py-2 text-left font-medium border-r">Kredit Limit Lama</th>
                  <th class="px-3 py-2 text-left font-medium border-r">Kredit Limit Baru</th>
                  <th class="px-3 py-2 text-left font-medium border-r">ToP Lama</th>
                  <th class="px-3 py-2 text-left font-medium">ToP Baru</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in comparisonRows" :key="row.key" class="border-t">
                  <td class="px-3 py-2 border-r">{{ row.unitName }}</td>
                  <td class="px-3 py-2 border-r">{{ row.oldKreditLimit === '-' ? '-' : formatNumber(row.oldKreditLimit) }}</td>
                  <td class="px-3 py-2 border-r font-medium text-primary">{{ row.newKreditLimit === '-' ? '-' : formatNumber(row.newKreditLimit) }}</td>
                  <td class="px-3 py-2 border-r">{{ row.oldTop === '-' ? '-' : formatNumber(row.oldTop) }}</td>
                  <td class="px-3 py-2 font-medium text-primary">{{ row.newTop === '-' ? '-' : formatNumber(row.newTop) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-muted-foreground">Tidak ada detail perubahan yang ditemukan.</p>
        </CardContent>
      </Card>

      <Card v-if="groupedNotifications.length > 0">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg">Daftar Log Perubahan</CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Setiap baris merepresentasikan satu change log per unit bisnis.
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 space-y-3">
          <div
            v-for="notification in groupedNotifications"
            :key="notification.id"
            class="rounded-lg border p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">
                {{ notification.m_customer_change_log?.customer_ub?.m_unit_bisnis?.nama_comp || 'Unit bisnis tidak diketahui' }}
              </div>
              <Badge :variant="getStatusVariant(notification.status_name || '')">
                {{ notification.status_name || 'PENDING' }}
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground">
              {{ formatDateTime(notification.createdAt) }}
            </div>
            <div class="space-y-1 text-sm">
              <div
                v-for="change in parseChangeValues(notification.m_customer_change_log?.change_values)"
                :key="`${notification.id}-${change.field}`"
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <span class="font-medium uppercase">{{ change.field }}</span>
                <span>
                  {{ formatNumber(change.old_value) }} ->
                  <span class="text-primary font-medium">{{ formatNumber(change.new_value) }}</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="isApprovalSection" class="border-2 border-dashed">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg">Approval Action</CardTitle>
          <CardDescription class="text-xs md:text-sm">
            Keputusan approval akan diproses untuk seluruh perubahan customer pada group ini.
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 space-y-4">
          <FieldX
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan approval..."
            hints="Wajib diisi untuk revisi dan reject"
            :rows="3"
            :disabled="submitting"
          />
          <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              @click="submitApproval('REJECT')"
              variant="outline"
              :disabled="submitting"
              class="gap-2 border-destructive text-destructive"
            >
              <Ban class="h-4 w-4" /> Reject
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



