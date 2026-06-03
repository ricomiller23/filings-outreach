// lib/workflow/generate.ts — Stage 3: Email Generation

import { MatchedOutreach } from "./match";

export interface GeneratedEmail {
  to: string;
  subject: string;
  body: string;
  match: MatchedOutreach;
}

const SENDER_NAME = "Eric Miller";
const getSenderEmail = () => process.env.SEND_AS_EMAIL ?? "ricomiller@icloud.com";

/**
 * Generate a personalized outreach email for a matched contact.
 */
export function generateEmail(match: MatchedOutreach): GeneratedEmail {
  const { filing, seed } = match;
  let { contact_person, target_company, likely_paper, best_angle } = seed;

  // Clean any incorrect Rule 415 references to Rule 144 in outbound emails
  if (likely_paper) {
    likely_paper = likely_paper.replace(/rule\s*415/gi, "Rule 144");
  }
  if (best_angle) {
    best_angle = best_angle.replace(/rule\s*415/gi, "Rule 144");
  }

  const filingDate = new Date(filing.filedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const issuerName = filing.issuerName || target_company;

  // Personalized greeting - Dear [Name],
  const firstName = extractFirstName(contact_person);
  const greetingName = firstName || (contact_person && contact_person !== "Investor Relations" ? contact_person : "Security Holder");
  const greeting = `Dear ${greetingName},`;

  // Subject line — Block Trade Solution for Your Restricted Stock / [Company Name] Position
  const subject = buildSubject(issuerName);

  // Body — personalized Template 1
  const body = buildBody({
    greeting,
    issuerName,
    filingDate,
    formType: filing.formType,
    likelyPaper: likely_paper,
    angle: best_angle,
    contactPerson: contact_person,
    senderName: SENDER_NAME,
    senderEmail: getSenderEmail(),
    ticker: filing.ticker,
  });

  return {
    to: seed.email,
    subject,
    body,
    match,
  };
}

function extractFirstName(name: string): string {
  if (!name || name === "Investor Relations" || name.includes("/")) return "";
  // Handle "Bregje \"Bee\" Roseboom-Van Kessel" → "Bee"
  const nickMatch = name.match(/"([^"]+)"/);
  if (nickMatch) return titleCase(nickMatch[1]);
  // Handle "Daqing (David) Ye" → "David"
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) return titleCase(parenMatch[1]);

  const parts = name.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 2) return titleCase(parts[0] || "");

  // SEC format: "LastName FirstName MiddleInitial" (e.g. "Sanchez Alejandro M")
  // Detect by: last part is a single letter/initial, or name has 3+ parts
  // with no comma. In SEC filings, names are typically "Last First [Mid]".
  // If there are 2+ parts and the name looks like SEC format (Last First),
  // use the second part as the first name.
  const lastPart = parts[parts.length - 1];
  const isSECFormat = parts.length >= 2 && (
    lastPart.length <= 2 || // middle initial like "M" or "Jr"
    parts.length >= 3       // "LastName FirstName MiddleInitial"
  );
  if (isSECFormat) {
    return titleCase(parts[1]); // Second token is the first name
  }

  // Default: first token is the first name (normal "First Last" format)
  return titleCase(parts[0]);
}

/** Title-case a single word: "JOHN" → "John", "john" → "John" */
function titleCase(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function buildSubject(issuerName: string): string {
  return `Block Trade Solution for Your Restricted Stock / ${issuerName} Position`;
}

function formatFormType(rawFormType: string): string {
  const clean = rawFormType.trim();
  if (/^144$/i.test(clean)) return "Form 144";
  if (/^8-?K$/i.test(clean)) return "Form 8-K";
  if (/^S-?1$/i.test(clean)) return "Form S-1";
  if (/^S-?1\/A$/i.test(clean) || /^S-?1A$/i.test(clean)) return "Form S-1/A";
  if (/^4$/i.test(clean)) return "Form 4";
  if (!clean.toLowerCase().startsWith("form")) {
    return `Form ${clean}`;
  }
  return clean;
}

interface BodyParams {
  greeting: string;
  issuerName: string;
  filingDate: string;
  formType: string;
  likelyPaper: string;
  angle: string;
  contactPerson: string;
  senderName: string;
  senderEmail: string;
  ticker: string | null;
}

function buildBody(p: BodyParams): string {
  const { greeting, issuerName, filingDate, formType, ticker, senderName, senderEmail } = p;

  const formattedFormType = formatFormType(formType);
  const tickerStr = ticker ? ` (${ticker})` : "";

  return `${greeting}

I'm writing to you regarding your position in ${issuerName}${tickerStr} and the challenges you may be facing in monetizing those securities, following the recent ${formattedFormType} filing submitted on ${filingDate}.

The Problem You Know Well:

Volume limits that prevent meaningful sales
Inability to deposit shares at some firms
Thin trading that makes block sales difficult
Holding period restrictions complicating liquidity
The frustration of watching value you can't access

The Solution We Offer: I specialize in facilitating block trades that take restricted securities off holders' books—quickly, efficiently, and with certainty of execution. We purchase:

Rule 144 shares with volume limitations
Section 4(a)(1) control positions
Section 3(a)(10) shares from debt settlements
Convertible debentures that are underwater or difficult to monetize

How We Can Help You: Instead of fighting the market with volume limits and deposit issues, we can take the entire position off your hands in a single block trade. This means:

Immediate liquidity — no more waiting for trading windows
Certainty of execution — we evaluate quickly and close efficiently
No volume constraints — we buy the full block
Clean exit — no lingering position or overhang

My Background: I've been active in the restricted securities space since the late 1980s, with extensive experience in sourcing, evaluating, and closing transactions involving restricted and thinly traded positions. I understand the practical and legal considerations that come with these transactions, and I know how important speed and certainty are when you need liquidity.

Next Step: If you have a position you'd like to discuss, I would welcome the opportunity to have a brief call to understand your situation and explore whether a block trade makes sense. I can evaluate opportunities quickly and move to close efficiently when the fit is right.

Would you be available for a call this week or next? You can reach me at 480.287.2227 or reply to this email.

Best regards,

${senderName}

480.287.2227
${senderEmail}`;
}
