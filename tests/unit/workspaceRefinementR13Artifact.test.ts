import { cp, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { snapshotCandidate, verifyFrozenCandidate, verifyServedFrontend } from '../../scripts/refinement-artifact.mjs';
import { vi } from 'vitest';

it('binds frontend, gateway, migrations and tests without packaging server secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eflow-r13-artifact-'));
  try {
    for (const directory of ['dist', 'server', 'supabase/migrations', 'src', 'scripts', 'tests', '.github/workflows']) await mkdir(join(root, directory), { recursive: true });
    await writeFile(join(root, '.github/workflows/release.yml'), 'fixture gate');
    for (const path of ['dist/index.html', 'dist/eflow-view-modules.json', 'server/main.py', 'src/app.ts', 'supabase/migrations/fixture.sql', 'package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts', 'playwright.release.config.ts', 'playwright.refinement.config.ts', 'tests/flow.ts']) await writeFile(join(root, path), 'fixture');
    await writeFile(join(root, 'server/.env'), 'PRIVATE_SECRET=never-package');
    const initial = await snapshotCandidate(root);
    await writeFile(join(root, '.github/workflows/release.yml'), 'changed gate');
    expect((await snapshotCandidate(root)).id).not.toBe(initial.id);
    await writeFile(join(root, '.github/workflows/release.yml'), 'fixture gate');
    expect(initial.gateway.map(file => file.path)).toEqual(['server/main.py']);
    expect(JSON.stringify(initial)).not.toContain('never-package');
    const archived = join(root, '.refinement/artifacts', initial.id);
    await mkdir(join(archived, 'gateway'), { recursive: true });
    await cp(join(root, 'dist'), join(archived, 'frontend'), { recursive: true });
    await cp(join(root, 'server/main.py'), join(archived, 'gateway/main.py'));
    await verifyFrozenCandidate(root, initial);
    await writeFile(join(archived, 'gateway/main.py'), 'mismatched gateway');
    await expect(verifyFrozenCandidate(root, initial)).rejects.toThrow('Frozen gateway');
    const fetchMock = vi.fn().mockImplementation(async () => new Response('fixture'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await verifyServedFrontend('http://localhost:5175', initial);
      fetchMock.mockResolvedValue(new Response('different artifact'));
      await expect(verifyServedFrontend('http://localhost:5175', initial)).rejects.toThrow('Preview');
    } finally { vi.unstubAllGlobals(); }
    await writeFile(join(root, 'tests/flow.ts'), 'changed authority test');
    expect((await snapshotCandidate(root)).id).not.toBe(initial.id);
    await writeFile(join(root, 'dist/index.html'), 'changed frontend');
    expect((await snapshotCandidate(root)).frontend).not.toEqual(initial.frontend);
    await rm(join(root, 'dist/eflow-view-modules.json'));
    await expect(snapshotCandidate(root)).rejects.toThrow('complete production build');
  } finally { await rm(root, { recursive: true, force: true }); }
});
