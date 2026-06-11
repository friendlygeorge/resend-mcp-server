#!/usr/bin/env node
/**
 * Resend MCP Server
 *
 * Connect AI assistants to Resend's transactional email API.
 * Send emails, manage domains, create API keys, and manage contacts
 * through the Model Context Protocol.
 *
 * Works with Claude Desktop, Cursor, Windsurf, Cline, and any MCP client.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RESEND_BASE = "https://api.resend.com";

// Rate limiter: Resend free tier = 10 req/s. We use 110ms (~9 req/s) to stay safely under.
let lastCall = 0;
const MIN_INTERVAL = 110; // ~9 req/s, safe for free tier (10 req/s)

async function rateLimitedFetch(
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY environment variable is not set. Get an API key at https://resend.com/api-keys"
    );
  }

  const now = Date.now();
  const wait = MIN_INTERVAL - (now - lastCall);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCall = Date.now();

  const res = await fetch(`${RESEND_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(`${RESEND_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Resend API error (${retry.status}): ${text}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }

  // 204 No Content (e.g. some DELETE/PUT endpoints)
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

// ── Formatting helpers ──

function formatEmail(e: any): string {
  const lines: string[] = [];
  lines.push(`**${e.subject || "(no subject)"}**`);
  lines.push(`- **ID:** \`${e.id}\``);
  lines.push(`- **From:** ${e.from}`);
  lines.push(`- **To:** ${Array.isArray(e.to) ? e.to.join(", ") : e.to}`);
  if (e.cc) lines.push(`- **Cc:** ${Array.isArray(e.cc) ? e.cc.join(", ") : e.cc}`);
  if (e.bcc) lines.push(`- **Bcc:** ${Array.isArray(e.bcc) ? e.bcc.join(", ") : e.bcc}`);
  if (e.reply_to) lines.push(`- **Reply-To:** ${Array.isArray(e.reply_to) ? e.reply_to.join(", ") : e.reply_to}`);
  lines.push(`- **Created:** ${e.created_at || "N/A"}`);
  if (e.last_event) lines.push(`- **Last Event:** ${e.last_event}`);
  if (e.status) lines.push(`- **Status:** ${e.status}`);
  if (e.scheduled_at) lines.push(`- **Scheduled:** ${e.scheduled_at}`);
  return lines.join("\n");
}

function formatDomain(d: any): string {
  const lines: string[] = [];
  lines.push(`**${d.name}**`);
  lines.push(`- **ID:** \`${d.id}\``);
  lines.push(`- **Status:** ${d.status || "N/A"}`);
  lines.push(`- **Region:** ${d.region || "N/A"}`);
  lines.push(`- **Created:** ${d.created_at || "N/A"}`);
  if (d.records && d.records.length) {
    lines.push("");
    lines.push("**DNS Records:**");
    for (const r of d.records) {
      lines.push(`- \`${r.record}\` \`${r.type}\` → \`${r.value}\`${r.ttl ? ` (TTL ${r.ttl})` : ""}`);
    }
  }
  return lines.join("\n");
}

function formatApiKey(k: any): string {
  const lines: string[] = [];
  lines.push(`**${k.name}**`);
  lines.push(`- **ID:** \`${k.id}\``);
  lines.push(`- **Token:** \`${k.token || "(hidden — only shown on create)"}\``);
  lines.push(`- **Created:** ${k.created_at || "N/A"}`);
  return lines.join("\n");
}

function formatContact(c: any): string {
  const lines: string[] = [];
  lines.push(`**${c.first_name || ""}${c.last_name ? " " + c.last_name : ""}** <${c.email}>`);
  lines.push(`- **ID:** \`${c.id}\``);
  if (c.unsubscribed) lines.push(`- **Status:** Unsubscribed`);
  else lines.push(`- **Status:** Subscribed`);
  lines.push(`- **Created:** ${c.created_at || "N/A"}`);
  return lines.join("\n");
}

// Create server
const server = new McpServer({
  name: "resend",
  version: "1.1.0",
});

// ── Tool: send_email ──
server.tool(
  "send_email",
  "Send a transactional email via Resend",
  {
    from: z.string().describe("Sender address (e.g. 'Acme <noreply@acme.com>')"),
    to: z.union([z.string(), z.array(z.string())]).describe("Recipient address(es)"),
    subject: z.string().describe("Email subject line"),
    html: z.string().optional().describe("HTML body"),
    text: z.string().optional().describe("Plain text body"),
    cc: z.union([z.string(), z.array(z.string())]).optional().describe("Cc address(es)"),
    bcc: z.union([z.string(), z.array(z.string())]).optional().describe("Bcc address(es)"),
    reply_to: z.union([z.string(), z.array(z.string())]).optional().describe("Reply-To address(es)"),
    scheduled_at: z.string().optional().describe("ISO 8601 datetime to schedule the email"),
    headers: z.record(z.string()).optional().describe("Custom headers as key/value pairs"),
  },
  async ({ from, to, subject, html, text, cc, bcc, reply_to, scheduled_at, headers }) => {
    try {
      if (!html && !text) {
        return {
          content: [
            { type: "text" as const, text: "Error: Provide either `html` or `text` body." },
          ],
        };
      }
      const body: any = { from, to, subject };
      if (html) body.html = html;
      if (text) body.text = text;
      if (cc) body.cc = cc;
      if (bcc) body.bcc = bcc;
      if (reply_to) body.reply_to = reply_to;
      if (scheduled_at) body.scheduled_at = scheduled_at;
      if (headers) body.headers = headers;

      const data = await rateLimitedFetch("/emails", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Email sent**\n\n- **ID:** \`${data.id}\``,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: list_emails ──
server.tool(
  "list_emails",
  "List recent emails sent via Resend",
  {
    limit: z.number().optional().default(20).describe("Max emails to return (default 20)"),
  },
  async ({ limit }) => {
    try {
      const data = await rateLimitedFetch(`/emails?limit=${Math.min(limit, 100)}`);
      const emails = data.data || [];
      if (emails.length === 0) {
        return { content: [{ type: "text" as const, text: "No emails found." }] };
      }
      const lines = emails.map((e: any, i: number) => {
        const to = Array.isArray(e.to) ? e.to.join(", ") : e.to;
        return `**${i + 1}. ${e.subject || "(no subject)"}**\n   From: ${e.from} → To: ${to}\n   ID: \`${e.id}\` | Last Event: ${e.last_event || "N/A"} | Created: ${e.created_at}`;
      });
      return {
        content: [
          { type: "text" as const, text: `**📧 Recent Emails (${emails.length}):**\n\n${lines.join("\n\n")}` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: get_email ──
server.tool(
  "get_email",
  "Get details about a specific email by ID",
  {
    email_id: z.string().describe("Email ID (from send_email or list_emails)"),
  },
  async ({ email_id }) => {
    try {
      const data = await rateLimitedFetch(`/emails/${email_id}`);
      return { content: [{ type: "text" as const, text: formatEmail(data) }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: create_domain ──
server.tool(
  "create_domain",
  "Create a new sending domain in Resend",
  {
    name: z.string().describe("Domain name (e.g. 'mail.acme.com')"),
    region: z.enum(["us-east-1", "eu-west-1", "sa-east-1", "ap-northeast-1"]).optional().describe("AWS region (default: us-east-1)"),
  },
  async ({ name, region }) => {
    try {
      const body: any = { name };
      if (region) body.region = region;
      const data = await rateLimitedFetch("/domains", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Domain created**\n\n${formatDomain(data)}`,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: list_domains ──
server.tool(
  "list_domains",
  "List all sending domains in your Resend account",
  {
    limit: z.number().optional().default(20).describe("Max domains to return (default 20)"),
  },
  async ({ limit }) => {
    try {
      const data = await rateLimitedFetch(`/domains?limit=${Math.min(limit, 100)}`);
      const domains = data.data || [];
      if (domains.length === 0) {
        return { content: [{ type: "text" as const, text: "No domains found." }] };
      }
      const lines = domains.map((d: any, i: number) =>
        `**${i + 1}. ${d.name}** — Status: ${d.status || "N/A"} | Region: ${d.region || "N/A"} | ID: \`${d.id}\``
      );
      return {
        content: [
          { type: "text" as const, text: `**🌐 Domains (${domains.length}):**\n\n${lines.join("\n")}` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: verify_domain ──
server.tool(
  "verify_domain",
  "Trigger verification of a domain's DNS records",
  {
    domain_id: z.string().describe("Domain ID (from create_domain or list_domains)"),
  },
  async ({ domain_id }) => {
    try {
      const data = await rateLimitedFetch(`/domains/${domain_id}/verify`, {
        method: "POST",
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Verification triggered**\n\n${formatDomain(data)}`,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: create_api_key ──
server.tool(
  "create_api_key",
  "Create a new Resend API key (token is only returned once)",
  {
    name: z.string().describe("Friendly name for the key (e.g. 'production-server')"),
    permission: z.enum(["full_access", "sending_access", "domain_read"]).optional().default("full_access").describe("Permission scope (default: full_access)"),
    domain_id: z.string().optional().describe("Restrict key to a specific domain (for sending_access)"),
  },
  async ({ name, permission, domain_id }) => {
    try {
      const body: any = { name };
      if (permission) body.permission = permission;
      if (domain_id) body.domain_id = domain_id;
      const data = await rateLimitedFetch("/api-keys", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **API key created**\n\n${formatApiKey(data)}\n\n⚠️ **Save the token now — it will not be shown again.**`,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: list_api_keys ──
server.tool(
  "list_api_keys",
  "List all API keys in your Resend account (tokens are hidden)",
  {},
  async () => {
    try {
      const data = await rateLimitedFetch("/api-keys");
      const keys = data.data || [];
      if (keys.length === 0) {
        return { content: [{ type: "text" as const, text: "No API keys found." }] };
      }
      const lines = keys.map((k: any, i: number) =>
        `**${i + 1}. ${k.name}** — ID: \`${k.id}\` | Created: ${k.created_at || "N/A"}`
      );
      return {
        content: [
          { type: "text" as const, text: `**🔑 API Keys (${keys.length}):**\n\n${lines.join("\n")}` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: list_contacts ──
server.tool(
  "list_contacts",
  "List contacts in a Resend audience",
  {
    audience_id: z.string().describe("Audience ID (e.g. from your Resend dashboard)"),
    limit: z.number().optional().default(20).describe("Max contacts to return (default 20)"),
  },
  async ({ audience_id, limit }) => {
    try {
      const data = await rateLimitedFetch(
        `/audiences/${audience_id}/contacts?limit=${Math.min(limit, 100)}`
      );
      const contacts = data.data || [];
      if (contacts.length === 0) {
        return { content: [{ type: "text" as const, text: "No contacts found." }] };
      }
      const lines = contacts.map((c: any, i: number) => {
        const name = `${c.first_name || ""}${c.last_name ? " " + c.last_name : ""}`.trim() || "(no name)";
        return `**${i + 1}. ${name}** <${c.email}> — ${c.unsubscribed ? "Unsubscribed" : "Subscribed"} | ID: \`${c.id}\``;
      });
      return {
        content: [
          { type: "text" as const, text: `**👥 Contacts (${contacts.length}):**\n\n${lines.join("\n")}` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: create_contact ──
server.tool(
  "create_contact",
  "Add a new contact to a Resend audience",
  {
    audience_id: z.string().describe("Audience ID"),
    email: z.string().email().describe("Contact email address"),
    first_name: z.string().optional().describe("First name"),
    last_name: z.string().optional().describe("Last name"),
    unsubscribed: z.boolean().optional().default(false).describe("Whether the contact is unsubscribed"),
  },
  async ({ audience_id, email, first_name, last_name, unsubscribed }) => {
    try {
      const body: any = { email };
      if (first_name) body.first_name = first_name;
      if (last_name) body.last_name = last_name;
      if (unsubscribed !== undefined) body.unsubscribed = unsubscribed;
      const data = await rateLimitedFetch(`/audiences/${audience_id}/contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Contact created**\n\n${formatContact(data)}`,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: send_batch_email ──
server.tool(
  "send_batch_email",
  "Send multiple transactional emails in a single API call (up to 100)",
  {
    emails: z
      .array(
        z.object({
          from: z.string().describe("Sender address"),
          to: z.union([z.string(), z.array(z.string())]).describe("Recipient(s)"),
          subject: z.string().describe("Subject line"),
          html: z.string().optional().describe("HTML body"),
          text: z.string().optional().describe("Plain text body"),
          cc: z.union([z.string(), z.array(z.string())]).optional(),
          bcc: z.union([z.string(), z.array(z.string())]).optional(),
          reply_to: z.union([z.string(), z.array(z.string())]).optional(),
        })
      )
      .min(1)
      .max(100)
      .describe("Array of email objects (1-100)"),
  },
  async ({ emails }) => {
    try {
      const body = emails.map((e) => {
        const item: any = { from: e.from, to: e.to, subject: e.subject };
        if (e.html) item.html = e.html;
        if (e.text) item.text = e.text;
        if (e.cc) item.cc = e.cc;
        if (e.bcc) item.bcc = e.bcc;
        if (e.reply_to) item.reply_to = e.reply_to;
        return item;
      });
      const data = await rateLimitedFetch("/emails/batch", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const ids = (data.data || []).map((r: any) => r.id).filter(Boolean);
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Batch sent** — ${ids.length} email(s)\n\nIDs: ${ids.map((id: string) => `\`${id}\``).join(", ")}`,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: list_audiences ──
server.tool(
  "list_audiences",
  "List all audiences in your Resend account",
  {
    limit: z.number().optional().default(20).describe("Max audiences to return (default 20)"),
  },
  async ({ limit }) => {
    try {
      const data = await rateLimitedFetch(`/audiences?limit=${Math.min(limit, 100)}`);
      const audiences = data.data || [];
      if (audiences.length === 0) {
        return { content: [{ type: "text" as const, text: "No audiences found." }] };
      }
      const lines = audiences.map(
        (a: any, i: number) =>
          `**${i + 1}. ${a.name}** — ID: \`${a.id}\` | Created: ${a.created_at || "N/A"}`
      );
      return {
        content: [
          { type: "text" as const, text: `**📋 Audiences (${audiences.length}):**\n\n${lines.join("\n")}` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: create_audience ──
server.tool(
  "create_audience",
  "Create a new audience for organizing contacts",
  {
    name: z.string().describe("Audience name (e.g. 'Newsletter Subscribers')"),
  },
  async ({ name }) => {
    try {
      const data = await rateLimitedFetch("/audiences", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Audience created**\n\n- **Name:** ${data.name}\n- **ID:** \`${data.id}\``,
          },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: get_contact ──
server.tool(
  "get_contact",
  "Get details about a specific contact by ID",
  {
    audience_id: z.string().describe("Audience ID"),
    contact_id: z.string().describe("Contact ID"),
  },
  async ({ audience_id, contact_id }) => {
    try {
      const data = await rateLimitedFetch(`/audiences/${audience_id}/contacts/${contact_id}`);
      return { content: [{ type: "text" as const, text: formatContact(data) }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: update_contact ──
server.tool(
  "update_contact",
  "Update an existing contact's properties",
  {
    audience_id: z.string().describe("Audience ID"),
    contact_id: z.string().describe("Contact ID"),
    email: z.string().email().optional().describe("New email address"),
    first_name: z.string().optional().describe("New first name"),
    last_name: z.string().optional().describe("New last name"),
    unsubscribed: z.boolean().optional().describe("Unsubscribe status"),
  },
  async ({ audience_id, contact_id, email, first_name, last_name, unsubscribed }) => {
    try {
      const body: any = {};
      if (email) body.email = email;
      if (first_name !== undefined) body.first_name = first_name;
      if (last_name !== undefined) body.last_name = last_name;
      if (unsubscribed !== undefined) body.unsubscribed = unsubscribed;
      if (Object.keys(body).length === 0) {
        return { content: [{ type: "text" as const, text: "Error: Provide at least one field to update." }] };
      }
      await rateLimitedFetch(`/audiences/${audience_id}/contacts/${contact_id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return {
        content: [
          { type: "text" as const, text: `✅ **Contact updated**\n\n- Audience: \`${audience_id}\`\n- Contact: \`${contact_id}\`` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: delete_contact ──
server.tool(
  "delete_contact",
  "Remove a contact from an audience",
  {
    audience_id: z.string().describe("Audience ID"),
    contact_id: z.string().describe("Contact ID"),
  },
  async ({ audience_id, contact_id }) => {
    try {
      await rateLimitedFetch(`/audiences/${audience_id}/contacts/${contact_id}`, {
        method: "DELETE",
      });
      return {
        content: [
          { type: "text" as const, text: `✅ **Contact deleted**\n\n- Audience: \`${audience_id}\`\n- Contact: \`${contact_id}\`` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: delete_api_key ──
server.tool(
  "delete_api_key",
  "Delete a Resend API key by ID",
  {
    key_id: z.string().describe("API key ID (from list_api_keys)"),
  },
  async ({ key_id }) => {
    try {
      await rateLimitedFetch(`/api-keys/${key_id}`, { method: "DELETE" });
      return {
        content: [
          { type: "text" as const, text: `✅ **API key deleted** — \`${key_id}\`` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// ── Tool: delete_domain ──
server.tool(
  "delete_domain",
  "Remove a sending domain from your Resend account",
  {
    domain_id: z.string().describe("Domain ID (from list_domains)"),
  },
  async ({ domain_id }) => {
    try {
      await rateLimitedFetch(`/domains/${domain_id}`, { method: "DELETE" });
      return {
        content: [
          { type: "text" as const, text: `✅ **Domain deleted** — \`${domain_id}\`` },
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
