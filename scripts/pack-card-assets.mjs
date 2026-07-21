import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cardsRoot = path.join(root, "public/cards");
const archiveRoot = path.join(root, "card-assets");
const requested = process.argv.slice(2);
const concurrency = Math.max(1, Math.min(8, Number(process.env.ASSET_JOBS) || 6));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });
}

async function pool(items, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
}

const entries = await readdir(cardsRoot, { withFileTypes: true });
const available = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
const series = requested.length ? requested : [...available].sort();

for (const name of series) {
  if (!available.has(name) || name.includes("/") || name.includes("..")) {
    throw new Error(`Unknown card asset directory: ${name}`);
  }
}

await mkdir(archiveRoot, { recursive: true });
let completed = 0;
await pool(series, async (name) => {
  const source = path.join(cardsRoot, name);
  const archive = path.join(archiveRoot, `${name}.tar`);
  await run("tar", ["-cf", archive, "-C", source, "."]);
  completed += 1;
  console.log(`[${completed}/${series.length}] packed ${name}`);
});

console.log(`Packed ${series.length} card asset archives into ${archiveRoot}`);
