import { existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { loadConfig } from "../config";

function printTree(dir: string, prefix: string, baseDir: string): void {
  const entries = readdirSync(dir).filter((e) => !e.startsWith(".")).sort();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const fullPath = join(dir, entry);
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      console.log(`${prefix}${connector}${entry}/`);
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      printTree(fullPath, newPrefix, baseDir);
    } else {
      console.log(`${prefix}${connector}${entry}`);
    }
  }
}

/** Display memory files as a tree structure. */
export async function listCommand(options: { dir?: string }): Promise<void> {
  const config = loadConfig();
  let targetDir = config.memory_dir;

  if (options.dir) {
    targetDir = join(config.memory_dir, options.dir);
  }

  if (!existsSync(targetDir)) {
    console.log(`Directory not found: ${targetDir}`);
    return;
  }

  const displayName = options.dir || relative(join(config.memory_dir, ".."), config.memory_dir);
  console.log(`${displayName}/`);
  printTree(targetDir, "", config.memory_dir);
}
