import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export interface SkillTagDefinition {
  id: string;
  label: string;
  position: number;
  retired: boolean;
}

export const SKILL_TAGS_UPDATED_EVENT = "eflow:skill-tags-updated";

export function sortSkillTagDefinitions(items: readonly SkillTagDefinition[]): SkillTagDefinition[] {
  return [...items].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

export function activeSkillTagLabels(items: readonly SkillTagDefinition[]): string[] {
  return sortSkillTagDefinitions(items)
    .filter((item) => !item.retired)
    .map((item) => item.label);
}

export async function fetchSkillTagDefinitions(): Promise<SkillTagDefinition[]> {
  const { data, error } = await supabase
    .from("skill_tag_definitions")
    .select("id,label,position,retired");
  if (error) {
    throw new Error(
      error.code === "PGRST205" || error.code === "42P01"
        ? "Skill tag maintenance is unavailable in this database."
        : error.message,
    );
  }
  return sortSkillTagDefinitions((data ?? []) as SkillTagDefinition[]);
}

export async function saveSkillTagDefinition(definition: SkillTagDefinition): Promise<void> {
  const cleanLabel = definition.label.replace(/\s+/g, " ").trim();
  if (!cleanLabel || cleanLabel.length > 100) {
    throw new Error("Enter a skill name between 1 and 100 characters.");
  }
  const { error } = await supabase
    .from("skill_tag_definitions")
    .upsert({
      id: definition.id,
      label: cleanLabel,
      position: definition.position,
      retired: definition.retired,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    throw new Error(
      error.code === "23505" ? "That skill tag name is already active." : error.message,
    );
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SKILL_TAGS_UPDATED_EVENT));
  }
}

export function useSkillTags(enabled = true) {
  const [definitions, setDefinitions] = useState<SkillTagDefinition[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await fetchSkillTagDefinitions();
      setDefinitions(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load skill tags.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let mounted = true;
    void refresh();
    const onUpdated = () => {
      if (mounted) void refresh();
    };
    const channel =
      typeof supabase.channel === "function"
        ? supabase
            .channel(`skill-tag-definitions:${crypto.randomUUID()}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "skill_tag_definitions" },
              onUpdated,
            )
            .subscribe()
        : undefined;
    if (typeof window !== "undefined") {
      window.addEventListener(SKILL_TAGS_UPDATED_EVENT, onUpdated);
    }
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener(SKILL_TAGS_UPDATED_EVENT, onUpdated);
      }
    };
  }, [enabled, refresh]);

  return {
    definitions,
    activeLabels: activeSkillTagLabels(definitions),
    loading,
    error,
    refresh,
  };
}
