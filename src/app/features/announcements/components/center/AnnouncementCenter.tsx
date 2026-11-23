import type { ComponentProps, ReactNode } from 'react';
import { Button, Dropdown, Label, Search as VibeSearch, Tab, TabList, TabsContext } from '@vibe/core';
import { Announcement, Calendar, Check, Completed, Email, Globe, Inbox, Info, NavigationChevronRight, Team, Time, Workspace } from '@vibe/icons';
import type { Audience } from '../../../../services/announcementService';
import { PageHeader, SectionEmpty, StatCard, formatDate } from '../../../../components/workflow/primitives';
import { WorkspaceLoadingSkeleton } from '../../../../components/workflow/WorkspaceLoadingSkeleton';
import { Modal } from '../../../../components/ui/Modal';
import { formatManilaDate, formatManilaDateTime } from '../../../../shared/calendarDisplay';
import { useNotificationNavigationIntent } from '../../../notifications';
import { useAnnouncementCenter } from '../../hooks/useAnnouncementCenter';

const AUDIENCE_META: Record<Audience, { label: string; icon: ReactNode; color: string; labelColor: ComponentProps<typeof Label>["color"] }> = {
  all: {
    label: "Entire LGU",
    icon: <Globe size={11} />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    labelColor: "positive",
  },
  org: {
    label: "Office Scope",
    icon: <Workspace size={11} />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    labelColor: "bright-blue",
  },
  users: {
    label: "Direct Announcement",
    icon: <Team size={11} />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    labelColor: "purple",
  },
};

export function AnnouncementCenter({ eyebrow = "My Workspace · Updates" }: { eyebrow?: string }) {
  const { audienceFilter, filter, filteredItems, items, loading, markAllRead, openAnnouncement, readList, searchQuery, selectedAnnouncement, setAudienceFilter, setFilter, setSearchQuery, setSelectedAnnouncement, unreadList } = useAnnouncementCenter();

  useNotificationNavigationIntent(
    (intent) => intent.kind === "announcement",
    (intent) => {
      if (loading) return false;
      setFilter("all");
      setAudienceFilter("all");
      setSearchQuery("");
      const label = intent.entityLabel?.trim().toLowerCase();
      if (label) {
        const matched = items.find(
          (entry) =>
            entry.title.trim().toLowerCase() === label ||
            label.includes(entry.title.trim().toLowerCase()) ||
            entry.body.trim().toLowerCase().includes(label),
        );
        if (matched) {
          void openAnnouncement(matched);
        }
      }
      return true;
    },
    [items, loading, openAnnouncement, setAudienceFilter, setFilter, setSearchQuery],
  );

  const filters = [
    { id: "all", label: loading ? "All" : `All (${items.length})`, icon: <Inbox size={13} /> },
    { id: "unread", label: loading ? "Unread" : `Unread (${unreadList.length})`, icon: <Email size={13} /> },
    { id: "read", label: loading ? "Read" : `Read (${readList.length})`, icon: <Completed size={13} /> },
  ] as const;
  const activeFilter = filters.findIndex((item) => item.id === filter);
  const audienceOptions = [
    { value: "all", label: "All audiences" },
    { value: "org", label: "Office" },
    { value: "users", label: "Direct" },
  ];
  const loadingBar = (
    <span className="inline-block h-6 w-10 animate-pulse rounded-md bg-neutral-200/80 align-middle" />
  );

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-5 p-4 sm:p-8">
      <PageHeader eyebrow={eyebrow} title="Announcement Center" subtitle="Official executive directives, departmental updates, and urgent broadcasts addressed to your workspace." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<Announcement size={16} />} label="Total" value={loading ? loadingBar : items.length} />
        <StatCard icon={<Email size={16} />} label="Unread" tone={unreadList.length ? "info" : "good"} value={loading ? loadingBar : unreadList.length} />
        <StatCard icon={<Completed size={16} />} label="Read" tone="good" value={loading ? loadingBar : readList.length} />
      </div>

      {/* ─── Search & Controls Bar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-xl p-2.5 shadow-sm">
        {/* Filter Pills */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-full min-w-0 overflow-x-auto sm:w-auto"><TabsContext activeTabId={activeFilter} id="announcement-center-tabs">
            <TabList id="announcement-center-tab-list">
              {filters.map((item) => <Tab active={filter === item.id} id={item.id} key={item.id} onClick={() => setFilter(item.id)}><span className="inline-flex items-center gap-1.5">{item.icon}{item.label}</span></Tab>)}
            </TabList>
          </TabsContext></div>
          <Dropdown aria-label="Filter announcement audience" className="w-44 max-w-full" clearable={false} onChange={(option) => setAudienceFilter(String(option.value))} options={audienceOptions} size="small" value={audienceOptions.find((option) => option.value === audienceFilter)} />
        </div>

        {/* Search Bar & Mark Read Action */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <VibeSearch className="min-w-0 flex-1 sm:w-64" clearIconLabel="Clear announcement search" inputAriaLabel="Search announcements" onChange={setSearchQuery} onClear={() => setSearchQuery("")} placeholder="Search announcements…" showClearIcon size="small" value={searchQuery} />

          {unreadList.length > 0 && (
            <Button color="positive" kind="secondary" leftIcon={Completed} onClick={markAllRead} size="small">Mark all read</Button>
          )}
        </div>
      </div>

      {/* ─── Announcements List ─── */}
      {loading ? (
        <AnnouncementCenterListSkeleton />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <SectionEmpty illustration={filter === "unread" ? "complete" : searchQuery ? "search" : "inbox"} icon={<Announcement size={30} />} title={filter === "unread" ? "You're all caught up!" : "No announcements found"} description={filter === "unread"
              ? "There are no unread announcements in your inbox right now."
              : searchQuery
              ? `No announcements match "${searchQuery}". Try a different term.`
              : "New official directives and announcements will appear here."} />
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((a) => {
            const isUnread = !a.readAt;
            const aud = AUDIENCE_META[a.audience] || AUDIENCE_META.all;

            return (
              <button
                aria-label={`Open announcement: ${a.title}`}
                key={a.id}
                onClick={() => openAnnouncement(a)}
                className={`group relative w-full rounded-xl border bg-white p-5 text-left transition-[border-color,box-shadow] duration-100 hover:shadow-sm ${
                  isUnread
                    ? "border-blue-300 ring-1 ring-blue-100 bg-gradient-to-r from-blue-50/40 via-white to-white"
                    : "border-neutral-200/90 hover:border-neutral-300"
                }`}
              >
                {/* Unread Accent Indicator */}
                {isUnread && (
                  <div className="absolute left-0 top-4 bottom-4 w-1.5 bg-blue-500 rounded-r-full" />
                )}

                <div className="flex items-start gap-4">
                  {/* Status Icon Container */}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                      isUnread
                        ? "bg-blue-600 text-white border-blue-500"
                        : "bg-neutral-100 text-neutral-500 border-neutral-200"
                    }`}
                  >
                    <Email size={18} />
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Audience Badge */}
                        <Label color={aud.labelColor} text={aud.label} />

                        {/* Unread Badge */}
                        {isUnread && (
                          <span className="inline-flex items-center rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">New</span>
                        )}

                        {/* Read Badge */}
                        {a.readAt && (
                          <Label color="positive" text="Read" />
                        )}
                      </div>

                      {/* Published Date */}
                      <span className="text-[11px] font-normal text-neutral-400 flex items-center gap-1 shrink-0">
                        <Time size={11} /> {formatManilaDateTime(a.publishedAt, formatDate(a.publishedAt))}
                      </span>
                    </div>

                    {/* Announcement Title */}
                    <h3
                      className={`text-[15px] font-semibold tracking-tight ${
                        isUnread ? "text-neutral-900" : "text-neutral-800"
                      }`}
                    >
                      {a.title}
                    </h3>

                    {/* Body Snippet */}
                    <p className="text-[13px] font-normal text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                      {a.body}
                    </p>

                    {/* Footer Info */}
                    {a.expiresAt && (
                      <div className="mt-3 flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                        <Info size={12} /> Valid until {formatManilaDate(a.expiresAt, formatDate(a.expiresAt))}
                      </div>
                    )}
                  </div>

                  <div className="self-center pl-2 shrink-0 text-neutral-300 group-hover:text-neutral-600 group-hover:translate-x-0.5 transition-all">
                    <NavigationChevronRight size={18} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Standard Centered Announcement Detail Modal ─── */}
      <Modal
        isOpen={Boolean(selectedAnnouncement)}
        title={selectedAnnouncement?.title || "Announcement Detail"}
        description="Official Directive · Announcement Detail"
        ariaLabel="Announcement detail"
        width="max-w-2xl"
        onClose={() => setSelectedAnnouncement(null)}
        footer={
          selectedAnnouncement ? (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check size={15} /> Marked as read
              </div>
              <Button kind="primary" onClick={() => setSelectedAnnouncement(null)} size="small">
                Close
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedAnnouncement && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                  (AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).color
                }`}
              >
                {(AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).icon}{" "}
                {(AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--eflow-text-secondary)]">
                <Calendar size={12} /> Published{" "}
                {formatManilaDateTime(selectedAnnouncement.publishedAt, formatDate(selectedAnnouncement.publishedAt))}
              </span>
            </div>

            <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-5 text-sm leading-relaxed text-[var(--eflow-text)] whitespace-pre-wrap">
              {selectedAnnouncement.body}
            </div>

            {selectedAnnouncement.expiresAt && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
                <Info size={16} className="mt-0.5 shrink-0 text-amber-700" />
                <div className="text-xs leading-relaxed">
                  This announcement has a set expiration date of{" "}
                  <strong className="font-semibold">
                    {formatManilaDate(selectedAnnouncement.expiresAt, formatDate(selectedAnnouncement.expiresAt))}
                  </strong>
                  .
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AnnouncementCenterListSkeleton() {
  return (
    <WorkspaceLoadingSkeleton
      label="Loading announcement center…"
      className="grid gap-3"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="relative w-full rounded-xl border border-neutral-200/90 bg-white p-5"
        >
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-neutral-200/80" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-200/70" />
                  <div className="h-4 w-12 animate-pulse rounded-full bg-neutral-100" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
              </div>
              <div className="h-4 w-3/5 animate-pulse rounded bg-neutral-200/80" />
              <div className="space-y-1.5">
                <div className="h-3 w-11/12 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
            <div className="self-center pl-2">
              <div className="h-4 w-4 animate-pulse rounded bg-neutral-200/70" />
            </div>
          </div>
        </div>
      ))}
    </WorkspaceLoadingSkeleton>
  );
}
