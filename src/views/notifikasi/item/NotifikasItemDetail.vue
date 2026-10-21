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
  Download,
  Eye,
  ExternalLink,
  Image as ImageIcon,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getItemsNotifications,
  approveItemNotification,
  updateItemStatus,
  reviseItem,
  type ItemNotification,
} from "./service.item";
import { API_BASE_URL } from "@/lib/api";
import FieldX from "@/components/field/FieldX.vue";

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const notification = ref<ItemNotification | null>(null);
const approvalCatatan = ref("");
const currentImageIndex = ref(0);

// Preview image dialog
const showPreviewDialog = ref(false);
const previewImageUrl = ref("");
const previewFileName = ref("");

const notificationId = computed(() => route.params.id as string);

const getImageUrl = (imagePath: string | null) => {
  if (!imagePath) return null;
  const baseUrl = API_BASE_URL.replace("/api", "");
  return `${baseUrl}/${imagePath}`;
};

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
    const response = await getItemsNotifications(1, 100);
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
    const approvalListStr = localStorage.getItem("approval_list");
    if (!approvalListStr) {
      toast.error("Approval level not found", {
        description: "Please login again to set approval level",
      });
      return;
    }

    const approvalList = JSON.parse(approvalListStr);

    if (!Array.isArray(approvalList) || approvalList.length === 0) {
      toast.error("Invalid approval list", {
        description: "Approval list is empty",
      });
      return;
    }

    const approvalLevel = approvalList[0].level;

    if (approvalLevel === undefined || approvalLevel === null) {
      toast.error("Invalid approval level", {
        description: "Approval level is missing",
      });
      return;
    }

    // Handle REVISI or APPROVED
    if (status === "REVISI") {
      await reviseItem(
        notification.value.m_items_id ?? "",
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
    } else {
      // Update notification approval first
      await approveItemNotification(
        notification.value.id,
        approvalLevel,
        approvalCatatan.value,
      );
      // Then update item status
      await updateItemStatus(notification.value.m_items_id ?? "", status);
    }

    toast.success(
      `Item ${status === "APPROVED" ? "approved" : "revised"} successfully`,
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

const nextImage = () => {
  if (notification.value?.m_item?.m_items_images) {
    currentImageIndex.value =
      (currentImageIndex.value + 1) %
      notification.value.m_item.m_items_images.length;
  }
};

const prevImage = () => {
  if (notification.value?.m_item?.m_items_images) {
    const length = notification.value.m_item.m_items_images.length;
    currentImageIndex.value = (currentImageIndex.value - 1 + length) % length;
  }
};

// Preview image
const openImagePreview = (imagePath: string) => {
  const url = getImageUrl(imagePath);
  if (url) {
    previewImageUrl.value = url;
    previewFileName.value = imagePath.split("/").pop() || "image";
    showPreviewDialog.value = true;
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
          <span class="truncate">Item Approval</span>
        </h1>
        <p class="text-xs md:text-sm text-muted-foreground">
          Review and approve item request
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
                notification.user_default?.name || "N/A"
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

      <!-- Item Details Card -->
      <Card v-if="notification.m_item">
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <FileText class="h-5 w-5 shrink-0" />
            Informasi Item
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Detail lengkap item yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0 space-y-4 md:space-y-6">
          <!-- Basic Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Kode Item</Label
              >
              <p
                class="text-base md:text-lg font-bold text-primary font-mono break-all"
              >
                {{ notification.m_item.kode_item || "-" }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Status</Label
              >
              <div>
                <Badge
                  :variant="getStatusVariant(notification.m_item.status)"
                  class="text-xs md:text-sm"
                >
                  {{ notification.m_item.status }}
                </Badge>
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Nama Item</Label
              >
              <p class="text-sm md:text-base font-semibold">
                {{ notification.m_item.nama_item }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Nama Singkat</Label
              >
              <p class="text-sm md:text-base">
                {{ notification.m_item.nama_singkat }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Tipe Barang</Label
              >
              <p class="text-sm md:text-base capitalize">
                {{ notification.m_item.tipe_barang }}
              </p>
            </div>
            <div class="space-y-1">
              <Label
                class="text-xs md:text-sm font-medium text-muted-foreground"
                >Aktif</Label
              >
              <Badge
                :variant="
                  notification.m_item.is_active ? 'default' : 'secondary'
                "
                class="text-xs"
              >
                {{ notification.m_item.is_active ? "Ya" : "Tidak" }}
              </Badge>
            </div>
          </div>

          <Separator />

          <!-- Classification Info -->
          <div class="space-y-3">
            <h4
              class="text-xs md:text-sm font-semibold flex items-center gap-2"
            >
              <Package class="h-4 w-4" />
              Klasifikasi
            </h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Jenis</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.m_group_jeni?.nama_jenis || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Merek</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.m_group_merek?.nama_merek || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Tipe</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.m_group_tipe?.nama_tipe || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Ukuran</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.m_group_ukuran?.nama_ukuran || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Batch</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.m_group_batch?.nama_batch || "-" }}
                </p>
              </div>
              <div class="space-y-1">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Satuan</Label
                >
                <p class="text-sm md:text-base">
                  {{ notification.m_item.uom?.value1 || "-" }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Stock Info -->
          <div class="space-y-3">
            <h4 class="text-xs md:text-sm font-semibold">Informasi Stock</h4>
            <div class="grid grid-cols-2 gap-3 md:gap-4">
              <div class="p-3 md:p-4 bg-muted rounded-md">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Min Stock</Label
                >
                <p class="text-xl md:text-2xl font-bold">
                  {{ notification.m_item.min_stock }}
                </p>
              </div>
              <div class="p-3 md:p-4 bg-muted rounded-md">
                <Label
                  class="text-xs md:text-sm font-medium text-muted-foreground"
                  >Max Stock</Label
                >
                <p class="text-xl md:text-2xl font-bold">
                  {{ notification.m_item.max_stock }}
                </p>
              </div>
            </div>
          </div>

          <!-- Spesifikasi & Catatan -->
          <div v-if="notification.m_item.spesifikasi" class="space-y-2">
            <Separator />
            <Label class="text-xs md:text-sm font-semibold">Spesifikasi</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.m_item.spesifikasi }}
              </p>
            </div>
          </div>

          <div v-if="notification.m_item.catatan" class="space-y-2">
            <Label class="text-xs md:text-sm font-semibold">Catatan Item</Label>
            <div class="p-3 md:p-4 bg-muted rounded-md">
              <p class="text-sm md:text-base whitespace-pre-wrap">
                {{ notification.m_item.catatan }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Gambar Tab -->
      <Card
        v-if="
          notification.m_item?.m_items_images &&
          notification.m_item.m_items_images.length > 0
        "
      >
        <CardHeader class="p-4 md:p-6">
          <CardTitle class="text-base md:text-lg flex items-center gap-2">
            <ImageIcon class="h-5 w-5 shrink-0" />
            Gambar Item ({{ notification.m_item.m_items_images.length }})
          </CardTitle>
          <CardDescription class="text-xs md:text-sm"
            >Foto-foto item yang diajukan</CardDescription
          >
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <!-- Image Carousel -->
          <div class="space-y-4">
            <div class="relative w-full max-w-lg mx-auto">
              <div
                class="aspect-square border rounded-lg overflow-hidden bg-muted flex items-center justify-center cursor-pointer"
                @click="
                  openImagePreview(
                    notification.m_item!.m_items_images![currentImageIndex]
                      ?.gambar || '',
                  )
                "
              >
                <img
                  :src="
                    getImageUrl(
                      notification.m_item.m_items_images[currentImageIndex]
                        ?.gambar || null,
                    ) || ''
                  "
                  :alt="notification.m_item.nama_item"
                  class="w-full h-full object-contain"
                />
              </div>

              <!-- Navigation Buttons -->
              <div
                v-if="notification.m_item.m_items_images.length > 1"
                class="absolute inset-0 flex items-center justify-between px-2 md:px-4 pointer-events-none"
              >
                <Button
                  @click.stop="prevImage"
                  variant="secondary"
                  size="icon"
                  class="rounded-full pointer-events-auto shadow-lg h-8 w-8 md:h-10 md:w-10"
                >
                  <ArrowLeft class="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button
                  @click.stop="nextImage"
                  variant="secondary"
                  size="icon"
                  class="rounded-full pointer-events-auto shadow-lg h-8 w-8 md:h-10 md:w-10"
                >
                  <svg
                    class="h-3 w-3 md:h-4 md:w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                </Button>
              </div>

              <!-- Image Counter -->
              <div
                class="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 md:px-3 py-1 rounded-full"
              >
                {{ currentImageIndex + 1 }} /
                {{ notification.m_item.m_items_images.length }}
              </div>
            </div>

            <!-- Thumbnails -->
            <div
              v-if="notification.m_item.m_items_images.length > 1"
              class="flex gap-2 justify-center overflow-x-auto py-2"
            >
              <button
                v-for="(img, index) in notification.m_item.m_items_images"
                :key="index"
                @click="currentImageIndex = index"
                class="shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg border-2 overflow-hidden transition-all"
                :class="
                  index === currentImageIndex
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent opacity-60 hover:opacity-100'
                "
              >
                <img
                  :src="getImageUrl(img.gambar) || ''"
                  :alt="`Thumbnail ${index + 1}`"
                  class="w-full h-full object-cover"
                />
              </button>
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
            >Berikan keputusan Anda untuk Item ini</CardDescription
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
