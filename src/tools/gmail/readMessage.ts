import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailReadMessage',
    description:
      'Retrieves the full content of a Gmail message by ID, including headers, plain text body, and attachment metadata.',
    parameters: z.object({
      messageId: z
        .string()
        .describe('The message ID (from gmailSearchMessages results).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();

      const res = await gmail.users.messages.get({
        userId: 'me',
        id: args.messageId,
        format: 'full',
      });

      const headers: Record<string, string> = {};
      for (const h of res.data.payload?.headers || []) {
        if (h.name && h.value) headers[h.name] = h.value;
      }

      // Extract plain text body
      let body = '';
      const payload = res.data.payload;

      function extractText(part: any): string {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64url').toString('utf-8');
        }
        if (part.parts) {
          for (const sub of part.parts) {
            const text = extractText(sub);
            if (text) return text;
          }
        }
        return '';
      }

      if (payload) {
        body = extractText(payload);
        // Fallback to HTML if no plain text
        if (!body) {
          function extractHtml(part: any): string {
            if (part.mimeType === 'text/html' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64url').toString('utf-8');
            }
            if (part.parts) {
              for (const sub of part.parts) {
                const html = extractHtml(sub);
                if (html) return html;
              }
            }
            return '';
          }
          body = extractHtml(payload);
        }
      }

      // Extract attachment info
      const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
      function findAttachments(part: any) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
          });
        }
        if (part.parts) {
          for (const sub of part.parts) findAttachments(sub);
        }
      }
      if (payload) findAttachments(payload);

      return JSON.stringify(
        {
          messageId: res.data.id,
          threadId: res.data.threadId,
          labelIds: res.data.labelIds || [],
          snippet: res.data.snippet,
          headers,
          body: body.substring(0, 10000), // Cap at 10k chars
          ...(attachments.length > 0 ? { attachments } : {}),
        },
        null,
        2
      );
    },
  });
}
