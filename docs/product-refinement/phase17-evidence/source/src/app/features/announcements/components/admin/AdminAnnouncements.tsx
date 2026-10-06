import { useReviewedMutation } from "../../../../shared/useReviewedMutation";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Search as VibeSearch,
  Tab,
  TabList,
  TabsContext,
} from "@vibe/core";
import { Add, Announcement as AnnouncementIcon } from "@vibe/icons";
import * as Icons from "lucide-react";
import {
  deleteAnnouncement,
  fetchAllAnnouncements,
  subscribeToAnnouncements,
  withdrawAnnouncement,
  type Announcement,
} from "../../../../services/announcementService";
import {
  PageHeader,
  SectionEmpty,
  StatCard,
  formatDate,
} from "../../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../../components/workflow/WorkspaceLoadingSkeleton";
import { AnnouncementEditor } from "./AnnouncementEditor";
import { AUDIENCE_META, STATUS_META } from "./announcementMeta";
import { useAuth } from "../../../../contexts/AuthContext";

export function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorFor, setEditorFor] = useState<Announcement | "new" | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft" | "withdrawn"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { can } = useAuth();
  const canPublish = can("announcements.publish");
  const authority = useRef(can);
  authority.current = can;
  const safety = useReviewedMutation("announcements");
  const requirePublish = () => {
    if (!authority.current("announcements.publish"))
      throw new Error(
        "Publishing access changed. Refresh your permissions before continuing.",
      );
  };

  const refresh = async () => {
    setAnnouncements(await fetchAllAnnouncements());
  };

  useEffect(() => {
    const unsub = subscribeToAnnouncements((a) => {
      setAnnouncements(a);
      setLoading(false);
    });
    return unsub;
  }, []);

  const stats = useMemo(
    () => ({
      published: announcements.filter((a) => a.status === "published").length,
      drafts: announcements.filter((a) => a.status === "draft").length,
      withdrawn: announcements.filter((a) => a.status === "withdrawn").length,
      total: announcements.length,
    }),
    [announcements],
  );

  const filteredAnnouncements = useMemo(() => {
    let list = announcements;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
      );
    }
    return list;
  }, [announcements, statusFilter, searchQuery]);

  if (loading)
    return (
      <div className="p-4 sm:p-8">
        <WorkspaceLoadingSkeleton
          label="Loading announcement control panel…"
          rows={4}
        />
      </div>
    );

  const statusTabs = ["all", "published", "draft", "withdrawn"] as const;
  const activeStatusTab = statusTabs.indexOf(statusFilter);

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-5 p-4 sm:p-8">
      {safety.dialog}
      {safety.message && (
        <FeedbackState tone={safety.tone} title="Announcement result">
          <p>{safety.message}</p>
          <button type="button" onClick={() => void refresh().catch(() => {})}>
            Refresh announcements
          </button>
        </FeedbackState>
      )}
      <PageHeader
        eyebrow="Administration · Communications"
        title="Announcement Management"
        subtitle="Publish executive broadcasts across the entire LGU, target office subtrees, or notify individual personnel."
        actions={
          <Button
            disabled={!canPublish}
            kind="primary"
            leftIcon={Add}
            onClick={() => setEditorFor("new")}
          >
            New announcement
          </Button>
        }
      />

      {/* ─── Metrics Cards ─── */}
      <div className="grid grid-cols-1 gap-3.5 min-[480px]:grid-cols-2 sm:grid-cols-4">
        <StatCard label="Published" tone="good" value={stats.published} />
        <StatCard label="Drafts" value={stats.drafts} />
        <StatCard
          label="Withdrawn"
          tone={stats.withdrawn ? "bad" : "neutral"}
          value={stats.withdrawn}
        />
        <StatCard label="Total created" value={stats.total} />
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-xl p-2.5 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="shrink-0 overflow-x-auto">
          <TabsContext
            activeTabId={activeStatusTab}
            id="admin-announcements-tabs"
          >
            <TabList id="admin-announcements-tab-list">
              {statusTabs.map((status) => (
                <Tab
                  active={statusFilter === status}
                  id={status}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                >
                  <span className="capitalize">{status}</span>
                </Tab>
              ))}
            </TabList>
          </TabsContext>
        </div>

        {/* Search Bar */}
        <div className="w-full sm:w-64 shrink-0">
          <VibeSearch
            className="w-full"
            clearIconLabel="Clear announcement filter"
            inputAriaLabel="Filter announcements"
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder="Filter announcements…"
            showClearIcon
            size="small"
            value={searchQuery}
          />
        </div>
      </div>

      {/* ─── Announcement List ─── */}
      {filteredAnnouncements.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <SectionEmpty
            icon={<AnnouncementIcon size={30} />}
            title="No announcements found"
            description={
              searchQuery
                ? `No announcements match "${searchQuery}".`
                : "Use New announcement above to draft the first official broadcast."
            }
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAnnouncements.map((a) => {
            const aud = AUDIENCE_META[a.audience] || AUDIENCE_META.all;
            const st = STATUS_META[a.status] || STATUS_META.draft;

            return (
              <div
                key={a.id}
                className="bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* Status Badge */}
                      <span
                        className={`text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border uppercase tracking-wider ${st.tone}`}
                      >
                        {st.label}
                      </span>

                      {/* Audience Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-0.5 border ${aud.color}`}
                      >
                        {aud.icon} {aud.label}
                      </span>

                      {/* Dates */}
                      {a.publishedAt && (
                        <span className="text-[11px] font-normal text-neutral-400 flex items-center gap-1">
                          <Icons.Clock size={11} /> Published{" "}
                          {formatDate(a.publishedAt)}
                        </span>
                      )}

                      {a.expiresAt && (
                        <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.2">
                          Expires {formatDate(a.expiresAt)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-[15.5px] font-semibold text-neutral-900 tracking-tight">
                      {a.title}
                    </h3>
                    <p className="text-[13px] font-normal text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                      {a.body}
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  {canPublish ? (
                    <div className="flex items-center gap-1 shrink-0 bg-neutral-50 border border-neutral-200/80 rounded-xl p-1">
                      {a.status !== "published" && (
                        <button
                          onClick={() => setEditorFor(a)}
                          className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-white transition-colors cursor-pointer"
                          title="Edit draft"
                        >
                          <Icons.Pencil size={15} />
                        </button>
                      )}

                      {a.status === "published" && (
                        <button
                          disabled={safety.pending}
                          onClick={() =>
                            void safety.run({
                              key: `${a.id}:withdraw`,
                              validate: requirePublish,
                              confirmation: {
                                title: "Withdraw announcement?",
                                description: `“${a.title}” will leave the published feed.`,
                                actionLabel: "Withdraw",
                              },
                              operation: () => withdrawAnnouncement(a.id),
                              success: "Announcement withdrawn.",
                              refresh,
                            })
                          }
                          className="p-2 rounded-lg text-neutral-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Withdraw announcement"
                        >
                          <Icons.Archive size={15} />
                        </button>
                      )}

                      <button
                        disabled={safety.pending}
                        onClick={() =>
                          void safety.run({
                            key: `${a.id}:delete`,
                            validate: requirePublish,
                            confirmation: {
                              title: "Delete announcement permanently?",
                              description: `“${a.title}” cannot be restored by this action.`,
                              danger: true,
                              actionLabel: "Delete announcement",
                              confirmationText: a.title,
                            },
                            operation: () => deleteAnnouncement(a.id),
                            success: "Announcement deleted.",
                            refresh,
                          })
                        }
                        className="p-2 rounded-lg text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete permanently"
                      >
                        <Icons.Trash2 size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Slide-over Drawer / Editor Modal ─── */}
      {editorFor && canPublish && (
        <AnnouncementEditor
          existing={editorFor === "new" ? null : editorFor}
          onClose={() => setEditorFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
