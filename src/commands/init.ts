import { existsSync, mkdirSync } from "fs";
import { loadConfig, saveConfig, getConfigPath, getConfigDir } from "../config";

/** Initialize memctl config and memory directory structure. */
export async function initCommand(): Promise<void> {
  const configPath = getConfigPath();
  const configDir = getConfigDir();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (!existsSync(configPath)) {
    const config = loadConfig();
    saveConfig(config);
    console.log(`Created config at ${configPath}`);
  } else {
    console.log(`Config already exists at ${configPath}`);
  }

  const config = loadConfig();
  const memDir = config.memory_dir;

  const dirs = [
    memDir,
    `${memDir}/daily`,
    `${memDir}/knowledge`,
    `${memDir}/documents`,
    `${memDir}/projects`,
    `${memDir}/scopes`,
    `${memDir}/.index`,
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`Created ${dir}`);
    }
  }

  console.log(`\nMemory directory: ${memDir}`);
  console.log("Initialization complete.");
}
