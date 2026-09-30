// Runs the BTG skin fully mocked: mock API + `next dev` pointed at it. No
// database, Google account or OpenAI key needed. Standalone on purpose, so the
// skin adds no scripts to the project's package.json files:
//
//   node apps/web/btg/mock/dev.mjs
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startMockApi } from './server.mjs';

const WEB_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const API_PORT = Number(process.env.MOCK_API_PORT ?? 3999);

// The web app resolves @ics-select/shared from its dist/ build.
if (!existsSync(new URL('packages/shared/dist/index.js', `file://${REPO_ROOT}`))) {
  spawnSync('pnpm', ['--filter', '@ics-select/shared', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
}

const api = startMockApi(API_PORT);
const next = spawn('pnpm', ['exec', 'next', 'dev', '--turbopack', '-p', '3000'], {
  cwd: WEB_DIR,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
});

console.log('[btg-mock] Abra http://localhost:3000/btg-poc (membro) ou http://localhost:3000/btgadmin-poc (admin)');

const stop = () => {
  api.close();
  next.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
next.on('exit', (code) => {
  api.close();
  process.exit(code ?? 0);
});
