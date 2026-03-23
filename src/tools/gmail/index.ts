import type { FastMCP } from 'fastmcp';
import { register as archiveThreads } from './archiveThreads.js';
import { register as modifyThreadLabels } from './modifyThreadLabels.js';
import { register as listLabels } from './listLabels.js';

export function registerGmailTools(server: FastMCP) {
  archiveThreads(server);
  modifyThreadLabels(server);
  listLabels(server);
}
