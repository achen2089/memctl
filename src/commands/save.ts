import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { loadConfig } from "../config";
import { openDb, insertChunk } from "../db";
import { chunkText } from "../chunk";
import { embed } from "../embed";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function fetchPage(url: string): Promise<{ title: string; text: string }> {
  // Use Readability-style extraction via a simple fetch + HTML strip
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
  
  const html = await resp.text();
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/si);
  const title = titleMatch 
    ? titleMatch[1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim()
    : new URL(url).hostname;

  // Strip HTML to get text content
  // Remove script/style blocks first
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  
  // Convert common elements to markdown-ish
  text = text
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

export async function saveCommand(
  url: string,
  options: { scope?: string; title?: string }
): Promise<void> {
  const config = loadConfig();

  console.log(`Fetching ${url}...`);
  const { title: pageTitle, text } = await fetchPage(url);
  const title = options.title || pageTitle;

  if (text.length < 50) {
    console.error("Could not extract meaningful content from this URL.");
    process.exit(1);
  }

  // Determine target directory
  let targetDir: string;
  if (options.scope) {
    targetDir = join(config.memory_dir, "scopes", options.scope, "web");
  } else {
    targetDir = join(config.memory_dir, "web");
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const slug = slugify(title);
  const mdPath = join(targetDir, `${slug}.md`);
  const content = `# ${title}\n\n_Source: ${url}_\n_Saved: ${new Date().toISOString().slice(0, 10)}_\n\n---\n\n${text}`;
  writeFileSync(mdPath, content, "utf-8");
  console.log(`Saved to ${mdPath}`);

  // Index
  const db = openDb(config);
  try {
    const relativePath = mdPath.replace(config.memory_dir + "/", "");
    const chunks = chunkText(text);
    console.log(`Indexing ${chunks.length} chunk(s)...`);

    for (let i = 0; i < chunks.length; i++) {
      let embedding: Float32Array | null = null;
      if (config.embeddings_enabled) {
        embedding = await embed(chunks[i].text, config);
      }
      insertChunk(db, relativePath, i, chunks[i].text, chunks[i].startLine, chunks[i].endLine, embedding);
    }

    console.log(`Done. "${title}" (${text.length} chars, ${chunks.length} chunks)`);
  } finally {
    db.close();
  }
}
