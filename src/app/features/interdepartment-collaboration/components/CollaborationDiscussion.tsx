import * as React from "react";
import { Avatar, Button } from "@vibe/core";
import { MessageSquare, Send } from "lucide-react";
import type { Organization, UserProfile } from "../../../types";
import type { CollaborationMessage } from "../types";

export function CollaborationDiscussion({
  messages,
  organizations,
  profiles,
  onSend,
}: {
  messages: CollaborationMessage[];
  organizations: Organization[];
  profiles: UserProfile[];
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section className="eflow-section-card">
      <header>
        <h2>Proposal discussion &amp; notes</h2>
        <p className="m-0 mt-1 text-xs text-secondary">
          Shared interdepartmental comment thread. Informal notes do not replace formal change requests.
        </p>
      </header>

      {/* Messages Thread */}
      <div className="max-h-[480px] space-y-3.5 overflow-y-auto p-5">
        {messages.map((item) => {
          const profile = profiles.find(
            (candidate) => candidate.id === item.authorId,
          );
          const org = organizations.find(
            (candidate) =>
              candidate.id === (item.authorOrgId || profile?.org_id),
          );
          const isSystem = item.messageType === "system";

          return (
            <div
              key={item.id}
              className={`rounded-xl p-4 transition-all ${
                isSystem
                  ? "border border-blue-200 bg-blue-50/60"
                  : "border border-neutral-200 bg-neutral-50/70"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    text={
                      item.authorName
                        ? item.authorName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                        : profile?.full_name
                          ? profile.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                          : "EF"
                    }
                    size="small"
                  />
                  <div>
                    <span className="text-xs font-semibold text-neutral-900">
                      {item.authorName || profile?.full_name || "eFlow System"}
                    </span>
                    {org?.name && (
                      <span className="ml-2 text-[11px] text-secondary">
                        · {org.name}
                      </span>
                    )}
                  </div>
                </div>
                <time className="text-[11px] text-secondary">
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>

              <div className="mt-2 text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap pl-8">
                {item.message}
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="py-12 text-center">
            <MessageSquare size={28} className="mx-auto text-neutral-300" />
            <div className="mt-3 text-sm font-semibold text-neutral-800">
              No comments yet
            </div>
            <p className="mt-1 text-xs text-secondary">
              Start the discussion by sending an interdepartmental message below.
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Box */}
      <div className="flex items-end gap-3 border-t border-neutral-100 p-4 bg-neutral-50/50">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Write a message to all participating offices… (Press Enter to send)"
          className="eflow-control min-w-0 flex-1 resize-none h-auto py-2 leading-relaxed"
        />
        <Button
          size="small"
          disabled={!message.trim() || sending}
          onClick={() => void send()}
        >
          <Send size={14} className="mr-1.5" />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </section>
  );
}
