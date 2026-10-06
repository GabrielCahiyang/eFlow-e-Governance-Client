import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
const { webServer: _server, ...shared } = base;
export default defineConfig(shared, { testDir: '.', testMatch: 'filter-timing.spec.ts', webServer: undefined, workers: 1, reporter: 'list', outputDir: 'filter-timing-results' });
