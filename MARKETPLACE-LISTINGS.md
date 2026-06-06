# Marketplace Listings — Resend MCP Server

## Listing 1: mcp.so

**Title:** Resend MCP Server

**Category:** Email & Communication

**Description:**
MCP server for Resend — the modern transactional email API. Send emails, manage sending domains, create API keys, and manage audience contacts through natural language. Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.

Features:
- Send transactional emails (HTML or plain text, with Cc/Bcc/Reply-To)
- List and inspect sent emails with delivery status
- Create and verify sending domains
- Create and list API keys (full, sending, or domain-scoped)
- List and add contacts to audiences
- Rate-limited to 9 req/s, automatic retry on 429

**Tags:** resend, email, transactional, smtp, api, mcp, automation

**Installation:**
```bash
npx -y resend-mcp-server
```

---

## Listing 2: Smithery (smithery.ai)

**Title:** Resend

**Description:**
Connect AI assistants to Resend's transactional email API. Send emails, manage domains, mint API keys, and manage audience contacts through the Model Context Protocol. Requires a Resend API key.

**Tools:** 10 (send_email, list_emails, get_email, create_domain, list_domains, verify_domain, create_api_key, list_api_keys, list_contacts, create_contact)

**Transport:** stdio

**Config:**
```json
{
  "command": "npx",
  "args": ["-y", "resend-mcp-server"],
  "env": {
    "RESEND_API_KEY": "re_xxxxxxxxxxxx"
  }
}
```

---

## Listing 3: Glama MCP

**Title:** Resend MCP Server

**Description:**
Access Resend's transactional email API through MCP. Send emails, manage sending domains, create API keys, and manage audience contacts. Works with Claude Desktop, Cursor, and other MCP clients. Requires a Resend API key.

**Category:** Communication

**Tools:** 10

**Tags:** resend, email, transactional, smtp, api, automation

---

## Listing 4: There's An AI For That (TAAIFT)

**Title:** Resend MCP Server

**Category:** Developer Tools → AI Development → MCP Servers

**Description:**
MCP server that connects AI assistants to Resend's transactional email API. Send emails, manage sending domains, mint API keys, and manage audience contacts by talking to your AI. Requires a Resend API key (free tier supported).

**Price:** Free (open source, MIT)

---

## Listing 5: Awesome MCP Servers (GitHub)

**PR Description:**
Add Resend MCP Server — send emails, manage domains & API keys for AI assistants. 10 tools: send/list/get email, create/list/verify domain, create/list API key, list/create contact. Resend API, TypeScript, MIT license.
