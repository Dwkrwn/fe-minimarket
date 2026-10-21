<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  Users,
  User,
  FileText,
  Calendar,
  AlertCircle,
  Ban,
  Building2,
  Phone,
  Mail,
  Globe,
  CreditCard,
  MapPin,
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
  getSupplierNotifications,
  reviseSupplier,
  approveSupplier,
  rejectSupplier,
  type SupplierNotification,
} from "./service.supplier";
import { getSupplierById } from "@/views/purchasing/master/m_supplier/service";
import { useAuthStore } from "@/stores/auth";
import FieldX from "@/components/field/FieldX.vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<SupplierNotification | null>(null);
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
    const response = await getSupplierNotifications(1, 100);
    const found = response.data.find((n) => n.id === notificationId.value);

    if (!found) {
      toast.error("Notification not found");
      router.push("/notifikasi");
      return;
    }

    let hydratedNotification: any = { ...found };

    // Re-fetch full Supplier detail
    if (found.m_supplier_id) {
      try {
        const supplierResponse = await getSupplierById(found.m_supplier_id);
        hydratedNotification.m_supplier = supplierResponse.data;
      } catch (error) {
        console.error("Error fetching supplier detail:", error);
      }
    } else if (found.m_supplier) {
      hydratedNotification.m_supplier = found.m_supplier;
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
    // Get approval info from localStorage
    const approvalList = authStore.getApprovalList();
    const supplierApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/master/m_supplier" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!supplierApproval) {
      toast.error("Approval configuration not found", {
        description: "Anda tidak memiliki hak untuk menyetujui Supplier",
      });
      return;
    }

    const approvalLevel = supplierApproval.level;

    if (status === "APPROVED") {
      await approveSupplier(
        notification.value.m_supplier_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
      toast.success("Supplier approved successfully");
    } else {
      await reviseSupplier(
        notification.value.m_supplier_id!,
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
      toast.success("Supplier sent for revision");
    }

    router.push("/notifikasi");
  } catch (error: any) {
    toast.error(
      `Failed to ${status === "APPROVED" ? "approve" : "revise"} supplier`,
      {
        description: error.message || "An error occurred",
      },
    );
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
    const supplierApproval = approvalList.find(
      (a: any) =>
        a.path === "/purchasing/master/m_supplier" &&
        a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!supplierApproval) {
      toast.error("Approval configuration not found", {
        description: "Anda tidak memiliki hak untuk reject Supplier",
      });
      return;
    }

    const approvalLevel = supplierApproval.level;

    await rejectSupplier(
      notification.value.m_supplier_id!,
      notification.value.id,
      approvalLevel,
      approvalCatatan.value,
    );

    toast.success("Supplier rejected successfully");
    router.push("/notifikasi");
  } catch (error: any) {
    toast.error("Failed to reject supplier", {
      description: error.message || "An error occurred",
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
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
};

onMounted(() => {
  fetchNotificationDetail();
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 md:space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="router.push('/notifikasi')">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">
            Supplier Approval Detail
          </h1>
          <p class="text-sm text-muted-foreground mt-1">
            Review and approve supplier information
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton class="h-6 w-48" />
          <Skeleton class="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent class="space-y-3">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>

    <!-- Content -->
    <template v-else-if="notification">
      <!-- Notification Info -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <Users class="h-5 w-5 text-primary" />
                <CardTitle class="text-xl">{{ notification.title }}</CardTitle>
              </div>
              <CardDescription class="text-base">{{
                notification.approval_message
              }}</CardDescription>
            </div>
            <Badge :variant="getStatusVariant(notification.status_name || '')">
              {{ notification.status_name || "PENDING" }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex items-center gap-2 text-sm">
              <User class="h-4 w-4 text-muted-foreground" />
              <span class="text-muted-foreground">Requested by:</span>
              <span class="font-medium">{{
                notification.user_default?.name || "-"
              }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Calendar class="h-4 w-4 text-muted-foreground" />
              <span class="text-muted-foreground">Date:</span>
              <span class="font-medium">{{
                formatDateTime(notification.createdAt)
              }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Clock class="h-4 w-4 text-muted-foreground" />
              <span class="text-muted-foreground">Approval Level:</span>
              <span class="font-medium"
                >Level {{ notification.approval_level }}</span
              >
            </div>
          </div>

          <Separator v-if="notification.approval_catatan" />

          <div v-if="notification.approval_catatan" class="space-y-2">
            <div class="flex items-center gap-2">
              <AlertCircle class="h-4 w-4 text-destructive" />
              <Label class="text-sm font-semibold">Previous Notes:</Label>
            </div>
            <div class="bg-destructive/10 p-3 rounded-md text-sm">
              {{ notification.approval_catatan }}
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Supplier Detail -->
      <Card v-if="notification.m_supplier">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Building2 class="h-5 w-5" />
            Supplier Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs default-value="general" class="w-full">
            <TabsList class="grid w-full grid-cols-3">
              <TabsTrigger value="general">General Info</TabsTrigger>
              <TabsTrigger value="rekening">Bank Accounts</TabsTrigger>
              <TabsTrigger value="alamat">Addresses</TabsTrigger>
            </TabsList>

            <!-- General Info Tab -->
            <TabsContent value="general" class="space-y-4 mt-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Kode Supplier</Label
                  >
                  <p class="text-sm font-medium">
                    {{ notification.m_supplier.kode_supplier || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Nama Supplier</Label
                  >
                  <p class="text-sm font-medium">
                    {{ notification.m_supplier.nama_supp }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Tipe Supplier</Label
                  >
                  <p class="text-sm font-medium">
                    {{ notification.m_supplier.tipe_supp?.value1 || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">NPWP</Label>
                  <p class="text-sm font-medium">
                    {{ notification.m_supplier.npwp_supp || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Top</Label>
                  <p class="text-sm font-medium">
                    {{ notification.m_supplier.top?.value1 || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Currency</Label>
                  <p class="text-sm font-medium">
                    {{
                      notification.m_supplier.m_currency?.kode_currency || "-"
                    }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Tax Status</Label
                  >
                  <Badge
                    :variant="
                      notification.m_supplier.is_tax ? 'default' : 'secondary'
                    "
                  >
                    {{ notification.m_supplier.is_tax ? "PKP" : "Non-PKP" }}
                  </Badge>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Status</Label>
                  <Badge
                    :variant="
                      notification.m_supplier.is_active
                        ? 'default'
                        : 'secondary'
                    "
                  >
                    {{
                      notification.m_supplier.is_active ? "Active" : "Inactive"
                    }}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div class="space-y-2">
                <Label class="text-sm text-muted-foreground">Alamat</Label>
                <p class="text-sm">{{ notification.m_supplier.alamat_supp }}</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Negara</Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.negara_supp }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Provinsi</Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.provinsi_supp }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Kota</Label>
                  <p class="text-sm">{{ notification.m_supplier.kota_supp }}</p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Kecamatan</Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.kecamatan_supp || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground">Kode Pos</Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.kodepos || "-" }}
                  </p>
                </div>
              </div>

              <Separator />

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label
                    class="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <Phone class="h-3 w-3" />
                    Telepon
                  </Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.no_telp || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label
                    class="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <Phone class="h-3 w-3" />
                    Fax
                  </Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.no_fax || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label
                    class="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <Mail class="h-3 w-3" />
                    Email
                  </Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.email || "-" }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label
                    class="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <Globe class="h-3 w-3" />
                    Website
                  </Label>
                  <p class="text-sm">
                    {{ notification.m_supplier.website || "-" }}
                  </p>
                </div>
              </div>

              <Separator />

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Contact Person 1</Label
                  >
                  <p class="text-sm">
                    {{ notification.m_supplier.cp1 }} -
                    {{ notification.m_supplier.no_cp1 }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="text-sm text-muted-foreground"
                    >Contact Person 2</Label
                  >
                  <p class="text-sm">
                    {{
                      notification.m_supplier.cp2 &&
                      notification.m_supplier.no_cp2
                        ? `${notification.m_supplier.cp2} - ${notification.m_supplier.no_cp2}`
                        : "-"
                    }}
                  </p>
                </div>
              </div>

              <div v-if="notification.m_supplier.catatan" class="space-y-2">
                <Label class="text-sm text-muted-foreground">Catatan</Label>
                <p class="text-sm">{{ notification.m_supplier.catatan }}</p>
              </div>
            </TabsContent>

            <!-- Bank Accounts Tab -->
            <TabsContent value="rekening" class="mt-4">
              <div
                v-if="
                  notification.m_supplier.m_supplier_d_rekenings &&
                  notification.m_supplier.m_supplier_d_rekenings.length > 0
                "
                class="rounded-md border"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank</TableHead>
                      <TableHead>No. Rekening</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="rek in notification.m_supplier
                        .m_supplier_d_rekenings"
                      :key="rek.id"
                    >
                      <TableCell>{{ rek.bank || "-" }}</TableCell>
                      <TableCell>{{ rek.no_rek || "-" }}</TableCell>
                      <TableCell>
                        <Badge
                          v-if="rek.is_default"
                          variant="default"
                          class="text-xs"
                          >Default</Badge
                        >
                        <span v-else class="text-muted-foreground">-</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div v-else class="text-center py-8 text-muted-foreground">
                <CreditCard class="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No bank accounts registered</p>
              </div>
            </TabsContent>

            <!-- Addresses Tab -->
            <TabsContent value="alamat" class="mt-4">
              <div
                v-if="
                  notification.m_supplier.m_supplier_d_alamats &&
                  notification.m_supplier.m_supplier_d_alamats.length > 0
                "
                class="space-y-4"
              >
                <Card
                  v-for="alamat in notification.m_supplier.m_supplier_d_alamats"
                  :key="alamat.id"
                >
                  <CardHeader>
                    <CardTitle class="text-base flex items-center gap-2">
                      <MapPin class="h-4 w-4" />
                      {{ alamat.jenis_almt_id || "Address" }}
                    </CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-3">
                    <div class="space-y-2">
                      <Label class="text-sm text-muted-foreground"
                        >Alamat</Label
                      >
                      <p class="text-sm">{{ alamat.alamat || "-" }}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Provinsi</Label
                        >
                        <p class="text-sm">{{ alamat.provinsi || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Kota</Label
                        >
                        <p class="text-sm">{{ alamat.kota || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Kecamatan</Label
                        >
                        <p class="text-sm">{{ alamat.kecamatan || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Kode Pos</Label
                        >
                        <p class="text-sm">{{ alamat.kodepos || "-" }}</p>
                      </div>
                    </div>
                    <Separator />
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Telepon</Label
                        >
                        <p class="text-sm">{{ alamat.telp || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground">Fax</Label>
                        <p class="text-sm">{{ alamat.fax || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground"
                          >Email</Label
                        >
                        <p class="text-sm">{{ alamat.email || "-" }}</p>
                      </div>
                      <div class="space-y-1">
                        <Label class="text-xs text-muted-foreground">PIC</Label>
                        <p class="text-sm">{{ alamat.nama_pic || "-" }}</p>
                      </div>
                    </div>
                    <div v-if="alamat.catatan" class="space-y-1">
                      <Label class="text-xs text-muted-foreground"
                        >Catatan</Label
                      >
                      <p class="text-sm">{{ alamat.catatan }}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div v-else class="text-center py-8 text-muted-foreground">
                <MapPin class="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No additional addresses registered</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <!-- Approval Actions -->
      <Card>
        <CardHeader>
          <CardTitle>Approval Action</CardTitle>
          <CardDescription>Provide your decision and feedback</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="approval-notes">Notes / Feedback</Label>
            <FieldX
              id="approval-notes"
              v-model="approvalCatatan"
              type="textarea"
              placeholder="Enter your notes or reason for revision/rejection..."
              :rows="4"
            />
          </div>

          <div class="flex flex-wrap justify-end gap-3">
            <Button
              @click="handleApproval('REVISI')"
              :disabled="submitting"
              variant="outline"
              class="flex-1 md:flex-none"
            >
              <AlertCircle class="h-4 w-4 mr-2" />
              {{ submitting ? "Processing..." : "Revise" }}
            </Button>
            <Button
              @click="handleReject"
              :disabled="submitting"
              variant="destructive"
              class="flex-1 md:flex-none"
            >
              <Ban class="h-4 w-4 mr-2" />
              {{ submitting ? "Processing..." : "Reject" }}
            </Button>
            <Button
              @click="handleApproval('APPROVED')"
              :disabled="submitting"
              class="flex-1 md:flex-none"
            >
              <Check class="h-4 w-4 mr-2" />
              {{ submitting ? "Processing..." : "Approve" }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
