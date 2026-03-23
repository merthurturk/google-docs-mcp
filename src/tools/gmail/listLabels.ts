import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailListLabels',
    description:
      'Lists all Gmail labels (system and user-created). Use the returned label IDs with gmailModifyThreadLabels.',
    parameters: z.object({}),
    execute: async (_args, { log }) => {
      const gmail = await getGmailClient();

      try {
        const res = await gmail.users.labels.list({ userId: 'me' });
        const labels = (res.data.labels || []).map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
        }));

        log.info(`Found ${labels.length} labels`);

        return JSON.stringify({ labels }, null, 2);
      } catch (error: any) {
        log.error(`Error listing labels: ${error.message || error}`);
        throw new UserError(`Failed to list labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
