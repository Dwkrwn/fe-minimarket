<script setup lang="ts">
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { FieldSelect } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth";
import {
  Building2,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UsersRound,
  Workflow,
} from "lucide-vue-next";
import CompanyStructureFormDialog from "./components/CompanyStructureFormDialog.vue";
import CompanyStructureTree from "./components/CompanyStructureTree.vue";
import type { CompanyStructureRecord } from "./service";
import { useCompanyStructure } from "./useCompanyStructure";

const {
  selectedCompanyId,
  showInactive,
  search,
  isLoading,
  isRefreshing,
  isSubmitting,
  pageErrorMessage,
  dialogErrorMessage,
  selectedNodeId,
  selectedNode,
  companyLabel,
  filteredRecords,
  summary,
  treeNodes,
  isManageMode,
  isDialogOpen,
  isDeleteDialogOpen,
  dialogTitle,
  dialogDescription,
  deleteDialogDescription,
  dialogMode,
  isDialogReadonly,
  form,
  excludedParentIds,
  handleRefresh,
  deleteNode,
  cancelDelete,
  confirmDelete,
  toggleManageMode,
  openCreateDialog,
  openEditDialog,
  openReadDialog,
  setSelectedCompany,
  setSelectedCompanyDetail,
  setDialogOpen,
  submitDialog,
} = useCompanyStructure();

const authStore = useAuthStore();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const handleTreeSelect = (node: CompanyStructureRecord) => {
  if (isManageMode.value) {
    selectedNodeId.value = node.id;
    return;
  }

  openReadDialog(node);
};
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-[1700px] flex-col gap-4">
      <Card
        class="overflow-hidden rounded-[28px] border border-border bg-card p-0 shadow-sm"
      >
        <div class="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
          <div
            class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1
                  class="text-xl font-semibold tracking-tight text-foreground"
                >
                  Master Company Structure
                </h1>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                Susunan jabatan, penanggung jawab posisi, dan hubungan
                atasan-bawahan dalam company.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <div
                class="rounded-2xl border border-border bg-muted/50 px-3 py-2"
              >
                <p
                  class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Posisi Tampil
                </p>
                <p
                  class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  <UsersRound class="h-4 w-4 text-primary/70" />
                  {{ summary.total }}
                </p>
              </div>
              <div
                class="rounded-2xl border border-border bg-muted/50 px-3 py-2"
              >
                <p
                  class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Posisi Aktif
                </p>
                <p
                  class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  <Sparkles class="h-4 w-4 text-emerald-500/80" />
                  {{ summary.active }}
                </p>
              </div>
              <!-- <div
                class="rounded-2xl border border-border bg-muted/50 px-3 py-2"
              >
                <p
                  class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Jabatan Puncak
                </p>
                <p
                  class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  <GitBranch class="h-4 w-4 text-primary/70" />
                  {{ summary.roots }}
                </p>
              </div> -->
              <div
                class="rounded-2xl border border-border bg-muted/50 px-3 py-2"
              >
                <p
                  class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Level Struktur
                </p>
                <p
                  class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  <Workflow class="h-4 w-4 text-primary/70" />
                  {{ summary.maxLevel }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          class="grid gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[300px_minmax(0,1fr)_auto] xl:items-end"
        >
          <div class="space-y-2">
            <label
              class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              Company
            </label>
            <FieldSelect
              :model-value="selectedCompanyId"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_company`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama,kode',
                  filter_column_status: true,
                },
              }"
              valueField="id"
              displayField="nama"
              placeholder="Pilih company"
              class="w-full"
              @input="setSelectedCompany"
              @update:value-full="setSelectedCompanyDetail"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              Search
            </label>
            <div class="relative">
              <Search
                class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                v-model="search"
                placeholder="Cari jabatan atau user..."
                class="h-11 rounded-2xl border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div
            class="flex flex-col justify-end gap-3 sm:flex-row sm:items-center xl:justify-self-end"
          >
            <label
              class="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground"
            >
              <Switch v-model:checked="showInactive" />
              <span>Tampilkan posisi nonaktif</span>
            </label>

            <Button
              type="button"
              variant="outline"
              class="h-11 rounded-2xl border-border px-4 font-medium"
              :disabled="isRefreshing || isLoading"
              @click="handleRefresh"
            >
              <RefreshCw
                class="mr-2 h-4 w-4"
                :class="isRefreshing || isLoading ? 'animate-spin' : ''"
              />
              {{ isRefreshing || isLoading ? "Memuat..." : "Refresh" }}
            </Button>

            <Button
              v-if="isManageMode"
              type="button"
              class="h-11 rounded-2xl bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
              @click="openCreateDialog()"
            >
              <Plus class="mr-2 h-4 w-4" />
              Add Position
            </Button>
          </div>
        </div>
      </Card>

      <div
        v-if="pageErrorMessage"
        class="rounded-3xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive-foreground"
      >
        {{ pageErrorMessage }}
      </div>

      <Card
        class="overflow-hidden rounded-[30px] border border-border bg-card p-0 shadow-sm"
      >
        <div
          class="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-semibold text-foreground">
                {{ companyLabel }}
              </h2>
              <Badge
                variant="outline"
                class="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-primary"
              >
                {{ filteredRecords.length }} posisi tampil
              </Badge>
              <Badge
                v-if="selectedNode"
                variant="outline"
                class="rounded-full border-border bg-muted/50 px-3 py-1 text-foreground"
              >
                Selected: {{ selectedNode.jabatan }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">
              {{
                isManageMode
                  ? "Klik kartu untuk memilih. Gunakan tombol kecil pada kartu untuk tambah child atau edit."
                  : "Klik kartu untuk membuka detail posisi tanpa mengubah data."
              }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              class="rounded-full border-border bg-muted/50 px-3 py-1 text-muted-foreground"
            >
              {{ summary.vacancy }} posisi kosong
            </Badge>
            <Badge
              variant="outline"
              class="rounded-full border-border bg-muted/50 px-3 py-1 text-muted-foreground"
            >
              {{ summary.maxLevel }} level
            </Badge>
            <!-- <Badge
              variant="outline"
              class="rounded-full border-border bg-muted/50 px-3 py-1 text-muted-foreground"
            >
              {{ summary.roots }} jabatan puncak
            </Badge> -->
          </div>
        </div>

        <div class="relative">
          <div
            v-if="isRefreshing && !isLoading"
            class="pointer-events-none absolute right-4 top-4 z-10 rounded-full border border-primary/20 bg-background/95 px-3 py-1 text-xs font-medium text-primary shadow-sm"
          >
            Memperbarui data...
          </div>

          <div
            v-if="isLoading"
            class="grid gap-4 px-4 py-6 sm:grid-cols-2 2xl:grid-cols-4 sm:px-5"
          >
            <div
              v-for="index in 8"
              :key="index"
              class="rounded-[24px] border border-border bg-muted/30 p-4"
            >
              <Skeleton class="h-5 w-24 rounded-full bg-muted-foreground/20" />
              <Skeleton class="mt-3 h-5 w-36 bg-muted-foreground/20" />
              <Skeleton class="mt-2 h-4 w-28 bg-muted-foreground/20" />
              <Skeleton
                class="mt-4 h-14 w-full rounded-2xl bg-muted-foreground/20"
              />
              <Skeleton
                class="mt-3 h-12 w-full rounded-2xl bg-muted-foreground/20"
              />
            </div>
          </div>

          <div
            v-else-if="!selectedCompanyId"
            class="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center"
          >
            <Building2 class="h-10 w-10 text-muted-foreground" />
            <p class="mt-4 text-lg font-medium text-foreground">
              Pilih company terlebih dahulu
            </p>
            <p class="mt-2 max-w-md text-sm text-muted-foreground">
              Halaman ini akan memuat struktur organisasi setelah company
              dipilih dari field di atas.
            </p>
          </div>

          <div
            v-else-if="!filteredRecords.length"
            class="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center"
          >
            <Target class="h-10 w-10 text-muted-foreground" />
            <p class="mt-4 text-lg font-medium text-foreground">
              Belum ada node struktur yang cocok
            </p>
            <p class="mt-2 max-w-md text-sm text-muted-foreground">
              Coba ganti company, ubah kata kunci pencarian, atau tampilkan
              posisi nonaktif bila diperlukan.
            </p>
          </div>

          <div v-else class="px-4 py-4 sm:px-5">
            <ScrollArea
              class="h-[calc(100vh-13.5rem)] min-h-[560px] max-h-[920px]"
            >
              <div class="min-w-full py-4">
                <CompanyStructureTree
                  :nodes="treeNodes"
                  :selected-id="selectedNodeId"
                  :can-manage="isManageMode"
                  @toggle-manage="toggleManageMode()"
                  @select="handleTreeSelect($event)"
                  @edit="openEditDialog($event)"
                  @create-child="openCreateDialog($event)"
                  @delete="deleteNode($event)"
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>

      <CompanyStructureFormDialog
        :open="isDialogOpen"
        :title="dialogTitle"
        :description="dialogDescription"
        :mode="dialogMode"
        :readonly="isDialogReadonly"
        :form="form"
        :excluded-parent-ids="excludedParentIds"
        :submitting="isSubmitting"
        :error-message="dialogErrorMessage"
        @update:open="setDialogOpen($event)"
        @submit="submitDialog"
      />

      <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Posisi"
        :description="deleteDialogDescription"
        type="danger"
        confirm-text="Hapus"
        cancel-text="Batal"
        :is-loading="isSubmitting"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
        @update:open="
          (value) => {
            if (!value) cancelDelete();
          }
        "
      />
    </div>
  </div>
</template>
