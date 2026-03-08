# memctl

Personal memory system for humans and AI agents.

## The Idea

One folder. Every tool points to it. Knowledge carries across sessions, tools, and devices.

```
~/Memory/                  ← synced via iCloud/Dropbox/git
├── daily/                 ← what happened today
├── knowledge/             ← long-lived facts and preferences
├── documents/             ← ingested files (PDFs → markdown)
├── ...                    ← any folders you want (courses, books, projects)
└── .index/                ← search index (auto-generated, ignore)
```

Point any AI tool at this folder and it just works:

```markdown
# In your CLAUDE.md, AGENTS.md, or any AI tool config:

## Memory
Your persistent memory is at ~/Memory/
Read files there for context. Write new learnings to daily/ or knowledge/.
For fast search: memctl search "<query>"
```

That's it. Claude Code reads the files directly. Codex reads the files directly. Any tool that can read files gets your full context.

## memctl CLI

`memctl` is an optional power tool on top of the folder — quick adds, fast search, file ingestion.

### Install

```bash
# Option 1: From source (requires Bun)
git clone https://github.com/achen2089/memctl.git
cd memctl && bun install && bun link

# Option 2: Compiled binary (no dependencies)
# Or download the compiled binary (no dependencies)
# Drop it anywhere in your PATH
```

### Setup

```bash
memctl init    # creates ~/.memctl/config.yaml and directory structure
```

Edit `~/.memctl/config.yaml` to point at your memory folder:

```yaml
memory_dir: ~/Memory
```

### Usage

```bash
# Add memories (goes to daily/ with timestamp)
memctl add "something worth remembering"
memctl add "always use 127.0.0.1 for Docker ports" -t decision

# Write to a specific file
memctl add "prefer vim keybindings" -f knowledge/preferences.md

# Search (hybrid keyword + semantic)
memctl search "docker port binding"

# Raw pattern match (no index, instant)
memctl grep "Docker"

# Ingest a PDF (extracts text → markdown for AI tools to read)
memctl ingest paper.pdf

# Save a webpage
memctl save https://example.com/article

# See today's log
memctl today

# Scoped memories (per-agent/tool)
memctl add "user prefers dark mode" -s claude
memctl search "preferences" -s claude
```

### Search modes

| Command | How it works | When to use |
|---------|-------------|-------------|
| `memctl search` | FTS5 + vector similarity (needs index) | Fuzzy/semantic queries |
| `memctl grep` | Raw pattern matching (no index) | Exact terms, instant |

### Flags

- `--json` — machine-readable output (search, grep)
- `--verbose` — detailed progress (rebuild)
- `--scope` / `-s` — isolate memories per tool/agent
- `--tag` / `-t` — tag entries (decision, fact, preference)

## How it works

1. **Markdown files are the source of truth** — human-readable, editable, syncable
2. **SQLite index is a cache** — FTS5 + vector embeddings, fully rebuildable with `memctl rebuild`
3. **In-process embeddings** — `all-MiniLM-L6-v2` (23MB ONNX model), no external services needed

## AI tool integration

Add this to your project's `CLAUDE.md` or `AGENTS.md`:

```markdown
## Memory
Your persistent memory is at ~/Memory/
Read files there for context. Write new learnings to daily/ or knowledge/.

Quick commands:
- memctl add "<text>" — save a memory
- memctl search "<query>" — find memories
- memctl grep "<pattern>" — raw search
- memctl today — see today's log
```

## License

MIT
