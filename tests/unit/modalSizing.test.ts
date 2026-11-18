import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {expect, it} from 'vitest';
import {modalWidth} from '../../src/app/components/ui/modalSizing';

it('retains requested form widths instead of squeezing wide forms into medium Vibe presets', () => {
  expect(modalWidth('max-w-lg')).toBe(512);
  expect(modalWidth('max-w-2xl')).toBe(672);
  expect(modalWidth('max-w-5xl')).toBe(1024);
  expect(modalWidth('max-w-[900px]')).toBe(900);
  expect(modalWidth('max-w-[99999px]')).toBe(1600);
});

it('keeps Vibe modal bodies and horizontal table scrollers free of nested vertical scroll traps', () => {
  const readCss = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
  const controlsCss = readCss('src/styles/foundation-controls.css');
  const modalBodyRule = controlsCss.match(/\.eflow-vibe-modal-content\s*\{[^}]*\}/)?.[0] ?? '';
  expect(modalBodyRule).toContain('overflow: visible');
  expect(modalBodyRule).not.toContain('overscroll-behavior: contain');

  const taskPageCss = readCss('src/app/features/task-inspector/components/taskPage.css');
  expect(taskPageCss).toContain('.eflow-vibe-modal-layout.task-dialog-modal>:has(>.task-dialog-modal__body)');
  expect(taskPageCss).toMatch(/\.task-page__tabs\{[^}]*overflow-x:auto;overflow-y:hidden/);
  expect(taskPageCss).toMatch(/\.task-drawer__tabs\{[^}]*overflow-x:auto;overflow-y:hidden/);

  const projectTableCss = readCss('src/app/features/project-table/projectTable.css');
  expect(projectTableCss).toMatch(/\.pt-table-scroll\{[^}]*overflow-x:auto;overflow-y:hidden/);
  expect(projectTableCss).toMatch(/\.pt-subitems-table-scroll\s*\{[^}]*overflow-x:auto;\s*overflow-y:hidden/);

  const hierarchyCss = readCss('src/app/features/nested-work/workHierarchy.css');
  expect(hierarchyCss).toMatch(/\.nw-hierarchy-table-scroll\s*\{[^}]*overflow-x:\s*auto;\s*overflow-y:\s*hidden/);
});

it('contains screen-reader-only absolute elements inside the app shell instead of creating page bottom scroll gaps', () => {
  const readSource = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
  const shellCss = readSource('src/app/features/app-shell/eflowAppShell.css');
  expect(shellCss).toMatch(/\.eflow-app-shell\s*\{[^}]*position:\s*relative[^}]*overflow:\s*clip/);
  expect(shellCss).toMatch(/html:has\(\.eflow-app-shell\),\s*body:has\(\.eflow-app-shell\)\s*\{[^}]*overflow:\s*clip/);
  expect(shellCss).toMatch(/\.eflow-app-shell__workspace\s*\{[^}]*position:\s*relative/);

  const navCss = readSource('src/app/features/app-shell/navigationV2.css');
  expect(navCss).toMatch(/\.eflow-app-shell__desktop-navigation\s*\{[^}]*position:\s*relative/);

  const nestedCss = readSource('src/app/features/nested-work/nestedWork.css');
  expect(nestedCss).toMatch(/\.r7-work\{[^}]*position:\s*relative/);
  expect(nestedCss).toMatch(/\.r7-owner-summary--avatars\{[^}]*position:\s*relative/);

  const skeletonsTsx = readSource('src/app/components/ui/SurfaceSkeletons.tsx');
  expect(skeletonsTsx).toContain('relative inline-block');
  expect(skeletonsTsx).toContain("className.includes('fixed') ? className : `relative ${className}`");
});
