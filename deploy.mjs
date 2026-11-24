// Lägger ut dist/ på Vercel via Composio (composio proxy -t vercel).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const TEAM = 'team_mqTdFSQ7eSm9bv4nyBDo0MST';
const filer = [];
(function gaa(d) { for (const n of readdirSync(d)) { const p = `${d}/${n}`; if (statSync(p).isDirectory()) gaa(p); else filer.push(p); } })('dist');
const kropp = {
  name: 'bostadskoll', target: 'production',
  projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
  files: filer.map((f) => ({ file: f.slice(5), data: readFileSync(f).toString('base64'), encoding: 'base64' })),
};
writeFileSync('/tmp/bk-deploy.json', JSON.stringify(kropp));
const ut = execFileSync('composio', ['proxy', '-t', 'vercel', '-X', 'POST', `https://api.vercel.com/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1`, '-H', 'content-type: application/json', '-d', '@/tmp/bk-deploy.json'], { encoding: 'utf8', maxBuffer: 1e8 });
console.log(ut.slice(0, 1500));
