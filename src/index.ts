#!/usr/bin/env bun

import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { searchCommand } from "./commands/search";
import { ingestCommand } from "./commands/ingest";
import { todayCommand } from "./commands/today";
import { listCommand } from "./commands/list";
import { rebuildCommand } from "./commands/rebuild";
import { configCommand } from "./commands/config";
import { saveCommand } from "./commands/save";
import { grepCommand } from "./commands/grep";

// Version inlined for compiled binary compatibility
const VERSION = "0.2.0";

const program = new Command();

program
  .name("memctl")
  .description("Personal memory CLI — markdown-first, vector-searchable, zero servers")
  .version(VERSION, "-V, --version", "print the current version")
  .addHelpText("after", `
Quick Start:
  $ memctl init                          # set up config and memory directory
  $ memctl add "something worth remembering"
  $ memctl add "use Bun over Node" -t decision
  $ memctl search "that thing about Bun"  # hybrid keyword + semantic search
  $ memctl grep "Bun"                     # fast raw pattern match (no index)
  $ memctl ingest paper.pdf               # extract and index a PDF
  $ memctl save https://example.com       # save a webpage to memory
  $ memctl today                          # see what you logged today

Search Modes:
  search     Hybrid FTS5 + vector similarity (needs index)
  grep       Raw pattern matching across files (no index, instant)

Output:
  --json     Machine-readable JSON output (search, grep)
  --verbose  Detailed progress (rebuild)

Config: ~/.memctl/config.yaml
Docs:   https://github.com/achen2089/memctl`);

program
  .command("init")
  .description("Create default config file and memory directory structure")
  .addHelpText("after", `
Examples:
  $ memctl init`)
  .action(async () => {
    try {
      await initCommand();
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("add <text>")
  .description("Append a memory to today's daily log")
  .option("-t, --tag <tag>", "tag the entry (e.g. decision, fact, preference)")
  .option("-f, --file <file>", "write to a specific file instead of daily log")
  .addHelpText("after", `
Examples:
  $ memctl add "prefer dark mode for all editors"
  $ memctl add "decided to use SQLite" --tag decision
  $ memctl add "prefer vim keybindings" -f knowledge/preferences.md`)
  .action(async (text: string, options: { tag?: string; file?: string }) => {
    try {
      await addCommand(text, options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("search <query>")
  .description("Hybrid search: FTS5 keyword + vector similarity")
  .option("-n, --limit <n>", "max results (default: 5)", "5")
  .option("-k, --keyword", "keyword-only, skip vector search")
  .option("-j, --json", "output results as JSON (for AI agent consumption)")
  .addHelpText("after", `
Examples:
  $ memctl search "dark mode preference"
  $ memctl search "project decisions" --limit 10
  $ memctl search "sqlite" --keyword
  $ memctl search "docker ports" --json`)
  .action(async (query: string, options: { limit?: string; keyword?: boolean; json?: boolean }) => {
    try {
      await searchCommand(query, options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("ingest <path>")
  .description("Ingest a file into memory (PDF, markdown, or text)")
  .addHelpText("after", `
Examples:
  $ memctl ingest paper.pdf
  $ memctl ingest notes.md`)
  .action(async (path: string) => {
    try {
      await ingestCommand(path, {});
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("today")
  .description("Print today's daily log")
  .addHelpText("after", `
Examples:
  $ memctl today`)
  .action(async () => {
    try {
      await todayCommand();
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all memory files as a tree")
  .option("-d, --dir <subdir>", "list a subdirectory only")
  .addHelpText("after", `
Examples:
  $ memctl list
  $ memctl list --dir daily`)
  .action(async (options: { dir?: string }) => {
    try {
      await listCommand(options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("rebuild")
  .description("Rebuild the entire search index from markdown files")
  .option("-v, --verbose", "show detailed progress for each chunk")
  .addHelpText("after", `
Examples:
  $ memctl rebuild
  $ memctl rebuild --verbose`)
  .action(async (options: { verbose?: boolean }) => {
    try {
      await rebuildCommand(options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("save <url>")
  .description("Save a webpage to memory")
  .option("-t, --title <title>", "override the page title")
  .addHelpText("after", `
Examples:
  $ memctl save https://example.com/article
  $ memctl save https://example.com --title "Research Paper"`)
  .action(async (url: string, options: { title?: string }) => {
    try {
      await saveCommand(url, options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("grep <pattern>")
  .description("Search memory files by pattern (like grep)")
  .option("-r, --regex", "treat pattern as a regular expression")
  .option("-i, --ignore-case", "case-insensitive matching (default: true)")
  .option("-j, --json", "output matches as JSON")
  .option("-n, --limit <n>", "max matches (default: 50)", "50")
  .addHelpText("after", `
Examples:
  $ memctl grep "SQLite"
  $ memctl grep "eigen.*" --regex
  $ memctl grep "TODO" --json`)
  .action(async (pattern: string, options: { regex?: boolean; ignoreCase?: boolean; json?: boolean; limit?: string }) => {
    try {
      await grepCommand(pattern, options);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("config")
  .description("Print current config (resolved paths)")
  .addHelpText("after", `
Examples:
  $ memctl config`)
  .action(async () => {
    try {
      await configCommand();
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
