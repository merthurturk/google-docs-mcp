import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';
import * as fs from 'fs';
import * as path from 'path';

export function register(server: FastMCP) {
  server.addTool({
    name: 'uploadFile',
    description:
      'Uploads a local file to Google Drive. Places it in the specified folder or Drive root.',
    parameters: z.object({
      localPath: z
        .string()
        .min(1)
        .describe('Absolute path to the local file to upload.'),
      parentFolderId: z
        .string()
        .optional()
        .describe(
          'ID of the destination folder in Google Drive. If not provided, uploads to Drive root.'
        ),
      name: z
        .string()
        .optional()
        .describe(
          'Name for the file in Drive. If not provided, uses the local filename.'
        ),
      mimeType: z
        .string()
        .optional()
        .describe(
          'MIME type of the file. If not provided, it will be auto-detected from the file extension.'
        ),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();

      if (!fs.existsSync(args.localPath)) {
        throw new UserError(`File not found: ${args.localPath}`);
      }

      const fileName = args.name || path.basename(args.localPath);
      const stats = fs.statSync(args.localPath);

      log.info(
        `Uploading "${fileName}" (${(stats.size / 1024).toFixed(1)} KB) to ${args.parentFolderId || 'root'}`
      );

      try {
        const fileMetadata: Record<string, any> = {
          name: fileName,
        };

        if (args.parentFolderId) {
          fileMetadata.parents = [args.parentFolderId];
        }

        const media = {
          mimeType: args.mimeType || getMimeType(args.localPath),
          body: fs.createReadStream(args.localPath),
        };

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id,name,parents,webViewLink,size',
          supportsAllDrives: true,
        });

        const file = response.data;
        return JSON.stringify(
          {
            id: file.id,
            name: file.name,
            size: file.size,
            url: file.webViewLink,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error uploading file: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(
            'Destination folder not found. Check the folder ID.'
          );
        if (error.code === 403)
          throw new UserError(
            'Permission denied. Make sure you have write access to the destination folder.'
          );
        throw new UserError(
          `Failed to upload file: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
