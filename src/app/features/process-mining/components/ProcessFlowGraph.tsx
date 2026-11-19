import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DfgEdge, DfgNode, WorkflowStageName } from "../types";

const STAGE_ORDER: Record<WorkflowStageName, { step: string; col: number; lane: "mid" | "top" | "bottom" }> = {
  "Planning & Setup": { step: "01", col: 0, lane: "mid" },
  "Budget & Funding": { step: "02", col: 1, lane: "top" },
  "Task Execution": { step: "03", col: 1, lane: "bottom" },
  "Cash Advance & Liquidation": { step: "04", col: 2, lane: "top" },
  "Work Review & Approval": { step: "05", col: 2, lane: "bottom" },
  "Project Closure": { step: "06", col: 3, lane: "mid" },
};

const COL_GAP = 286;
const Y_POS = { top: 36, mid: 124, bottom: 214 };
const LAYOUT_STORAGE_PREFIX = "eflow:dfg-layout:v1";

type SavedNodePositions = Record<string, { x: number; y: number }>;

function readSavedPositions(scopeKey: string): SavedNodePositions {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(
      `${LAYOUT_STORAGE_PREFIX}:${scopeKey || "office"}`,
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedNodePositions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedPositions(scopeKey: string, positions: SavedNodePositions): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = `${LAYOUT_STORAGE_PREFIX}:${scopeKey || "office"}`;
    if (Object.keys(positions).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(positions));
    }
  } catch {
    // Ignore restricted/full storage.
  }
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} hr`;
  return `${Math.round((hours / 24) * 10) / 10} d`;
}

type StageNodeData = {
  step: string;
  label: string;
  eventCount: number;
  medianWaitHours: number;
  reworkCount: number;
  activeWaitingCount: number;
  isBottleneck: boolean;
  lane: "mid" | "top" | "bottom";
};

function StageFlowNode({ data }: NodeProps<Node<StageNodeData>>) {
  return (
    <div
      className={`pm-dfg-node ${
        data.isBottleneck
          ? "pm-dfg-node--bottleneck"
          : data.reworkCount > 0
            ? "pm-dfg-node--returned"
            : ""
      }`}
    >
      <Handle id="in" type="target" position={Position.Left} className="pm-handle" />
      <Handle id="top-in" type="target" position={Position.Top} className="pm-handle pm-handle--hidden" />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className="pm-handle pm-handle--hidden" />

      <div className="pm-dfg-node__top">
        <span className="pm-dfg-step">Stage {data.step}</span>
        <div className="pm-dfg-pills">
          {data.isBottleneck && (
            <span className="pm-badge pm-badge--medium">Slowest</span>
          )}
          {data.reworkCount > 0 && (
            <span className="pm-badge pm-badge--high">
              {data.reworkCount} sent back
            </span>
          )}
        </div>
      </div>

      <div className="pm-dfg-node__title">{data.label}</div>

      <div className="pm-dfg-node__meta">
        <span>{data.eventCount} actions</span>
        <span aria-hidden="true">·</span>
        <span>{formatHours(data.medianWaitHours)} typical</span>
        {data.activeWaitingCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-medium">
              {data.activeWaitingCount} active
            </span>
          </>
        )}
      </div>

      <Handle id="out" type="source" position={Position.Right} className="pm-handle" />
      <Handle id="top-out" type="source" position={Position.Top} className="pm-handle pm-handle--hidden" />
      <Handle id="bottom-out" type="source" position={Position.Bottom} className="pm-handle pm-handle--hidden" />
    </div>
  );
}

const nodeTypes = { stageNode: StageFlowNode };

function buildInitialNodes(
  nodes: DfgNode[],
  savedPositions: SavedNodePositions,
): Node<StageNodeData>[] {
  const presentCols = Array.from(
    new Set(
      nodes.map((n) => STAGE_ORDER[n.stage as WorkflowStageName]?.col ?? 0),
    ),
  ).sort((a, b) => a - b);
  const colIndexMap = new Map(presentCols.map((c, idx) => [c, idx]));

  return nodes.map((node, index) => {
    const meta = STAGE_ORDER[node.stage as WorkflowStageName] ?? {
      step: String(index + 1).padStart(2, "0"),
      col: index,
      lane: "mid" as const,
    };
    const visualCol = colIndexMap.get(meta.col) ?? index;
    const peersInCol = nodes.filter(
      (other) => (STAGE_ORDER[other.stage as WorkflowStageName]?.col ?? 0) === meta.col,
    );
    const lane = peersInCol.length === 1 ? "mid" : meta.lane;
    const saved = savedPositions[node.id];

    return {
      id: node.id,
      type: "stageNode",
      position: saved
        ? { x: saved.x, y: saved.y }
        : { x: 28 + visualCol * COL_GAP, y: Y_POS[lane] },
      data: {
        step: meta.step,
        label: node.label,
        eventCount: node.eventCount,
        medianWaitHours: node.medianWaitHours,
        reworkCount: node.reworkCount,
        activeWaitingCount: node.activeWaitingCount,
        isBottleneck: node.isBottleneck,
        lane,
      },
      draggable: true,
    };
  });
}

function buildRoutedEdges(
  edges: DfgEdge[],
  positionedNodes: Node<StageNodeData>[],
): Edge[] {
  const posById = new Map(
    positionedNodes.map((n) => [n.id, n.position]),
  );

  return edges
    .filter((edge) => edge.source !== edge.target)
    .map((edge) => {
      const isReturn = edge.kind === "rework";
      const isSlow = edge.kind === "bottleneck";
      const color = isReturn ? "#dc2626" : isSlow ? "#d97706" : "#0c6f6b";

      const srcPos = posById.get(edge.source) ?? { x: 0, y: 0 };
      const tgtPos = posById.get(edge.target) ?? { x: 0, y: 0 };
      const dx = tgtPos.x - srcPos.x;
      const dy = tgtPos.y - srcPos.y;
      const sameColumn = Math.abs(dx) < 140;

      let sourceHandle = "out";
      let targetHandle = "in";
      let edgeType: "default" | "smoothstep" = "default";

      if (isReturn || dx < -80) {
        // Connect cleanly through top or bottom edges when looping back
        edgeType = "smoothstep";
        if (sameColumn) {
          sourceHandle = dy >= 0 ? "bottom-out" : "top-out";
          targetHandle = dy >= 0 ? "top-in" : "bottom-in";
        } else {
          const upperHalf = srcPos.y < 120 && tgtPos.y < 120;
          sourceHandle = upperHalf ? "top-out" : "bottom-out";
          targetHandle = upperHalf ? "top-in" : "bottom-in";
        }
      } else if (sameColumn) {
        edgeType = "smoothstep";
        sourceHandle = dy >= 0 ? "bottom-out" : "top-out";
        targetHandle = dy >= 0 ? "top-in" : "bottom-in";
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: edgeType,
        label: `${edge.count}× · ${formatHours(edge.medianHours)}`,
        animated: isReturn,
        style: {
          stroke: color,
          strokeWidth: isReturn || isSlow ? 2 : 1.75,
          strokeDasharray: isReturn ? "5 4" : undefined,
        },
        labelStyle: {
          fontSize: 11,
          fontWeight: 600,
          fill: color,
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.94,
        },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      };
    });
}

export function ProcessFlowGraph({
  nodes,
  edges,
  layoutScopeKey = "office",
  onInspectStage,
}: {
  nodes: DfgNode[];
  edges: DfgEdge[];
  layoutScopeKey?: string;
  onInspectStage?: (stage: string) => void;
}) {
  const [savedPositions, setSavedPositions] = useState<SavedNodePositions>(() =>
    readSavedPositions(layoutScopeKey),
  );
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<StageNodeData>>(
    buildInitialNodes(nodes, savedPositions),
  );

  useEffect(() => {
    const loaded = readSavedPositions(layoutScopeKey);
    setSavedPositions(loaded);
  }, [layoutScopeKey]);

  useEffect(() => {
    setRfNodes(buildInitialNodes(nodes, savedPositions));
  }, [nodes, savedPositions, setRfNodes]);

  const flowEdges = useMemo(
    () => buildRoutedEdges(edges, rfNodes),
    [edges, rfNodes],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node<StageNodeData>) => {
      setSavedPositions((prev) => {
        const next = {
          ...prev,
          [draggedNode.id]: {
            x: Math.round(draggedNode.position.x),
            y: Math.round(draggedNode.position.y),
          },
        };
        writeSavedPositions(layoutScopeKey, next);
        return next;
      });
    },
    [layoutScopeKey],
  );

  const handleResetLayout = useCallback(() => {
    writeSavedPositions(layoutScopeKey, {});
    setSavedPositions({});
    setRfNodes(buildInitialNodes(nodes, {}));
  }, [layoutScopeKey, nodes, setRfNodes]);

  const handleNodeContextMenu = useCallback(
    (event: { preventDefault: () => void }, node: Node<StageNodeData>) => {
      if (!onInspectStage) return;
      event.preventDefault();
      onInspectStage(node.id);
    },
    [onInspectStage],
  );

  const hasCustomLayout = Object.keys(savedPositions).length > 0;
  const supportsFlowCanvas = typeof globalThis.ResizeObserver !== "undefined";

  if (!nodes.length) {
    return (
      <p className="ea-empty">
        No stage transitions recorded for the current filters.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {supportsFlowCanvas ? (
        <div className="pm-graph-wrap" aria-label="Discovered workflow graph">
          <ReactFlow
            nodes={rfNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeContextMenu={handleNodeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#cbd5e1"
            />
            <Panel position="top-left" className="pm-graph-hint">
              Drag boxes to arrange · Right-click a stage for actions
            </Panel>
            {hasCustomLayout && (
              <Panel position="top-right">
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="pm-graph-reset"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  Reset layout
                </button>
              </Panel>
            )}
            <Controls
              showInteractive={false}
              position="bottom-right"
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="space-y-2" aria-label="Discovered workflow graph">
          <div className="flex flex-wrap gap-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                onContextMenu={(event) => {
                  if (!onInspectStage) return;
                  event.preventDefault();
                  onInspectStage(node.id);
                }}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px]"
              >
                <span className="font-medium text-foreground">{node.label}</span>{" "}
                <span className="text-muted-foreground">({node.eventCount} actions)</span>
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            {edges
              .filter((edge) => edge.source !== edge.target)
              .map((edge) => (
                <li key={edge.id}>
                  {edge.source} → {edge.target} ({edge.count}× · {formatHours(edge.medianHours)} ·{" "}
                  {edge.kind === "rework"
                    ? "sent back"
                    : edge.kind === "bottleneck"
                      ? "slow"
                      : "normal"}
                  )
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
