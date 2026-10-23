"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Link2Off, Loader2, Send, ShieldAlert } from "lucide-react";

type TelegramConnector = {
  id: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  safeMetadata: Record<string, unknown>;
  disabledAt: string | null;
};

type ApiError = { ok: false; error?: { code?: string; message?: string } };

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { ok?: boolean }) | ApiError | null;
  if (!response.ok || !payload || payload.ok === false) {
    const message = (payload as ApiError | null)?.error?.message;
    throw new Error(message || `Request failed (HTTP ${response.status}).`);
  }
  return payload as T;
}

function meta(connector: TelegramConnector, key: string) {
  const value = connector.safeMetadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function TelegramConnectorCard({ workspaceId }: { workspaceId: string | null }) {
  const [connectors, setConnectors] = useState<TelegramConnector[]>([]);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const data = await readJson<{ connectors: TelegramConnector[] }>(
      await fetch(`/api/social-media/connectors?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" }),
    );
    setConnectors(
      data.connectors.filter(
        (connector) => connector.provider === "TELEGRAM" && !connector.disabledAt && connector.state !== "DISCONNECTED",
      ),
    );
  }, [workspaceId]);

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load Telegram connectors."));
  }, [load]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  const connect = () =>
    run("connect", async () => {
      if (!workspaceId) throw new Error("No publishing workspace is available.");
      const result = await readJson<{ connector: { displayName: string }; testMessageId: number | null }>(
        await fetch("/api/social-media/connectors/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, botToken, chatId, sendTestMessage: true }),
        }),
      );
      setBotToken("");
      setChatId("");
      setNotice(
        `Connected ${result.connector.displayName}.${result.testMessageId ? " A test message was posted to the channel." : ""}`,
      );
      await load();
    });

  const test = (connectorId: string) =>
    run(`test:${connectorId}`, async () => {
      await readJson(
        await fetch("/api/social-media/connectors/telegram/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, connectorId }),
        }),
      );
      setNotice("Test message posted. Check the channel.");
    });

  const disconnect = (connectorId: string) =>
    run(`disconnect:${connectorId}`, async () => {
      await readJson(
        await fetch("/api/social-media/connectors", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, connectorId }),
        }),
      );
      setNotice("Telegram channel disconnected and the stored bot token deleted.");
      await load();
    });

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Bot-token connector</p>
      <h2 className="mt-2 text-xl font-bold text-white">Telegram channel</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
        Paste the bot token from @BotFather and your channel. GEM checks the token with Telegram, confirms the bot is an
        administrator that can post, and stores the token encrypted on the server. It is never shown again.
      </p>

      {connectors.length > 0 ? (
        <div className="mt-4 space-y-3">
          {connectors.map((connector) => (
            <div key={connector.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
              <div className="text-sm">
                <p className="flex items-center gap-2 font-semibold text-white">
                  <CircleCheck className="h-4 w-4 text-emerald-300" /> {connector.displayName}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  Bot @{meta(connector, "botUsername") ?? "unknown"} · {meta(connector, "chatType") ?? "chat"} · id {connector.externalAccountId}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void test(connector.id)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 disabled:opacity-40">
                  {busy === `test:${connector.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
                </button>
                <button type="button" onClick={() => void disconnect(connector.id)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/25 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-40">
                  {busy === `disconnect:${connector.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />} Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <label className="text-xs text-white/55">
          Bot token
          <input
            type="password"
            value={botToken}
            onChange={(event) => setBotToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="123456789:AA…"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
          />
        </label>
        <label className="text-xs text-white/55">
          Channel
          <input
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="@yourchannel or -100…"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
          />
        </label>
        <button
          type="submit"
          disabled={!workspaceId || !botToken.trim() || !chatId.trim() || Boolean(busy)}
          className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#071019] disabled:opacity-40"
        >
          {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Connect &amp; send test
        </button>
      </form>
      <p className="mt-2 text-xs text-white/35">
        First add the bot to the channel as an administrator with permission to post messages. Connecting posts one short test message.
      </p>

      {notice ? <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-sm text-emerald-100">{notice}</p> : null}
      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
    </section>
  );
}
