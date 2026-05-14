// lib/seeds.ts
// Approved seed contacts — DO NOT modify without explicit approval

export interface SeedContact {
  target_company: string;
  target_context: string;
  contact_person: string;
  title: string;
  email: string;
  phone: string;
  filing_link: string;
  contact_source_link: string;
  likely_paper: string;
  best_angle: string;
  live_enabled: boolean;
  // CIK of the issuer (from filing link) for exact matching
  issuer_cik: string;
  // Human-readable issuer name patterns for fuzzy fallback
  issuer_name_patterns: string[];
  notes?: string;
}

export const LIVE_SEEDS: SeedContact[] = [
  {
    target_company: "Monroe Street Capital Partners LP",
    target_context: "HyOrc Corp financing counterparty",
    contact_person: "Brian Goldberg",
    title: "Authorized Signatory",
    email: "brian@monroestreetcapitalpartners.com",
    phone: "unknown",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1070789/000149315226022853/form8-k.htm",
    contact_source_link: "https://www.sec.gov/Archives/edgar/data/1886894/000149315225025969/ex10-1.htm",
    likely_paper: "HyOrc convertible note, commitment shares, conversion stock",
    best_angle: "direct monetization of HyOrc convert exposure instead of selling out through the market",
    live_enabled: true,
    issuer_cik: "0001070789",
    issuer_name_patterns: ["hyorc", "hy-orc", "1070789"],
  },
  {
    target_company: "Trinseo PLC",
    target_context: "distressed debt / restructuring",
    contact_person: "Bregje \"Bee\" Roseboom-Van Kessel",
    title: "Senior Vice President, Corporate Finance & Investor Relations",
    email: "bvankessel@trinseo.com",
    phone: "+41 44 718 3685",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1519061/000110465926060590/tm2614481d1_8k.htm",
    contact_source_link: "https://investor.trinseo.com/home/investor-services/investor-contacts/default.aspx",
    likely_paper: "distressed lender claims, reorg equity entitlement",
    best_angle: "bilateral purchase of claims or post-reorg equity exposure",
    live_enabled: true,
    issuer_cik: "0001519061",
    issuer_name_patterns: ["trinseo", "1519061"],
  },
  {
    target_company: "Trinseo PLC",
    target_context: "distressed debt / restructuring",
    contact_person: "Annie Muller",
    title: "Senior Manager, Investor Relations",
    email: "amuller@trinseo.com",
    phone: "610-240-3223",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1519061/000110465926060590/tm2614481d1_8k.htm",
    contact_source_link: "https://investor.trinseo.com/home/investor-services/investor-contacts/default.aspx",
    likely_paper: "distressed lender claims, reorg equity entitlement",
    best_angle: "route to workout desk, claims desk, or lender account handling Trinseo exposure",
    live_enabled: true,
    issuer_cik: "0001519061",
    issuer_name_patterns: ["trinseo", "1519061"],
  },
  {
    target_company: "Jianpu Technology Inc.",
    target_context: "Lu Jiayan Form 4 / ownership contact proxy",
    contact_person: "Daqing (David) Ye",
    title: "Investor Relations",
    email: "IR@rong360.com",
    phone: "+86 (10) 6242 7068",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1713923/000110465926060681/0001104659-26-060681-index.html",
    contact_source_link: "https://ir.jianpu.ai/contact-us",
    likely_paper: "potential stock block / beneficial ownership-related position",
    best_angle: "respectful exploratory inquiry about whether Lu Jiayan or an affiliated holder would consider a negotiated block sale",
    live_enabled: true,
    issuer_cik: "0001713923",
    issuer_name_patterns: ["jianpu", "rong360", "1713923"],
  },
  {
    target_company: "WeRide Inc.",
    target_context: "share-capital / filing-contact proxy",
    contact_person: "Investor Relations",
    title: "Investor Relations",
    email: "ir@weride.ai",
    phone: "400-102-3883",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1867729/000110465926060735/tm2614564d1_6k.htm",
    contact_source_link: "https://ir.weride.ai/ir-resources/contact-ir",
    likely_paper: "issuance-related stock, equity-linked exposure, recipient stock",
    best_angle: "ask whether recent filing-related counterparties or recipients may be open to selling blocks or paper",
    live_enabled: true,
    issuer_cik: "0001867729",
    issuer_name_patterns: ["weride", "we ride", "1867729"],
  },
  {
    target_company: "National Grid plc",
    target_context: "investor-relations routing contact",
    contact_person: "James Flanagan",
    title: "Investor Relations Manager (US)",
    email: "james.flanagan2@nationalgrid.com",
    phone: "+44 (0) 20 7004 3129",
    filing_link: "https://www.sec.gov/Archives/edgar/data/1004315/000165495426004849/a2416e.htm",
    contact_source_link: "https://www.nationalgrid.com/document/139246/download",
    likely_paper: "low-confidence legacy / non-core debt or related paper",
    best_angle: "ask to route to the correct debt capital markets or holder-facing contact for any transferable paper",
    live_enabled: true,
    issuer_cik: "0001004315",
    issuer_name_patterns: ["national grid", "nationalgrid", "1004315"],
  },
  {
    target_company: "Honda Motor Co. Ltd.",
    target_context: "investor-relations routing contact",
    contact_person: "David Iida",
    title: "Investor Relations",
    email: "david_iida@hna.honda.com",
    phone: "212-707-9920",
    filing_link: "https://www.sec.gov/Archives/edgar/data/715153/000119312526222672/d18759d6k.htm",
    contact_source_link: "https://hondanews.com/contact",
    likely_paper: "low-confidence special-situations / transferable paper inquiry",
    best_angle: "ask if treasury or IR can route an inquiry involving any transferable paper or counterparty liquidity",
    live_enabled: true,
    issuer_cik: "0000715153",
    issuer_name_patterns: ["honda", "715153"],
  },
  {
    target_company: "SharonAI Holdings Inc.",
    target_context: "investor-relations contact",
    contact_person: "Ross Barrows / IR Desk",
    title: "Head of Capital Strategy & Investor Relations / IR Desk",
    email: "sharonai@imsinvestorrelations.com",
    phone: "unknown",
    filing_link: "https://www.sec.gov/Archives/edgar/data/2068385/000149315226022897/form8-k.htm",
    contact_source_link: "https://sharonai.com/investors/",
    likely_paper: "potential SHAZ stock block or financing paper",
    best_angle: "broad holder-sourcing inquiry directed to IR / capital strategy",
    live_enabled: true,
    issuer_cik: "0002068385",
    issuer_name_patterns: ["sharonai", "sharon ai", "shaz", "2068385"],
  },
];

export const WATCHLIST_ONLY: SeedContact[] = [
  {
    target_company: "Lambda Ventures LLC",
    target_context: "watchlist — no verified email yet",
    contact_person: "Unknown",
    title: "Unknown",
    email: "",
    phone: "unknown",
    filing_link: "",
    contact_source_link: "",
    likely_paper: "unknown",
    best_angle: "unknown",
    live_enabled: false,
    issuer_cik: "",
    issuer_name_patterns: ["lambda ventures"],
    notes: "Excluded from live outreach — no verified public business email confirmed",
  },
  {
    target_company: "Elevra Lithium",
    target_context: "watchlist — no verified email yet",
    contact_person: "Unknown",
    title: "Unknown",
    email: "",
    phone: "unknown",
    filing_link: "",
    contact_source_link: "",
    likely_paper: "unknown",
    best_angle: "unknown",
    live_enabled: false,
    issuer_cik: "",
    issuer_name_patterns: ["elevra lithium", "elevra"],
    notes: "Excluded from live outreach — no verified public business email confirmed",
  },
];

export const ALL_SEEDS = [...LIVE_SEEDS, ...WATCHLIST_ONLY];
