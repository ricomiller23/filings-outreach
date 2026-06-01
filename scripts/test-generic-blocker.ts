// scripts/test-generic-blocker.ts
import { isGenericEmail } from "../lib/email-validator";

const testCases = [
  // Generic / Should be blocked (true)
  { email: "ir@weride.ai", expected: true },
  { email: "IR@rong360.com", expected: true },
  { email: "info@company.com", expected: true },
  { email: "investor-relations@nationalgrid.com", expected: true },
  { email: "investor.relations@domain.com", expected: true },
  { email: "ir-desk@sharonai.com", expected: true },
  { email: "contact@domain.com", expected: true },
  { email: "sales@test.com", expected: true },
  { email: "support@app.com", expected: true },
  { email: "admin@server.net", expected: true },
  { email: "jobs@hiring.com", expected: true },
  { email: "careers@corporation.com", expected: true },
  { email: "compliance@bank.com", expected: true },
  { email: "legal@firm.co", expected: true },
  { email: "help@website.com", expected: true },
  { email: "office@company.co.uk", expected: true },

  // Non-generic / Should be allowed (false)
  { email: "brian@monroestreetcapitalpartners.com", expected: false },
  { email: "bvankessel@trinseo.com", expected: false },
  { email: "amuller@trinseo.com", expected: false },
  { email: "james.flanagan2@nationalgrid.com", expected: false },
  { email: "david_iida@hna.honda.com", expected: false },
  { email: "sharonai@imsinvestorrelations.com", expected: false },
  { email: "john.doe@company.com", expected: false },
  { email: "a.smith@domain.org", expected: false },
  { email: "marketing-lead@start.up", expected: false }, // only "marketing" itself is generic, "marketing-lead" is not
];

let failed = false;

console.log("🧪 Running generic email validator test suite...\n");

for (const tc of testCases) {
  const result = isGenericEmail(tc.email);
  if (result === tc.expected) {
    console.log(`✅ [PASS] ${tc.email.padEnd(45)} -> expected: ${tc.expected}, got: ${result}`);
  } else {
    console.error(`❌ [FAIL] ${tc.email.padEnd(45)} -> expected: ${tc.expected}, got: ${result}`);
    failed = true;
  }
}

if (failed) {
  console.log("\n❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("\n🎉 All email validation tests passed!");
  process.exit(0);
}
