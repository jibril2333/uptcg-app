import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const SETTINGS_FILE = "ntfy-settings.json";

function cleanString(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeServerUrl(value) {
  const candidate = cleanString(value, 500) || "https://ntfy.sh";
  const url = new URL(candidate);
  if (url.protocol !== "https:") throw new Error("ntfy 服务器必须使用 HTTPS");
  if (url.username || url.password || url.search || url.hash) throw new Error("ntfy 服务器地址格式不正确");
  return url.href.replace(/\/+$/, "");
}

function normalizeTopic(value) {
  const topic = cleanString(value, 80);
  if (topic && (!/^[\p{L}\p{N}_-]+$/u.test(topic) || topic.length > 64)) {
    throw new Error("Topic 只能包含文字、数字、横线或下划线，最多 64 个字符");
  }
  return topic;
}

function normalizedSettings(value = {}) {
  return {
    enabled: value.enabled === true,
    lastError: cleanString(value.lastError, 500) || null,
    lastSentAt: typeof value.lastSentAt === "string" && !Number.isNaN(Date.parse(value.lastSentAt))
      ? new Date(value.lastSentAt).toISOString()
      : null,
    serverUrl: normalizeServerUrl(value.serverUrl),
    token: cleanString(value.token, 1000),
    topic: normalizeTopic(value.topic),
  };
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export function createNtfyManager({ cardDataRoot, fetchImpl = fetch, now = () => new Date() }) {
  const settingsPath = path.join(cardDataRoot, SETTINGS_FILE);
  let settings = normalizedSettings();

  async function save() {
    await writeJsonAtomic(settingsPath, settings);
  }

  async function initialize() {
    try {
      settings = normalizedSettings(JSON.parse(await readFile(settingsPath, "utf8")));
    } catch {
      settings = normalizedSettings();
      await save();
    }
  }

  function publicSettings() {
    return {
      enabled: settings.enabled,
      hasToken: Boolean(settings.token),
      lastError: settings.lastError,
      lastSentAt: settings.lastSentAt,
      serverUrl: settings.serverUrl,
      topic: settings.topic,
    };
  }

  async function configure(value = {}) {
    const next = normalizedSettings({
      ...settings,
      enabled: value.enabled,
      serverUrl: value.serverUrl,
      token: value.clearToken === true
        ? ""
        : typeof value.token === "string" && value.token.trim()
          ? value.token
          : settings.token,
      topic: value.topic,
    });
    if (next.enabled && !next.topic) throw new Error("请填写 ntfy Topic");
    settings = next;
    await save();
    return publicSettings();
  }

  async function publish({ message, priority = 3, tags = "cards", title }, { force = false } = {}) {
    if (!force && !settings.enabled) return { skipped: true };
    if (!settings.topic) throw new Error("请先填写并保存 ntfy Topic");

    const headers = { "content-type": "application/json; charset=utf-8" };
    if (settings.token) headers.authorization = `Bearer ${settings.token}`;

    try {
      const response = await fetchImpl(settings.serverUrl, {
        body: JSON.stringify({
          message,
          priority,
          tags: tags.split(",").filter(Boolean),
          title,
          topic: settings.topic,
        }),
        headers,
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`ntfy 返回 HTTP ${response.status}`);
      settings.lastError = null;
      settings.lastSentAt = now().toISOString();
      await save();
      return { skipped: false };
    } catch (error) {
      settings.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await save();
      throw error;
    }
  }

  async function sendTest() {
    await publish({
      message: "ntfy 通知配置正常。",
      priority: 3,
      tags: "white_check_mark,cards",
      title: "UPTCG 测试通知",
    }, { force: true });
    return publicSettings();
  }

  async function notifyCardUpdate(event) {
    if (event.status === "success") {
      const catalog = event.catalog || {};
      await publish({
        message: `发现 ${event.addedCardCount || 0} 张新卡片。当前已收录 ${catalog.workCount || 0} 个作品、${catalog.productCount || 0} 个分类，共 ${catalog.cardCount || 0} 张卡牌。`,
        priority: 3,
        tags: "white_check_mark,cards",
        title: "UPTCG 发现新卡片",
      });
      return;
    }
    await publish({
      message: event.error || "卡牌数据更新未完成，请打开设置页查看。",
      priority: 4,
      tags: "warning,cards",
      title: "UPTCG 卡牌数据更新失败",
    });
  }

  return { configure, initialize, notifyCardUpdate, publicSettings, sendTest };
}
