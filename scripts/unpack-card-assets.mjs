import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cardsRoot = path.join(root, "public/cards");
const archiveRoot = path.join(root, "card-assets");
const concurrency = Math.max(1, Math.min(8, Number(process.env.ASSET_JOBS) || 6));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
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

const archives = (await readdir(archiveRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".tar"))
  .map((entry) => entry.name)
  .sort();

if (!archives.length) throw new Error(`No card asset archives found in ${archiveRoot}`);

let completed = 0;
await pool(archives, async (fileName) => {
  const series = fileName.slice(0, -".tar".length);
  const destination = path.join(cardsRoot, series);
  await mkdir(destination, { recursive: true });
  await run("tar", ["-xf", path.join(archiveRoot, fileName), "-C", destination]);
  completed += 1;
  console.log(`[${completed}/${archives.length}] unpacked ${series}`);
});

console.log(`Restored ${archives.length} card asset archives into ${cardsRoot}`);
