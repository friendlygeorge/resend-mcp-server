# Resend MCP Server

> An MCP server for [Resend](https://resend.com) — connect any MCP-compatible client to the Resend transactional email API.

[![npm version](https://img.shields.io/npm/v/@supernova123/resend-mcp-server)](https://www.npmjs.com/package/@supernova123/resend-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@supernova123/resend-mcp-server)](https://www.npmjs.com/package/@supernova123/resend-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blueviolet)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Claude Desktop](https://img.shields.io/badge/Claude%20Desktop-ready-orange)](https://claude.ai/download)
[![Cursor](https://img.shields.io/badge/Cursor-compatible-blue)](https://cursor.sh)

## What is this?

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants and agents full access to [Resend](https://resend.com)'s email API — send single or batch emails, manage sending domains, API keys, audiences, and contacts — through natural language.

Use it with **Claude Desktop**, **Cursor**, **Windsurf**, **Cline**, **Continue**, or any MCP-compatible client to send emails, manage infrastructure, and build automation around email.

## Why use this?

- **18 built-in tools** — covers sending (single + batch), domains, API keys, audiences, and contacts
- **Send emails by talking** — "send a welcome email to jane@example.com" just works
- **Manage your infrastructure** — create/verify/delete domains, mint/revoke API keys, manage contacts
- **Batch sending** — send up to 100 emails in a single API call
- **Full contact CRUD** — create, read, update, and delete contacts across audiences
- **Rate-limited automatically** — respects Resend's 10 req/s free tier, retries on 429
- **Works with every MCP client** — Claude Desktop, Cursor, Windsurf, Cline, Continue, and more

## Quick Start

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "resend": {
      "command": "npx",
      "args": ["-y", "resend-mcp-server"],
      "env": {
        "RESEND_API_KEY": "re_xxxxxxxxxxxx"
      }
    }
  }
}
```

Get a free API key at [resend.com/api-keys](https://resend.com/api-keys).

### Use it

Ask your AI assistant things like:

- "Send an email to jane@example.com thanking her for signing up"
- "List the last 5 emails I sent"
- "What happened to email ID `abc-123`?"
- "Create a new sending domain for `mail.acme.com`"
- "Verify domain `domain-xyz`"
- "Mint a new API key called 'production-server'"
- "Add jane@example.com to audience `audience-1`"

## Tools

| Tool | Description |
|------|-------------|
| `send_email` | Send a transactional email (HTML or plain text, with Cc/Bcc/Reply-To) |
| `send_batch_email` | Send up to 100 emails in a single API call |
| `list_emails` | List recent sent emails with their delivery status |
| `get_email` | Get details for a specific email by ID |
| `create_domain` | Add a new sending domain |
| `list_domains` | List all sending domains in your account |
| `verify_domain` | Trigger DNS verification for a domain |
| `delete_domain` | Remove a sending domain |
| `create_api_key` | Create a new API key (full, sending, or domain-scoped) |
| `list_api_keys` | List all API keys (tokens are hidden) |
| `delete_api_key` | Delete an API key by ID |
| `list_audiences` | List all audiences in your account |
| `create_audience` | Create a new audience for organizing contacts |
| `list_contacts` | List contacts in an audience |
| `get_contact` | Get details for a specific contact by ID |
| `create_contact` | Add a new contact to an audience |
| `update_contact` | Update a contact's email, name, or subscription status |
| `delete_contact` | Remove a contact from an audience |

## Use Cases

### Transactional Email Automation
"Send a welcome email to every new signup" — automate onboarding flows, receipts, and notifications through natural language. No more switching between email dashboards.

### Domain Management
"Add mail.acme.com as a sending domain and verify it" — manage DNS records, DKIM, and SPF through your AI assistant instead of logging into Resend's dashboard.

### Contact & Audience Management
"Add jane@example.com to my VIP audience" — build and segment contact lists without touching a spreadsheet. Full CRUD on contacts and audiences.

### Batch Campaigns
"Send this newsletter to all contacts in audience-1" — batch-send up to 100 emails in one call. Perfect for newsletters, product announcements, or re-engagement campaigns.

### Infrastructure Audit
"List all my API keys and domains" — audit your Resend setup in seconds. See which keys are active, which domains are verified, and clean up stale resources.

## Security

- **API key required** — Resend API key is passed via environment variable, never logged or stored in files.
- **No local file access** — does not read or write any files on your machine.
- **No shell access** — does not execute commands or spawn processes.
- **Rate-limited** — automatically caps requests at ~9 req/s to stay within Resend's free tier.
- **Open source** — MIT licensed. Inspect the code at [GitHub](https://github.com/friendlygeorge/resend-mcp-server).

## Troubleshooting

### Rate limit errors (429)
The server auto-retries on 429 with a 2s backoff. Free tier allows 10 req/s. The server caps at ~9 req/s to stay safe. If you hit this frequently, consider upgrading your Resend plan.

### "Invalid API key" errors
Verify your `RESEND_API_KEY` starts with `re_` and is active at [resend.com/api-keys](https://resend.com/api-keys). Keys take up to 30 seconds to propagate after creation.

### Server won't start
Make sure Node.js 18+ is installed: `node --version`. If using npx, ensure npm is up to date: `npm install -g npm@latest`.

### MCP client can't connect
Verify the config path is correct. Claude Desktop uses `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Restart the client after config changes.

### Emails not delivering
Check `list_emails` for delivery status. Common issues: missing DNS records (run `verify_domain`), bounce due to invalid address, or domain not yet verified. Resend's dashboard shows detailed webhook events.

## Requirements

- Node.js 18+
- A [Resend](https://resend.com) account and API key (`RESEND_API_KEY`)

## Rate Limits

The server automatically rate-limits requests to ~9 calls/second to stay safely under Resend's free-tier limit of 10 req/s. If you hit a 429 anyway, it waits 2s and retries once.

## Development

```bash
git clone https://github.com/friendlygeorge/resend-mcp-server.git
cd resend-mcp-server
npm install
npm run build
RESEND_API_KEY=re_xxxx npm start
```

## License

MIT
