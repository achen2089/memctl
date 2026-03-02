# memctl — Personal Memory CLI

## What This Is

A portable, embedded personal memory system for AI agents and humans. Markdown-first, vector-searchable, zero servers.

## Tech Stack

- **Runtime:** Bun (primary), should also work with Node 20+ where possible
- **Language:** TypeScript (strict)
- **Database:** `bun:sqlite` with FTS5 for full-text search + vector storage
- **Embeddings:** `@huggingface/transformers` — in-process ONNX model (`Xenova/all-MiniLM-L6-v2`, 384 dims). No external server needed.
- **PDF extraction:** `pdf-parse` 
- **CLI framework:** `commander`
- **Config:** YAML config file via `yaml` package

## Architecture

### Three Layers

1. **Markdown files (source of truth)** — human-readable, synced via iCloud/Dropbox/etc
2. **SQLite index (search cache)** — FTS5 + vector embeddings, fully rebuildable from markdown
3. **Artifacts (binary files)** — PDFs, images stored alongside their `.md` extracted summaries

### Directory Structure (memory folder)

```
<memory_dir>/              # configured in ~/.memctl/config.yaml
├── daily/
│   └── 2026-03-01.md      # daily logs
├── knowledge/
│   └── preferences.md     # persistent facts
├── documents/
│   ├── paper.pdf           # original artifact
│   └── paper.md            # extracted + indexed
├── projects/
│   └── memctl.md           # project-specific memories
├── scopes/
│   ├── claude/daily/       # scoped per tool/agent
│   ├── codex/daily/
│   └── pufferbot/daily/
└── .index/
    └── memctl.db           # SQLite FTS5 + vectors (gitignored, rebuildable)
```

### Config File (`~/.memctl/config.yaml`)

```yaml
# Where memory files live
memory_dir: ~/Library/Mobile Documents/com~apple~CloudDocs/memory

# Embedding model (downloaded on first use, ~23MB)
embedding_model: Xenova/all-MiniLM-L6-v2
embedding_dimensions: 384

# Set to false to use FTS5 only (no vector search)
embeddings_enabled: true
```

If no config exists, create one with sensible defaults on first run. The `memory_dir` default should be `~/.memctl/memory` (NOT iCloud — that's user-configured).

## CLI Commands

### `memctl add <text>`
Append a memory to today's daily log.
- `--tag <tag>` or `-t` — tag the entry (e.g. `decision`, `fact`, `preference`)
- `--scope <scope>` or `-s` — write to a scoped folder (e.g. `claude`, `pufferbot`)
- `--file <file>` or `-f` — write to a specific file instead of daily log

Format in the daily log:
```markdown
# 2026-03-01

- **22:30** The memory text here #tag
```

### `memctl search <query>`
Hybrid search: FTS5 keyword + vector similarity. Returns top results ranked.
- `--limit <n>` or `-n` — max results (default 5)
- `--scope <scope>` or `-s` — limit to a scope
- `--keyword` or `-k` — keyword-only, skip vector search

Output format:
```
📄 daily/2026-03-01.md (92.3%)
────────────────────────────────
The matching content snippet...
```

### `memctl ingest <path>`
Ingest a file into memory. Extracts text, creates markdown sidecar, indexes.
- Supports: `.pdf`, `.md`, `.txt`, and any text-readable file
- `--scope <scope>` or `-s` — scope the ingested file
- PDFs: extract text → write `<name>.md` alongside `<name>.pdf` in `documents/`

### `memctl today`
Print today's daily log.

### `memctl list`
List all memory files as a tree.
- `--dir <subdir>` or `-d` — list a subdirectory only

### `memctl rebuild`
Rebuild the entire search index from markdown files. Walks the memory dir, chunks, embeds, indexes.

### `memctl config`
Print current config (resolved paths).

### `memctl init`
Create default config file and memory directory structure.

## Project Structure

```
src/
├── index.ts          # CLI entrypoint (commander)
├── config.ts         # YAML config loading + defaults
├── db.ts             # bun:sqlite setup, FTS5, vector storage
├── embed.ts          # @huggingface/transformers embedding
├── chunk.ts          # Text chunking (paragraphs, ~1000 char chunks)
├── extract.ts        # PDF + text extraction
├── search.ts         # Hybrid FTS5 + vector search logic
└── commands/
    ├── add.ts
    ├── search.ts
    ├── ingest.ts
    ├── today.ts
    ├── list.ts
    ├── rebuild.ts
    ├── config.ts
    └── init.ts
```

## Package Configuration

```json
{
  "name": "memctl",
  "bin": { "memctl": "./src/index.ts" },
  "type": "module"
}
```

Make the entrypoint `#!/usr/bin/env bun` shebang.

## Code Standards

- No classes, prefer functions and plain objects
- Use async/await, no callbacks
- Error handling: catch and print user-friendly messages, exit with code 1
- Keep it simple — this is a CLI tool, not a framework
- No unnecessary abstractions

## Testing

For now, manual testing is fine. Make sure these work:
```bash
memctl init
memctl add "test memory" --tag test
memctl add "scoped memory" --scope claude
memctl search "test"
memctl search "test" --keyword
memctl today
memctl list
memctl rebuild
memctl config
```

## What NOT to Do

- No server mode, no HTTP API
- No MCP server
- No React/web UI
- No external embedding services (no OpenAI, no Ollama)
- No complex database migrations — single table setup
- Don't over-engineer. Ship it simple.
