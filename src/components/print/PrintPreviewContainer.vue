<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ArrowLeft, Loader2, Printer } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    loading?: boolean;
    fileName?: string;
    showToolbar?: boolean;
    showBackButton?: boolean;
    pageClass?: string;
    previewClass?: string;
    contentClass?: string;
    innerClass?: string;
    downloadText?: string;
  }>(),
  {
    title: "Preview Dokumen",
    description: "Preview dan cetak dokumen",
    loading: false,
    fileName: "document.pdf",
    showToolbar: true,
    showBackButton: false,
    pageClass: "min-h-screen bg-background",
    previewClass: "max-w-4xl mx-auto p-6 print:p-0 print:max-w-none pdf-content",
    contentClass:
      "bg-white border rounded-lg shadow-sm print:border-0 print:shadow-none print:rounded-none",
    innerClass: "p-8 print:p-6 text-gray-900",
    downloadText: "Download PDF",
  },
);

const emit = defineEmits<{
  back: [];
}>();

const generating = ref(false);
const printRef = ref<HTMLDivElement | null>(null);

const resolvedFileName = computed(() => {
  const trimmed = props.fileName?.trim();
  if (!trimmed) return "document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
});

const waitForImages = async (root?: HTMLElement | null) => {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );
};

const sanitizeUnsupportedColors = (element: HTMLElement) => {
  const clonedWindow = element.ownerDocument.defaultView;
  if (!clonedWindow) return;

  const fallbackByProperty: Record<string, string> = {
    color: "#111827",
    backgroundColor: "transparent",
    borderColor: "#e5e7eb",
    borderTopColor: "#e5e7eb",
    borderRightColor: "#e5e7eb",
    borderBottomColor: "#e5e7eb",
    borderLeftColor: "#e5e7eb",
    outlineColor: "#e5e7eb",
    textDecorationColor: "#111827",
  };

  const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];

  nodes.forEach((node) => {
    const styles = clonedWindow.getComputedStyle(node);

    Object.entries(fallbackByProperty).forEach(([property, fallback]) => {
      const value = styles[property as keyof CSSStyleDeclaration];
      if (typeof value === "string" && value.includes("oklch")) {
        node.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), fallback);
      }
    });

    const boxShadow = styles.boxShadow;
    if (boxShadow?.includes("oklch")) {
      node.style.boxShadow = "none";
    }
  });
};

const downloadPdf = async () => {
  if (!printRef.value) {
    toast.error("Gagal membuat PDF", { description: "Konten belum siap" });
    return;
  }

  try {
    generating.value = true;
    await nextTick();

    const element = printRef.value;
    if (!element) return;

    element.classList.add("pdf-generating");
    await nextTick();
    await waitForImages(element);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      onclone: (_document, clonedElement) => {
        sanitizeUnsupportedColors(clonedElement as HTMLElement);
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pdfMargin = 8;
    const imgWidth = pageWidth - pdfMargin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = pdfMargin;

    pdf.addImage(imgData, "PNG", pdfMargin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - pdfMargin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + pdfMargin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", pdfMargin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - pdfMargin * 2;
    }

    pdf.save(resolvedFileName.value);
    toast.success("PDF berhasil didownload");
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("Gagal membuat PDF", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    printRef.value?.classList.remove("pdf-generating");
    generating.value = false;
  }
};

defineExpose({
  downloadPdf,
});
</script>

<template>
  <div :class="pageClass">
    <div
      v-if="showToolbar"
      class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-4 no-print"
    >
      <div class="flex items-center justify-between max-w-4xl mx-auto gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <Button
            v-if="showBackButton"
            variant="ghost"
            size="icon"
            @click="emit('back')"
          >
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div class="min-w-0">
            <h1 class="text-xl font-bold truncate">{{ title }}</h1>
            <p class="text-sm text-muted-foreground truncate">
              {{ description }}
            </p>
          </div>
        </div>
        <Button
          @click="downloadPdf"
          :disabled="loading || generating"
          class="gap-2 shrink-0"
        >
          <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
          <Printer v-else class="h-4 w-4" />
          {{ downloadText }}
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center min-h-[60vh]">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else ref="printRef" :class="previewClass">
      <div :class="contentClass">
        <div :class="innerClass">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
