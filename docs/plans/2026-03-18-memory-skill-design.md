# SQLite Memory Skill Design

**Date:** 2026-03-18

## Goal

Create a user-level memory skill for OpenCode, inspired by OpenClaw-style persistent memory, that stores structured memories in SQLite while keeping Markdown exports for readability and portability.

## Context

The current workspace is empty, so this work starts from scratch. The skill should live at the user level rather than inside a specific project so it can be reused across repositories and sessions.

## Requirements

- Support general-purpose memory, not just code memory.
- Store operational data in SQLite for fast lookup and better scaling than pure Markdown.
- Keep Markdown exports so users can inspect and back up memory without database tools.
- Support:
  - semantic-ish search
  - timeline browsing
  - manual memory creation
  - automatic extraction
  - tags/categories
- Work through both natural-language usage and CLI-style commands.

## Approaches Considered

### 1. Markdown only

Use `.md` files as the primary store and grep/parse them at runtime.

Pros:
- human-readable
- easy to sync

Cons:
- slow as memory volume grows
- hard to support ranking, filtering, and timeline queries cleanly
- expensive repeated parsing

### 2. SQLite only

Use SQLite as the only store and render output on demand.

Pros:
- fast lookups
- simple indexing
- clean schema evolution

Cons:
- poor inspectability without tools
- weaker portability for users who want plain-text memory snapshots

### 3. Hybrid SQLite + Markdown export (chosen)

Use SQLite as the system of record and generate Markdown exports from structured rows.

Pros:
- fast reads and writes
- keeps user-readable memory documents
- enables timeline, tags, and ranking cleanly
- easy future upgrade path to embeddings or FTS

Cons:
- export synchronization logic required
- slightly more moving pieces than a single-store design

## Chosen Design

### Installation model

Install as a user-level skill under `~/.config/opencode/skills/sqlite-memory-skill/`.

Development can happen in a normal workspace and then be copied or linked into the user skill directory.

### Storage model

Primary storage:
- SQLite database file such as `~/.local/share/opencode-memory/memory.db`

Derived export:
- Markdown directory such as `~/.local/share/opencode-memory/export/`

SQLite is authoritative. Markdown is generated for browsing, backup, and debugging.

### Data model

Core tables:
- `memories`
  - `id`
  - `content`
  - `summary`
  - `source`
  - `importance`
  - `created_at`
  - `updated_at`
  - `event_at`
  - `access_count`
  - `last_accessed_at`
- `tags`
  - `id`
  - `name`
- `memory_tags`
  - `memory_id`
  - `tag_id`
- `memory_links`
  - `from_memory_id`
  - `to_memory_id`
  - `relation`
- `ingestion_log`
  - `id`
  - `source`
  - `status`
  - `created_at`

Phase 1 keeps search lightweight. A future phase can add SQLite FTS5 or embeddings without breaking the schema.

### Retrieval model

Phase 1 search strategy:
- exact tag filters
- recency sort
- keyword match on `content` and `summary`
- optional SQLite FTS5 if available in the runtime

This gives a practical “semantic-ish” experience without requiring local embedding models on day one.

### Automatic extraction

Automatic extraction should be conservative. The system stores only clearly useful facts:
- preferences
- stable project decisions
- repeated instructions
- follow-up obligations
- named entities and relationships when confidence is high

Extraction strategy:
- parse input text
- derive candidate memories
- score candidates
- deduplicate by normalized content + recent similarity check
- persist approved rows

### Markdown export strategy

Generate Markdown from SQLite into:
- `timeline/YYYY-MM.md`
- `tags/<tag>.md`
- `memories/<id>.md`

Exports should be deterministic so diffs stay readable.

### User interaction model

The skill should support two entry styles:

Natural language:
- “记住我偏好用 sqlite 做存储”
- “搜索与 APISIX 相关的记忆”
- “查看最近一周的记忆”

CLI-style:
- `memory add --content "..." --tags a,b`
- `memory search "sqlite performance"`
- `memory timeline --days 7`
- `memory export`

## File Layout

Planned skill layout:

- `sqlite-memory-skill/SKILL.md`
- `sqlite-memory-skill/scripts/memory_cli.py`
- `sqlite-memory-skill/scripts/export_markdown.py`
- `sqlite-memory-skill/scripts/extract_memories.py`
- `sqlite-memory-skill/references/schema.md`
- `sqlite-memory-skill/references/usage.md`

## Error Handling

- Initialize database automatically if missing.
- Fail safely when export directory is unavailable.
- Return clear messages for empty search results.
- Protect against duplicate tags and duplicate near-identical memory inserts.
- Keep extraction failures isolated from manual add/search flows.

## Testing Strategy

- schema initialization tests
- manual add/list/search tests
- tag association tests
- timeline query tests
- export generation tests
- extraction deduplication tests

Tests should use temporary SQLite databases and temporary export directories.

## Future Extensions

- embeddings-backed search
- memory decay or archival
- importance re-ranking from access history
- project-scoped and user-scoped memory namespaces
- import existing Markdown memory archives into SQLite

## Success Criteria

- User can install the skill at user scope.
- User can add, search, browse, tag, and export memory.
- SQLite becomes the fast source of truth.
- Markdown remains available as a readable mirror.
- The initial implementation stays lightweight and local-first.
