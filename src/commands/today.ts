import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { loadConfig } from "../config";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Print today's daily log file to stdout. */
export async function todayCommand(): Promise<void> {
  const config = loadConfig();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const filePath = join(config.memory_dir, "daily", `${dateStr}.md`);

  if (!existsSync(filePath)) {
    console.log(`No entries for today (${dateStr}).`);
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  console.log(content);
}
