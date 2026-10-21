<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  CalendarRange,
  FileText,
  GitBranch,
  Mail,
  PanelRightClose,
  UserRound,
} from "lucide-vue-next";
import type { CompanyStructureSummary, CompanyStructureTreeNode } from "../service";
import { formatCompanyStructureDate } from "../service";

const props = defineProps<{
  companyLabel: string;
  selectedNode: CompanyStructureTreeNode | null;
  selectedParent: CompanyStructureTreeNode | null;
  summary: CompanyStructureSummary;
}>();

const effectiveRange = computed(() => {
  if (!props.selectedNode) return "-";

  const start = formatCompanyStructureDate(props.selectedNode.effectiveStart);
  const end = formatCompanyStructureDate(props.selectedNode.effectiveEnd);
  if (start === "-" && end === "-") return "Belum ditentukan";
  return `${start} - ${end}`;
});
</script>

<template>
  <Card class="h-full rounded-3xl border border-border bg-card p-0 shadow-sm">
      <div class="border-b border-border px-5 py-4">
        <div class="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
          <PanelRightClose class="h-4 w-4" />
          Detail Posisi
        </div>
        <p class="mt-2 text-lg font-semibold text-foreground">
          {{ selectedNode ? selectedNode.jabatan : "Pilih node struktur" }}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ companyLabel }}
      </p>
    </div>

    <div class="space-y-5 px-5 py-5">
      <div v-if="selectedNode" class="space-y-5">
        <div class="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div class="flex items-center gap-3">
            <Avatar class="h-12 w-12 border border-primary/30 bg-primary/10">
              <AvatarFallback class="bg-transparent text-sm font-semibold text-primary">
                {{ selectedNode.avatarInitials }}
              </AvatarFallback>
            </Avatar>

            <div class="min-w-0">
              <p class="truncate text-base font-semibold text-foreground">
                {{ selectedNode.userName || "Posisi kosong" }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ selectedNode.userUsername || selectedNode.userEmail || "Belum terhubung ke user_default" }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <Badge class="rounded-full px-2.5 py-0.5">
              Level {{ selectedNode.level }}
            </Badge>
            <Badge variant="outline" class="rounded-full border-primary/30 px-2.5 py-0.5 text-primary">
              {{ selectedNode.isActive ? "Aktif" : "Nonaktif" }}
            </Badge>
            <Badge variant="secondary" class="rounded-full px-2.5 py-0.5">
              {{ selectedNode.children.length }} bawahan langsung
            </Badge>
          </div>
        </div>

        <div class="grid gap-3">
          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Building2 class="h-4 w-4 text-primary/70" />
              Company
            </p>
            <p class="mt-2 text-sm text-foreground">
              {{ selectedNode.companyName }}
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <GitBranch class="h-4 w-4 text-primary/70" />
              Atasan Langsung
            </p>
            <p class="mt-2 text-sm text-foreground">
              {{ selectedParent?.jabatan || "Jabatan puncak" }}
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarRange class="h-4 w-4 text-primary/70" />
              Periode Berlaku
            </p>
            <p class="mt-2 text-sm text-foreground">
              {{ effectiveRange }}
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <UserRound class="h-4 w-4 text-primary/70" />
              User Default ID
            </p>
            <p class="mt-2 break-all text-sm text-foreground">
              {{ selectedNode.userDefaultId || "-" }}
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Mail class="h-4 w-4 text-primary/70" />
              Kontak
            </p>
            <p class="mt-2 break-all text-sm text-foreground">
              {{ selectedNode.userEmail || "-" }}
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
            <p class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <FileText class="h-4 w-4 text-primary/70" />
              Catatan
            </p>
            <p class="mt-2 text-sm leading-relaxed text-foreground">
              {{ selectedNode.catatan || "Tidak ada catatan tambahan." }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <p class="text-sm font-medium text-foreground">
          Belum ada node yang dipilih
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          Klik salah satu posisi di chart untuk melihat detail relasi, user, dan masa aktifnya.
        </p>
      </div>

      <Separator class="bg-border" />

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
          <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total Posisi</p>
          <p class="mt-2 text-xl font-semibold text-foreground">{{ summary.total }}</p>
        </div>

        <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
          <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Posisi Kosong</p>
          <p class="mt-2 text-xl font-semibold text-foreground">{{ summary.vacancy }}</p>
        </div>

        <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
          <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Jabatan Puncak</p>
          <p class="mt-2 text-xl font-semibold text-foreground">{{ summary.roots }}</p>
        </div>

        <div class="rounded-2xl border border-border bg-muted/30 p-3.5">
          <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Kedalaman Level</p>
          <p class="mt-2 text-xl font-semibold text-foreground">{{ summary.maxLevel }}</p>
        </div>
      </div>
    </div>
  </Card>
</template>
