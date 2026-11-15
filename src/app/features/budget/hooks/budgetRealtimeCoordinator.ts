import { supabase } from "../../../../lib/supabase";

export interface BudgetRealtimeSubscriptionOptions {
  scopeKey: string;
  orgId: string;
  budgetId?: string;
  itemized: boolean;
  canDeleteProjectTrigger: () => boolean;
  onRefresh: () => void;
}

interface SubscriberHandle {
  canDeleteProjectTrigger: () => boolean;
  onRefresh: () => void;
}

interface SharedChannelEntry {
  channelTopic: string;
  channel: ReturnType<typeof supabase.channel>;
  subscribed: boolean;
  pendingRefresh: number | undefined;
  subscribers: Set<SubscriberHandle>;
  triggerRefresh: () => void;
}

const COALESCE_WINDOW_MS = 1_000;
const activeEntries = new Map<string, SharedChannelEntry>();

function buildChannel(
  channelTopic: string,
  orgId: string,
  budgetId: string | undefined,
  itemized: boolean,
  onChange: () => void,
  onProjectDelete: () => void,
) {
  let channel = supabase
    .channel(channelTopic)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "department_fiscal_budgets",
        filter: `org_id=eq.${orgId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "petty_cash_requests",
        filter: `org_id=eq.${orgId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "budget_ledger_entries",
        filter: `org_id=eq.${orgId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "projects", filter: `org_id=eq.${orgId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "projects" },
      onProjectDelete,
    );

  if (budgetId) {
    channel = channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "office_budget_sections",
          filter: `fiscal_budget_id=eq.${budgetId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "department_budget_lines",
          filter: `fiscal_budget_id=eq.${budgetId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "department_budget_adjustments",
          filter: `fiscal_budget_id=eq.${budgetId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_commitments",
          filter: `fiscal_budget_id=eq.${budgetId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_budget_allocations" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_budget_allocation_lines" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_releases" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_liquidations" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_request_attachments" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_receipts" },
        onChange,
      );
  }

  if (itemized) {
    channel = channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_request_lines" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_receipt_items" },
        onChange,
      );
  }

  return channel;
}

/**
 * Shares one Supabase Realtime channel per active budget scope across concurrently
 * mounted components and coalesces event bursts before refreshing the shared cache.
 */
export function subscribeBudgetRealtime(options: BudgetRealtimeSubscriptionOptions) {
  const { scopeKey, orgId, budgetId, itemized, canDeleteProjectTrigger, onRefresh } = options;
  const subscriber: SubscriberHandle = { canDeleteProjectTrigger, onRefresh };

  let entry = activeEntries.get(scopeKey);
  if (!entry) {
    // Use a unique topic whenever ref-count starts from 0 so React Strict Mode
    // remounts never attach handlers to a channel still finishing removal.
    const channelTopic = `office-budget:${scopeKey}:${crypto.randomUUID()}`;
    const subscribers = new Set<SubscriberHandle>();

    const created: SharedChannelEntry = {
      channelTopic,
      channel: undefined as unknown as ReturnType<typeof supabase.channel>,
      subscribed: false,
      pendingRefresh: undefined,
      subscribers,
      triggerRefresh: () => {
        if (created.pendingRefresh !== undefined || created.subscribers.size === 0) return;
        created.pendingRefresh = window.setTimeout(() => {
          created.pendingRefresh = undefined;
          const [primary] = created.subscribers;
          primary?.onRefresh();
        }, COALESCE_WINDOW_MS);
      },
    };

    const channel = buildChannel(
      channelTopic,
      orgId,
      budgetId,
      itemized,
      created.triggerRefresh,
      () => {
        for (const sub of created.subscribers) {
          if (sub.canDeleteProjectTrigger()) {
            created.triggerRefresh();
            return;
          }
        }
      },
    );
    created.channel = channel;

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (created.subscribed) created.triggerRefresh();
      created.subscribed = true;
    });

    entry = created;
    activeEntries.set(scopeKey, entry);
  }

  entry.subscribers.add(subscriber);

  return {
    isSubscribed: () => entry.subscribed,
    triggerOnlineRefresh: () => entry.triggerRefresh(),
    unsubscribe: () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        if (entry.pendingRefresh !== undefined) {
          window.clearTimeout(entry.pendingRefresh);
          entry.pendingRefresh = undefined;
        }
        activeEntries.delete(scopeKey);
        void supabase.removeChannel(entry.channel);
      }
    },
  };
}
