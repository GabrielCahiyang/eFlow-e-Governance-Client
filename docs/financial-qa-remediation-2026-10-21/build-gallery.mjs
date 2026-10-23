import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const escape = text => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
async function walk(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute));
    else if (/\.(jpg|png)$/i.test(entry.name)) result.push(absolute);
  }
  return result;
}
const images = (await walk(path.join(root, 'screenshots'))).sort();
const latest = `<p><strong>Latest Office tasks layout:</strong> <a href="OFFICE_TASK_TABLE_RESPONSIVE.md">responsive table fix and checks</a> · <a href="screenshots/isolated-browser/office-task-table/office-tasks-1440-100.png">1440px at 100%</a> · <a href="screenshots/isolated-browser/office-task-table/office-tasks-1920-125.png">1920px at 125%</a> · <a href="screenshots/isolated-browser/office-task-table/office-tasks-1920-200.png">1920px at 200%</a>. Earlier screenshots below remain historical evidence.</p>`;
const officeTeam = `<p><strong>Office Team connection fix:</strong> <a href="OFFICE_TEAM_CONNECTION_FIX.md">cause, fix and live read checks</a> · <a href="screenshots/isolated-browser/office-team/office-team-members-recovered.png">desktop members recovery</a> · <a href="screenshots/isolated-browser/office-team/office-team-invitations-recovered.png">desktop invitations recovery</a>. These two screenshots use isolated fixtures; the report separately records live database reads.</p>`;
const figures = officeTeam + latest + images.map((file, index) => {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const label = path.basename(file).replace(/\.(jpg|png)$/i, '').replaceAll('-', ' ');
  return `<figure><figcaption>${index + 1}. ${escape(label)}</figcaption><a href="${escape(relative)}" target="_blank" rel="noopener"><img src="${escape(relative)}" loading="lazy" alt="${escape(label)}"></a></figure>`;
}).join('\n');
await writeFile(path.join(root, 'GALLERY.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>eFlow financial remediation screenshots</title><style>body{font:16px system-ui;color:#173239;background:#f1f6f6;margin:0}main{max-width:1480px;margin:auto;padding:28px}a{color:#086f6a}h1{font-size:28px}figure{margin:24px 0;background:white;border:1px solid #cbdcdd;border-radius:12px;overflow:hidden}figcaption{padding:16px;font-weight:600}img{display:block;max-width:100%;height:auto;margin:auto}p{line-height:1.6}</style><main><h1>Financial remediation — ${images.length} screenshots</h1><p>22 October 2026. Images named live-desktop show the actual hosted-backed system with the current local frontend. Financial observations were read-only; live-desktop-ai images include authorized labeled QA project/task and staffing changes. Other images use synthetic, network-isolated browser fixtures against local production builds. Neither is a new hosted settlement acceptance or physical-device receipt. <a href="REPORT.md">Report</a> · <a href="STATUS.md">Status</a> · <a href="REMAINING_GAPS.md">Remaining gaps</a> · <a href="../live-financial-workflow-2026-10-21/GALLERY.html">Original 45-image live audit</a></p>${figures}</main></html>`, 'utf8');
console.log(`Generated gallery with ${images.length} images.`);
