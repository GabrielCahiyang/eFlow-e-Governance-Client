"""Shared skill tag catalog helpers for Admin maintenance and email invite flows."""
import re
from gateway_dependencies import supabase_admin

INVALID_SKILL_CHARACTERS = re.compile(r'[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]')


def validate_skill_map(value: dict[str, bool]) -> dict[str, bool]:
    if len(value) > 100 or any(
        not isinstance(k, str) or not k.strip() or len(k) > 100 or INVALID_SKILL_CHARACTERS.search(k)
        for k in value
    ):
        raise ValueError('Enter at most 100 short skill names')
    return {k.strip(): bool(v) for k, v in value.items() if bool(v)}


def active_skill_labels(client=None) -> list[str]:
    db = client or supabase_admin
    try:
        rows = (
            db.table('skill_tag_definitions')
            .select('label')
            .eq('retired', False)
            .order('position')
            .order('label')
            .execute()
            .data
        )
        if not isinstance(rows, list):
            return []
        return [
            row['label'].strip()
            for row in rows
            if isinstance(row, dict) and isinstance(row.get('label'), str) and row['label'].strip()
        ]
    except Exception:
        return []
