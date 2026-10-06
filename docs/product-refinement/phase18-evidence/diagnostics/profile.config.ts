import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
export default defineConfig(base, { testDir: '.', testMatch: 'filter-profile.spec.ts', webServer: undefined, workers: 1, reporter: 'list', outputDir: 'profile-results' });
