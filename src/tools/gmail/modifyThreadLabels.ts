import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailModifyThreadLabels',
    description:
      'Add or remove labels from Gmail threads. Use to archive (remove INBOX), mark read (remove UNREAD), star, categorize, or apply custom labels. Call gmailListLabels first to get valid label IDs.',
    parameters: z.object({
      threadIds: z
        .array(z.string())
        .min(1)
        .describe('Array of Gmail thread IDs to modify.'),
      addLabelIds: z
        .array(z.string())
        .optional()
        .describe('Label IDs to add (e.g. ["STARRED", "Label_123"]).'),
      removeLabelIds: z
        .array(z.string())
        .optional()
        .describe('Label IDs to remove (e.g. ["INBOX", "UNREAD"]).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();

      if (!args.addLabelIds?.length && !args.removeLabelIds?.length) {
        throw new UserError('Must specify at least one of addLabelIds or removeLabelIds.');
      }

      const results: Array<{ threadId: string; success: boolean; error?: string }> = [];

      for (const threadId of args.threadIds) {
        try {
          await gmail.users.threads.modify({
            userId: 'me',
            id: threadId,
            requestBody: {
              addLabelIds: args.addLabelIds || [],
              removeLabelIds: args.removeLabelIds || [],
            },
          });
          results.push({ threadId, success: true });
          log.info(`Modified labels on thread ${threadId}`);
        } catch (error: any) {
          const msg = error.message || 'Unknown error';
          results.push({ threadId, success: false, error: msg });
          log.error(`Failed to modify thread ${threadId}: ${msg}`);
        }
      }

      const modified = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return JSON.stringify(
        {
          summary: `Modified ${modified} thread(s)${failed > 0 ? `, ${failed} failed` : ''}.`,
          results,
        },
        null,
        2
      );
    },
  });
}
