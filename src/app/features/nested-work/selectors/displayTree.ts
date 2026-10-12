import type {WorkNode} from '../types';
import {MAX_WORK_DEPTH} from './tree';

/** Input is already authorized by the caller. No capability or directory lookup. */
type DisplayNode = Pick<WorkNode, 'id' | 'parent_subtask_id' | 'sibling_order' | 'title'>;
export type WorkDisplayContext = 'missing_parent' | 'cycle' | null;
export interface WorkDisplayRow {
  id: string;
  parentId: string | null;
  /** Rendering edge only. A broken/missing edge never changes canonical parentId. */
  displayParentId: string | null;
  title: string;
  parentLabel: string | null;
  depth: number;
  indentLevel: number;
  hasChildren: boolean;
  path: readonly {id: string; title: string}[];
  pathLabel: string;
  context: WorkDisplayContext;
  pathTruncated: boolean;
}

const compareNodes = (a: DisplayNode, b: DisplayNode) =>
  a.sibling_order - b.sibling_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Stable iterative preorder, bounded by supplied node count even for cycles.
 * Paths retain at most eight supplied nodes; deeper malformed input remains
 * reachable with explicit incomplete context and capped visual indentation.
 * Canonical IDs are expected to be unique, as in WorkTreeSnapshot.
 */
export function buildWorkDisplayTree(nodes: readonly DisplayNode[]): WorkDisplayRow[] {
  const ordered = [...nodes].sort(compareNodes);
  const byId = new Map(ordered.map(node => [node.id, node]));
  const parents = new Map<string, string | null>();
  const contexts = new Map<string, WorkDisplayContext>();
  for (const node of ordered) {
    const missing = node.parent_subtask_id !== null && !byId.has(node.parent_subtask_id);
    parents.set(node.id, missing ? null : node.parent_subtask_id);
    if (missing) contexts.set(node.id, 'missing_parent');
  }

  // A functional parent graph can have one cycle per component. Break only its
  // earliest ordered cycle edge for display; retain the actual edge on the row.
  const resolved = new Set<string>();
  for (const node of ordered) {
    const chain: string[] = [], positions = new Map<string, number>();
    let id: string | null = node.id;
    while (id !== null && !resolved.has(id) && !positions.has(id)) {
      positions.set(id, chain.length);
      chain.push(id);
      id = parents.get(id) ?? null;
    }
    if (id !== null && positions.has(id)) {
      const cycle = chain.slice(positions.get(id)!);
      const anchor = cycle.map(key => byId.get(key)!).sort(compareNodes)[0];
      parents.set(anchor.id, null);
      contexts.set(anchor.id, 'cycle');
    }
    for (const key of chain) resolved.add(key);
  }

  const children = new Map<string | null, DisplayNode[]>();
  for (const node of ordered) {
    const parent = parents.get(node.id)!;
    const siblings = children.get(parent) ?? [];
    siblings.push(node);
    children.set(parent, siblings);
  }
  type Pending = {node: DisplayNode; depth: number; path: WorkDisplayRow['path']; context: WorkDisplayContext};
  const stack: Pending[] = (children.get(null) ?? []).map(node =>
    ({node, depth: 1, path: [], context: contexts.get(node.id) ?? null})).reverse();
  const rows: WorkDisplayRow[] = [];
  while (stack.length) {
    const {node, depth, path: parentPath, context} = stack.pop()!;
    const path = [...parentPath, {id: node.id, title: node.title}].slice(-MAX_WORK_DEPTH);
    const pathTruncated = depth > MAX_WORK_DEPTH;
    const labels = context === 'cycle' ? ['Cycle in hierarchy'] : context === 'missing_parent' ? ['Parent context unavailable'] : [];
    if (pathTruncated) labels.push('Earlier context unavailable');
    const descendants = children.get(node.id) ?? [];
    rows.push({id: node.id, parentId: node.parent_subtask_id, displayParentId: parents.get(node.id)!,
      title: node.title, parentLabel: node.parent_subtask_id === null ? null : byId.get(node.parent_subtask_id)?.title ?? 'Parent unavailable',
      depth, indentLevel: Math.min(depth - 1, 3), hasChildren: descendants.length > 0,
      path, pathLabel: [...labels, ...path.map(part => part.title)].join(' / '), context, pathTruncated});
    for (let index = descendants.length - 1; index >= 0; index--) {
      stack.push({node: descendants[index], depth: depth + 1, path, context});
    }
  }
  return rows;
}

/** Remove only the focused node's display ancestors, leaving other branches and
 * the focused node's own disclosure state unchanged. Unknown IDs do nothing.
 */
export function expandWorkDisplayFocus(rows: readonly WorkDisplayRow[], collapsedIds: ReadonlySet<string>, focusedNodeId?: string): Set<string> {
  const next = new Set(collapsedIds), byId = new Map(rows.map(row => [row.id, row]));
  let id = focusedNodeId ? byId.get(focusedNodeId)?.displayParentId : null;
  const seen = new Set(focusedNodeId ? [focusedNodeId] : []);
  while (id && !seen.has(id)) {
    seen.add(id);
    next.delete(id);
    id = byId.get(id)?.displayParentId;
  }
  return next;
}

/** Caller controls collapse state. Persist the returned set in that actor/root
 * scope when focus expands a hidden descendant. Rows convey no work authority.
 */
export function selectWorkDisplayTree(nodes: readonly DisplayNode[], collapsedIds: ReadonlySet<string>, focusedNodeId?: string) {
  const allRows = buildWorkDisplayTree(nodes);
  const expanded = expandWorkDisplayFocus(allRows, collapsedIds, focusedNodeId);
  const hidden = new Set<string>();
  const rows = allRows.filter(row => {
    if (row.displayParentId !== null && (hidden.has(row.displayParentId) || expanded.has(row.displayParentId))) {
      hidden.add(row.id);
      return false;
    }
    return true;
  });
  return {rows, collapsedIds: expanded};
}

/** Pure view state; actor switches discard other actors' IDs, root switches
 * retain this actor's unrelated root state. No browser storage or global cache.
 */
export interface WorkCollapseState {
  actorId: string | null;
  roots: ReadonlyMap<string, ReadonlySet<string>>;
}
export function selectWorkCollapsedIds(state: WorkCollapseState | undefined, actorId: string | null, rootId: string): Set<string> {
  return new Set(actorId && state?.actorId === actorId ? state.roots.get(rootId) : []);
}
export function updateWorkCollapsedIds(state: WorkCollapseState | undefined, actorId: string | null, rootId: string, collapsedIds: ReadonlySet<string>): WorkCollapseState {
  const roots = new Map(actorId && state?.actorId === actorId ? state.roots : []);
  if (actorId) roots.set(rootId, new Set(collapsedIds));
  return {actorId, roots};
}
