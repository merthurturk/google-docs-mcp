import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailArchiveThreads',
    description:
      'Archives Gmail threads by removing the INBOX label. Accepts one or more thread IDs. Archived threads remain searchable but leave the inbox.',
    parameters: z.object({
      threadIds: z
        .array(z.string())
        .min(1)
        .describe('Array of Gmail thread IDs to archive.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      const results: Array<{ threadId: string; success: boolean; error?: string }> = [];

      for (const threadId of args.threadIds) {
        try {
          await gmail.users.threads.modify({
            userId: 'me',
            id: threadId,
            requestBody: {
              removeLabelIds: ['INBOX'],
            },
          });
          results.push({ threadId, success: true });
          log.info(`Archived thread ${threadId}`);
        } catch (error: any) {
          const msg = error.message || 'Unknown error';
          results.push({ threadId, success: false, error: msg });
          log.error(`Failed to archive thread ${threadId}: ${msg}`);
        }
      }

      const archived = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return JSON.stringify(
        {
          summary: `Archived ${archived} thread(s)${failed > 0 ? `, ${failed} failed` : ''}.`,
          results,
        },
        null,
        2
      );
    },
  });
}
