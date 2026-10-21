<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Building2,
  CalendarClock,
  GitBranch,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-vue-next";
import type { CompanyStructureTreeNode } from "../service";
import { formatCompanyStructureDate } from "../service";

const props = defineProps<{
  node: CompanyStructureTreeNode;
  selected?: boolean;
  canManage?: boolean;
}>();

const emit = defineEmits<{
  select: [node: CompanyStructureTreeNode];
  edit: [node: CompanyStructureTreeNode];
  createChild: [node: CompanyStructureTreeNode];
  delete: [node: CompanyStructureTreeNode];
}>();

const effectiveRange = computed(() => {
  const start = formatCompanyStructureDate(props.node.effectiveStart);
  const end = formatCompanyStructureDate(props.node.effectiveEnd);

  if (start === "-" && end === "-") return "Periode belum diatur";
  return `${start} - ${end}`;
});

const handleCardKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  emit("select", props.node);
};
</script>

<template>
  <Card
    role="button"
    tabindex="0"
    class="company-structure-node-card__drag-handle group relative w-[248px] rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1"
    :class="selected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'"
    @click="emit('select', node)"
    @keydown="handleCardKeydown"
  >
    <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-2">
        <div class="flex items-center gap-2">
          <Badge
            variant="secondary"
            class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary"
          >
            Level {{ node.level }}
          </Badge>
          <Badge
            :variant="node.isActive ? 'default' : 'outline'"
            class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          >
            {{ node.isActive ? "Active" : "Inactive" }}
          </Badge>
        </div>

        <div>
          <p class="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
            {{ node.jabatan }}
          </p>
          <p class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 class="h-3.5 w-3.5 text-primary/70" />
            {{ node.companyName }}
          </p>
        </div>
      </div>

      <div v-if="canManage" class="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="nodrag h-8 w-8 rounded-xl border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          @click.stop="emit('createChild', node)"
        >
          <Plus class="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="nodrag h-8 w-8 rounded-xl border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          @click.stop="emit('edit', node)"
        >
          <Pencil class="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="nodrag h-8 w-8 rounded-xl border border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click.stop="emit('delete', node)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <Avatar class="h-9 w-9 border border-primary/25 bg-primary/10">
        <AvatarFallback class="bg-transparent text-sm font-semibold text-primary">
          {{ node.avatarInitials }}
        </AvatarFallback>
      </Avatar>

      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-foreground">
          {{ node.userName || "Posisi masih kosong" }}
        </p>
        <p class="truncate text-[11px] text-muted-foreground">
          {{ node.userUsername || node.userEmail || "Belum terhubung ke user_default" }}
        </p>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
      <div class="rounded-xl border border-border bg-muted/30 px-3 py-2">
        <p class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Child</p>
        <p class="mt-1 flex items-center gap-1 text-foreground">
          <GitBranch class="h-3.5 w-3.5 text-primary/70" />
          {{ node.children.length }}
        </p>
      </div>

      <div class="rounded-xl border border-border bg-muted/30 px-3 py-2">
        <p class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sequence</p>
        <p class="mt-1 text-foreground">
          #{{ node.sequence || 0 }}
        </p>
      </div>
    </div>

    <div class="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <CalendarClock class="h-3.5 w-3.5 text-primary/70" />
        Effective Range
      </p>
      <p class="mt-1 text-[11px] text-foreground/80">
        {{ effectiveRange }}
      </p>
    </div>

    <div
      v-if="node.catatan"
      class="mt-3 rounded-xl border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground"
    >
      <p class="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <UserRound class="h-3.5 w-3.5 text-primary/70" />
        Catatan
      </p>
      <p class="line-clamp-2">
        {{ node.catatan }}
      </p>
    </div>
  </Card>
</template>
