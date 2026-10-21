<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import type { CompanyStructureTreeNode } from "../service";
import CompanyStructureNodeCard from "./CompanyStructureNodeCard.vue";

interface CompanyStructureFlowNodeData {
  node: CompanyStructureTreeNode;
  isSelected: boolean;
  canManage: boolean;
  onSelect: (node: CompanyStructureTreeNode) => void;
  onEdit: (node: CompanyStructureTreeNode) => void;
  onCreateChild: (node: CompanyStructureTreeNode) => void;
  onDelete: (node: CompanyStructureTreeNode) => void;
}

const props = defineProps<NodeProps<CompanyStructureFlowNodeData>>();
</script>

<template>
  <div class="company-structure-flow-node">
    <Handle
      id="company-structure-target"
      type="target"
      :position="Position.Top"
      :connectable="true"
      class="company-structure-flow-node__handle"
    />

    <CompanyStructureNodeCard
      :node="props.data.node"
      :selected="props.data.isSelected"
      :can-manage="props.data.canManage"
      @select="props.data.onSelect(props.data.node)"
      @edit="props.data.onEdit(props.data.node)"
      @create-child="props.data.onCreateChild(props.data.node)"
      @delete="props.data.onDelete(props.data.node)"
    />

    <Handle
      id="company-structure-source"
      type="source"
      :position="Position.Bottom"
      :connectable="true"
      class="company-structure-flow-node__handle"
    />
  </div>
</template>

<style scoped>
.company-structure-flow-node {
  position: relative;
  width: 248px;
}

.company-structure-flow-node__handle {
  left: 50%;
  width: 10px;
  height: 10px;
  border: 2px solid hsl(var(--primary));
  background: hsl(var(--background));
  transform: translateX(-50%);
  opacity: 1;
}
</style>
