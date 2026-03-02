import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { dirname, join } from "path";
import { loadConfig } from "../config";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export async function addCommand(
  text: string,
  options: { tag?: string; scope?: string; file?: string }
): Promise<void> {
  const config = loadConfig();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let filePath: string;

  if (options.file) {
    filePath = join(config.memory_dir, options.file);
  } else if (options.scope) {
    const scopeDir = join(config.memory_dir, "scopes", options.scope, "daily");
    if (!existsSync(scopeDir)) {
      mkdirSync(scopeDir, { recursive: true });
    }
    filePath = join(scopeDir, `${dateStr}.md`);
  } else {
    const dailyDir = join(config.memory_dir, "daily");
    if (!existsSync(dailyDir)) {
      mkdirSync(dailyDir, { recursive: true });
    }
    filePath = join(dailyDir, `${dateStr}.md`);
  }

  const tagStr = options.tag ? ` #${options.tag}` : "";
  const entry = `- **${timeStr}** ${text}${tagStr}\n`;

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `# ${dateStr}\n\n${entry}`, "utf-8");
  } else {
    appendFileSync(filePath, entry, "utf-8");
  }

  const relative = filePath.replace(config.memory_dir + "/", "");
  console.log(`Added to ${relative}`);
}
