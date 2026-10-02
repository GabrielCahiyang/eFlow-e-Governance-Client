import { isAdminRole } from "../../../../shared/roles";
import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { assignUserToOrg, deleteOrg, recreateOrg } from "../../../../../lib/supabaseService";
import { useOrgs, useProfiles } from "../../../../hooks/useSupabaseData";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization } from "../../../../types";
import { AssignHeadModal } from "./AssignHeadModal";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { OrgModal } from "./OrgModal";
import { UsersPanel } from "./UsersPanel";
import { UndoNotifications, type UndoItem } from "./UndoNotifications";
import { buildGraph, layoutNodes, nodeTypes, resolveNodeCollisions } from "./orgTreeModel";
import { Building2, Focus, LayoutDashboard, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { Tooltip } from "@vibe/core";

function OrgTreeBuilderInner() {
  const { orgs, loading: orgsLoading } = useOrgs();
  const { profiles, loading: profilesLoading } = useProfiles();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [showOrgModal, setShowOrgModal] = React.useState(false);
  const [editingOrg, setEditingOrg] = React.useState<Organization | undefined>(undefined);
  const [addingParentId, setAddingParentId] = React.useState<string | undefined>(undefined);
  const [showHeadModal, setShowHeadModal] = React.useState(false);
  const [headOrg, setHeadOrg] = React.useState<Organization | null>(null);
  const [search, setSearch] = React.useState('');
  const reactFlowInstance = useReactFlow();
  const pendingLayoutRef = React.useRef(false);


  const [undoStack, setUndoStack] = React.useState<UndoItem[]>([]);

  // Periodically clean up expired undo items
  React.useEffect(() => {
    const interval = setInterval(() => {
      setUndoStack((prev) => {
        const now = Date.now();
        const active = prev.filter((item) => item.expiresAt > now);
        if (active.length !== prev.length) {
          return active;
        }
        return prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Build graph from orgs
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraph(orgs);
    const laidOut = layoutNodes(newNodes, newEdges);
    setNodes(laidOut);
    setEdges(newEdges);
    pendingLayoutRef.current = false;
  }, [orgs, setNodes, setEdges]);

  const runLayout = React.useCallback(() => {
    setNodes((nds) => layoutNodes(nds, edges));
  }, [setNodes, edges]);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  // Auto-layout after operations
  React.useEffect(() => {
    if (pendingLayoutRef.current) {
      pendingLayoutRef.current = false;
      runLayout();
    }
  }, [nodes.length, runLayout]);

  // Context menu handlers
  const handleNodeContext = React.useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, orgId: node.id });
    },
    []
  );

  const handlePaneContext = React.useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({ x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY });
    },
    []
  );

  const handleNodeDragStop = React.useCallback(
    (_: unknown, node: Node) => {
      setNodes((currentNodes) => {
        const nodesAtDrop = currentNodes.map((currentNode) =>
          currentNode.id === node.id
            ? { ...currentNode, position: { ...node.position } }
            : currentNode,
        );

        return resolveNodeCollisions(nodesAtDrop, node.id);
      });
    },
    [setNodes],
  );

  const handleAddChild = React.useCallback(() => {
    if (contextMenu?.orgId) {
      setAddingParentId(contextMenu.orgId);
    } else {
      setAddingParentId(undefined);
    }
    setEditingOrg(undefined);
    setShowOrgModal(true);
  }, [contextMenu]);

  const handleEdit = React.useCallback(() => {
    const org = orgs.find((o) => o.id === contextMenu?.orgId);
    if (org) {
      setEditingOrg(org);
      setAddingParentId(undefined);
      setShowOrgModal(true);
    }
  }, [contextMenu, orgs]);

  const handleAssignHead = React.useCallback(() => {
    const org = orgs.find((o) => o.id === contextMenu?.orgId);
    if (org) {
      setHeadOrg(org);
      setShowHeadModal(true);
    }
  }, [contextMenu, orgs]);

  const handleDelete = React.useCallback(async () => {
    const orgId = contextMenu?.orgId;
    if (!orgId) return;

    const org = orgs.find((o) => o.id === orgId);
    if (!org) return;

    if (org.org_type === 'lgu') {
      toast('Cannot delete the root LGU node', 'error');
      return;
    }

    try {
      await deleteOrg(orgId);
      const toastId = Math.random().toString(36).slice(2);
      setUndoStack((prev) => [
        ...prev,
        {
          id: toastId,
          org,
          expiresAt: Date.now() + 30000,
        },
      ]);
      toast(`"${org.name}" deleted`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to delete', 'error');
    }
  }, [contextMenu, orgs, toast]);

  const handleUndo = React.useCallback(async (item: UndoItem) => {
    try {
      await recreateOrg(item.org);
      toast(`Restored "${item.org.name}"`, 'success');
      setUndoStack((prev) => prev.filter((t) => t.id !== item.id));
    } catch (err: any) {
      toast(err?.message || 'Failed to restore', 'error');
    }
  }, [toast]);

  const dismissUndo = React.useCallback((id: string) => {
    setUndoStack((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Drag-drop from users panel onto org nodes
  const onNodeDrop: React.DragEventHandler<HTMLDivElement> = React.useCallback(
    async (event) => {
      const userId = event.dataTransfer.getData('userId');
      if (!userId) return;
      event.preventDefault();

      const target = event.target as HTMLElement;
      const nodeEl = target.closest('.react-flow__node');
      if (!nodeEl) return;
      const nodeId = nodeEl.getAttribute('data-id');
      if (!nodeId) return;

      try {
        await assignUserToOrg(userId, nodeId);
        const profile = profiles.find((p) => p.id === userId);
        const org = orgs.find((o) => o.id === nodeId);
        toast(
          `${profile?.full_name || 'User'} assigned to ${org?.name || 'org'}`,
          'success'
        );
      } catch (err: any) {
        toast(err?.message || 'Failed to assign user', 'error');
      }
    },
    [profiles, orgs, toast]
  );

  const onDragOverNode: React.DragEventHandler<HTMLDivElement> = React.useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Can delete check
  const canDelete = React.useCallback(
    (orgId?: string) => {
      if (!orgId) return false;
      const hasChildren = orgs.some((o) => o.parent_id === orgId);
      const hasUsers = profiles.some((p) => p.org_id === orgId);
      const org = orgs.find((o) => o.id === orgId);
      if (org?.org_type === 'lgu') return false;
      return !hasChildren && !hasUsers;
    },
    [orgs, profiles]
  );

  // Attach node properties for drag-drop
  const nodesWithHandlers: Node[] = React.useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as Record<string, unknown>),
          member_count: profiles.filter((p) => p.org_id === n.id && !isAdminRole(p.role)).length,
        },
      })),
    [nodes, profiles]
  );

  if (orgsLoading || profilesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          <span className="text-[13px] font-normal text-neutral-500">
            Loading org structure...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Main canvas area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        <UndoNotifications items={undoStack} onUndo={handleUndo} onDismiss={dismissUndo} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-3 shrink-0">
          <div className="mr-auto min-w-[220px]"><div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900"><Building2 size={16} className="text-teal-700" /> Organization structure</div><p className="mt-0.5 text-[9.5px] text-neutral-500">Right-click a node to edit it, add a child, or manage leadership.</p></div>
          <button
            onClick={() => { setAddingParentId(undefined); setEditingOrg(undefined); setShowOrgModal(true); }}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-[11px] font-medium hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={13} /> Add organization</span>
          </button>
          <button
            onClick={runLayout}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-1.5"><LayoutDashboard size={13} /> Auto layout</span>
          </button>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <Tooltip content="Zoom in on the organization map"><button
            onClick={() => reactFlowInstance.zoomIn()}
            aria-label="Zoom in"
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
          >
            <ZoomIn size={14} />
          </button></Tooltip>
          <Tooltip content="Zoom out from the organization map"><button
            onClick={() => reactFlowInstance.zoomOut()}
            aria-label="Zoom out"
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
          >
            <ZoomOut size={14} />
          </button></Tooltip>
          <Tooltip content="Fit the full organization map in view"><button
            onClick={() => reactFlowInstance.fitView({ padding: 0.2 })}
            aria-label="Fit organization map"
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
          >
            <Focus size={14} />
          </button></Tooltip>
        </div>

        {/* Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeContextMenu={handleNodeContext}
            onPaneContextMenu={handlePaneContext}
            onPaneClick={closeContextMenu}
            onNodeClick={closeContextMenu}
            onNodeDragStop={handleNodeDragStop}
            onDrop={onNodeDrop}
            onDragOver={onDragOverNode}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      {/* Users panel */}
      <UsersPanel
        profiles={profiles.filter((p) => !isAdminRole(p.role))}
        orgs={orgs}
        search={search}
        setSearch={setSearch}
      />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={closeContextMenu}
          onAddChild={handleAddChild}
          onEdit={handleEdit}
          onAssignHead={handleAssignHead}
          onDelete={handleDelete}
          canDelete={canDelete(contextMenu.orgId)}
        />
      )}

      {/* Modals */}
      <OrgModal
        isOpen={showOrgModal}
        onClose={() => { setShowOrgModal(false); setEditingOrg(undefined); setAddingParentId(undefined); }}
        org={editingOrg}
        parentId={addingParentId}
        orgs={orgs}
        profiles={profiles}
      />
      <AssignHeadModal
        isOpen={showHeadModal}
        onClose={() => { setShowHeadModal(false); setHeadOrg(null); }}
        org={headOrg}
        orgs={orgs}
        profiles={profiles}
      />
    </div>
  );
}

export function OrgTreeBuilder() {
  return (
    <ReactFlowProvider>
      <OrgTreeBuilderInner />
    </ReactFlowProvider>
  );
}
