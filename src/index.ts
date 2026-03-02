#!/usr/bin/env bun

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { searchCommand } from "./commands/search";
import { ingestCommand } from "./commands/ingest";
import { todayCommand } from "./commands/today";
import { listCommand } from "./commands/list";
import { rebuildCommand } from "./commands/rebuild";
import { configCommand } from "./commands/config";

const program = new Command();

program
  .name("memctl")
  .description("Personal memory CLI — markdown-first, vector-searchable, zero servers")
  .version("0.1.0");

program
  .command("init")
  .description("Create default config file and memory directory structure")
  .action(async () => {
    try {
      await initCommand();
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("add <text>")
  .description("Append a memory to today's daily log")
  .option("-t, --tag <tag>", "tag the entry")
  .option("-s, --scope <scope>", "write to a scoped folder")
  .option("-f, --file <file>", "write to a specific file")
  .action(async (text: string, options) => {
    try {
      await addCommand(text, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("search <query>")
  .description("Hybrid search: FTS5 keyword + vector similarity")
  .option("-n, --limit <n>", "max results", "5")
  .option("-s, --scope <scope>", "limit to a scope")
  .option("-k, --keyword", "keyword-only, skip vector search")
  .action(async (query: string, options) => {
    try {
      await searchCommand(query, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("ingest <path>")
  .description("Ingest a file into memory")
  .option("-s, --scope <scope>", "scope the ingested file")
  .action(async (path: string, options) => {
    try {
      await ingestCommand(path, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("today")
  .description("Print today's daily log")
  .action(async () => {
    try {
      await todayCommand();
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all memory files as a tree")
  .option("-d, --dir <subdir>", "list a subdirectory only")
  .action(async (options) => {
    try {
      await listCommand(options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("rebuild")
  .description("Rebuild the entire search index from markdown files")
  .action(async () => {
    try {
      await rebuildCommand();
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("config")
  .description("Print current config")
  .action(async () => {
    try {
      await configCommand();
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
