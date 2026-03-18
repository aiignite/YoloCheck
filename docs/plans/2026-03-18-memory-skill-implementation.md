# SQLite Memory Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a user-level OpenCode memory skill backed by SQLite with Markdown exports, manual and automatic memory capture, timeline browsing, tag support, and lightweight search.

**Architecture:** The skill is packaged as a reusable OpenCode skill with a small Python CLI. SQLite is the source of truth for memory records, tags, links, and ingestion metadata. Markdown files are exported from SQLite for inspectability, backup, and grep-friendly browsing.

**Tech Stack:** Python 3, `sqlite3`, `argparse`, `pathlib`, `pytest`, optional SQLite FTS5

---

### Task 1: Initialize the Skill Skeleton

**Files:**
- Create: `build/sqlite-memory-skill/`
- Create: `build/sqlite-memory-skill/SKILL.md`
- Create: `build/sqlite-memory-skill/scripts/`
- Create: `build/sqlite-memory-skill/references/`
- Test: `tests/test_skill_layout.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_skill_layout_exists(tmp_path):
    skill_dir = tmp_path / "sqlite-memory-skill"
    assert (skill_dir / "SKILL.md").exists()
    assert (skill_dir / "scripts").is_dir()
    assert (skill_dir / "references").is_dir()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_skill_layout.py -v`
Expected: FAIL because skill files do not exist yet

**Step 3: Write minimal implementation**

- Create the skill directory tree.
- Add a placeholder `SKILL.md` with valid frontmatter.
- Add empty `scripts/` and `references/` directories.

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_skill_layout.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill tests/test_skill_layout.py
git commit -m "feat: initialize sqlite memory skill skeleton"
```

### Task 2: Add Database Bootstrap and Schema

**Files:**
- Create: `build/sqlite-memory-skill/scripts/memory_store.py`
- Create: `tests/test_memory_store.py`
- Create: `build/sqlite-memory-skill/references/schema.md`

**Step 1: Write the failing test**

```python
from pathlib import Path

from memory_store import initialize_database


def test_initialize_database_creates_core_tables(tmp_path):
    db_path = tmp_path / "memory.db"
    initialize_database(db_path)
    assert db_path.exists()
```
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_memory_store.py::test_initialize_database_creates_core_tables -v`
Expected: FAIL with import or missing function error

**Step 3: Write minimal implementation**

Implement:
- `initialize_database(db_path)`
- create tables `memories`, `tags`, `memory_tags`, `memory_links`, `ingestion_log`
- create useful indexes on timestamps and tag joins

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_memory_store.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/memory_store.py build/sqlite-memory-skill/references/schema.md tests/test_memory_store.py
git commit -m "feat: add sqlite schema bootstrap for memory skill"
```

### Task 3: Implement Manual Memory Creation

**Files:**
- Modify: `build/sqlite-memory-skill/scripts/memory_store.py`
- Create: `build/sqlite-memory-skill/scripts/memory_cli.py`
- Test: `tests/test_manual_add.py`

**Step 1: Write the failing test**

```python
from memory_store import initialize_database, add_memory, list_memories


def test_add_memory_persists_content_and_tags(tmp_path):
    db_path = tmp_path / "memory.db"
    initialize_database(db_path)

    memory_id = add_memory(
        db_path,
        content="User prefers sqlite for persistent memory.",
        tags=["preference", "storage"],
        source="manual",
    )

    rows = list_memories(db_path)
    assert memory_id is not None
    assert len(rows) == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_manual_add.py -v`
Expected: FAIL because `add_memory` and `list_memories` are not implemented

**Step 3: Write minimal implementation**

Implement:
- `add_memory(...)`
- tag upsert logic
- `list_memories(...)`
- CLI subcommand: `memory add`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_manual_add.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/memory_store.py build/sqlite-memory-skill/scripts/memory_cli.py tests/test_manual_add.py
git commit -m "feat: add manual memory creation and tagging"
```

### Task 4: Implement Timeline Browsing

**Files:**
- Modify: `build/sqlite-memory-skill/scripts/memory_store.py`
- Test: `tests/test_timeline.py`

**Step 1: Write the failing test**

```python
from datetime import datetime, timedelta

from memory_store import initialize_database, add_memory, get_timeline


def test_get_timeline_returns_recent_entries_first(tmp_path):
    db_path = tmp_path / "memory.db"
    initialize_database(db_path)

    add_memory(db_path, content="Older", tags=[], source="manual", event_at=datetime.now() - timedelta(days=2))
    add_memory(db_path, content="Newer", tags=[], source="manual", event_at=datetime.now())

    timeline = get_timeline(db_path, days=7)
    assert [item["content"] for item in timeline] == ["Newer", "Older"]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_timeline.py -v`
Expected: FAIL because `get_timeline` is missing

**Step 3: Write minimal implementation**

Implement:
- `get_timeline(db_path, days=7, limit=50)`
- CLI subcommand: `memory timeline --days N`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_timeline.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/memory_store.py build/sqlite-memory-skill/scripts/memory_cli.py tests/test_timeline.py
git commit -m "feat: add memory timeline queries"
```

### Task 5: Implement Search

**Files:**
- Modify: `build/sqlite-memory-skill/scripts/memory_store.py`
- Test: `tests/test_search.py`
- Modify: `build/sqlite-memory-skill/scripts/memory_cli.py`

**Step 1: Write the failing test**

```python
from memory_store import initialize_database, add_memory, search_memories


def test_search_memories_matches_keywords_and_tags(tmp_path):
    db_path = tmp_path / "memory.db"
    initialize_database(db_path)

    add_memory(db_path, content="Use sqlite for memory persistence", tags=["storage"], source="manual")
    add_memory(db_path, content="Use apisix for gateway routing", tags=["infra"], source="manual")

    results = search_memories(db_path, query="sqlite", tags=["storage"])
    assert len(results) == 1
    assert results[0]["content"] == "Use sqlite for memory persistence"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_search.py -v`
Expected: FAIL because `search_memories` is missing

**Step 3: Write minimal implementation**

Implement:
- `search_memories(db_path, query, tags=None, limit=10)`
- keyword matching over `content` and `summary`
- optional FTS5 branch when supported
- CLI subcommand: `memory search QUERY`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_search.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/memory_store.py build/sqlite-memory-skill/scripts/memory_cli.py tests/test_search.py
git commit -m "feat: add lightweight memory search"
```

### Task 6: Implement Automatic Extraction and Deduplication

**Files:**
- Create: `build/sqlite-memory-skill/scripts/extract_memories.py`
- Modify: `build/sqlite-memory-skill/scripts/memory_store.py`
- Test: `tests/test_extraction.py`

**Step 1: Write the failing test**

```python
from memory_store import initialize_database, list_memories
from extract_memories import extract_and_store


def test_extract_and_store_saves_useful_unique_memories(tmp_path):
    db_path = tmp_path / "memory.db"
    initialize_database(db_path)

    text = "User prefers sqlite. User prefers sqlite. Project uses markdown exports."
    created = extract_and_store(db_path, text, source="conversation")

    rows = list_memories(db_path)
    assert created == 2
    assert len(rows) == 2
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_extraction.py -v`
Expected: FAIL because extraction module is missing

**Step 3: Write minimal implementation**

Implement:
- simple sentence-based candidate extraction
- normalized deduplication
- source logging to `ingestion_log`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_extraction.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/extract_memories.py build/sqlite-memory-skill/scripts/memory_store.py tests/test_extraction.py
git commit -m "feat: add automatic memory extraction and deduplication"
```

### Task 7: Implement Markdown Export

**Files:**
- Create: `build/sqlite-memory-skill/scripts/export_markdown.py`
- Modify: `build/sqlite-memory-skill/scripts/memory_store.py`
- Test: `tests/test_export_markdown.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

from memory_store import initialize_database, add_memory
from export_markdown import export_markdown


def test_export_markdown_generates_timeline_and_tag_files(tmp_path):
    db_path = tmp_path / "memory.db"
    export_dir = tmp_path / "export"
    initialize_database(db_path)
    add_memory(db_path, content="Use sqlite", tags=["storage"], source="manual")

    export_markdown(db_path, export_dir)

    assert any((export_dir / "tags").iterdir())
    assert any((export_dir / "timeline").iterdir())
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_export_markdown.py -v`
Expected: FAIL because exporter is missing

**Step 3: Write minimal implementation**

Implement:
- export per-memory pages
- export monthly timeline pages
- export per-tag pages
- CLI subcommand: `memory export`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_export_markdown.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/scripts/export_markdown.py build/sqlite-memory-skill/scripts/memory_cli.py tests/test_export_markdown.py
git commit -m "feat: add markdown export for sqlite memory"
```

### Task 8: Finalize SKILL.md and Usage References

**Files:**
- Modify: `build/sqlite-memory-skill/SKILL.md`
- Create: `build/sqlite-memory-skill/references/usage.md`
- Test: `tests/test_skill_metadata.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_skill_frontmatter_contains_name_and_description():
    text = Path("build/sqlite-memory-skill/SKILL.md").read_text()
    assert "name:" in text
    assert "description:" in text
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_skill_metadata.py -v`
Expected: FAIL if the final metadata and usage guidance are not complete enough

**Step 3: Write minimal implementation**

Document:
- when to trigger the skill
- how to use manual add/search/timeline/export/extract flows
- where SQLite and Markdown data live

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_skill_metadata.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill/SKILL.md build/sqlite-memory-skill/references/usage.md tests/test_skill_metadata.py
git commit -m "feat: document sqlite memory skill usage"
```

### Task 9: Package and Install at User Scope

**Files:**
- Create: `dist/sqlite-memory-skill.skill`
- Modify: `~/.config/opencode/skills/sqlite-memory-skill/` or symlink target
- Test: installation smoke test command

**Step 1: Write the failing test**

There is no meaningful unit test for packaging itself. Instead write a smoke-check script or command expectation that fails before packaging.

**Step 2: Run test to verify it fails**

Run: `test -e dist/sqlite-memory-skill.skill`
Expected: non-zero exit because package does not exist yet

**Step 3: Write minimal implementation**

Run:

```bash
python /Users/wyh/.claude/skills/skill-creator/scripts/package_skill.py build/sqlite-memory-skill dist
ln -sfn "$PWD/build/sqlite-memory-skill" ~/.config/opencode/skills/sqlite-memory-skill
```

**Step 4: Run test to verify it passes**

Run: `test -e dist/sqlite-memory-skill.skill && ls ~/.config/opencode/skills/sqlite-memory-skill`
Expected: package exists and installed path resolves

**Step 5: Commit**

```bash
git add build/sqlite-memory-skill dist/sqlite-memory-skill.skill
git commit -m "feat: package and install sqlite memory skill"
```

### Task 10: Run the Full Verification Suite

**Files:**
- Test: `tests/`

**Step 1: Write the failing test**

At this stage the failing condition is the absence of a complete verification run.

**Step 2: Run test to verify current gaps**

Run: `pytest tests -v`
Expected: any remaining failures are addressed before completion

**Step 3: Write minimal implementation**

Fix only the failing areas discovered in the verification run.

**Step 4: Run test to verify it passes**

Run: `pytest tests -v`
Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify sqlite memory skill end to end"
```
