import { loadConfig } from "../config";
import { openDb } from "../db";
import { hybridSearch } from "../search";

export async function searchCommand(
  query: string,
  options: { limit?: string; scope?: string; keyword?: boolean }
): Promise<void> {
  const config = loadConfig();
  const db = openDb(config);

  try {
    const limit = options.limit ? parseInt(options.limit, 10) : 5;
    const results = await hybridSearch(db, query, config, {
      limit,
      scope: options.scope,
      keywordOnly: options.keyword,
    });

    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    for (const result of results) {
      console.log(`\n📄 ${result.filePath} (${result.score.toFixed(1)}%)`);
      console.log("────────────────────────────────");
      // Show a snippet (first 200 chars)
      const snippet = result.content.length > 200
        ? result.content.slice(0, 200) + "..."
        : result.content;
      console.log(snippet);
    }
  } finally {
    db.close();
  }
}
