"""Read-only table inventory, paged/filtered data explorer, and direct export helpers."""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timezone
import io
import json
import re
from threading import RLock
import time
from typing import Any, Literal
from urllib.parse import quote
from uuid import UUID

import httpx

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, supabase_admin
from services.backup_security import (
    BACKUP_DOMAINS,
    IMPORTANT_EFLOW_TABLES,
    SENSITIVE_COLUMN_NAMES,
    SENSITIVE_PUBLIC_TABLES,
    classify_table,
    redact_row,
    validate_table_name,
)


OPENAPI_CACHE_TTL_SECONDS = 30.0
EXPORT_MAX_ROWS = 50_000
EXPORT_PAGE_SIZE = 1000
TEXT_FORMATS = frozenset({"text", "character varying", "varchar", "citext", "name", "bpchar"})
DATE_FORMATS = frozenset({"date", "timestamp with time zone", "timestamp without time zone", "timestamptz", "timestamp"})
NUMERIC_TYPES = frozenset({"integer", "number"})
DATE_INPUT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

ExportFormat = Literal["csv", "json", "jsonl", "sql"]
ExportScope = Literal["page", "filtered", "all"]


class ExplorerPermissionError(Exception):
    """Raised when a table cannot be read directly via PostgREST."""


class ExplorerValidationError(ValueError):
    """Raised when filter, sort, or pagination inputs are invalid."""


def _is_sensitive_column(column_name: str) -> bool:
    lowered = column_name.lower()
    return (
        lowered in SENSITIVE_COLUMN_NAMES
        or lowered.endswith("_secret")
        or lowered.endswith("_token_hash")
    )


def _escape_postgrest_or_like(value: str) -> str:
    cleaned = value.replace("\\", "\\\\").replace('"', '\\"').replace("*", "")
    return f'"*{cleaned}*"'


def _parse_content_range_total(header_value: str | None, fallback_len: int) -> int:
    if not header_value:
        return fallback_len
    if "/" not in header_value:
        return fallback_len
    total_part = header_value.split("/", 1)[1].strip()
    if total_part.isdigit():
        return int(total_part)
    return fallback_len


def _sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        encoded = json.dumps(value, ensure_ascii=False, default=str).replace("'", "''")
        return f"'{encoded}'::jsonb"
    text = str(value).replace("'", "''")
    return f"'{text}'"


def _csv_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    # Guard Excel / LibreOffice formula injection while keeping numeric negatives intact.
    if text and text[0] in ("=", "+", "@") or (text.startswith("-") and not re.fullmatch(r"-\d+(?:\.\d+)?", text)):
        text = "'" + text
    return text


class BackupExplorerService:
    """Provides cached OpenAPI table discovery, paged row reads, and audited exports."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._cached_at = 0.0
        self._cached_schema: dict[str, list[dict[str, Any]]] | None = None

    def clear_cache(self) -> None:
        with self._lock:
            self._cached_at = 0.0
            self._cached_schema = None

    def discover_schema(self, force_refresh: bool = False) -> dict[str, list[dict[str, Any]]]:
        now = time.monotonic()
        with self._lock:
            if (
                not force_refresh
                and self._cached_schema is not None
                and now - self._cached_at < OPENAPI_CACHE_TTL_SECONDS
            ):
                return self._cached_schema

        response = httpx.get(
            f"{settings.supabase_url}/rest/v1/",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Accept": "application/openapi+json",
            },
            timeout=30,
        )
        response.raise_for_status()
        openapi = response.json()
        definitions = openapi.get("definitions") or openapi.get("components", {}).get("schemas", {})
        paths = openapi.get("paths", {})

        schema: dict[str, list[dict[str, Any]]] = {}
        for name, definition in definitions.items():
            if "get" not in (paths.get(f"/{name}") or {}) or name == "spatial_ref_sys":
                continue
            validate_table_name(name)
            properties = (definition or {}).get("properties") or {}
            columns: list[dict[str, Any]] = []
            for col_name, col_meta in properties.items():
                col_type = str((col_meta or {}).get("type") or "")
                col_format = str((col_meta or {}).get("format") or "")
                redacted = _is_sensitive_column(col_name)
                is_date = col_format.lower() in DATE_FORMATS
                is_text = col_type == "string" and (
                    not col_format or col_format.lower() in TEXT_FORMATS
                )
                is_uuid = col_format.lower() == "uuid"
                is_bool = col_type == "boolean"
                is_numeric = col_type in NUMERIC_TYPES
                columns.append(
                    {
                        "name": col_name,
                        "type": col_type or ("jsonb" if col_format == "jsonb" else "unknown"),
                        "format": col_format or col_type or "text",
                        "is_date": is_date,
                        "is_text": is_text,
                        "is_uuid": is_uuid,
                        "is_bool": is_bool,
                        "is_numeric": is_numeric,
                        "searchable": (is_text or is_uuid or is_numeric) and not redacted,
                        "filterable": not redacted and col_format != "jsonb" and col_type != "array",
                        "sortable": col_format != "jsonb" and col_type != "array",
                        "redacted": redacted,
                    }
                )
            schema[name] = columns

        sorted_schema = {name: schema[name] for name in sorted(schema)}
        with self._lock:
            self._cached_schema = sorted_schema
            self._cached_at = time.monotonic()
        return sorted_schema

    def discover_public_tables(self) -> list[str]:
        return list(self.discover_schema().keys())

    def default_sort_for_table(self, table_name: str, schema: dict[str, list[dict[str, Any]]] | None = None) -> tuple[str | None, str]:
        table_schema = (schema or self.discover_schema()).get(table_name, [])
        col_names = [col["name"] for col in table_schema]
        for preferred in ("created_at", "updated_at", "sealed_at", "timestamp"):
            if preferred in col_names:
                return preferred, "desc"
        if "id" in col_names:
            return "id", "asc"
        if col_names:
            return col_names[0], "asc"
        return None, "asc"

    async def list_tables(
        self,
        *,
        search: str = "",
        category: str = "all",
        importance: str = "all",
        page: int = 1,
        page_size: int = 15,
        include_counts: bool = True,
    ) -> dict[str, Any]:
        schema = self.discover_schema()
        needle = search.strip().lower()
        entries: list[dict[str, Any]] = []
        for table_name, columns in schema.items():
            meta = classify_table(table_name)
            if category != "all" and meta["domain"] != category:
                continue
            if importance == "important" and not meta["important"]:
                continue
            if importance == "supporting" and (meta["important"] or meta["sensitive"]):
                continue
            if importance == "excluded" and not meta["sensitive"]:
                continue
            if needle and needle not in table_name.lower() and needle not in meta["domain_label"].lower():
                continue
            entries.append(
                {
                    **meta,
                    "column_count": len(columns),
                    "has_date_column": any(col["is_date"] for col in columns),
                }
            )

        # Important operational tables surface first, then alphabetical.
        entries.sort(key=lambda item: (not item["important"], item["sensitive"], item["name"]))
        total = len(entries)
        safe_page_size = max(1, min(100, page_size))
        total_pages = max(1, (total + safe_page_size - 1) // safe_page_size)
        safe_page = max(1, min(total_pages, page))
        start = (safe_page - 1) * safe_page_size
        page_items = entries[start : start + safe_page_size]

        if include_counts and page_items:
            counts = await self._fetch_table_counts([item["name"] for item in page_items])
            for item in page_items:
                count_info = counts.get(item["name"], {})
                item["row_count"] = count_info.get("row_count")
                item["api_readable"] = count_info.get("api_readable", not item["sensitive"])
        else:
            for item in page_items:
                item["row_count"] = None
                item["api_readable"] = not item["sensitive"]

        return {
            "items": page_items,
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
            "total_pages": total_pages,
            "domains": [
                {"id": domain_id, "label": label, "description": desc}
                for domain_id, label, desc in BACKUP_DOMAINS
            ],
            "important_count": sum(1 for name in schema if name in IMPORTANT_EFLOW_TABLES),
            "total_discovered": len(schema),
        }

    async def _fetch_table_counts(self, table_names: list[str]) -> dict[str, dict[str, Any]]:
        results: dict[str, dict[str, Any]] = {}
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Prefer": "count=exact",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            async def fetch_one(name: str) -> None:
                if name in SENSITIVE_PUBLIC_TABLES:
                    results[name] = {"row_count": None, "api_readable": False}
                    return
                try:
                    resp = await client.get(
                        f"{settings.supabase_url}/rest/v1/{quote(name, safe='')}",
                        params={"select": "*", "limit": 1},
                        headers=headers,
                    )
                    if resp.status_code in (401, 403):
                        results[name] = {"row_count": None, "api_readable": False}
                        return
                    if not resp.is_success:
                        results[name] = {"row_count": None, "api_readable": False}
                        return
                    results[name] = {
                        "row_count": _parse_content_range_total(resp.headers.get("content-range"), len(resp.json())),
                        "api_readable": True,
                    }
                except Exception:
                    results[name] = {"row_count": None, "api_readable": False}

            await asyncio.gather(*(fetch_one(name) for name in table_names))
        return results

    def _validate_browse_table(self, table_name: str) -> tuple[str, list[dict[str, Any]]]:
        clean_name = validate_table_name(table_name)
        schema = self.discover_schema()
        if clean_name not in schema:
            raise KeyError(clean_name)
        if clean_name in SENSITIVE_PUBLIC_TABLES:
            raise ExplorerPermissionError(
                f"Table '{clean_name}' contains protected server settings and cannot be browsed in plain text. Use an encrypted Disaster Recovery backup instead."
            )
        return clean_name, schema[clean_name]

    def _build_query_params(
        self,
        table_name: str,
        columns: list[dict[str, Any]],
        *,
        search: str = "",
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        filter_col: str | None = None,
        filter_val: str | None = None,
        date_col: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> tuple[list[tuple[str, str]], str | None, str]:
        col_map = {col["name"]: col for col in columns}
        params: list[tuple[str, str]] = [("select", "*")]

        resolved_sort = sort_by if sort_by in col_map and col_map[sort_by]["sortable"] else None
        if resolved_sort is None:
            resolved_sort, default_dir = self.default_sort_for_table(table_name, {table_name: columns})
            resolved_dir = default_dir
        else:
            resolved_dir = sort_dir

        if resolved_sort:
            params.append(("order", f"{resolved_sort}.{resolved_dir}.nullslast"))

        trimmed_search = search.strip()
        if trimmed_search:
            or_clauses: list[str] = []
            is_uuid_search = False
            try:
                UUID(trimmed_search)
                is_uuid_search = True
            except ValueError:
                pass
            is_int_search = bool(re.fullmatch(r"-?\d{1,12}", trimmed_search))

            for col in columns:
                if col["redacted"]:
                    continue
                if col["is_text"]:
                    or_clauses.append(f"{col['name']}.ilike.{_escape_postgrest_or_like(trimmed_search)}")
                elif is_uuid_search and col["is_uuid"]:
                    or_clauses.append(f"{col['name']}.eq.{trimmed_search}")
                elif is_int_search and col["is_numeric"]:
                    or_clauses.append(f"{col['name']}.eq.{trimmed_search}")

            if or_clauses:
                params.append(("or", f"({','.join(or_clauses[:16])})"))

        if filter_col and filter_val is not None and filter_val.strip() != "":
            if filter_col not in col_map or not col_map[filter_col]["filterable"]:
                raise ExplorerValidationError(f"Column '{filter_col}' cannot be filtered.")
            col_info = col_map[filter_col]
            raw_val = filter_val.strip()
            if col_info["is_bool"]:
                lowered = raw_val.lower()
                if lowered not in {"true", "false"}:
                    raise ExplorerValidationError(f"Column '{filter_col}' expects 'true' or 'false'.")
                params.append((filter_col, f"eq.{lowered}"))
            elif col_info["is_numeric"]:
                if not re.fullmatch(r"-?\d+(?:\.\d+)?", raw_val):
                    raise ExplorerValidationError(f"Column '{filter_col}' expects a numeric value.")
                params.append((filter_col, f"eq.{raw_val}"))
            elif col_info["is_uuid"]:
                try:
                    UUID(raw_val)
                except ValueError as exc:
                    raise ExplorerValidationError(f"Column '{filter_col}' expects a valid UUID.") from exc
                params.append((filter_col, f"eq.{raw_val}"))
            elif col_info["is_date"]:
                if DATE_INPUT_RE.fullmatch(raw_val):
                    params.append((filter_col, f"gte.{raw_val}T00:00:00Z" if "timestamp" in col_info["format"] else f"eq.{raw_val}"))
                    if "timestamp" in col_info["format"]:
                        params.append((filter_col, f"lte.{raw_val}T23:59:59.999999Z"))
                else:
                    params.append((filter_col, f"eq.{raw_val}"))
            else:
                params.append((filter_col, f"ilike.*{raw_val.replace('*', '')}*"))

        if date_from or date_to:
            target_date_col = date_col
            if not target_date_col:
                date_candidates = [col["name"] for col in columns if col["is_date"]]
                for preferred in ("created_at", "updated_at", "sealed_at", "timestamp", "due_date"):
                    if preferred in date_candidates:
                        target_date_col = preferred
                        break
                if not target_date_col and date_candidates:
                    target_date_col = date_candidates[0]
            if not target_date_col or target_date_col not in col_map or not col_map[target_date_col]["is_date"]:
                raise ExplorerValidationError("Choose a valid date column for date-range filtering.")
            col_format = col_map[target_date_col]["format"].lower()
            is_timestamp = "timestamp" in col_format
            if date_from:
                if not DATE_INPUT_RE.fullmatch(date_from):
                    raise ExplorerValidationError("Start date must use YYYY-MM-DD format.")
                params.append((target_date_col, f"gte.{date_from}T00:00:00Z" if is_timestamp else f"gte.{date_from}"))
            if date_to:
                if not DATE_INPUT_RE.fullmatch(date_to):
                    raise ExplorerValidationError("End date must use YYYY-MM-DD format.")
                params.append((target_date_col, f"lte.{date_to}T23:59:59.999999Z" if is_timestamp else f"lte.{date_to}"))

        return params, resolved_sort, resolved_dir

    def browse_table_rows(
        self,
        table_name: str,
        *,
        page: int = 1,
        page_size: int = 25,
        search: str = "",
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        filter_col: str | None = None,
        filter_val: str | None = None,
        date_col: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        clean_name, columns = self._validate_browse_table(table_name)
        safe_page_size = max(1, min(100, page_size))
        safe_page = max(1, page)
        offset = (safe_page - 1) * safe_page_size

        base_params, resolved_sort, resolved_dir = self._build_query_params(
            clean_name,
            columns,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filter_col=filter_col,
            filter_val=filter_val,
            date_col=date_col,
            date_from=date_from,
            date_to=date_to,
        )
        query_params = [*base_params, ("limit", str(safe_page_size)), ("offset", str(offset))]

        response = httpx.get(
            f"{settings.supabase_url}/rest/v1/{quote(clean_name, safe='')}",
            params=query_params,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Prefer": "count=exact",
            },
            timeout=30,
        )
        if response.status_code in (401, 403):
            raise ExplorerPermissionError(
                f"Direct API row browsing is restricted on '{clean_name}'. Use DB Dump (pg_dump) to archive this table."
            )
        if response.status_code == 400:
            detail = ""
            try:
                detail = str((response.json() or {}).get("message") or "")
            except Exception:
                pass
            raise ExplorerValidationError(detail or "Could not apply the requested table filter.")
        response.raise_for_status()

        raw_rows = response.json()
        rows = [redact_row(row) for row in raw_rows]
        total = _parse_content_range_total(response.headers.get("content-range"), len(rows))
        total_pages = max(1, (total + safe_page_size - 1) // safe_page_size)
        meta = classify_table(clean_name)

        return {
            **meta,
            "columns": columns,
            "rows": rows,
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
            "total_pages": total_pages,
            "sort_by": resolved_sort,
            "sort_dir": resolved_dir,
        }

    def export_table_data(
        self,
        actor: AuthenticatedUser,
        table_name: str,
        export_format: ExportFormat = "csv",
        scope: ExportScope = "filtered",
        *,
        page: int = 1,
        page_size: int = 25,
        search: str = "",
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        filter_col: str | None = None,
        filter_val: str | None = None,
        date_col: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        clean_name, columns = self._validate_browse_table(table_name)
        col_names = [col["name"] for col in columns]

        if scope == "page":
            result = self.browse_table_rows(
                clean_name,
                page=page,
                page_size=page_size,
                search=search,
                sort_by=sort_by,
                sort_dir=sort_dir,
                filter_col=filter_col,
                filter_val=filter_val,
                date_col=date_col,
                date_from=date_from,
                date_to=date_to,
            )
            rows = result["rows"]
            total_available = result["total"]
        else:
            effective_search = "" if scope == "all" else search
            effective_filter_col = None if scope == "all" else filter_col
            effective_filter_val = None if scope == "all" else filter_val
            effective_date_from = None if scope == "all" else date_from
            effective_date_to = None if scope == "all" else date_to

            base_params, _, _ = self._build_query_params(
                clean_name,
                columns,
                search=effective_search,
                sort_by=sort_by,
                sort_dir=sort_dir,
                filter_col=effective_filter_col,
                filter_val=effective_filter_val,
                date_col=date_col,
                date_from=effective_date_from,
                date_to=effective_date_to,
            )
            rows = []
            total_available = 0
            offset = 0
            with httpx.Client(timeout=60) as client:
                while len(rows) < EXPORT_MAX_ROWS:
                    batch_limit = min(EXPORT_PAGE_SIZE, EXPORT_MAX_ROWS - len(rows))
                    response = client.get(
                        f"{settings.supabase_url}/rest/v1/{quote(clean_name, safe='')}",
                        params=[*base_params, ("limit", str(batch_limit)), ("offset", str(offset))],
                        headers={
                            "apikey": settings.supabase_service_role_key,
                            "Authorization": f"Bearer {settings.supabase_service_role_key}",
                            "Prefer": "count=exact",
                        },
                    )
                    if response.status_code in (401, 403):
                        raise ExplorerPermissionError(
                            f"Direct API export is restricted on '{clean_name}'. Use DB Dump (pg_dump) to export this table."
                        )
                    response.raise_for_status()
                    batch = response.json()
                    if offset == 0:
                        total_available = _parse_content_range_total(response.headers.get("content-range"), len(batch))
                    rows.extend(redact_row(row) for row in batch)
                    if len(batch) < batch_limit:
                        break
                    offset += len(batch)

        if not col_names and rows:
            col_names = list(rows[0].keys())

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
        base_filename = f"eflow-{clean_name}-{scope}-{timestamp}"

        if export_format == "csv":
            buffer = io.StringIO()
            buffer.write("\ufeff")
            writer = csv.writer(buffer, lineterminator="\r\n")
            writer.writerow(col_names)
            for row in rows:
                writer.writerow([_csv_cell(row.get(col)) for col in col_names])
            content = buffer.getvalue().encode("utf-8")
            media_type = "text/csv; charset=utf-8"
            filename = f"{base_filename}.csv"
        elif export_format == "json":
            payload = {
                "table": clean_name,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "scope": scope,
                "row_count": len(rows),
                "total_matching": total_available,
                "rows": rows,
            }
            content = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")
            media_type = "application/json; charset=utf-8"
            filename = f"{base_filename}.json"
        elif export_format == "jsonl":
            lines = [json.dumps(row, ensure_ascii=False, separators=(",", ":"), default=str) for row in rows]
            content = ("\n".join(lines) + ("\n" if lines else "")).encode("utf-8")
            media_type = "application/x-ndjson; charset=utf-8"
            filename = f"{base_filename}.jsonl"
        elif export_format == "sql":
            header_lines = [
                f"-- eFlow table export: public.{clean_name}",
                f"-- Generated at: {datetime.now(timezone.utc).isoformat()}",
                f"-- Scope: {scope} ({len(rows)} rows)",
                "",
            ]
            quoted_cols = ", ".join(f'"{col}"' for col in col_names)
            sql_lines = list(header_lines)
            for row in rows:
                vals = ", ".join(_sql_literal(row.get(col)) for col in col_names)
                sql_lines.append(f'INSERT INTO public."{clean_name}" ({quoted_cols}) VALUES ({vals});')
            content = ("\n".join(sql_lines) + "\n").encode("utf-8")
            media_type = "application/sql; charset=utf-8"
            filename = f"{base_filename}.sql"
        else:
            raise ExplorerValidationError(f"Unsupported export format: {export_format}")

        self._audit_export(
            actor,
            clean_name,
            export_format,
            scope,
            len(rows),
            {"search": search, "filter_col": filter_col, "date_from": date_from, "date_to": date_to},
        )
        return {
            "content": content,
            "media_type": media_type,
            "filename": filename,
            "row_count": len(rows),
            "total_matching": total_available,
            "truncated": total_available > len(rows) and scope != "page",
        }

    @staticmethod
    def _audit_export(
        actor: AuthenticatedUser,
        table_name: str,
        export_format: str,
        scope: str,
        row_count: int,
        filters: dict[str, Any],
    ) -> None:
        try:
            supabase_admin.table("audit_events").insert(
                {
                    "actor_id": actor.id,
                    "actor_name": actor.email,
                    "entity_type": "database_backup",
                    "entity_id": table_name,
                    "action": "backup.data_exported",
                    "metadata": {
                        "table": table_name,
                        "format": export_format,
                        "scope": scope,
                        "row_count": row_count,
                        "filters": {k: v for k, v in filters.items() if v},
                    },
                }
            ).execute()
        except Exception:
            pass


backup_explorer = BackupExplorerService()
