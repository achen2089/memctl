import { loadConfig } from "../config";
import { openDb } from "../db";
import { hybridSearch } from "../search";
import type { SearchResult } from "../search";

/** Options for the search command. */
interface SearchCommandOptions {
  limit?: string;
  keyword?: boolean;
  json?: boolean;
}

/** JSON output format for machine-readable search results. */
interface SearchResultJson {
  filePath: string;
  score: number;
  startLine: number;
  endLine: number;
  content: string;
}

/**
 * Highlight query terms in a text snippet by wrapping matches in **bold**.
 * Case-insensitive, highlights all occurrences.
 */
function highlightSnippet(text: string, query: string): string {
  const terms = query.split(/\s+/).filter((t) => t.length > 0);
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    result = result.replace(re, "**$1**");
  }
  return result;
}

/**
 * Execute a search query and display results.
 * Supports human-readable (default) and JSON output modes.
 */
export async function searchCommand(
  query: string,
  options: SearchCommandOptions
): Promise<void> {
  const config = loadConfig();
  const db = openDb(config);

  try {
    const limit = options.limit ? parseInt(options.limit, 10) : 5;
    const results = await hybridSearch(db, query, config, {
      limit,
      keywordOnly: options.keyword,
    });

    if (results.length === 0) {
      if (options.json) {
        console.log(JSON.stringify([]));
      } else {
        console.log("No results found.");
      }
      return;
    }

    if (options.json) {
      const jsonResults: SearchResultJson[] = results.map((r) => ({
        filePath: r.filePath,
        score: Math.round(r.score * 10) / 10,
        startLine: r.startLine,
        endLine: r.endLine,
        content: r.content,
      }));
      console.log(JSON.stringify(jsonResults, null, 2));
      return;
    }

    for (const result of results) {
      console.log(`\n📄 ${result.filePath} (${result.score.toFixed(1)}%)`);
      console.log("────────────────────────────────");
      const snippet = result.content.length > 300
        ? result.content.slice(0, 300) + "..."
        : result.content;
      console.log(highlightSnippet(snippet, query));
    }
  } finally {
    db.close();
  }
}
