# memctl

Personal memory CLI — markdown-first, vector-searchable, zero servers.

## What is this?

`memctl` is a command-line tool that gives you (and your AI agents) a persistent, searchable memory system. Memories are stored as plain markdown files, indexed with SQLite FTS5 + vector embeddings for hybrid search. No databases to run, no APIs to manage.

**Key ideas:**
- **Markdown is the source of truth** — human-readable, version-controllable, syncs via iCloud/Dropbox/git
- **SQLite index is a cache** — fully rebuildable from the markdown files at any time
- **In-process embeddings** — uses `all-MiniLM-L6-v2` (23MB ONNX model), no Ollama or external services
- **Works for humans and AI agents** — any tool that can run a shell command gets memory

## Install

```bash
# requires bun
bun install
bun link
```

## Quick start

```bash
# initialize config and directory structure
memctl init

# add a memory
memctl add "Switched from Docker Compose v1 to v2 on the Mac mini"

# add with a tag
memctl add "Always bind Docker ports to 127.0.0.1" -t decision

# search (hybrid keyword + semantic)
memctl search "docker port binding"

# see today's log
memctl today

# ingest a document (PDF, markdown, text)
memctl ingest ~/Documents/paper.pdf

# save a webpage
memctl save https://example.com/article

# scoped memories (per-agent/tool)
memctl add "User prefers Bun over Node" -s claude
memctl search "preferences" -s claude

# list all memory files
memctl list

# rebuild the search index from scratch
memctl rebuild

# show config
memctl config
```

## Directory structure

```
<memory_dir>/
├── daily/            # daily logs (YYYY-MM-DD.md)
├── knowledge/        # persistent facts, preferences
├── documents/        # ingested files + extracted text
├── projects/         # project-specific memories
├── scopes/           # per-agent/tool memories
│   ├── claude/
│   ├── pufferbot/
│   └── ...
└── .index/
    └── memctl.db     # search index (rebuildable, gitignored)
```

## How search works

Queries run against two systems simultaneously:
- **FTS5** — SQLite full-text search for exact keyword matches
- **Vector similarity** — cosine similarity against `all-MiniLM-L6-v2` embeddings

Results are merged and ranked. Use `--limit` to control how many results come back.

## Config

Stored at `~/.memctl/config.yaml`:

```yaml
memory_dir: ~/Library/Mobile Documents/com~apple~CloudDocs/Memory
embedding_model: Xenova/all-MiniLM-L6-v2
embedding_dimensions: 384
embeddings_enabled: true
```

## AI agent integration

Add this to your agent's instruction file (`CLAUDE.md`, `AGENTS.md`, etc.):

```
## Memory
Use memctl for persistent memory across sessions:
- `memctl add "<text>"` — save a memory
- `memctl search "<query>"` — recall memories
- `memctl add "<text>" -s <scope>` — scoped to this tool
- `memctl today` — see what's been logged today
```

## Tech stack

- **Bun** + TypeScript
- **bun:sqlite** with FTS5
- **@huggingface/transformers** (all-MiniLM-L6-v2, 384 dims)
- **commander** for CLI
- **pdf-parse** for document ingestion

## License

Private
