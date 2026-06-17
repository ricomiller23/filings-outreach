// app/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Plus, Search, SlidersHorizontal, ArrowUpDown, Download, 
  Trash2, Mail, Phone, Calendar, User, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, FileText, Settings, Star, Sparkles,
  ArrowRight, MessageSquare, Play, RefreshCw, Send, Check,
  ExternalLink, Filter, ChevronLeft, ChevronDown, X, Eye
} from "lucide-react";

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
}

interface ContactRecord {
  id: string;
  contact_name: string;
  title?: string;
  company?: string;
  email: string;
  phone?: string;
  filing_url?: string;
  source: string;
  is_individual: boolean;
  is_decision_maker: boolean;
  influence_level: string;
  security_type?: string;
  position_size: number;
  estimated_value: number;
  security_description?: string;
  status: string;
  priority: string;
  last_contact_date?: string;
  last_contact_method?: string;
  next_follow_up_date?: string;
  next_follow_up_action?: string;
  touchpoints: Array<{
    date: string;
    type: string;
    notes: string;
    outcome: string;
  }>;
  deal_value: number;
  close_probability: number;
  expected_close_date?: string;
  notes?: string;
  tags: string[];
  follow_up_sequence: string;
  automation_enabled: boolean;
  created_at: string;
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
  readyToSend: boolean;
  error?: string;
}

interface FilingRecord {
  id: string;
  accessionNumber: string;
  formType: string;
  filedAt: string;
  periodOfReport: string;
  score: number;
  hasAgedDebt: boolean;
  hasRestricted: boolean;
  has3a10: boolean;
  rawXmlUrl: string;
  primaryDocUrl: string;
  createdAt: string;
  issuerId: string;
  issuerName: string;
  issuerTicker: string;
  marketTier: string;
  issuerCik: string;
  insiderId: string;
  insiderName: string;
  insiderCik: string;
}

interface FilingDetailData {
  filing: Record<string, unknown>;
  transactions: Array<{
    id: string;
    tableType: string;
    securityTitle: string;
    transactionDate: string;
    transactionCode: string;
    shares: number;
    pricePerShare: number;
    acquiredDisposed: string;
    sharesOwnedAfter: number;
  }>;
  insiderRoles: Array<{
    isDirector: boolean;
    isOfficer: boolean;
    isTenPctOwn: boolean;
    officerTitle: string;
    firstSeen: string;
    lastSeen: string;
  }>;
}

const FORM_TYPES = ["F3", "F3A", "F4", "F4A", "F5", "S1", "S1A", "SC13D", "SC13G", "OTHER"] as const;
const MARKET_TIERS = ["OTCBB", "OTCQB", "OTCQX", "PINK_CURRENT", "PINK_LIMITED", "PINK_NO_INFO", "GREY", "EXPERT", "NYSE", "NASDAQ", "OTHER"] as const;

const SCORE_COLORS: Record<string, string> = {
  high: "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40",
  medium: "bg-amber-950/50 text-amber-400 border border-amber-800/40",
  low: "bg-zinc-800 text-zinc-400 border border-zinc-700/40",
};

function getScoreColor(score: number): string {
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

function formatShortDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const PIPELINE_COLUMNS = ["Hot", "Warm", "Cold", "Closed_Won", "Closed_Lost", "Dead"] as const;

const STATUS_COLORS: Record<string, string> = {
  Hot: "bg-rose-950/40 text-rose-400 border border-rose-800/50",
  Warm: "bg-amber-950/40 text-amber-400 border border-amber-800/50",
  Cold: "bg-sky-950/40 text-sky-400 border border-sky-800/50",
  Closed_Won: "bg-emerald-950/40 text-emerald-400 border border-emerald-800/50",
  Closed_Lost: "bg-zinc-900 text-zinc-400 border border-zinc-700/50",
  Dead: "bg-red-950/40 text-red-400 border border-red-800/50",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-950/50 text-rose-400 border border-rose-800/30",
  Medium: "bg-amber-950/50 text-amber-400 border border-amber-800/30",
  Low: "bg-zinc-800 text-zinc-400 border border-zinc-700/30",
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

function formatUSD(num: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(num);
}

function isGenericEmailLocal(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  const parts = cleanEmail.split('@');
  if (parts.length !== 2) return false;
  const localPart = parts[0].replace(/[._-]/g, '');
  const genericPrefixes = [
    "ir", "info", "contact", "sales", "support", "admin", "jobs", "careers", "marketing",
    "press", "media", "investorrelations", "investors", "office", "help", "hello",
    "enquiries", "inquiries", "team", "contactus", "feedback", "pr", "irdesk", "sec",
    "compliance", "legal"
  ];
  return genericPrefixes.includes(localPart);
}

function isRealPersonNameLocal(name?: string | null): boolean {
  if (!name || name.trim().length === 0) return false;
  const n = name.trim().toLowerCase();
  if (
    n === "investor relations" ||
    n === "investor relations contact" ||
    n.includes("ir desk") ||
    n.includes("contact") ||
    n.includes("hello") ||
    n === "investors"
  ) return false;
  
  const entityPatterns = [
    /\b(inc|corp|co|ltd|llc|lp|plc|holdings|group|trust|fund|capital|partners|ventures|gmbh|s\.a\.|n\.v\.|ag)\b/i,
    /\b(bank|association|foundation|committee|council)\b/i,
  ];
  for (const pat of entityPatterns) {
    if (pat.test(n)) return false;
  }
  
  const tokens = n.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2) return false;
  
  return true;
}

export default function DashboardClient() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [runLog, setRunLog] = useState<RunLog[]>([]);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [activeTab, setActiveTab] = useState<"pipeline" | "filings" | "contacts" | "watchlist" | "sequences" | "log">("pipeline");
  const [loading, setLoading] = useState(true);
  
  // Pipeline filter / view state
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [securityFilter, setSecurityFilter] = useState("");
  const [humanOnlyFilter, setHumanOnlyFilter] = useState(false);
  
  // Trigger workflow state
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  // Quick Action Forms
  const [noteText, setNoteText] = useState("");
  const [touchpointType, setTouchpointType] = useState("note_added");
  const [touchpointOutcome, setTouchpointOutcome] = useState("neutral");

  // Filings Explorer State
  const [filingsData, setFilingsData] = useState<FilingRecord[]>([]);
  const [filingsTotal, setFilingsTotal] = useState(0);
  const [filingsTotalPages, setFilingsTotalPages] = useState(0);
  const [filingsLoading, setFilingsLoading] = useState(false);
  const [filingsSearch, setFilingsSearch] = useState("");
  const [filingsFormType, setFilingsFormType] = useState("");
  const [filingsMarketTier, setFilingsMarketTier] = useState("");
  const [filingsHasAgedDebt, setFilingsHasAgedDebt] = useState(false);
  const [filingsHasRestricted, setFilingsHasRestricted] = useState(false);
  const [filingsHas3a10, setFilingsHas3a10] = useState(false);
  const [filingsMinScore, setFilingsMinScore] = useState("");
  const [filingsDateFrom, setFilingsDateFrom] = useState("");
  const [filingsDateTo, setFilingsDateTo] = useState("");
  const [filingsSortBy, setFilingsSortBy] = useState("filedAt");
  const [filingsSortDir, setFilingsSortDir] = useState("desc");
  const [filingsPage, setFilingsPage] = useState(1);
  const [selectedFiling, setSelectedFiling] = useState<FilingDetailData | null>(null);
  const [selectedFilingRow, setSelectedFilingRow] = useState<FilingRecord | null>(null);
  const [filingDetailLoading, setFilingDetailLoading] = useState(false);
  const [showFilingsFilters, setShowFilingsFilters] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupAction, setFollowupAction] = useState("");

  // Add Contact Form State
  const [newContactForm, setNewContactForm] = useState({
    contactName: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    source: "manual_entry",
    isIndividual: true,
    isDecisionMaker: false,
    influenceLevel: "influencer",
    securityType: "Section_3a10",
    positionSize: 0,
    estimatedValue: 0,
    securityDescription: "",
    status: "Warm",
    priority: "Medium",
    dealValue: 0,
    notes: ""
  });

  // Sequences editor / mock data
  const [sequences, setSequences] = useState([
    { id: "aggressive", name: "Aggressive Sequence", steps: ["Day 1: Initial Pitch", "Day 3: Value Add follow-up", "Day 7: Direct Offer", "Day 14: Final follow-up"] },
    { id: "standard", name: "Standard Sequence", steps: ["Day 1: Warm intro", "Day 5: Case study / Info", "Day 14: Friendly check-in", "Day 30: Re-engagement email"] },
    { id: "gentle", name: "Gentle Nurture", steps: ["Day 1: Intro / Resource share", "Day 10: Industry insight", "Day 30: Relationship check-in"] }
  ]);

  async function loadData() {
    setLoading(true);
    try {
      const [contactsRes, watchRes, logRes, gmailRes] = await Promise.all([
        fetch("/api/contacts?limit=1000", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/watchlist", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/run-log?limit=20", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/gmail-status", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setContacts(contactsRes.data ?? []);
      setWatchlist(watchRes.data ?? []);
      setRunLog(logRes.data ?? []);
      setGmailStatus(gmailRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadFilings = useCallback(async (pageOverride?: number) => {
    setFilingsLoading(true);
    try {
      const p = pageOverride ?? filingsPage;
      const qp = new URLSearchParams();
      if (filingsSearch) qp.set("search", filingsSearch);
      if (filingsFormType) qp.set("formType", filingsFormType);
      if (filingsMarketTier) qp.set("marketTier", filingsMarketTier);
      if (filingsHasAgedDebt) qp.set("hasAgedDebt", "true");
      if (filingsHasRestricted) qp.set("hasRestricted", "true");
      if (filingsHas3a10) qp.set("has3a10", "true");
      if (filingsMinScore) qp.set("minScore", filingsMinScore);
      if (filingsDateFrom) qp.set("dateFrom", filingsDateFrom);
      if (filingsDateTo) qp.set("dateTo", filingsDateTo);
      qp.set("sortBy", filingsSortBy);
      qp.set("sortDir", filingsSortDir);
      qp.set("page", String(p));
      qp.set("limit", "50");
      const res = await fetch(`/api/filings?${qp.toString()}`, { cache: "no-store" });
      const json = await res.json();
      setFilingsData(json.data ?? []);
      setFilingsTotal(json.pagination?.total ?? 0);
      setFilingsTotalPages(json.pagination?.totalPages ?? 0);
    } catch (e) {
      console.error("[filings] load error", e);
    } finally {
      setFilingsLoading(false);
    }
  }, [filingsSearch, filingsFormType, filingsMarketTier, filingsHasAgedDebt, filingsHasRestricted, filingsHas3a10, filingsMinScore, filingsDateFrom, filingsDateTo, filingsSortBy, filingsSortDir, filingsPage]);

  useEffect(() => {
    if (activeTab === "filings") {
      loadFilings();
    }
  }, [activeTab, loadFilings]);

  function handleFilingsSearch() {
    setFilingsPage(1);
    loadFilings(1);
  }

  async function openFilingDetail(filing: FilingRecord) {
    setSelectedFilingRow(filing);
    setFilingDetailLoading(true);
    try {
      const res = await fetch(`/api/filings/${filing.id}`, { cache: "no-store" });
      const json = await res.json();
      setSelectedFiling(json.data ?? null);
    } catch (e) {
      console.error("[filing-detail] Error:", e);
    } finally {
      setFilingDetailLoading(false);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContactForm),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewContactForm({
          contactName: "",
          title: "",
          company: "",
          email: "",
          phone: "",
          source: "manual_entry",
          isIndividual: true,
          isDecisionMaker: false,
          influenceLevel: "influencer",
          securityType: "Section_3a10",
          positionSize: 0,
          estimatedValue: 0,
          securityDescription: "",
          status: "Warm",
          priority: "Medium",
          dealValue: 0,
          notes: ""
        });
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add contact");
      }
    } catch (e) {
      alert("Error adding contact");
    }
  }

  async function handleLogTouchpoint(contactId: string) {
    if (!noteText.trim()) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/touchpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: touchpointType,
          notes: noteText,
          outcome: touchpointOutcome
        }),
      });
      if (res.ok) {
        setNoteText("");
        const updated = await res.json();
        if (selectedContact && selectedContact.id === contactId) {
          setSelectedContact(updated.data);
        }
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleScheduleFollowup(contactId: string) {
    if (!followupDate) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextFollowUpDate: followupDate,
          nextFollowUpAction: followupAction
        }),
      });
      if (res.ok) {
        setFollowupDate("");
        setFollowupAction("");
        const updated = await res.json();
        if (selectedContact && selectedContact.id === contactId) {
          setSelectedContact(updated.data);
        }
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUpdateStatus(contactId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedContact && selectedContact.id === contactId) {
          setSelectedContact(updated.data);
        }
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function triggerDryRun() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/manual-run?dry=1", { method: "POST", cache: "no-store" });
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
      const res = await fetch("/api/manual-run", { method: "POST", cache: "no-store" });
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setTriggerResult(String(e));
    } finally {
      setTriggering(false);
    }
  }

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = 
      (c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.company?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    const matchesSecurity = securityFilter ? c.security_type === securityFilter : true;
    const matchesHuman = humanOnlyFilter ? (isRealPersonNameLocal(c.contact_name) && !isGenericEmailLocal(c.email)) : true;

    return matchesSearch && matchesStatus && matchesSecurity && matchesHuman;
  });

  const getPipelineCount = (status: string) => {
    return contacts.filter((c) => c.status === status).length;
  };

  const getPipelineValue = (status: string) => {
    return contacts
      .filter((c) => c.status === status)
      .reduce((sum, c) => sum + (c.deal_value || 0), 0);
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-[#1B2030] bg-[#0A0C10] px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-700 shadow-md">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#E8ECF4] flex items-center gap-2">
                FILINGS OUTREACH <span className="text-cyan-400 text-sm font-semibold border border-cyan-400/30 px-1.5 py-0.5 rounded">CRM</span>
              </h1>
              <p className="text-[10px] text-zinc-500 mt-0.5">Automated Securities Outreach & Relationship Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {gmailStatus && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  gmailStatus.readyToSend
                    ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-400"
                    : "bg-rose-950/30 border-rose-800/50 text-rose-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${gmailStatus.readyToSend ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                {gmailStatus.readyToSend ? `Gmail active · ${gmailStatus.aliasEmail}` : "Gmail off"}
              </div>
            )}

            <button
              onClick={triggerDryRun}
              disabled={triggering}
              className="px-3.5 py-1.5 text-xs rounded-lg border border-[#1B2030] bg-[#0F1218] text-[#8892A6] hover:border-[#2A3050] hover:text-[#E8ECF4] transition-all disabled:opacity-40"
            >
              Dry Run
            </button>
            <button
              onClick={triggerLiveRun}
              disabled={triggering || !gmailStatus?.readyToSend}
              className="px-3.5 py-1.5 text-xs rounded-lg bg-cyan-400 text-[#07080B] font-bold hover:bg-cyan-300 transition-all shadow-lg shadow-cyan-400/10 disabled:opacity-40"
            >
              {triggering ? "Running…" : "Run Now"}
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-[#1B2030]/50 bg-[#0A0C10]/40">
        <div className="max-w-7xl mx-auto px-8 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Pipeline Value", value: formatUSD(contacts.reduce((sum, c) => sum + (c.deal_value || 0), 0)), color: "text-white" },
            { label: "Active Deals", value: contacts.filter((c) => c.status === "Hot" || c.status === "Warm").length, color: "text-cyan-400" },
            { label: "Closed Won", value: contacts.filter((c) => c.status === "Closed_Won").length, color: "text-emerald-400" },
            { label: "Win Rate", value: `${contacts.filter((c) => c.status === "Closed_Won").length ? Math.round((contacts.filter((c) => c.status === "Closed_Won").length / (contacts.filter((c) => c.status === "Closed_Won" || c.status === "Closed_Lost").length || 1)) * 100) : 0}%`, color: "text-violet-400" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Navigation and Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1B2030] pb-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "pipeline", label: "Pipeline Board" },
              { id: "filings", label: "Filings Explorer" },
              { id: "contacts", label: "All Contacts" },
              { id: "sequences", label: "Follow-Up Sequences" },
              { id: "watchlist", label: "Watchlist" },
              { id: "log", label: "Run Log" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400 shadow-md shadow-cyan-400/5"
                    : "border-transparent text-[#8892A6] hover:text-[#E8ECF4]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-[#07080B] hover:bg-cyan-300 transition-all shadow-md shadow-cyan-400/10"
            >
              <Plus className="h-3 w-3" />
              Add Contact
            </button>
          </div>
        </div>

        {/* Dynamic Content Views */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#8892A6]">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
            <p className="text-xs">Loading operator queue...</p>
          </div>
        ) : (
          <>
            {/* Pipeline / Kanban View */}
            {activeTab === "pipeline" && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start">
                {PIPELINE_COLUMNS.map((column) => {
                  const columnContacts = contacts.filter((c) => c.status === column);
                  return (
                    <div key={column} className="bg-[#0F1218]/60 border border-[#1B2030]/60 rounded-xl p-3 flex flex-col min-h-[500px]">
                      <div className="flex items-center justify-between border-b border-[#1B2030] pb-2 mb-3">
                        <span className="text-xs font-bold text-[#E8ECF4]">{column.replace("_", " ")}</span>
                        <span className="text-[10px] text-zinc-500 font-bold bg-[#1B2030] px-1.5 py-0.5 rounded">
                          {columnContacts.length}
                        </span>
                      </div>
                      
                      {columnContacts.length > 0 && (
                        <div className="text-[10px] text-zinc-500 mb-3 font-semibold">
                          Total: {formatUSD(getPipelineValue(column))}
                        </div>
                      )}

                      <div className="space-y-3 flex-1 overflow-y-auto">
                        {columnContacts.map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => setSelectedContact(contact)}
                            className="bg-[#07080B] border border-[#1B2030] hover:border-[#2A3050] transition-all rounded-lg p-3 cursor-pointer group"
                          >
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <span className="text-xs font-bold text-[#E8ECF4] group-hover:text-cyan-400 transition-colors">
                                {contact.contact_name}
                              </span>
                              {contact.is_decision_maker && (
                                <span title="Decision Maker" className="shrink-0">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 truncate mb-2">{contact.company || "No Company"}</p>
                            <div className="flex items-center justify-between mt-3 border-t border-[#1B2030]/50 pt-2">
                              <span className="text-[10px] font-bold text-cyan-400/80">
                                {formatUSD(contact.deal_value || 0)}
                              </span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                contact.priority === "High" ? "bg-rose-950/40 text-rose-400" : "bg-zinc-800 text-zinc-400"
                              }`}>
                                {contact.priority}
                              </span>
                            </div>
                          </div>
                        ))}

                        {columnContacts.length === 0 && (
                          <div className="flex items-center justify-center py-10 border border-dashed border-[#1B2030] rounded-lg">
                            <span className="text-[10px] text-zinc-600 italic">Empty</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filings Explorer Tab */}
            {activeTab === "filings" && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="bg-[#0F1218]/40 border border-[#1B2030]/80 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-[#1B2030] bg-[#0A0C10]/40">
                    {/* Top row: search + toggle filters */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8892A6]/50" />
                        <input
                          type="text"
                          placeholder="Search issuer name, ticker, or insider..."
                          value={filingsSearch}
                          onChange={(e) => setFilingsSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleFilingsSearch()}
                          className="w-full pl-9 pr-4 py-2 bg-[#07080B] border border-[#1B2030] rounded-lg text-xs text-[#E8ECF4] placeholder-[#8892A6]/50 outline-none focus:border-cyan-400/40"
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={filingsFormType}
                          onChange={(e) => { setFilingsFormType(e.target.value); setFilingsPage(1); }}
                          className="bg-[#07080B] border border-[#1B2030] rounded-lg text-xs px-3 py-2 text-[#8892A6] outline-none"
                        >
                          <option value="">All Form Types</option>
                          {FORM_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                        </select>

                        <select
                          value={filingsMarketTier}
                          onChange={(e) => { setFilingsMarketTier(e.target.value); setFilingsPage(1); }}
                          className="bg-[#07080B] border border-[#1B2030] rounded-lg text-xs px-3 py-2 text-[#8892A6] outline-none"
                        >
                          <option value="">All Market Tiers</option>
                          {MARKET_TIERS.map(mt => <option key={mt} value={mt}>{mt.replace(/_/g, " ")}</option>)}
                        </select>

                        <select
                          value={`${filingsSortBy}-${filingsSortDir}`}
                          onChange={(e) => {
                            const [sb, sd] = e.target.value.split("-");
                            setFilingsSortBy(sb);
                            setFilingsSortDir(sd);
                            setFilingsPage(1);
                          }}
                          className="bg-[#07080B] border border-[#1B2030] rounded-lg text-xs px-3 py-2 text-[#8892A6] outline-none"
                        >
                          <option value="filedAt-desc">Date Filed ↓</option>
                          <option value="filedAt-asc">Date Filed ↑</option>
                          <option value="score-desc">Score ↓</option>
                          <option value="score-asc">Score ↑</option>
                          <option value="issuerName-asc">Issuer A→Z</option>
                          <option value="issuerName-desc">Issuer Z→A</option>
                        </select>

                        <button
                          onClick={() => setShowFilingsFilters(!showFilingsFilters)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                            showFilingsFilters || filingsHasAgedDebt || filingsHasRestricted || filingsHas3a10 || filingsMinScore || filingsDateFrom || filingsDateTo
                              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
                              : "border-[#1B2030] bg-[#07080B] text-[#8892A6] hover:text-[#E8ECF4]"
                          }`}
                        >
                          <Filter className="h-3 w-3" />
                          Filters
                          {(filingsHasAgedDebt || filingsHasRestricted || filingsHas3a10 || filingsMinScore || filingsDateFrom || filingsDateTo) && (
                            <span className="bg-cyan-400 text-[#07080B] text-[8px] font-black px-1 rounded-full">!</span>
                          )}
                        </button>

                        <button
                          onClick={handleFilingsSearch}
                          className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-400 text-[#07080B] hover:bg-cyan-300 transition-all"
                        >
                          Search
                        </button>
                      </div>
                    </div>

                    {/* Expanded filters */}
                    {showFilingsFilters && (
                      <div className="mt-4 pt-4 border-t border-[#1B2030]/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Signal Filters</label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs cursor-pointer text-[#8892A6]">
                              <input
                                type="checkbox"
                                checked={filingsHasAgedDebt}
                                onChange={(e) => { setFilingsHasAgedDebt(e.target.checked); setFilingsPage(1); }}
                                className="rounded bg-[#07080B] border-[#1B2030] text-cyan-400"
                              />
                              Aged Debt
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer text-[#8892A6]">
                              <input
                                type="checkbox"
                                checked={filingsHasRestricted}
                                onChange={(e) => { setFilingsHasRestricted(e.target.checked); setFilingsPage(1); }}
                                className="rounded bg-[#07080B] border-[#1B2030] text-cyan-400"
                              />
                              Restricted Stock
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer text-[#8892A6]">
                              <input
                                type="checkbox"
                                checked={filingsHas3a10}
                                onChange={(e) => { setFilingsHas3a10(e.target.checked); setFilingsPage(1); }}
                                className="rounded bg-[#07080B] border-[#1B2030] text-cyan-400"
                              />
                              3(a)(10)
                            </label>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Min Score</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={filingsMinScore}
                            onChange={(e) => { setFilingsMinScore(e.target.value); setFilingsPage(1); }}
                            className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Date From</label>
                          <input
                            type="date"
                            value={filingsDateFrom}
                            onChange={(e) => { setFilingsDateFrom(e.target.value); setFilingsPage(1); }}
                            className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Date To</label>
                          <input
                            type="date"
                            value={filingsDateTo}
                            onChange={(e) => { setFilingsDateTo(e.target.value); setFilingsPage(1); }}
                            className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Results summary */}
                  <div className="px-4 py-2 bg-[#0A0C10]/20 border-b border-[#1B2030]/30 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">
                      {filingsLoading ? "Loading..." : `${filingsTotal.toLocaleString()} filings found`}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      Page {filingsPage} of {filingsTotalPages || 1}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1B2030] bg-[#0A0C10]/40">
                          {["Filed Date", "Form", "Issuer", "Market Tier", "Insider", "Score", "Signals", ""].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-zinc-500 font-bold tracking-wider uppercase text-[10px]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filingsLoading ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-16 text-center">
                              <RefreshCw className="h-5 w-5 animate-spin text-cyan-400 mx-auto mb-2" />
                              <span className="text-zinc-500 text-[10px]">Loading filings...</span>
                            </td>
                          </tr>
                        ) : filingsData.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-16 text-center text-zinc-600">
                              No filings found matching your filters.
                            </td>
                          </tr>
                        ) : (
                          filingsData.map((f) => (
                            <tr
                              key={f.id}
                              onClick={() => openFilingDetail(f)}
                              className="border-b border-[#1B2030]/60 hover:bg-[#1B2030]/20 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                                {formatShortDate(f.filedAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-violet-950/40 text-violet-400 border border-violet-800/30">
                                  {f.formType}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#E8ECF4]">{f.issuerName || "—"}</div>
                                {f.issuerTicker && (
                                  <span className="text-[10px] text-cyan-400/70">{f.issuerTicker}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-zinc-500 text-[10px]">
                                {f.marketTier ? f.marketTier.replace(/_/g, " ") : "—"}
                              </td>
                              <td className="px-4 py-3 text-zinc-400">
                                {f.insiderName || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black tabular-nums ${getScoreColor(f.score)}`}>
                                  {f.score}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {f.hasAgedDebt && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-950/40 text-rose-400 border border-rose-800/30">
                                      AGED DEBT
                                    </span>
                                  )}
                                  {f.hasRestricted && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/30">
                                      RESTRICTED
                                    </span>
                                  )}
                                  {f.has3a10 && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-800/30">
                                      3(a)(10)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Eye className="h-3.5 w-3.5 text-zinc-600 hover:text-cyan-400 transition-colors" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {filingsTotalPages > 1 && (
                    <div className="px-4 py-3 border-t border-[#1B2030] bg-[#0A0C10]/30 flex items-center justify-between">
                      <button
                        onClick={() => { const p = Math.max(1, filingsPage - 1); setFilingsPage(p); loadFilings(p); }}
                        disabled={filingsPage <= 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#1B2030] bg-[#07080B] text-[#8892A6] hover:text-[#E8ECF4] transition-all disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3 w-3" />
                        Prev
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(7, filingsTotalPages) }, (_, idx) => {
                          let pageNum: number;
                          if (filingsTotalPages <= 7) {
                            pageNum = idx + 1;
                          } else if (filingsPage <= 4) {
                            pageNum = idx + 1;
                          } else if (filingsPage >= filingsTotalPages - 3) {
                            pageNum = filingsTotalPages - 6 + idx;
                          } else {
                            pageNum = filingsPage - 3 + idx;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => { setFilingsPage(pageNum); loadFilings(pageNum); }}
                              className={`w-7 h-7 rounded text-[10px] font-bold transition-all ${
                                filingsPage === pageNum
                                  ? "bg-cyan-400/15 text-cyan-400 border border-cyan-400/40"
                                  : "text-zinc-500 hover:text-[#E8ECF4]"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => { const p = Math.min(filingsTotalPages, filingsPage + 1); setFilingsPage(p); loadFilings(p); }}
                        disabled={filingsPage >= filingsTotalPages}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#1B2030] bg-[#07080B] text-[#8892A6] hover:text-[#E8ECF4] transition-all disabled:opacity-30"
                      >
                        Next
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contacts list view */}
            {activeTab === "contacts" && (
              <div className="bg-[#0F1218]/40 border border-[#1B2030]/80 rounded-xl overflow-hidden">
                {/* Filters block */}
                <div className="p-4 border-b border-[#1B2030] bg-[#0A0C10]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8892A6]/50" />
                    <input
                      type="text"
                      placeholder="Search contacts, companies, emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#07080B] border border-[#1B2030] rounded-lg text-xs text-[#E8ECF4] placeholder-[#8892A6]/50 outline-none focus:border-cyan-400/40"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setHumanOnlyFilter(!humanOnlyFilter)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        humanOnlyFilter
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-[#1B2030] bg-[#07080B] text-[#8892A6] hover:text-[#E8ECF4]"
                      }`}
                    >
                      {humanOnlyFilter ? "Humans Only" : "All Contacts"}
                    </button>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-[#07080B] border border-[#1B2030] rounded-lg text-xs px-3 py-2 text-[#8892A6] outline-none"
                    >
                      <option value="">All Statuses</option>
                      {PIPELINE_COLUMNS.map(col => (
                        <option key={col} value={col}>{col.replace("_", " ")}</option>
                      ))}
                    </select>

                    <select
                      value={securityFilter}
                      onChange={(e) => setSecurityFilter(e.target.value)}
                      className="bg-[#07080B] border border-[#1B2030] rounded-lg text-xs px-3 py-2 text-[#8892A6] outline-none"
                    >
                      <option value="">All Security Types</option>
                      <option value="Rule_144">Rule 144</option>
                      <option value="Section_4a1">Section 4(a)(1)</option>
                      <option value="Section_3a10">Section 3(a)(10)</option>
                      <option value="Convertible_Debenture">Convertible Debenture</option>
                      <option value="Restricted_Stock">Restricted Stock</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1B2030] bg-[#0A0C10]/40">
                        {["Contact Name", "Company", "Title", "Email", "Status", "Security Type", "Deal Value", "Priority"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-zinc-500 font-bold tracking-wider uppercase text-[10px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-zinc-600">
                            No matching contacts found.
                          </td>
                        </tr>
                      ) : (
                        filteredContacts.map((contact) => (
                          <tr
                            key={contact.id}
                            onClick={() => setSelectedContact(contact)}
                            className="border-b border-[#1B2030]/60 hover:bg-[#1B2030]/20 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3.5 font-bold text-[#E8ECF4] flex items-center gap-2">
                              {contact.contact_name}
                              {contact.is_decision_maker && (
                                <span className="bg-amber-400/10 text-amber-400 text-[8px] font-extrabold px-1 py-0.5 rounded border border-amber-400/20">DM</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-zinc-400">{contact.company || "—"}</td>
                            <td className="px-4 py-3.5 text-zinc-500">{contact.title || "—"}</td>
                            <td className="px-4 py-3.5 text-zinc-500">{contact.email}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${STATUS_COLORS[contact.status] || "bg-zinc-800 text-zinc-400"}`}>
                                {contact.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-zinc-500">{contact.security_type || "—"}</td>
                            <td className="px-4 py-3.5 font-bold text-cyan-400">{formatUSD(contact.deal_value || 0)}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${PRIORITY_COLORS[contact.priority] || "bg-zinc-800 text-zinc-400"}`}>
                                {contact.priority}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Watchlist Tab */}
            {activeTab === "watchlist" && (
              <div className="overflow-x-auto rounded-xl border border-[#1B2030] bg-[#0F1218]/20">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1B2030] bg-[#0A0C10]/40">
                      {["Status", "Company", "Contact", "Email", "Likely Paper", "Notes"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((row) => (
                      <tr
                        key={row.seed_id}
                        className="border-b border-[#1B2030]/60 hover:bg-[#1B2030]/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.live_enabled ? "bg-emerald-950/30 text-emerald-400 ring-1 ring-emerald-800" : "bg-zinc-800 text-zinc-500"}`}>
                            {row.live_enabled ? "LIVE" : "WATCHLIST"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#E8ECF4]">{row.target_company}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.contact_person}</td>
                        <td className="px-4 py-3 text-zinc-500">{row.email || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{row.likely_paper}</td>
                        <td className="px-4 py-3 text-zinc-500 text-[10px]">{row.notes ?? "—"}</td>
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
                  <div className="text-center text-zinc-600 py-12">No runs logged yet.</div>
                ) : (
                  runLog.map((run) => (
                    <div key={run.run_id} className="rounded-xl border border-[#1B2030] bg-[#0F1218]/40 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black uppercase tracking-widest ${RUN_STATUS_COLORS[run.status] ?? "text-zinc-400"}`}>
                            {run.status}
                          </span>
                          <span className="text-zinc-500 text-[10px]">{formatDate(run.run_at)}</span>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono">{run.run_id.slice(0, 8)}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-xs border-t border-[#1B2030]/50 pt-3">
                        {[
                          ["Filings", run.filings_scanned],
                          ["Matched", run.matched_targets],
                          ["Sent", run.emails_sent],
                          ["Suppressed", run.suppressed_dupes],
                          ["Bounces", run.bounces],
                        ].map(([label, val]) => (
                          <div key={label as string}>
                            <div className="text-zinc-500 uppercase tracking-wide text-[9px]">{label}</div>
                            <div className="text-[#E8ECF4] font-bold text-base mt-0.5 tabular-nums">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sequences & Follow-up automation view */}
            {activeTab === "sequences" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {sequences.map((seq) => (
                  <div key={seq.id} className="bg-[#0F1218]/60 border border-[#1B2030] rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-[#1B2030] pb-3 mb-4">
                      <h3 className="text-xs font-black text-[#E8ECF4] uppercase tracking-wide">{seq.name}</h3>
                      <span className="text-[9px] font-bold bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-400/20">Active</span>
                    </div>
                    <div className="space-y-4">
                      {seq.steps.map((step, idx) => (
                        <div key={step} className="flex items-start gap-3 relative">
                          {idx < seq.steps.length - 1 && (
                            <div className="absolute left-2 top-5 bottom-0 w-0.5 bg-[#1B2030]" />
                          )}
                          <div className="w-4 h-4 rounded-full bg-[#1B2030] border border-[#2A3050] flex items-center justify-center text-[8px] font-black text-cyan-400 shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-zinc-300">{step.split(":")[0]}</span>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{step.split(":")[1] || "Automated email template"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Contact Details Drawer */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedContact(null)}
            className="absolute inset-0 bg-[#07080B]/60 backdrop-blur-sm"
          />
          
          {/* Drawer Body */}
          <div className="relative w-full max-w-xl h-full bg-[#0A0C10] border-l border-[#1B2030] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#1B2030] flex items-center justify-between">
              <div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${STATUS_COLORS[selectedContact.status]}`}>
                  {selectedContact.status.replace("_", " ")}
                </span>
                <h2 className="text-base font-bold text-[#E8ECF4] mt-2 flex items-center gap-2">
                  {selectedContact.contact_name}
                  {selectedContact.is_decision_maker && (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  )}
                </h2>
                <p className="text-[10px] text-zinc-500 mt-1">{selectedContact.company || "No Company"} · {selectedContact.title || "No Title"}</p>
              </div>
              <button 
                onClick={() => setSelectedContact(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold bg-[#0F1218] border border-[#1B2030] px-3 py-1 rounded"
              >
                Close
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Contact Information & Security Details */}
              <div className="grid grid-cols-2 gap-4 bg-[#0F1218]/40 border border-[#1B2030]/60 rounded-xl p-4">
                <div className="col-span-2 border-b border-[#1B2030]/40 pb-3 mb-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1">Contact Info</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-[#E8ECF4]">
                      <Mail className="h-3.5 w-3.5 text-zinc-500" />
                      {selectedContact.email || "No email"}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#E8ECF4]">
                      <Phone className="h-3.5 w-3.5 text-zinc-500" />
                      {selectedContact.phone && selectedContact.phone !== "unknown" ? selectedContact.phone : "No phone number"}
                    </div>
                    {selectedContact.filing_url && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400 mt-2">
                        <FileText className="h-3.5 w-3.5" />
                        <a href={selectedContact.filing_url} target="_blank" rel="noreferrer" className="hover:underline">
                          View Original SEC Filing
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">Deal Value</span>
                  <span className="text-base font-black text-cyan-400">{formatUSD(selectedContact.deal_value || 0)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">Security Type</span>
                  <span className="text-xs font-bold text-[#E8ECF4]">{selectedContact.security_type || "N/A"}</span>
                </div>
                <div className="col-span-2 border-t border-[#1B2030]/40 pt-3 mt-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">Security Details</span>
                  <p className="text-[10px] text-zinc-400 mt-1">{selectedContact.security_description || "No description provided."}</p>
                </div>
              </div>

              {/* Status Update Quick Action */}
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2 font-bold">Pipeline Stage</span>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_COLUMNS.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => handleUpdateStatus(selectedContact.id, stage)}
                      className={`text-[9px] font-bold px-2.5 py-1.5 rounded border transition-all ${
                        selectedContact.status === stage
                          ? "bg-cyan-400/10 border-cyan-400 text-cyan-400"
                          : "border-[#1B2030] text-[#8892A6] hover:bg-[#1B2030]"
                      }`}
                    >
                      {stage.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Touchpoint logger form */}
              <div className="bg-[#0F1218]/30 border border-[#1B2030] rounded-xl p-4">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-3 font-bold">Log Activity</span>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={touchpointType}
                      onChange={(e) => setTouchpointType(e.target.value)}
                      className="bg-[#07080B] border border-[#1B2030] rounded text-[10px] px-2.5 py-1.5 text-zinc-300"
                    >
                      <option value="email_sent">Email Sent</option>
                      <option value="call_made">Call Made</option>
                      <option value="meeting">Meeting Held</option>
                      <option value="note_added">Internal Note</option>
                    </select>

                    <select
                      value={touchpointOutcome}
                      onChange={(e) => setTouchpointOutcome(e.target.value)}
                      className="bg-[#07080B] border border-[#1B2030] rounded text-[10px] px-2.5 py-1.5 text-zinc-300"
                    >
                      <option value="neutral">Neutral Response</option>
                      <option value="positive">Positive Response</option>
                      <option value="negative">Declined / Negative</option>
                      <option value="no_response">No Response</option>
                    </select>
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Enter activity log notes..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2.5 text-xs text-[#E8ECF4] placeholder-[#8892A6]/40 focus:border-cyan-400/40 outline-none"
                  />

                  <button
                    onClick={() => handleLogTouchpoint(selectedContact.id)}
                    className="w-full bg-cyan-400 hover:bg-cyan-300 text-[#07080B] font-bold py-1.5 rounded text-xs transition-colors"
                  >
                    Log Activity
                  </button>
                </div>
              </div>

              {/* Schedule Follow-up Form */}
              <div className="bg-[#0F1218]/30 border border-[#1B2030] rounded-xl p-4">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-3 font-bold">Schedule Follow-up</span>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="bg-[#07080B] border border-[#1B2030] rounded text-[10px] px-2.5 py-1.5 text-zinc-300 flex-1 outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Action description (e.g. Send follow-up email)..."
                    value={followupAction}
                    onChange={(e) => setFollowupAction(e.target.value)}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2.5 text-xs text-[#E8ECF4] outline-none"
                  />
                  <button
                    onClick={() => handleScheduleFollowup(selectedContact.id)}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-1.5 rounded text-xs transition-colors"
                  >
                    Save Follow-up
                  </button>
                </div>
              </div>

              {/* Timeline of Touchpoints */}
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-4 font-bold">Activity History</span>
                <div className="space-y-4">
                  {selectedContact.touchpoints && selectedContact.touchpoints.length > 0 ? (
                    selectedContact.touchpoints.map((tp, idx) => (
                      <div key={idx} className="flex gap-3 items-start border-l border-[#1B2030] pl-4 relative ml-2">
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#E8ECF4] uppercase">{tp.type.replace("_", " ")}</span>
                            <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded">{tp.outcome}</span>
                            <span className="text-[9px] text-zinc-500 ml-auto">{new Date(tp.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1">{tp.notes}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic">No activity logs recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filing Detail Drawer */}
      {selectedFilingRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => { setSelectedFilingRow(null); setSelectedFiling(null); }}
            className="absolute inset-0 bg-[#07080B]/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl h-full bg-[#0A0C10] border-l border-[#1B2030] shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#1B2030] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-violet-950/40 text-violet-400 border border-violet-800/30">
                    {selectedFilingRow.formType}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black tabular-nums ${getScoreColor(selectedFilingRow.score)}`}>
                    Score: {selectedFilingRow.score}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#E8ECF4]">
                  {selectedFilingRow.issuerName || "Unknown Issuer"}
                  {selectedFilingRow.issuerTicker && (
                    <span className="text-cyan-400 ml-2 text-sm">({selectedFilingRow.issuerTicker})</span>
                  )}
                </h2>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Filed {formatShortDate(selectedFilingRow.filedAt)} · {selectedFilingRow.accessionNumber}
                </p>
              </div>
              <button
                onClick={() => { setSelectedFilingRow(null); setSelectedFiling(null); }}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold bg-[#0F1218] border border-[#1B2030] px-3 py-1 rounded"
              >
                Close
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {filingDetailLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="h-6 w-6 animate-spin text-cyan-400 mb-3" />
                  <span className="text-[10px] text-zinc-500">Loading filing details...</span>
                </div>
              ) : selectedFiling ? (
                <>
                  {/* Signal Badges */}
                  <div className="flex flex-wrap gap-2">
                    {selectedFilingRow.hasAgedDebt && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-950/40 text-rose-400 border border-rose-800/30">
                        🔴 Aged Debt
                      </span>
                    )}
                    {selectedFilingRow.hasRestricted && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/30">
                        🟡 Restricted Stock
                      </span>
                    )}
                    {selectedFilingRow.has3a10 && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-800/30">
                        🔵 3(a)(10) Exemption
                      </span>
                    )}
                  </div>

                  {/* Issuer Details */}
                  <div className="bg-[#0F1218]/40 border border-[#1B2030]/60 rounded-xl p-4">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-3 font-bold">Issuer Details</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[9px] text-zinc-600 block">Company</span>
                        <span className="text-xs font-bold text-[#E8ECF4]">{String(selectedFiling.filing.issuerName || "—")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 block">Ticker</span>
                        <span className="text-xs font-bold text-cyan-400">{String(selectedFiling.filing.issuerTicker || "—")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 block">Market Tier</span>
                        <span className="text-xs text-zinc-300">{String(selectedFiling.filing.marketTier || "—").replace(/_/g, " ")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 block">CIK</span>
                        <span className="text-xs text-zinc-400 font-mono">{String(selectedFiling.filing.issuerCik || "—")}</span>
                      </div>
                      {Boolean(selectedFiling.filing.issuerPhone) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">Phone</span>
                          <span className="text-xs text-zinc-300">{String(selectedFiling.filing.issuerPhone)}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.issuerWebsite) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">Website</span>
                          <a href={String(selectedFiling.filing.issuerWebsite)} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">
                            {String(selectedFiling.filing.issuerWebsite)}
                          </a>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.irContactName) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">IR Contact</span>
                          <span className="text-xs text-zinc-300">{String(selectedFiling.filing.irContactName)}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.irEmail) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">IR Email</span>
                          <span className="text-xs text-zinc-300">{String(selectedFiling.filing.irEmail)}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.avgDailyVolume) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">Avg Daily Volume</span>
                          <span className="text-xs text-zinc-300">{Number(selectedFiling.filing.avgDailyVolume).toLocaleString()}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.marketCapUsd) && (
                        <div>
                          <span className="text-[9px] text-zinc-600 block">Market Cap</span>
                          <span className="text-xs text-zinc-300">{formatUSD(Number(selectedFiling.filing.marketCapUsd))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Insider Details */}
                  <div className="bg-[#0F1218]/40 border border-[#1B2030]/60 rounded-xl p-4">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-3 font-bold">Insider Details</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[9px] text-zinc-600 block">Name</span>
                        <span className="text-xs font-bold text-[#E8ECF4]">{String(selectedFiling.filing.insiderName || "—")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 block">CIK</span>
                        <span className="text-xs text-zinc-400 font-mono">{String(selectedFiling.filing.insiderCik || "—")}</span>
                      </div>
                      {Boolean(selectedFiling.filing.insiderPhone) && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-zinc-500" />
                          <span className="text-xs text-zinc-300">{String(selectedFiling.filing.insiderPhone)}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.insiderEmail) && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-zinc-500" />
                          <span className="text-xs text-zinc-300">{String(selectedFiling.filing.insiderEmail)}</span>
                        </div>
                      )}
                      {Boolean(selectedFiling.filing.insiderAddress) && (
                        <div className="col-span-2">
                          <span className="text-[9px] text-zinc-600 block">Address</span>
                          <span className="text-xs text-zinc-400">
                            {String(selectedFiling.filing.insiderAddress)}
                            {selectedFiling.filing.insiderCity ? `, ${String(selectedFiling.filing.insiderCity)}` : ""}
                            {selectedFiling.filing.insiderState ? `, ${String(selectedFiling.filing.insiderState)}` : ""}
                            {selectedFiling.filing.insiderZip ? ` ${String(selectedFiling.filing.insiderZip)}` : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Role badges */}
                    {selectedFiling.insiderRoles.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#1B2030]/40">
                        <span className="text-[9px] text-zinc-600 block mb-2">Roles</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedFiling.insiderRoles.map((role, idx) => (
                            <div key={idx} className="flex gap-1">
                              {role.isDirector && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-950/40 text-violet-400 border border-violet-800/30">
                                  DIRECTOR
                                </span>
                              )}
                              {role.isOfficer && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-950/40 text-sky-400 border border-sky-800/30">
                                  OFFICER{role.officerTitle ? ` — ${role.officerTitle}` : ""}
                                </span>
                              )}
                              {role.isTenPctOwn && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/30">
                                  10%+ OWNER
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transactions */}
                  {selectedFiling.transactions.length > 0 && (
                    <div className="bg-[#0F1218]/40 border border-[#1B2030]/60 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#1B2030]">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
                          Transactions ({selectedFiling.transactions.length})
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-[#1B2030] bg-[#0A0C10]/40">
                              {["Date", "Type", "Security", "Code", "Shares", "Price", "A/D", "Owned After"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-zinc-600 font-bold uppercase tracking-wider">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedFiling.transactions.map((tx) => (
                              <tr key={tx.id} className="border-b border-[#1B2030]/40">
                                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                                  {formatShortDate(tx.transactionDate)}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                    tx.tableType === "NON_DERIVATIVE"
                                      ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/30"
                                      : "bg-violet-950/30 text-violet-400 border border-violet-800/30"
                                  }`}>
                                    {tx.tableType === "NON_DERIVATIVE" ? "NON-DERIV" : "DERIV"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-300 max-w-[200px] truncate">
                                  {tx.securityTitle || "—"}
                                </td>
                                <td className="px-3 py-2 text-zinc-400 font-mono">
                                  {tx.transactionCode || "—"}
                                </td>
                                <td className="px-3 py-2 text-zinc-300 tabular-nums">
                                  {tx.shares != null ? Number(tx.shares).toLocaleString() : "—"}
                                </td>
                                <td className="px-3 py-2 text-zinc-300 tabular-nums">
                                  {tx.pricePerShare != null ? `$${Number(tx.pricePerShare).toFixed(2)}` : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`font-bold ${
                                    tx.acquiredDisposed === "A" ? "text-emerald-400" : tx.acquiredDisposed === "D" ? "text-rose-400" : "text-zinc-500"
                                  }`}>
                                    {tx.acquiredDisposed || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-300 tabular-nums">
                                  {tx.sharesOwnedAfter != null ? Number(tx.sharesOwnedAfter).toLocaleString() : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SEC Filing Links */}
                  <div className="flex flex-col gap-2">
                    {selectedFilingRow.primaryDocUrl && (
                      <a
                        href={selectedFilingRow.primaryDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#1B2030] bg-[#0F1218]/40 hover:border-cyan-400/40 transition-all text-xs text-cyan-400"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Primary Document on SEC.gov
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </a>
                    )}
                    {selectedFilingRow.rawXmlUrl && (
                      <a
                        href={selectedFilingRow.rawXmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#1B2030] bg-[#0F1218]/40 hover:border-[#2A3050] transition-all text-xs text-zinc-400"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Raw XML Filing
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-zinc-600 py-16">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                  <span className="text-[10px]">Could not load filing details.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddModal(false)}
            className="absolute inset-0 bg-[#07080B]/80 backdrop-blur-sm"
          />
          <form 
            onSubmit={handleAddContact}
            className="relative w-full max-w-xl bg-[#0A0C10] border border-[#1B2030] shadow-2xl rounded-xl overflow-hidden"
          >
            <div className="p-5 border-b border-[#1B2030] bg-[#0F1218]/40 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#E8ECF4] uppercase">Create CRM Contact</h2>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={newContactForm.contactName}
                    onChange={(e) => setNewContactForm({...newContactForm, contactName: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Email *</label>
                  <input
                    type="email"
                    required
                    value={newContactForm.email}
                    onChange={(e) => setNewContactForm({...newContactForm, email: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Company</label>
                  <input
                    type="text"
                    value={newContactForm.company}
                    onChange={(e) => setNewContactForm({...newContactForm, company: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Title</label>
                  <input
                    type="text"
                    placeholder="CEO, Attorney, etc."
                    value={newContactForm.title}
                    onChange={(e) => setNewContactForm({...newContactForm, title: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Phone</label>
                  <input
                    type="text"
                    value={newContactForm.phone}
                    onChange={(e) => setNewContactForm({...newContactForm, phone: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Deal Value (USD)</label>
                  <input
                    type="number"
                    value={newContactForm.dealValue}
                    onChange={(e) => setNewContactForm({...newContactForm, dealValue: parseFloat(e.target.value) || 0})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Security Type</label>
                  <select
                    value={newContactForm.securityType}
                    onChange={(e) => setNewContactForm({...newContactForm, securityType: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  >
                    <option value="Section_3a10">Section 3(a)(10)</option>
                    <option value="Rule_144">Rule 144</option>
                    <option value="Section_4a1">Section 4(a)(1)</option>
                    <option value="Convertible_Debenture">Convertible Debenture</option>
                    <option value="Restricted_Stock">Restricted Stock</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Priority</label>
                  <select
                    value={newContactForm.priority}
                    onChange={(e) => setNewContactForm({...newContactForm, priority: e.target.value})}
                    className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Security Description / Notes</label>
                <textarea
                  rows={3}
                  value={newContactForm.notes}
                  onChange={(e) => setNewContactForm({...newContactForm, notes: e.target.value})}
                  className="w-full bg-[#07080B] border border-[#1B2030] rounded-lg p-2 text-xs text-[#E8ECF4] outline-none"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newContactForm.isDecisionMaker}
                    onChange={(e) => setNewContactForm({...newContactForm, isDecisionMaker: e.target.checked})}
                    className="rounded bg-[#07080B] border-[#1B2030] text-cyan-400"
                  />
                  Is Decision Maker?
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newContactForm.isIndividual}
                    onChange={(e) => setNewContactForm({...newContactForm, isIndividual: e.target.checked})}
                    className="rounded bg-[#07080B] border-[#1B2030] text-cyan-400"
                  />
                  Prioritize Individual Mode?
                </label>
              </div>
            </div>
            
            <div className="p-4 border-t border-[#1B2030] bg-[#0F1218]/30 flex justify-end">
              <button
                type="submit"
                className="bg-cyan-400 hover:bg-cyan-300 text-[#07080B] font-bold px-6 py-2 rounded-lg text-xs transition-colors"
              >
                Create Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
