# Resend MCP Server

> An MCP server for [Resend](https://resend.com) — connect any MCP-compatible client to the Resend transactional email API.

[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blueviolet)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## What is this?

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants and agents access to [Resend](https://resend.com)'s email API — send transactional emails, manage sending domains, create API keys, and manage audience contacts — through natural language.

Use it with **Claude Desktop**, **Cursor**, **Windsurf**, **Cline**, **Continue**, or any MCP-compatible client to send emails, manage infrastructure, and build automation around email.

## Why use this?

- **10 built-in tools** — covers sending, domains, API keys, and audiences
- **Send emails by talking** — "send a welcome email to jane@example.com" just works
- **Manage your infrastructure** — create/verify domains, mint API keys, manage contacts
- **Rate-limited automatically** — respects Resend's 10 req/s free tier, retries on 429
- **Works with every MCP client** — Claude Desktop, Cursor, Windsurf, Cline, Continue, and more

## Tools

| Tool | Description |
|------|-------------|
| `send_email` | Send a transactional email (HTML or plain text, with Cc/Bcc/Reply-To) |
| `list_emails` | List recent sent emails with their delivery status |
| `get_email` | Get details for a specific email by ID |
| `create_domain` | Add a new sending domain |
| `list_domains` | List all sending domains in your account |
| `verify_domain` | Trigger DNS verification for a domain |
| `create_api_key` | Create a new API key (full, sending, or domain-scoped) |
| `list_api_keys` | List all API keys (tokens are hidden) |
| `list_contacts` | List contacts in an audience |
| `create_contact` | Add a new contact to an audience |

## Quick Start

### 1. Get a Resend API key

Sign up at [resend.com](https://resend.com) and grab an API key from [resend.com/api-keys](https://resend.com/api-keys).

### 2. Install

```bash
npm install -g resend-mcp-server
```

Or run directly with npx:

```bash
npx -y resend-mcp-server
```

### 3. Configure your MCP client

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

Or with global install:

```json
{
  "mcpServers": {
    "resend": {
      "command": "resend-mcp-server",
      "env": {
        "RESEND_API_KEY": "re_xxxxxxxxxxxx"
      }
    }
  }
}
```

### 4. Use it

Ask your AI assistant things like:

- "Send an email to jane@example.com thanking her for signing up"
- "List the last 5 emails I sent"
- "What happened to email ID `abc-123`?"
- "Create a new sending domain for `mail.acme.com`"
- "Verify domain `domain-xyz`"
- "List all my sending domains"
- "Mint a new API key called 'production-server'"
- "List all my API keys"
- "Add jane@example.com to audience `audience-1`"
- "Show me the contacts in audience `audience-1`"

## Example Output

### `send_email`

```
✅ Email sent

- ID: `a1b2c3d4-...`
```

### `list_emails`

```
📧 Recent Emails (3):

1. Welcome to Acme!
   From: Acme <hello@acme.com> → To: jane@example.com
   ID: `a1b2c3d4-...` | Last Event: delivered | Created: 2026-01-15T10:30:00Z

2. Your receipt
   From: Acme <billing@acme.com> → To: bob@example.com
   ID: `e5f6g7h8-...` | Last Event: opened | Created: 2026-01-15T09:15:00Z
```

### `create_domain`

```
✅ Domain created

mail.acme.com
- ID: `domain-xyz-...`
- Status: pending
- Region: us-east-1
- Created: 2026-01-15T10:30:00Z

DNS Records:
- `mail.acme.com` `MX` → `feedback-smtp.us-east-1.amazonses.com`
- `resend._domainkey.mail.acme.com` `TXT` → `v=DKIM1; k=rsa; p=MIGfMA0GCSq...`
- `mail.acme.com` `TXT` → `v=spf1 include:amazonses.com ~all`
```

## Requirements

- Node.js 18+
- A [Resend](https://resend.com) account and API key (`RESEND_API_KEY`)

## Rate Limits

The server automatically rate-limits requests to ~9 calls/second to stay safely under Resend's free-tier limit of 10 req/s. If you hit a 429 anyway, it waits 2s and retries once.

## API Reference

All endpoints hit `https://api.resend.com` with a `Bearer` token. See the [Resend docs](https://resend.com/docs) for full details.

| Tool | Method | Path |
|------|--------|------|
| `send_email` | POST | `/emails` |
| `list_emails` | GET | `/emails` |
| `get_email` | GET | `/emails/{id}` |
| `create_domain` | POST | `/domains` |
| `list_domains` | GET | `/domains` |
| `verify_domain` | POST | `/domains/{id}/verify` |
| `create_api_key` | POST | `/api-keys` |
| `list_api_keys` | GET | `/api-keys` |
| `list_contacts` | GET | `/audiences/{id}/contacts` |
| `create_contact` | POST | `/audiences/{id}/contacts` |

## Development

```bash
git clone https://github.com/nova/resend-mcp-server.git
cd resend-mcp-server
npm install
npm run build
RESEND_API_KEY=re_xxxx npm start
```

## License

MIT
