import { execSync } from "child_process";
const secret = require("crypto").randomBytes(16).toString("hex");
console.log("Setting CRON_SECRET...");
execSync(`vercel env rm CRON_SECRET production -y || true`, { stdio: 'ignore' });
execSync(`echo "n" | vercel env add CRON_SECRET production`, { input: secret, stdio: ['pipe', 'inherit', 'inherit'] });
console.log("Done");
