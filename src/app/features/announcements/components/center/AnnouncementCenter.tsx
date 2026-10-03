import type { ComponentProps, ReactNode } from 'react';
import { Button, Dropdown, Heading, IconButton, Label, Search as VibeSearch, Tab, TabList, TabsContext } from '@vibe/core';
import { Announcement, Calendar, Check, Close, Completed, Email, Globe, Inbox, Info, NavigationChevronRight, Team, Time, Workspace } from '@vibe/icons';
import type { Audience } from '../../../../services/announcementService';
import { PageHeader, SectionEmpty, StatCard, formatDate } from '../../../../components/workflow/primitives';
import { WorkspaceLoadingSkeleton } from '../../../../components/workflow/WorkspaceLoadingSkeleton';
import { InspectorPanel } from '../../../../shared/motion';
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

  if (loading) return <div className="p-4 sm:p-8"><WorkspaceLoadingSkeleton label="Loading announcement center…" rows={3} /></div>;

  const filters = [
    { id: "all", label: `All (${items.length})`, icon: <Inbox size={13} /> },
    { id: "unread", label: `Unread (${unreadList.length})`, icon: <Email size={13} /> },
    { id: "read", label: `Read (${readList.length})`, icon: <Completed size={13} /> },
  ] as const;
  const activeFilter = filters.findIndex((item) => item.id === filter);
  const audienceOptions = [
    { value: "all", label: "All audiences" },
    { value: "org", label: "Office" },
    { value: "users", label: "Direct" },
  ];

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-5 p-4 sm:p-8">
      <PageHeader eyebrow={eyebrow} title="Announcement Center" subtitle="Official executive directives, departmental updates, and urgent broadcasts addressed to your workspace." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<Announcement size={16} />} label="Total" value={items.length} />
        <StatCard icon={<Email size={16} />} label="Unread" tone={unreadList.length ? "info" : "good"} value={unreadList.length} />
        <StatCard icon={<Completed size={16} />} label="Read" tone="good" value={readList.length} />
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
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <SectionEmpty icon={<Announcement size={30} />} title={filter === "unread" ? "You're all caught up!" : "No announcements found"} description={filter === "unread"
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

                        {/* Unread Pill */}
                        {isUnread && (
                          <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">New</span>
                        )}

                        {/* Read Badge */}
                        {a.readAt && (
                          <Label color="positive" text="Read" />
                        )}
                      </div>

                      {/* Published Date */}
                      <span className="text-[11px] font-normal text-neutral-400 flex items-center gap-1 shrink-0">
                        <Time size={11} /> {formatDate(a.publishedAt)}
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
                        <Info size={12} /> Valid until {formatDate(a.expiresAt)}
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

      {/* ─── Detail Modal / Drawer View ─── */}
      <InspectorPanel ariaLabel="Announcement detail" className="w-full sm:w-[600px]" onClose={() => setSelectedAnnouncement(null)} open={Boolean(selectedAnnouncement)}>
        {selectedAnnouncement && <>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Announcement size={16} />
                </div>
                <div>
                  <div className="text-[10.5px] font-medium text-neutral-400 uppercase tracking-wider">
                    Official Directive
                  </div>
                  <div className="text-[13px] font-semibold text-neutral-900">
                    Announcement Detail
                  </div>
                </div>
              </div>

              <IconButton aria-label="Close announcement detail" icon={Close} kind="tertiary" onClick={() => setSelectedAnnouncement(null)} size="small" />
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11.5px] font-medium border ${
                      (AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).color
                    }`}
                  >
                    {(AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).icon}{" "}
                    {(AUDIENCE_META[selectedAnnouncement.audience] || AUDIENCE_META.all).label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-normal text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
                    <Calendar size={12} /> Published {formatDate(selectedAnnouncement.publishedAt)}
                  </span>
                </div>

                <Heading className="leading-snug text-neutral-900" type="h1" weight="medium">{selectedAnnouncement.title}</Heading>
              </div>

              <div className="h-px bg-neutral-100" />

              {/* Message Content */}
              <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-2xl p-5 text-[14px] font-normal text-neutral-800 whitespace-pre-wrap leading-relaxed shadow-xs">
                {selectedAnnouncement.body}
              </div>

              {selectedAnnouncement.expiresAt && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[12px] font-normal">
                    This announcement has a set expiration date of{" "}
                    <strong className="font-semibold">
                      {formatDate(selectedAnnouncement.expiresAt)}
                    </strong>
                    .
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600">
                <Check size={15} /> Marked as read
              </div>
              <Button kind="primary" onClick={() => setSelectedAnnouncement(null)} size="small">Close</Button>
            </div>
          </>}
      </InspectorPanel>
    </div>
  );
}
