"use client";

import { useEffect, useState } from "react";

interface CRMRecord {
  outreach_id: string;
  target_company: string;
  contact_person: string;
  email: string;
  issuer_name: string;
  filing_date: string;
  form_type: string;
  score: number;
  email_subject: string;
  sent_at: string;
  reply_status: string;
  delivery_status: string;
  replied_at?: string;
  followup_due_at?: string;
  outreach_angle?: string;
}

interface WatchlistRecord {
  seed_id: string;
  target_company: string;
  contact_person: string;
  email: string;
  live_enabled: boolean;
  likely_paper: string;
  notes?: string;
}

interface RunLog {
  run_id: string;
  run_at: string;
  filings_scanned: number;
  matched_targets: number;
  emails_sent: number;
  suppressed_dupes: number;
  bounces: number;
  status: string;
  auth_errors?: string;
}

interface GmailStatus {
  authenticated: boolean;
  aliasFound: boolean;
  aliasVerified: boolean;
  aliasEmail?: string;
  allAliases?: string[];
  readyToSend: boolean;
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  awaiting: "bg-zinc-700 text-zinc-300",
  interested: "bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-500",
  declined: "bg-rose-900/60 text-rose-300 ring-1 ring-rose-500",
  bad_email: "bg-orange-900/60 text-orange-300 ring-1 ring-orange-500",
  other: "bg-sky-900/60 text-sky-300",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  completed: "text-emerald-400",
  partial: "text-amber-400",
  failed: "text-rose-400",
  running: "text-sky-400",
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [crm, setCrm] = useState<CRMRecord[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [runLog, setRunLog] = useState<RunLog[]>([]);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [activeTab, setActiveTab] = useState<"crm" | "watchlist" | "log">("crm");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [crmRes, watchRes, logRes, gmailRes] = await Promise.all([
          fetch("/api/crm?limit=100").then((r) => r.json()),
          fetch("/api/watchlist").then((r) => r.json()),
          fetch("/api/run-log?limit=20").then((r) => r.json()),
          fetch("/api/gmail-status").then((r) => r.json()),
        ]);
        setCrm(crmRes.data ?? []);
        setWatchlist(watchRes.data ?? []);
        setRunLog(logRes.data ?? []);
        setGmailStatus(gmailRes);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function triggerDryRun() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/cron/daily-run?dry=1");
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setTriggerResult(String(e));
    } finally {
      setTriggering(false);
    }
  }

  async function triggerLiveRun() {
    if (!confirm("Send LIVE outreach emails now?")) return;
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/cron/daily-run");
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setTriggerResult(String(e));
    } finally {
      setTriggering(false);
    }
  }

  const liveSeeds = watchlist.filter((w) => w.live_enabled);
  const pendingReplies = crm.filter((c) => c.reply_status === "awaiting");
  const interested = crm.filter((c) => c.reply_status === "interested");
  const totalSent = crm.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[#0d0d14] px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              FILINGS OUTREACH <span className="text-violet-400">CRM</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">AntiGravity / Automated Outreach System</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Gmail Status Badge */}
            {gmailStatus && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  gmailStatus.readyToSend
                    ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                    : "bg-rose-900/30 border-rose-700 text-rose-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${gmailStatus.readyToSend ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                {gmailStatus.readyToSend ? `Gmail ready · ${gmailStatus.aliasEmail}` : "Gmail not configured"}
              </div>
            )}

            <button
              onClick={triggerDryRun}
              disabled={triggering}
              className="px-4 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              Dry Run
            </button>
            <button
              onClick={triggerLiveRun}
              disabled={triggering || !gmailStatus?.readyToSend}
              className="px-4 py-1.5 text-xs rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {triggering ? "Running…" : "Run Now"}
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-zinc-800/60 bg-[#0c0c13]">
        <div className="max-w-7xl mx-auto px-8 py-4 grid grid-cols-4 gap-6">
          {[
            { label: "Total Sent", value: totalSent, color: "text-white" },
            { label: "Awaiting Reply", value: pendingReplies.length, color: "text-zinc-400" },
            { label: "Interested", value: interested.length, color: "text-emerald-400" },
            { label: "Live Targets", value: liveSeeds.length, color: "text-violet-400" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Warning Banner */}
      {gmailStatus && !gmailStatus.readyToSend && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-amber-300 text-sm font-medium">⚠ Gmail not ready for live sending</p>
            <p className="text-amber-400/70 text-xs mt-1">{gmailStatus.error}</p>
            {!gmailStatus.aliasFound && gmailStatus.authenticated && (
              <p className="text-amber-400/70 text-xs mt-1">
                Add ricomiller@icloud.com as "Send mail as" in Gmail Settings → Accounts and Import
              </p>
            )}
          </div>
        </div>
      )}

      {/* Trigger Result */}
      {triggerResult && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs text-zinc-500 mb-2">Run Result:</p>
            <pre className="text-xs text-zinc-300 overflow-auto max-h-48 bg-zinc-900 rounded p-3 border border-zinc-800">
              {triggerResult}
            </pre>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-8">
        <div className="max-w-7xl mx-auto flex gap-6">
          {(["crm", "watchlist", "log"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "crm" ? `Outreach CRM (${totalSent})` : tab === "watchlist" ? `Seed Watchlist (${watchlist.length})` : `Run Log (${runLog.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
            Loading data…
          </div>
        ) : (
          <>
            {/* CRM Tab */}
            {activeTab === "crm" && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      {["Company", "Contact", "Issuer", "Form", "Score", "Sent At", "Reply Status", "Follow-up"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 font-medium tracking-wide uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crm.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-zinc-600">
                          No outreach records yet. Run the workflow to generate emails.
                        </td>
                      </tr>
                    ) : (
                      crm.map((row) => (
                        <tr
                          key={row.outreach_id}
                          className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-200">{row.target_company}</div>
                            <div className="text-zinc-600 text-[10px] mt-0.5">{row.email}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{row.contact_person}</td>
                          <td className="px-4 py-3">
                            <div className="text-zinc-300">{row.issuer_name}</div>
                            <div className="text-zinc-600 text-[10px]">{row.filing_date?.slice(0, 10)}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{row.form_type}</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold tabular-nums ${row.score >= 80 ? "text-emerald-400" : row.score >= 50 ? "text-amber-400" : "text-zinc-500"}`}>
                              {row.score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(row.sent_at)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.reply_status] ?? "bg-zinc-800 text-zinc-400"}`}>
                              {row.reply_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                            {row.followup_due_at ? formatDate(row.followup_due_at).split(",")[0] : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Watchlist Tab */}
            {activeTab === "watchlist" && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      {["Status", "Company", "Contact", "Email", "Likely Paper", "Notes"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 font-medium tracking-wide uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((row) => (
                      <tr
                        key={row.seed_id}
                        className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.live_enabled ? "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-700" : "bg-zinc-800 text-zinc-500"}`}>
                            {row.live_enabled ? "LIVE" : "WATCHLIST"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-200">{row.target_company}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.contact_person}</td>
                        <td className="px-4 py-3 text-zinc-500">{row.email || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{row.likely_paper}</td>
                        <td className="px-4 py-3 text-zinc-600 text-[10px]">{row.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Run Log Tab */}
            {activeTab === "log" && (
              <div className="space-y-3">
                {runLog.length === 0 ? (
                  <div className="text-center text-zinc-600 py-12">No runs yet.</div>
                ) : (
                  runLog.map((run) => (
                    <div key={run.run_id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold uppercase tracking-widest ${RUN_STATUS_COLORS[run.status] ?? "text-zinc-400"}`}>
                            {run.status}
                          </span>
                          <span className="text-zinc-600 text-xs">{formatDate(run.run_at)}</span>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono">{run.run_id.slice(0, 8)}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-xs">
                        {[
                          ["Filings", run.filings_scanned],
                          ["Matched", run.matched_targets],
                          ["Sent", run.emails_sent],
                          ["Suppressed", run.suppressed_dupes],
                          ["Bounces", run.bounces],
                        ].map(([label, val]) => (
                          <div key={label as string}>
                            <div className="text-zinc-600 uppercase tracking-wide text-[10px]">{label}</div>
                            <div className="text-zinc-200 font-bold text-lg tabular-nums">{val}</div>
                          </div>
                        ))}
                      </div>
                      {run.auth_errors && (
                        <div className="mt-3 text-xs text-rose-400 bg-rose-950/30 rounded p-2 border border-rose-900">
                          {run.auth_errors}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
