import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailSearchMessages',
    description:
      'Searches Gmail messages using Gmail search syntax (e.g. "is:unread in:inbox", "from:user@example.com", "subject:meeting"). Returns message metadata including id, threadId, snippet, labels, and headers (From, To, Subject, Date). Use pageToken for pagination.',
    parameters: z.object({
      q: z
        .string()
        .optional()
        .describe(
          'Gmail search query. Examples: "is:unread in:inbox", "from:boss@company.com", "subject:invoice after:2026/01/01"'
        ),
      maxResults: z
        .number()
        .min(1)
        .max(500)
        .optional()
        .default(20)
        .describe('Maximum messages to return per request (1-500). Default: 20.'),
      pageToken: z
        .string()
        .optional()
        .describe('Token from previous response to retrieve next page of results.'),
      includeSpamTrash: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include messages from SPAM and TRASH. Default: false.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: args.q || undefined,
        maxResults: args.maxResults,
        pageToken: args.pageToken || undefined,
        includeSpamTrash: args.includeSpamTrash,
      });

      const messageIds = listRes.data.messages || [];
      const nextPageToken = listRes.data.nextPageToken || undefined;
      const resultSizeEstimate = listRes.data.resultSizeEstimate || 0;

      if (messageIds.length === 0) {
        return JSON.stringify({ messages: [], resultSizeEstimate: 0 }, null, 2);
      }

      const messages = await Promise.all(
        messageIds.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Cc'],
            });

            const headers: Record<string, string> = {};
            for (const h of detail.data.payload?.headers || []) {
              if (h.name && h.value) headers[h.name] = h.value;
            }

            return {
              messageId: detail.data.id,
              threadId: detail.data.threadId,
              labelIds: detail.data.labelIds || [],
              snippet: detail.data.snippet || '',
              internalDate: detail.data.internalDate,
              sizeEstimate: detail.data.sizeEstimate,
              headers,
            };
          } catch (error: any) {
            log.error(`Failed to fetch message ${msg.id}: ${error.message}`);
            return {
              messageId: msg.id,
              threadId: msg.threadId,
              error: error.message,
            };
          }
        })
      );

      return JSON.stringify(
        {
          messages,
          ...(nextPageToken ? { nextPageToken } : {}),
          resultSizeEstimate,
        },
        null,
        2
      );
    },
  });
}
