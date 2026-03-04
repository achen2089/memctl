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

// Read version from package.json
const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

const program = new Command();

program
  .name("memctl")
  .description("Personal memory CLI — markdown-first, vector-searchable, zero servers")
  .version(pkg.version, "-V, --version", "print the current version");

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
  .option("-s, --scope <scope>", "write to a scoped folder (e.g. claude, pufferbot)")
  .option("-f, --file <file>", "write to a specific file instead of daily log")
  .addHelpText("after", `
Examples:
  $ memctl add "prefer dark mode for all editors"
  $ memctl add "decided to use SQLite" --tag decision
  $ memctl add "claude context" --scope claude`)
  .action(async (text: string, options: { tag?: string; scope?: string; file?: string }) => {
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
  .option("-s, --scope <scope>", "limit to a scope")
  .option("-k, --keyword", "keyword-only, skip vector search")
  .option("-j, --json", "output results as JSON (for AI agent consumption)")
  .addHelpText("after", `
Examples:
  $ memctl search "dark mode preference"
  $ memctl search "project decisions" --limit 10
  $ memctl search "meeting notes" --scope claude --json
  $ memctl search "sqlite" --keyword`)
  .action(async (query: string, options: { limit?: string; scope?: string; keyword?: boolean; json?: boolean }) => {
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
  .option("-s, --scope <scope>", "scope the ingested file")
  .addHelpText("after", `
Examples:
  $ memctl ingest paper.pdf
  $ memctl ingest notes.md --scope research`)
  .action(async (path: string, options: { scope?: string }) => {
    try {
      await ingestCommand(path, options);
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
  .option("-s, --scope <scope>", "scope the saved page")
  .option("-t, --title <title>", "override the page title")
  .addHelpText("after", `
Examples:
  $ memctl save https://example.com/article
  $ memctl save https://example.com --scope research --title "Research Paper"`)
  .action(async (url: string, options: { scope?: string; title?: string }) => {
    try {
      await saveCommand(url, options);
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
