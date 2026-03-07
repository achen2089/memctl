import { loadConfig } from "../config";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

interface GrepOptions {
  regex?: boolean;
  ignoreCase?: boolean;
  json?: boolean;
  limit?: string;
}

interface GrepMatch {
  filePath: string;
  line: number;
  content: string;
}

/**
 * Recursively walk a directory and yield all .md file paths.
 */
function walkMarkdown(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".index" || entry.name === "node_modules") continue;
      results.push(...walkMarkdown(fullPath));
    } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Grep across all memory markdown files for a pattern.
 * Supports plain string and regex matching.
 */
export async function grepCommand(
  pattern: string,
  options: GrepOptions
): Promise<void> {
  const config = loadConfig();
  const searchDir = config.memory_dir;

  const flags = options.ignoreCase !== false ? "gi" : "g";
  let re: RegExp;
  try {
    re = options.regex
      ? new RegExp(pattern, flags)
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Invalid regex: ${msg}`);
    process.exit(1);
  }

  const files = walkMarkdown(searchDir);
  const matches: GrepMatch[] = [];
  const limit = options.limit ? parseInt(options.limit, 10) : 50;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        re.lastIndex = 0; // reset after test
        matches.push({
          filePath: relative(config.memory_dir, filePath),
          line: i + 1,
          content: lines[i],
        });
        if (matches.length >= limit) break;
      }
    }
    if (matches.length >= limit) break;
  }

  if (matches.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([]));
    } else {
      console.log("No matches found.");
    }
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  for (const match of matches) {
    const highlighted = match.content.replace(re, (m) => `\x1b[1;33m${m}\x1b[0m`);
    re.lastIndex = 0;
    console.log(`\x1b[35m${match.filePath}\x1b[0m:\x1b[32m${match.line}\x1b[0m: ${highlighted}`);
  }

  if (matches.length >= limit) {
    console.log(`\n(showing first ${limit} matches — use --limit to see more)`);
  }
}
