// lib/email-validator.ts
// Utility to detect generic or role-based email addresses (e.g. ir@, info@, contact@).

export function isGenericEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  
  const parts = cleanEmail.split('@');
  if (parts.length !== 2) return false;
  
  const localPart = parts[0];
  
  // Normalize local part by removing special characters (dots, hyphens, underscores)
  const normalizedLocal = localPart.replace(/[._-]/g, '');

  const genericPrefixes = new Set([
    "ir",
    "info",
    "contact",
    "sales",
    "support",
    "admin",
    "jobs",
    "careers",
    "marketing",
    "press",
    "media",
    "investorrelations",
    "investors",
    "office",
    "help",
    "hello",
    "enquiries",
    "inquiries",
    "team",
    "contactus",
    "feedback",
    "pr",
    "irdesk",
    "sec",
    "compliance",
    "legal"
  ]);

  return genericPrefixes.has(normalizedLocal);
}
