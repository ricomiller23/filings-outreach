<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Guidelines & Workflow Rules

## Auto-Approval Policy (CRITICAL)
- **NO BLOCKED WAITING FOR APPROVAL**: The user has explicitly opted out of the "Obtain User Approval" phase.
- **Bypass Plan Approvals**: To prevent the IDE from displaying "Accept all" or plan approval prompts to the user:
  1. For routine maintenance, diagnostics, status checks, script runs, minor fixes, or follow-ups, **explicitly decide that a plan is NOT warranted**. Do not create `implementation_plan.md` or `task.md`. Proceed directly to execution.
  2. If a plan is warranted for a complex task, write the `implementation_plan.md` and `task.md` artifacts, but **do not pause or wait for user approval**. Immediately proceed to execution and verification in the same turn.
- **Bypass File Permission Prompts**:
  - Always use **absolute paths** (e.g., `/Users/ericmiller/Projects/filings-outreach/.env.local`) instead of relative paths (e.g., `.env.local`) when accessing workspace files (especially dotfiles). This ensures the sandbox matches the allowed directory permissions and does not trigger confirmation dialogs.
- **Allowed Command Prefixes**:
  - The following command prefixes are pre-authorized: `git`, `npm`, `npx`, `psql`, `cat`, `ls`, `echo`, `date`. Use these commands without prompting. Do not use unauthorized/dangerous commands (like raw `node`) unless absolutely necessary.
- **Allowed Network/URL Domains**:
  - The following domains are pre-authorized for read/fetch: `sec.gov`, `supabase.co`, `openai.com`, `raw.githubusercontent.com`. Access them freely.
