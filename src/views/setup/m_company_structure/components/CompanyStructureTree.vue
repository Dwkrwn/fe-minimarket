<script setup lang="ts">
import dagre from "dagre";
import { computed, markRaw, nextTick, ref, watch } from "vue";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { Button } from "@/components/ui/button";
import {
  MarkerType,
  Position,
  VueFlow,
  useVueFlow,
  type Edge,
  type EdgeTypesObject,
  type Node,
  type NodeTypesObject,
} from "@vue-flow/core";
import { Eye, Pencil } from "lucide-vue-next";
import type { CompanyStructureTreeNode } from "../service";
import CompanyStructureFlowEdge from "./CompanyStructureFlowEdge.vue";
import CompanyStructureFlowNode from "./CompanyStructureFlowNode.vue";

interface CompanyStructureFlowNodeData {
  node: CompanyStructureTreeNode;
  isSelected: boolean;
  canManage: boolean;
  onSelect: (node: CompanyStructureTreeNode) => void;
  onEdit: (node: CompanyStructureTreeNode) => void;
  onCreateChild: (node: CompanyStructureTreeNode) => void;
  onDelete: (node: CompanyStructureTreeNode) => void;
}

const NODE_WIDTH = 248;
const NODE_HEIGHT = 274;
const NODE_GAP_X = 46;
const NODE_GAP_Y = 96;
const SOURCE_HANDLE_ID = "company-structure-source";
const TARGET_HANDLE_ID = "company-structure-target";

const props = defineProps<{
  nodes: CompanyStructureTreeNode[];
  selectedId?: string | null;
  canManage?: boolean;
}>();

const emit = defineEmits<{
  select: [node: CompanyStructureTreeNode];
  edit: [node: CompanyStructureTreeNode];
  createChild: [node: CompanyStructureTreeNode];
  delete: [node: CompanyStructureTreeNode];
  toggleManage: [];
}>();

const nodeTypes: NodeTypesObject = {
  companyStructure: markRaw(CompanyStructureFlowNode),
};

const edgeTypes: EdgeTypesObject = {
  companyStructure: markRaw(CompanyStructureFlowEdge),
};

const activeEdgeId = ref<string | null>(null);
const draggedPositions = ref<Record<string, { x: number; y: number }>>({});

const {
  fitView,
  onEdgeClick,
  onEdgeDoubleClick,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onNodeDragStop,
  updateNodeInternals,
} = useVueFlow();

const sortNodes = (nodes: CompanyStructureTreeNode[]) =>
  [...nodes].sort((leftNode, rightNode) => {
    if (leftNode.level !== rightNode.level) {
      return leftNode.level - rightNode.level;
    }

    if (leftNode.sequence !== rightNode.sequence) {
      return leftNode.sequence - rightNode.sequence;
    }

    return leftNode.jabatan.localeCompare(rightNode.jabatan);
  });

const flattenTree = (tree: CompanyStructureTreeNode[]) => {
  const nodes: Node<CompanyStructureFlowNodeData>[] = [];
  const edges: Edge[] = [];
  const signature: string[] = [];

  const visit = (
    currentNode: CompanyStructureTreeNode,
    parentNode: CompanyStructureTreeNode | null,
  ) => {
    signature.push(
      [
        currentNode.id,
        parentNode?.id ?? "root",
        currentNode.level,
        currentNode.sequence,
        currentNode.children.length,
      ].join(":"),
    );

    nodes.push({
      id: currentNode.id,
      type: "companyStructure",
      position: { x: 0, y: 0 },
        data: {
          node: currentNode,
          isSelected: props.selectedId === currentNode.id,
          canManage: Boolean(props.canManage),
          onSelect: (node) => emit("select", node),
          onEdit: (node) => emit("edit", node),
          onCreateChild: (node) => emit("createChild", node),
          onDelete: (node) => emit("delete", node),
      },
    });

    if (parentNode) {
      edges.push({
        id: `${parentNode.id}-${currentNode.id}`,
        source: parentNode.id,
        target: currentNode.id,
        sourceHandle: SOURCE_HANDLE_ID,
        targetHandle: TARGET_HANDLE_ID,
        type: "companyStructure",
        style: {
          stroke: activeEdgeId.value === `${parentNode.id}-${currentNode.id}` ? "#0f172a" : "#2563eb",
          strokeWidth: "2.25",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: activeEdgeId.value === `${parentNode.id}-${currentNode.id}` ? "#0f172a" : "#94a3b8",
        },
        zIndex: activeEdgeId.value === `${parentNode.id}-${currentNode.id}` ? 2 : 1,
      });
    }

    sortNodes(currentNode.children).forEach((childNode) => visit(childNode, currentNode));
  };

  sortNodes(tree).forEach((rootNode) => visit(rootNode, null));

  return {
    nodes,
    edges,
    signature: signature.join("|"),
  };
};

const layoutGraph = (
  rawNodes: Node<CompanyStructureFlowNodeData>[],
  rawEdges: Edge[],
) => {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    ranker: "tight-tree",
    nodesep: NODE_GAP_X,
    ranksep: NODE_GAP_Y,
    marginx: 48,
    marginy: 48,
  });

  rawNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  rawEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const nodes = rawNodes.map((node) => {
    const position = graph.node(node.id);
    const draggedPosition = draggedPositions.value[node.id];

    return {
      ...node,
      draggable: true,
      dragHandle: ".company-structure-node-card__drag-handle",
      selectable: true,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      position: draggedPosition ?? {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });

  const edges = rawEdges.map((edge) => ({
    ...edge,
    animated: false,
    selectable: true,
    updatable: false,
    class: activeEdgeId.value === edge.id ? "company-structure-flow__edge--active" : undefined,
  }));

  return { nodes, edges };
};

const flattenedGraph = computed(() => flattenTree(props.nodes));

const layoutedGraph = computed(() =>
  layoutGraph(flattenedGraph.value.nodes, flattenedGraph.value.edges),
);

const flowNodes = computed(() => layoutedGraph.value.nodes);

const flowEdges = computed(() => layoutedGraph.value.edges);

const flowKey = computed(() => flattenedGraph.value.signature || "empty");

watch(
  () => flowKey.value,
  async () => {
    const validIds = new Set(flattenedGraph.value.nodes.map((node) => node.id));

    draggedPositions.value = Object.fromEntries(
      Object.entries(draggedPositions.value).filter(([id]) => validIds.has(id)),
    );

    if (!flowNodes.value.length) {
      return;
    }

    await nextTick();
    updateNodeInternals(flowNodes.value.map((node) => node.id));
    await nextTick();
    fitView({
      padding: 0.2,
      includeHiddenNodes: false,
      duration: 0,
    });
  },
  { immediate: true },
);

onEdgeClick(({ edge }) => {
  activeEdgeId.value = edge.id;
});

onEdgeDoubleClick(({ edge }) => {
  activeEdgeId.value = edge.id;
});

onEdgeMouseEnter(({ edge }) => {
  activeEdgeId.value = edge.id;
});

onEdgeMouseLeave(() => {
  activeEdgeId.value = null;
});

onNodeDragStop(({ node }) => {
  draggedPositions.value = {
    ...draggedPositions.value,
    [node.id]: {
      x: node.position.x,
      y: node.position.y,
    },
  };
});
</script>

<template>
  <div
    v-if="!nodes.length"
    class="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 px-6 py-10 text-center"
  >
    <div class="max-w-md space-y-2">
      <p class="text-base font-medium text-foreground">Belum ada struktur yang bisa ditampilkan</p>
      <p class="text-sm text-muted-foreground">
        Pilih company lain atau tambahkan posisi pertama untuk mulai membangun hierarki.
      </p>
    </div>
  </div>

  <div
    v-else
    class="company-structure-flow"
  >
    <div class="company-structure-flow__toolbar">
      <Button
        type="button"
        :variant="canManage ? 'default' : 'outline'"
        class="h-9 rounded-xl px-3"
        @click="emit('toggleManage')"
      >
        <component :is="canManage ? Pencil : Eye" class="mr-2 h-4 w-4" />
        {{ canManage ? "Mode Kelola" : "Mode Baca" }}
      </Button>
    </div>

    <VueFlow
      :key="flowKey"
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :min-zoom="0.35"
      :max-zoom="1.6"
      :default-viewport="{ zoom: 0.9 }"
      :fit-view-on-init="true"
      :fit-view-on-init-options="{ padding: 0.2, includeHiddenNodes: false }"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      :zoom-on-double-click="false"
      :edges-updatable="false"
      class="company-structure-flow__canvas"
    >
      <Background />
      <Controls />
    </VueFlow>
  </div>
</template>

<style scoped>
.company-structure-flow {
  position: relative;
  min-height: 560px;
  overflow: hidden;
  border-radius: 1.75rem;
  border: 1px solid hsl(var(--border));
  background:
    radial-gradient(circle at top, hsl(var(--primary) / 0.08), transparent 28%),
    linear-gradient(180deg, hsl(var(--background)), hsl(var(--muted) / 0.2));
}

.company-structure-flow__toolbar {
  position: absolute;
  right: 1rem;
  top: 1rem;
  z-index: 5;
}

.company-structure-flow__canvas {
  height: calc(100vh - 16rem);
  min-height: 560px;
  background: transparent;
}

.company-structure-flow :deep(.vue-flow__node-companyStructure) {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0;
}

.company-structure-flow :deep(.vue-flow__pane) {
  cursor: grab;
}

.company-structure-flow :deep(.vue-flow__pane.dragging) {
  cursor: grabbing;
}

.company-structure-flow :deep(.vue-flow__edge-path) {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.company-structure-flow :deep(.company-structure-flow__edge--active .vue-flow__edge-path) {
  stroke: #0f172a;
  stroke-width: 2.7;
}

.company-structure-flow :deep(.vue-flow__arrowhead) {
  fill: #94a3b8;
}

.company-structure-flow :deep(.company-structure-flow__edge--active .vue-flow__arrowhead) {
  fill: #0f172a;
}

.company-structure-flow :deep(.vue-flow__edge-text) {
  fill: hsl(var(--foreground));
}

.company-structure-flow :deep(.vue-flow__background) {
  background:
    radial-gradient(circle at center, hsl(var(--primary) / 0.08) 1px, transparent 1px);
  background-size: 26px 26px;
}

.company-structure-flow :deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card) / 0.92);
  box-shadow: 0 12px 24px hsl(0 0% 0% / 0.12);
}

.company-structure-flow :deep(.vue-flow__controls-button) {
  border-bottom: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--foreground));
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.company-structure-flow :deep(.vue-flow__controls-button:hover) {
  background: hsl(var(--muted));
}

.company-structure-flow :deep(.vue-flow__controls-button svg) {
  width: 1rem;
  height: 1rem;
  color: currentColor;
}

.company-structure-flow :deep(.vue-flow__controls-button svg *) {
  stroke: currentColor;
  fill: none;
}

.company-structure-flow :deep(.vue-flow__controls-button:last-child) {
  border-bottom: 0;
}
</style>
