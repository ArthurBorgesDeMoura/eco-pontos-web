import { PlaywrightTestOptions, defineConfig } from '@playwright/test';

const porta = 4300;
const portaSemBackend = 4301;
const SEM_BACKEND = /sem-backend\.spec\.ts$/;
const DO_FE_15 = /fe-15-(telas|teclado|movimento|leitor)\.spec\.ts$/;
const API_DESLIGADA = 'http://127.0.0.1:9';

type Navegador = Pick<PlaywrightTestOptions, 'browserName' | 'channel'>;
const CHROME: Navegador = { browserName: 'chromium', channel: 'chrome' };
const EDGE: Navegador = { browserName: 'chromium', channel: 'msedge' };
const FIREFOX: Navegador = { browserName: 'firefox', channel: undefined };
const NAVEGADORES: Record<string, Navegador> = { chrome: CHROME, msedge: EDGE, firefox: FIREFOX };
const PRINCIPAL = NAVEGADORES[process.env['ECOPONTO_NAVEGADOR'] ?? 'chrome'] ?? CHROME;

const CELULAR = { viewport: { width: 390, height: 844 }, hasTouch: true };
const TABLET = { viewport: { width: 768, height: 1024 }, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  workers: 5,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${porta}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'celular', testIgnore: SEM_BACKEND, use: { ...PRINCIPAL, ...CELULAR } },
    { name: 'tablet', testIgnore: SEM_BACKEND, use: { ...PRINCIPAL, ...TABLET } },
    { name: 'desktop', testIgnore: SEM_BACKEND, use: { ...PRINCIPAL, ...DESKTOP } },
    {
      name: 'sem-backend',
      testMatch: SEM_BACKEND,
      use: { ...PRINCIPAL, baseURL: `http://localhost:${portaSemBackend}`, ...DESKTOP },
    },
    { name: 'firefox-celular', testMatch: DO_FE_15, use: { ...FIREFOX, ...CELULAR } },
    { name: 'firefox-desktop', testMatch: DO_FE_15, use: { ...FIREFOX, ...DESKTOP } },
    { name: 'edge-celular', testMatch: DO_FE_15, use: { ...EDGE, ...CELULAR } },
    { name: 'edge-desktop', testMatch: DO_FE_15, use: { ...EDGE, ...DESKTOP } },
  ],
  webServer: [
    {
      command: `npx ng serve --configuration simulacao --port ${porta}`,
      url: `http://localhost:${porta}/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 240_000,
      env: { ECOPONTO_API_URL: API_DESLIGADA, NG_CLI_ANALYTICS: 'false' },
    },
    {
      command: `npx ng serve --configuration development --port ${portaSemBackend}`,
      url: `http://localhost:${portaSemBackend}/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 240_000,
      env: { ECOPONTO_API_URL: API_DESLIGADA, NG_CLI_ANALYTICS: 'false', NG_PERSISTENT_BUILD_CACHE: '0' },
      stderr: 'ignore',
    },
  ],
});
