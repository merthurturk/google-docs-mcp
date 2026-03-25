import type { FastMCP } from 'fastmcp';
import { register as archiveThreads } from './archiveThreads.js';
import { register as modifyThreadLabels } from './modifyThreadLabels.js';
import { register as listLabels } from './listLabels.js';
import { register as searchMessages } from './searchMessages.js';
import { register as readMessage } from './readMessage.js';
import { register as downloadAttachment } from './downloadAttachment.js';

export function registerGmailTools(server: FastMCP) {
  archiveThreads(server);
  modifyThreadLabels(server);
  listLabels(server);
  searchMessages(server);
  readMessage(server);
  downloadAttachment(server);
}
