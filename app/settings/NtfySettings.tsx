"use client";

import { useCallback, useEffect, useState } from "react";

type NtfySettings = {
  enabled: boolean;
  hasToken: boolean;
  lastError: string | null;
  lastSentAt: string | null;
  serverUrl: string;
  topic: string;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

async function responseData(response: Response) {
  const data = await response.json() as NtfySettings & { error?: string };
  if (!response.ok) throw new Error(data.error || "ntfy_request_failed");
  return data;
}

export function NtfySettingsPanel() {
  const [settings, setSettings] = useState<NtfySettings | null>(null);
  const [serverUrl, setServerUrl] = useState("https://ntfy.sh");
  const [topic, setTopic] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [clearToken, setClearToken] = useState(false);
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<"save" | "test" | "">("");

  const applySettings = useCallback((next: NtfySettings) => {
    setSettings(next);
    setServerUrl(next.serverUrl);
    setTopic(next.topic);
    setEnabled(next.enabled);
    setToken("");
    setClearToken(false);
  }, []);

  useEffect(() => {
    void fetch("/api/ntfy", { cache: "no-store" })
      .then(responseData)
      .then(applySettings)
      .catch(() => setNotice("无法读取 ntfy 设置。"));
  }, [applySettings]);

  const configurationBody = () => ({
    clearToken,
    enabled,
    serverUrl,
    topic,
    ...(token.trim() ? { token: token.trim() } : {}),
  });

  const save = async () => {
    setBusyAction("save");
    setNotice("");
    try {
      const response = await fetch("/api/ntfy", {
        body: JSON.stringify(configurationBody()),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      applySettings(await responseData(response));
      setNotice("ntfy 设置已保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setBusyAction("");
    }
  };

  const testNotification = async () => {
    setBusyAction("test");
    setNotice("正在发送测试通知…");
    try {
      const saved = await responseData(await fetch("/api/ntfy", {
        body: JSON.stringify(configurationBody()),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }));
      applySettings(saved);
      const tested = await responseData(await fetch("/api/ntfy", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      }));
      applySettings(tested);
      setNotice("测试通知已发送。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "测试通知发送失败。");
    } finally {
      setBusyAction("");
    }
  };

  const tokenIsStored = settings?.hasToken && !clearToken;

  return (
    <section className="settings-section" aria-labelledby="settings-ntfy-title">
      <div className="settings-section__heading">
        <div><p>NOTIFICATIONS</p><h2 id="settings-ntfy-title">ntfy 通知</h2></div>
        <span className={`settings-update-status${enabled ? " is-on" : ""}`}>{enabled ? "已启用" : "未启用"}</span>
      </div>
      <form className="settings-ntfy-panel" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label>
          <span>服务器</span>
          <input type="url" inputMode="url" required value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://ntfy.sh" />
        </label>
        <label>
          <span>Topic</span>
          <input required={enabled} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="uptcg-alerts" />
        </label>
        <label>
          <span>访问令牌{tokenIsStored && <button type="button" onClick={() => setClearToken(true)}>清除</button>}</span>
          <input type="password" autoComplete="new-password" value={token} onChange={(event) => { setToken(event.target.value); setClearToken(false); }} placeholder={tokenIsStored ? "已保存，留空不修改" : "可选"} />
        </label>
        <div className="settings-ntfy-actions">
          <button className={`settings-switch${enabled ? " is-on" : ""}`} type="button" role="switch" aria-checked={enabled} disabled={!settings || Boolean(busyAction)} onClick={() => setEnabled((value) => !value)}>
            <span aria-hidden="true" />通知 · {enabled ? "开" : "关"}
          </button>
          <button type="button" disabled={!settings || !topic.trim() || Boolean(busyAction)} onClick={() => void testNotification()}>{busyAction === "test" ? "发送中…" : "测试"}</button>
          <button className="settings-primary-button" type="submit" disabled={!settings || Boolean(busyAction)}>{busyAction === "save" ? "保存中…" : "保存"}</button>
        </div>
      </form>
      <div className="settings-update-meta">
        <span>{settings?.lastSentAt ? `上次发送 ${displayDate(settings.lastSentAt)}` : "更新成功或失败时通知"}</span>
        {notice
          ? <span className={notice.includes("失败") || notice.includes("无法") || notice.includes("HTTP") ? "is-error" : ""}>{notice}</span>
          : settings?.lastError && <span className="is-error">{settings.lastError}</span>}
      </div>
    </section>
  );
}
