// lib/workflow/generate.ts — Stage 3: Email Generation

import { MatchedOutreach } from "./match";

export interface GeneratedEmail {
  to: string;
  subject: string;
  body: string;
  match: MatchedOutreach;
}

const SENDER_NAME = "Rico Miller";
const SENDER_EMAIL = process.env.SEND_AS_EMAIL ?? "ricomiller@icloud.com";

/**
 * Generate a personalized outreach email for a matched contact.
 * - 80–150 words
 * - Professional, direct, not spammy
 * - No emojis, no mass-marketing language
 */
export function generateEmail(match: MatchedOutreach): GeneratedEmail {
  const { filing, seed } = match;
  const { contact_person, target_company, likely_paper, best_angle } = seed;

  const filingDate = new Date(filing.filedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const issuerName = filing.issuerName || target_company;

  // Personalized greeting
  const firstName = extractFirstName(contact_person);
  const greeting = firstName ? `${firstName},` : "Hello,";

  // Subject line — credible, simple
  const subject = buildSubject(issuerName, filing.formType, seed);

  // Body — ~100 words, structured per spec
  const body = buildBody({
    greeting,
    issuerName,
    filingDate,
    formType: filing.formType,
    likelyPaper: likely_paper,
    angle: best_angle,
    contactPerson: contact_person,
    senderName: SENDER_NAME,
    senderEmail: SENDER_EMAIL,
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

function buildSubject(
  issuerName: string,
  formType: string,
  seed: MatchedOutreach["seed"]
): string {
  const likelyPaperShort = seed.likely_paper
    .split(",")[0]
    .replace(/(potential |low-confidence )/gi, "")
    .trim()
    .toLowerCase();

  if (likelyPaperShort.includes("claim") || likelyPaperShort.includes("debt")) {
    return `Interest in ${issuerName} claims / debt exposure`;
  }
  if (likelyPaperShort.includes("convert")) {
    return `Interest in ${issuerName} convert or related paper`;
  }
  if (likelyPaperShort.includes("block") || likelyPaperShort.includes("stock")) {
    return `Inquiry regarding ${issuerName} stock or block position`;
  }
  if (formType === "S1" || formType === "S1A") {
    return `Inquiry regarding ${issuerName} paper / issuance exposure`;
  }
  return `Interest in ${issuerName} — transferable paper inquiry`;
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
}

function buildBody(p: BodyParams): string {
  const { greeting, issuerName, filingDate, likelyPaper, angle, senderName, senderEmail } = p;

  // Build the filing reference sentence
  const filingRef = `I came across the recent ${issuerName} filing dated ${filingDate} and wanted to reach out directly.`;

  // Build the interest sentence — adapted from best_angle
  const interestSentence = buildInterestSentence(issuerName, likelyPaper, angle);

  // Standard routing ask
  const routingAsk = `If you are not the right contact for this type of inquiry, I would appreciate a brief introduction to whoever handles it on your end.`;

  const body = `${greeting}

${filingRef}

${interestSentence}

${routingAsk}

${senderName}
${senderEmail}`.trim();

  return body;
}

function buildInterestSentence(
  issuerName: string,
  likelyPaper: string,
  angle: string
): string {
  const paperLower = likelyPaper.toLowerCase();
  const angleLower = angle.toLowerCase();

  if (angleLower.includes("monetization") || angleLower.includes("convert")) {
    return `We are actively looking to acquire convertible note exposure or conversion-stage stock in situations like this, and would be interested in speaking with you about a potential direct transaction if ${issuerName} paper is available for sale.`;
  }
  if (angleLower.includes("claims") || angleLower.includes("workout") || angleLower.includes("reorg")) {
    return `We are interested in acquiring distressed lender claims or post-reorganization equity exposure in ${issuerName}, and we would welcome a bilateral discussion or an introduction to the appropriate desk handling this exposure.`;
  }
  if (angleLower.includes("block") || paperLower.includes("stock block")) {
    return `We are exploring whether any affiliated or beneficial holders of ${issuerName} stock would consider a negotiated block sale, and I wanted to reach out to your team as a first step in that inquiry.`;
  }
  if (angleLower.includes("route") || angleLower.includes("debt capital")) {
    return `We are interested in any transferable paper or legacy debt exposure connected to ${issuerName}, and I wanted to ask whether you could route this inquiry to the appropriate contact on the capital markets or treasury side.`;
  }
  if (angleLower.includes("treasury") || angleLower.includes("transferable")) {
    return `We are interested in exploring any special-situations or transferable paper connected to ${issuerName}, and would appreciate a referral to the right contact in treasury or investor relations if that is more appropriate.`;
  }

  // Generic fallback
  return `We would be interested in acquiring ${likelyPaper.split(",")[0].trim().toLowerCase()} connected to ${issuerName}, and I wanted to reach out to discuss whether a negotiated transaction might be possible.`;
}
