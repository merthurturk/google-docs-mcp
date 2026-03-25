import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import * as fs from 'fs';
import * as path from 'path';

export function register(server: FastMCP) {
  server.addTool({
    name: 'gmailDownloadAttachment',
    description:
      'Downloads a Gmail attachment to a local file. First use gmailReadMessage to get the attachment metadata (filename, size), then use this tool with the messageId to download. Returns the local file path.',
    parameters: z.object({
      messageId: z
        .string()
        .describe('The message ID containing the attachment.'),
      filename: z
        .string()
        .describe('The filename of the attachment to download (from gmailReadMessage attachments list).'),
      savePath: z
        .string()
        .optional()
        .describe('Optional absolute path to save the file. If not provided, saves to /tmp/ with the original filename.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();

      // Get the message to find the attachment ID
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: args.messageId,
        format: 'full',
      });

      // Find the attachment ID by filename
      let attachmentId: string | null = null;
      let attachmentFilename: string = args.filename;

      function findAttachment(part: any) {
        if (part.filename === args.filename && part.body?.attachmentId) {
          attachmentId = part.body.attachmentId;
        }
        if (part.parts) {
          for (const sub of part.parts) findAttachment(sub);
        }
      }

      if (res.data.payload) findAttachment(res.data.payload);

      if (!attachmentId) {
        // Try partial match
        function findPartialAttachment(part: any) {
          if (part.filename && part.filename.includes(args.filename) && part.body?.attachmentId) {
            attachmentId = part.body.attachmentId;
            attachmentFilename = part.filename;
          }
          if (part.parts) {
            for (const sub of part.parts) findPartialAttachment(sub);
          }
        }
        if (res.data.payload) findPartialAttachment(res.data.payload);
      }

      if (!attachmentId) {
        throw new UserError(`Attachment "${args.filename}" not found in message ${args.messageId}.`);
      }

      // Download the attachment
      const attachmentRes = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: args.messageId,
        id: attachmentId,
      });

      if (!attachmentRes.data.data) {
        throw new UserError('Attachment data is empty.');
      }

      // Decode base64url data
      const content = Buffer.from(attachmentRes.data.data, 'base64url');

      // Determine save path
      const outputPath = args.savePath || path.join('/tmp', attachmentFilename);

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, content);

      return JSON.stringify({
        success: true,
        filename: attachmentFilename,
        path: outputPath,
        size: content.length,
      });
    },
  });
}
