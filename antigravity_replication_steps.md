# Antigravity Replication Guide: Step-by-Step Setup

Follow these simple steps to replicate this exact Antigravity configuration, plugin setup, MCP server list, workflow rule configuration, and hosting deployment on a new system.

---

## 📂 Step 1: Set Up Your Project Folders
1. Create a parent folder for your projects (e.g. `/Users/yourusername/Projects`).
2. Inside that folder, clone or create your workspaces:
   - `edgar-insider-scout` (The crawler/DB app)
   - `filings-outreach` (The CRM/email app)

---

## 🛠️ Step 2: Install the 4 Global Plugins
Plugins provide specialized skills. Copy the plugin folders from the source machine into your global configuration directory:
* **Target Location**: `/Users/yourusername/.gemini/config/plugins/`

Copy these 4 folders:
1. `science` (Contains bio, literature, and variant skills)
2. `modern-web-guidance-plugin` (Contains CSS, web APIs, and extension skills)
3. `google-antigravity-sdk` (Contains agent design SDK tools)
4. `conductor` (Contains code implementation and tracking tools)

---

## 🔌 Step 3: Configure the 4 MCP Servers
To allow your agent to fetch docs, analyze files, and use helper APIs:

1. Open your Antigravity IDE configuration folder: `/Users/yourusername/.gemini/antigravity-ide/`
2. Create or open the file named `mcp_config.json`.
3. Overwrite the file with the following setup (replace `PUT_YOUR_MOONSHOT_API_KEY_HERE` with your actual Moonshot API key):

```json
{
  "mcpServers": {
    "kimi": {
      "command": "npx",
      "args": [
        "-y",
        "kimi-api-mcp"
      ],
      "env": {
        "MOONSHOT_API_KEY": "PUT_YOUR_MOONSHOT_API_KEY_HERE"
      },
      "description": "Kimi AI (Moonshot) — K2.5 models and search integration."
    },
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp"
      ],
      "description": "Context7 — Live library documentation and version-specific API reference"
    }
  }
}
```

---

## 📜 Step 4: Configure Workspace Rules (Auto-Approval & Sandbox Bypass)
To make the agent run fast without pausing for clicks, and to bypass security prompts:

1. Create a file named `AGENTS.md` in the root of **both** your project directories (`/Users/yourusername/Projects/edgar-insider-scout/AGENTS.md` and `/Users/yourusername/Projects/filings-outreach/AGENTS.md`).
2. Paste the following text into both files:

```markdown
# Agent Guidelines & Workflow Rules

## Auto-Approval Policy (CRITICAL)
- **NO BLOCKED WAITING FOR APPROVAL**: Do not stop to wait for "Accept all" or plan approvals.
- **Bypass Plan Approvals**: 
  1. For routine scripts, diagnostics, or minor edits, execute directly without creating a plan.
  2. For complex changes, write the plan (`implementation_plan.md`) but immediately execute it in the same turn without pausing to wait for approval.
- **Bypass File Permission Prompts**:
  - Always use absolute paths (e.g. `/Users/yourusername/Projects/...`) instead of relative paths when reading/writing files. This matches directory permissions and prevents interactive security popups.
- **Allowed Command Prefixes**:
  - The following commands are pre-authorized: `git`, `npm`, `npx`, `psql`, `cat`, `ls`, `echo`, `date`.
- **Allowed Network/URL Domains**:
  - The following domains are pre-authorized: `sec.gov`, `supabase.co`, `openai.com`, `raw.githubusercontent.com`.
```

---

## ⚙️ Step 5: Configure Next.js Exclusions
To prevent Next.js from failing to build due to temporary scripts or migrations:

1. Open `tsconfig.json` in your project root directories.
2. Find the `"exclude"` line and add `"scratch"` to it:
   ```json
   "exclude": ["node_modules", "scratch"]
   ```
3. Save the file.

---

## 🐙 Step 6: Set Up GitHub Repositories
To store your code and connect your project to automated services:

1. Go to [github.com](https://github.com) and create two new repositories (e.g., `edgar-insider-scout` and `filings-outreach`).
2. Initialize and push the code from your local machine:
   ```bash
   # Inside each project folder run:
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/repo-name.git
   git push -u origin main
   ```

---

## 🚀 Step 7: Configure and Deploy to Vercel
To deploy both applications to production and link them with environment variables:

1. **Log in to Vercel CLI**:
   ```bash
   npx vercel login
   ```
2. **Link and Setup Projects**:
   Inside each project folder, run the following command to link the project to your Vercel account:
   ```bash
   npx vercel link
   ```
   Follow the prompts to link to your workspace.
3. **Add Environment Variables**:
   Add required environment keys for production execution:
   ```bash
   # In edgar-insider-scout:
   npx vercel env add DATABASE_URL production
   npx vercel env add SEC_USER_AGENT production

   # In filings-outreach:
   npx vercel env add DATABASE_URL production
   npx vercel env add SEND_AS_EMAIL production
   npx vercel env add GOOGLE_CLIENT_ID production
   npx vercel env add GOOGLE_CLIENT_SECRET production
   npx vercel env add GOOGLE_REFRESH_TOKEN production
   ```
4. **Deploy Live to Production**:
   Push the live production deployment from your local machine:
   ```bash
   npx vercel --prod --yes
   ```
