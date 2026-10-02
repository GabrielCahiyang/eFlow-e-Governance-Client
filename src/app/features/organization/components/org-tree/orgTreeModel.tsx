import dagre from "@dagrejs/dagre";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { Organization, OrgType } from "../../../../types";
import { Building2, FileText, Folder, FolderTree, Landmark, Scale, Users } from "lucide-react";

const ORG_TYPE_ICONS: Record<OrgType, typeof Building2> = {
  lgu: Landmark,
  department: Building2,
  division: FolderTree,
  section: Folder,
  unit: FileText,
  board: Scale,
  committee: Users,
};

const ORG_TYPE_COLORS: Record<OrgType, string> = {
  lgu: 'bg-slate-800 text-white',
  department: 'bg-blue-600 text-white',
  division: 'bg-indigo-500 text-white',
  section: 'bg-violet-500 text-white',
  unit: 'bg-purple-400 text-white',
  board: 'bg-amber-600 text-white',
  committee: 'bg-teal-600 text-white',
};

export const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'division', label: 'Division' },
  { value: 'section', label: 'Section' },
  { value: 'unit', label: 'Unit' },
  { value: 'board', label: 'Board' },
  { value: 'committee', label: 'Committee' },
];

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  super_admin: 'bg-red-100 text-red-700',
  dept_head: 'bg-violet-100 text-violet-700',
  assistant_head: 'bg-indigo-100 text-indigo-700',
  employee: 'bg-emerald-100 text-emerald-700',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  super_admin: 'Admin',
  dept_head: 'Head',
  assistant_head: 'Assistant Head',
  employee: 'Employee',
};

// These dimensions are shared by the renderer and Dagre. Keeping one source
// of truth prevents long organization names from widening cards beyond the
// space the layout engine reserved for them.
export const ORG_NODE_WIDTH = 240;
export const ORG_NODE_HEIGHT = 90;
export const ORG_NODE_GAP = 32;

type PositionableNode = Pick<Node, 'id' | 'position'>;

export function nodesOverlap(first: PositionableNode, second: PositionableNode): boolean {
  return (
    first.position.x < second.position.x + ORG_NODE_WIDTH &&
    first.position.x + ORG_NODE_WIDTH > second.position.x &&
    first.position.y < second.position.y + ORG_NODE_HEIGHT &&
    first.position.y + ORG_NODE_HEIGHT > second.position.y
  );
}

export function hasNodeCollision(node: PositionableNode, nodes: PositionableNode[]): boolean {
  return nodes.some((candidate) => candidate.id !== node.id && nodesOverlap(node, candidate));
}

/**
 * Keeps the node the user dragged in place, then shifts any collided cards
 * sideways. Each moved card becomes the next collision source, so a crowded
 * row naturally makes room instead of rejecting the user's drag.
 */
export function resolveNodeCollisions(nodes: Node[], anchoredNodeId: string): Node[] {
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));
  const queue = [anchoredNodeId];
  const maxMoves = positionedNodes.length * positionedNodes.length;
  let moves = 0;

  while (queue.length > 0 && moves < maxMoves) {
    const sourceId = queue.shift();
    const source = positionedNodes.find((node) => node.id === sourceId);
    if (!source) continue;

    const collidedNodes = positionedNodes.filter(
      (candidate) => candidate.id !== source.id && nodesOverlap(source, candidate),
    );

    for (const target of collidedNodes) {
      if (target.id === anchoredNodeId) {
        const targetCenter = target.position.x + ORG_NODE_WIDTH / 2;
        const sourceCenter = source.position.x + ORG_NODE_WIDTH / 2;
        const moveRight =
          sourceCenter > targetCenter ||
          (sourceCenter === targetCenter && source.id.localeCompare(target.id) > 0);

        source.position.x = target.position.x + (moveRight ? ORG_NODE_WIDTH + ORG_NODE_GAP : -ORG_NODE_WIDTH - ORG_NODE_GAP);
        queue.push(source.id);
        moves += 1;
        continue;
      }

      const sourceCenter = source.position.x + ORG_NODE_WIDTH / 2;
      const targetCenter = target.position.x + ORG_NODE_WIDTH / 2;
      const moveRight =
        targetCenter > sourceCenter ||
        (targetCenter === sourceCenter && target.id.localeCompare(source.id) > 0);

      target.position.x = source.position.x + (moveRight ? ORG_NODE_WIDTH + ORG_NODE_GAP : -ORG_NODE_WIDTH - ORG_NODE_GAP);
      queue.push(target.id);
      moves += 1;
    }
  }

  return positionedNodes;
}

// ─── Dagre layout helper ─────────────────────────────────────────
export function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 88, nodesep: 64 });

  for (const node of nodes) {
    g.setNode(node.id, { width: ORG_NODE_WIDTH, height: ORG_NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - ORG_NODE_WIDTH / 2,
        y: pos.y - ORG_NODE_HEIGHT / 2,
      },
    };
  });
}

// ─── Build graph from flat org list ──────────────────────────────
export function buildGraph(orgs: Organization[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = orgs
    .filter((o) => o.is_active)
    .map((o) => ({
      id: o.id,
      type: 'orgNode',
      position: { x: 0, y: 0 },
      data: { ...o } as Record<string, unknown>,
    }));

  const edges: Edge[] = orgs
    .filter((o) => o.parent_id && o.is_active)
    .map((o) => ({
      id: `e-${o.parent_id}-${o.id}`,
      source: o.parent_id!,
      target: o.id,
      type: 'smoothstep',
      style: { stroke: '#d4d4d4', strokeWidth: 2 },
    }));

  return { nodes, edges };
}

// ─── Custom OrgNode Component ────────────────────────────────────
function OrgNodeComp({ data }: NodeProps) {
  const org = data as unknown as Organization;
  const isRoot = org.org_type === 'lgu';
  const Icon = ORG_TYPE_ICONS[org.org_type] || FolderTree;
  const colorClass = ORG_TYPE_COLORS[org.org_type] || 'bg-blue-600 text-white';

  return (
    <div
      className={`relative w-[240px] h-[90px] rounded-xl border shadow-sm p-3 transition-all
        ${isRoot ? 'bg-slate-900 text-white border-slate-700' : 'bg-white border-neutral-200'}
        hover:shadow-md`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-neutral-400" />
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${isRoot ? "bg-white/10 text-white" : "bg-neutral-100 text-neutral-600"}`}><Icon size={15} /></span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-[13px] truncate font-semibold
              ${isRoot ? 'text-white' : 'text-neutral-900'}`}
          >
            {org.name}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${colorClass}`}
        >
          {org.org_type}
        </span>
        {org.member_count != null && org.member_count > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 text-[9px] font-medium text-neutral-600">
            {org.member_count} members
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-neutral-400" />
    </div>
  );
}

export const nodeTypes = { orgNode: OrgNodeComp };

// ─── Context Menu ────────────────────────────────────────────────
