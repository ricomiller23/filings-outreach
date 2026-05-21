"use client";

import { useEffect, useState } from "react";

// Types
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
  send_errors?: string;
  notes?: string;
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
  const [errorState, setErrorState] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // CRM State
  const [crmPage, setCrmPage] = useState(1);
  const crmPerPage = 10;
  const [crmSort, setCrmSort] = useState<keyof CRMRecord>("sent_at");
  const [crmSortDesc, setCrmSortDesc] = useState(true);
  const [crmFilter, setCrmFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const [crmRes, watchRes, logRes, gmailRes] = await Promise.all([
        fetch("/api/crm?limit=100", { cache: "no-store" }),
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/run-log?limit=20", { cache: "no-store" }),
        fetch("/api/gmail-status", { cache: "no-store" }),
      ]);
      if (!crmRes.ok || !watchRes.ok || !logRes.ok || !gmailRes.ok) {
        throw new Error("Failed to load one or more resources.");
      }
      setCrm((await crmRes.json()).data ?? []);
      setWatchlist((await watchRes.json()).data ?? []);
      setRunLog((await logRes.json()).data ?? []);
      setGmailStatus(await gmailRes.json());
    } catch (e) {
      console.error(e);
      setErrorState(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  async function triggerManualRun() {
    if (!isDryRun && !confirm("Send LIVE outreach emails now?")) return;
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch(`/api/manual-run${isDryRun ? "?dry=1" : ""}`, { method: "POST", cache: "no-store" });
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
      if (!isDryRun) {
        loadData(); // Refresh data if it was a live run
      }
    } catch (e) {
      setTriggerResult(String(e));
    } finally {
      setTriggering(false);
    }
  }

  async function toggleLiveStatus(seed_id: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed_id, live_enabled: !currentStatus }),
      });
      if (res.ok) {
        setWatchlist((prev) => prev.map((w) => w.seed_id === seed_id ? { ...w, live_enabled: !currentStatus } : w));
      }
    } catch (e) {
      console.error("Failed to toggle status", e);
    }
  }

  const liveSeeds = watchlist.filter((w) => w.live_enabled);
  const pendingReplies = crm.filter((c) => c.reply_status === "awaiting");
  const interested = crm.filter((c) => c.reply_status === "interested");
  const totalSent = crm.length;

  const lastRunTime = runLog.length > 0 ? formatDate(runLog[0].run_at) : "Never";
  const nextScheduledRun = "Tomorrow at 8:00 AM ET"; // Since we know the cron schedule

  // CRM Sorting & Filtering
  const filteredCrm = crm.filter((c) => crmFilter === "all" || c.reply_status === crmFilter);
  const sortedCrm = [...filteredCrm].sort((a, b) => {
    const valA = a[crmSort] ?? "";
    const valB = b[crmSort] ?? "";
    if (valA < valB) return crmSortDesc ? 1 : -1;
    if (valA > valB) return crmSortDesc ? -1 : 1;
    return 0;
  });
  
  const crmPaginated = sortedCrm.slice((crmPage - 1) * crmPerPage, crmPage * crmPerPage);
  const totalCrmPages = Math.ceil(sortedCrm.length / crmPerPage);

  const toggleSort = (key: keyof CRMRecord) => {
    if (crmSort === key) setCrmSortDesc(!crmSortDesc);
    else {
      setCrmSort(key);
      setCrmSortDesc(true);
    }
  };

  return (
    <div className="w-full">
      {/* Status Banner */}
      <div className="bg-[#12121c] border-b border-zinc-800 px-8 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Gmail Auth:</span>
            {gmailStatus ? (
              <span className={`flex items-center gap-1.5 font-medium ${gmailStatus.readyToSend ? "text-emerald-400" : "text-rose-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${gmailStatus.readyToSend ? "bg-emerald-400" : "bg-rose-400"}`} />
                {gmailStatus.readyToSend ? "Connected" : "Action Required"}
              </span>
            ) : <span className="text-zinc-500 animate-pulse">Checking...</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Last Run:</span>
            <span className="text-zinc-300 font-medium">{lastRunTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Next Scheduled:</span>
            <span className="text-zinc-300 font-medium">{nextScheduledRun}</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#0c0c13] border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-6 grid grid-cols-4 gap-6">
          {[
            { label: "Total Sent", value: totalSent, color: "text-white" },
            { label: "Awaiting Reply", value: pendingReplies.length, color: "text-zinc-400" },
            { label: "Interested", value: interested.length, color: "text-emerald-400" },
            { label: "Live Targets", value: liveSeeds.length, color: "text-violet-400" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60 shadow-inner">
              <span className={`text-3xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs & Trigger */}
      <div className="border-b border-zinc-800 bg-[#0d0d14] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <div className="flex gap-6">
            {(["crm", "watchlist", "log"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {tab === "crm" ? `Outreach CRM (${totalSent})` : tab === "watchlist" ? `Seed Watchlist (${watchlist.length})` : `Run Log (${runLog.length})`}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4 py-2">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isDryRun} 
                onChange={(e) => setIsDryRun(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-600 focus:ring-offset-zinc-900" 
              />
              Dry Run
            </label>
            <button
              onClick={triggerManualRun}
              disabled={triggering || (!isDryRun && !gmailStatus?.readyToSend)}
              className={`px-5 py-2 text-sm rounded-lg font-medium transition-all shadow-lg ${
                isDryRun 
                  ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700" 
                  : "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/20"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {triggering ? "Running..." : (isDryRun ? "Test Run" : "Launch Outreach")}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {triggerResult && (
          <div className="mb-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto relative">
            <button onClick={() => setTriggerResult(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">✕</button>
            <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">Run Result:</h3>
            <pre className="text-xs text-zinc-300 font-mono">{triggerResult}</pre>
          </div>
        )}

        {errorState ? (
          <div className="flex flex-col items-center justify-center h-64 border border-rose-900/50 bg-rose-950/20 rounded-xl">
            <span className="text-rose-400 font-medium mb-2">Failed to load data</span>
            <span className="text-rose-500/70 text-sm">{errorState}</span>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 rounded-lg text-sm transition-colors">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4 border border-zinc-800/50 bg-zinc-900/10 rounded-xl">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-zinc-500 text-sm font-medium tracking-wide">SYNCING DATA...</span>
          </div>
        ) : (
          <>
            {/* CRM Tab */}
            {activeTab === "crm" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-2">Filter Status:</span>
                    <select 
                      value={crmFilter} 
                      onChange={(e) => { setCrmFilter(e.target.value); setCrmPage(1); }}
                      className="bg-zinc-800 border-none text-xs text-zinc-200 rounded-lg focus:ring-1 focus:ring-violet-500 outline-none px-3 py-1.5"
                    >
                      <option value="all">All Statuses</option>
                      {Object.keys(STATUS_COLORS).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center mr-2 text-xs text-zinc-500">
                    Showing {(crmPage - 1) * crmPerPage + 1}-{Math.min(crmPage * crmPerPage, sortedCrm.length)} of {sortedCrm.length}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-xl bg-[#0a0a0f]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80">
                        {[
                          { key: "target_company", label: "Company" },
                          { key: "contact_person", label: "Contact" },
                          { key: "issuer_name", label: "Issuer" },
                          { key: "form_type", label: "Form" },
                          { key: "score", label: "Score" },
                          { key: "sent_at", label: "Sent At" },
                          { key: "reply_status", label: "Status" },
                        ].map((col) => (
                          <th 
                            key={col.key} 
                            onClick={() => toggleSort(col.key as keyof CRMRecord)}
                            className="px-5 py-3.5 text-left text-zinc-400 font-semibold tracking-wide uppercase cursor-pointer hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {col.label}
                              {crmSort === col.key && (
                                <span className="text-violet-500">{crmSortDesc ? "↓" : "↑"}</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {crmPaginated.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-16 text-center text-zinc-500 bg-zinc-900/20">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-lg">📭</span>
                              <span>No outreach records match the current filters.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        crmPaginated.map((row) => (
                          <tr
                            key={row.outreach_id}
                            className="border-b border-zinc-800/50 hover:bg-zinc-900/60 transition-colors group"
                          >
                            <td className="px-5 py-3.5">
                              <div className="font-medium text-zinc-200 group-hover:text-violet-300 transition-colors">{row.target_company}</div>
                              <div className="text-zinc-600 text-[10px] mt-0.5">{row.email}</div>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-400">{row.contact_person}</td>
                            <td className="px-5 py-3.5">
                              <div className="text-zinc-300">{row.issuer_name}</div>
                              <div className="text-zinc-600 text-[10px] mt-0.5">{row.filing_date?.slice(0, 10)}</div>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-500 font-medium">{row.form_type}</td>
                            <td className="px-5 py-3.5">
                              <span className={`font-bold tabular-nums flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border ${row.score >= 80 ? "border-emerald-900/50 text-emerald-400" : row.score >= 50 ? "border-amber-900/50 text-amber-400" : "border-zinc-800 text-zinc-500"}`}>
                                {row.score}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap">{formatDate(row.sent_at)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${STATUS_COLORS[row.reply_status] ?? "bg-zinc-800 text-zinc-400"}`}>
                                {row.reply_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalCrmPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button 
                      onClick={() => setCrmPage(p => Math.max(1, p - 1))} 
                      disabled={crmPage === 1}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                      Prev
                    </button>
                    <div className="flex items-center px-4 text-sm font-medium text-zinc-500 bg-zinc-900/50 rounded-lg">
                      {crmPage} / {totalCrmPages}
                    </div>
                    <button 
                      onClick={() => setCrmPage(p => Math.min(totalCrmPages, p + 1))} 
                      disabled={crmPage === totalCrmPages}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Watchlist Tab */}
            {activeTab === "watchlist" && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-xl bg-[#0a0a0f]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      {["Status", "Company", "Contact", "Email", "Likely Paper", "Notes"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-zinc-400 font-semibold tracking-wide uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center text-zinc-500 bg-zinc-900/20">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-lg">🌱</span>
                            <span>Watchlist is empty.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      watchlist.map((row) => (
                        <tr
                          key={row.seed_id}
                          className={`border-b border-zinc-800/50 transition-colors ${row.live_enabled ? 'hover:bg-emerald-950/10' : 'hover:bg-zinc-900/60'}`}
                        >
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => toggleLiveStatus(row.seed_id, row.live_enabled)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all shadow-sm ${
                                row.live_enabled 
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700"
                              }`}
                            >
                              {row.live_enabled ? "✓ LIVE" : "+ ADD TO LIVE"}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-zinc-200">{row.target_company}</td>
                          <td className="px-5 py-3.5 text-zinc-400">{row.contact_person}</td>
                          <td className="px-5 py-3.5 text-zinc-500">{row.email || "—"}</td>
                          <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate">{row.likely_paper}</td>
                          <td className="px-5 py-3.5 text-zinc-600 text-[10px]">{row.notes ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Run Log Tab */}
            {activeTab === "log" && (
              <div className="space-y-4">
                {runLog.length === 0 ? (
                  <div className="text-center text-zinc-500 py-16 bg-zinc-900/20 border border-zinc-800/50 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">📜</span>
                      <span>No runs recorded yet.</span>
                    </div>
                  </div>
                ) : (
                  runLog.map((run) => (
                    <div key={run.run_id} className="rounded-xl border border-zinc-800/80 bg-[#0d0d14] overflow-hidden shadow-lg transition-all hover:border-zinc-700">
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-zinc-900 border ${RUN_STATUS_COLORS[run.status] ? RUN_STATUS_COLORS[run.status] + " border-zinc-800" : "text-zinc-400 border-zinc-800"}`}>
                              {run.status}
                            </span>
                            <span className="text-zinc-500 text-sm font-medium">{formatDate(run.run_at)}</span>
                          </div>
                          <span className="text-[10px] text-zinc-600 font-mono bg-zinc-900 px-2 py-1 rounded">ID: {run.run_id.slice(0, 8)}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-4 text-xs">
                          {[
                            ["Filings", run.filings_scanned],
                            ["Matched", run.matched_targets],
                            ["Sent", run.emails_sent],
                            ["Suppressed", run.suppressed_dupes],
                            ["Bounces", run.bounces],
                          ].map(([label, val]) => (
                            <div key={label as string} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
                              <div className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold mb-1">{label}</div>
                              <div className="text-zinc-100 font-bold text-xl tabular-nums">{val}</div>
                            </div>
                          ))}
                        </div>
                        
                        {(run.auth_errors || run.send_errors || run.notes) && (
                          <div className="mt-4 pt-4 border-t border-zinc-800/50">
                            <button 
                              onClick={() => setExpandedLog(expandedLog === run.run_id ? null : run.run_id)}
                              className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 transition-colors"
                            >
                              {expandedLog === run.run_id ? "Hide Details" : "View Error Details"}
                              <span className="text-[10px]">{expandedLog === run.run_id ? "▲" : "▼"}</span>
                            </button>
                            
                            {expandedLog === run.run_id && (
                              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                {run.auth_errors && (
                                  <div className="text-xs text-rose-300 bg-rose-950/40 rounded-lg p-3 border border-rose-900/50 font-mono overflow-x-auto">
                                    <div className="font-bold mb-1 uppercase tracking-wider text-[10px] text-rose-400">Auth Error</div>
                                    {run.auth_errors}
                                  </div>
                                )}
                                {run.send_errors && (
                                  <div className="text-xs text-amber-300 bg-amber-950/40 rounded-lg p-3 border border-amber-900/50 font-mono overflow-x-auto">
                                    <div className="font-bold mb-1 uppercase tracking-wider text-[10px] text-amber-400">Send Error</div>
                                    {run.send_errors}
                                  </div>
                                )}
                                {run.notes && (
                                  <div className="text-xs text-zinc-300 bg-zinc-900 rounded-lg p-3 border border-zinc-800 font-mono overflow-x-auto">
                                    <div className="font-bold mb-1 uppercase tracking-wider text-[10px] text-zinc-500">System Note</div>
                                    {run.notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
