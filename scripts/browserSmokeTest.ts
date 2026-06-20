import assert from 'node:assert/strict';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

import { BrowserType, chromium, firefox, Page } from 'playwright';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const VITE_BIN = 'node_modules/vite/bin/vite.js';
const EDGE_PATHS = [
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

interface BrowserRun {
  name: string;
  browserType: BrowserType;
  launchOptions?: Parameters<BrowserType['launch']>[0];
}

function runCommand(command: string, args: string[], env = process.env) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: 'pipe',
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed:\n${output}`));
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);

      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Preview server did not start: ${String(lastError)}`);
}

function startPreviewServer() {
  const child = spawn(
    process.execPath,
    [VITE_BIN, 'preview', `--port=${PORT}`, '--host=127.0.0.1'],
    {
      shell: false,
      stdio: 'ignore',
    }
  );

  return child;
}

function stopProcessTree(child: ChildProcess | null) {
  if (!child?.pid) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  child.kill();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

async function clickFirstAvailable(page: Page, names: string[]) {
  for (const name of names) {
    const button = page
      .getByRole('button', { name, exact: true })
      .filter({ visible: true });
    const count = await button.count();

    if (count > 0) {
      await button.first().click({ timeout: 5000 });
      return name;
    }
  }

  throw new Error(`None of these buttons were found: ${names.join(', ')}`);
}

async function readMainState(page: Page) {
  return page.evaluate(() => {
    const text = document.querySelector('main')?.textContent || '';

    return {
      text,
      articleCount: document.querySelectorAll('main article').length,
      horizontalOverflow:
        document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });
}

function isExpectedLocalFallbackConsoleError(message: string) {
  const normalizedMessage = message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (
    normalizedMessage.includes(
      'erro ao carregar configuracao da bolsa campeao'
    )
  ) {
    return true;
  }

  return (
    message.includes('Erro ao carregar configuração da Bolsa Campeão') &&
    message.includes('Missing or insufficient permissions')
  );
}

async function smokePage(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  const home = await readMainState(page);
  assert.equal(home.horizontalOverflow, false);
  assert.ok(
    home.text.includes('Bolão sincronizado') ||
      home.text.includes('Como o bolão funciona')
  );
  assert.ok(home.text.includes('Prêmio total'));

  await clickFirstAvailable(page, ['Meus Palpites', 'Palpites']);
  await page.waitForTimeout(500);

  const matches = await readMainState(page);
  assert.equal(matches.horizontalOverflow, false);
  assert.ok(matches.text.includes('Todos ('));
  assert.ok(matches.text.includes('Copiar todos'));
  assert.ok(
    matches.text.includes('Mostrando') ||
      matches.text.includes('Nenhuma partida')
  );

  await clickFirstAvailable(page, ['Classificação', 'Ranking']);
  await page.waitForTimeout(500);

  const ranking = await readMainState(page);
  assert.equal(ranking.horizontalOverflow, false);
  assert.ok(ranking.text.includes('Classificação geral'));
  assert.ok(ranking.text.includes('Conferência de palpites'));
  assert.ok(
    ranking.text.includes('Mostrando') ||
      ranking.text.includes('Nenhum palpite')
  );
}

async function smokeClipboard(page: Page) {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await clickFirstAvailable(page, ['Meus Palpites', 'Palpites']);
  await page.waitForTimeout(500);
  await page
    .getByRole('button', { name: 'Copiar todos', exact: true })
    .filter({ visible: true })
    .first()
    .click({ timeout: 5000 });
  await page.waitForTimeout(500);

  return page.evaluate(async () => {
    if (!navigator.clipboard) return 'clipboard-unavailable';

    return navigator.clipboard.readText();
  });
}

async function runBrowserSmoke(run: BrowserRun) {
  console.log(`[browser-smoke] ${run.name}: launching`);
  const browser = await run.browserType.launch({
    headless: true,
    timeout: 30000,
    ...run.launchOptions,
  });
  const browserErrors: string[] = [];

  try {
    const context = await browser.newContext();
    await context
      .grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: BASE_URL,
      })
      .catch(() => undefined);

    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(15000);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();

        if (!isExpectedLocalFallbackConsoleError(text)) {
          browserErrors.push(text);
        }
      }
    });
    page.on('pageerror', (error) => {
      browserErrors.push(error.message);
    });

    console.log(`[browser-smoke] ${run.name}: desktop`);
    await smokePage(page, { width: 1365, height: 768 });
    console.log(`[browser-smoke] ${run.name}: mobile`);
    await smokePage(page, { width: 390, height: 844 });

    let clipboardLength: number | string = 'not-tested';

    if (run.name !== 'Firefox') {
      console.log(`[browser-smoke] ${run.name}: clipboard`);
      const clipboardText = await withTimeout(
        smokeClipboard(page),
        10000,
        `${run.name} clipboard`
      );
      clipboardLength =
        clipboardText === 'clipboard-unavailable'
          ? clipboardText
          : clipboardText.length;

      assert.notEqual(clipboardLength, 0);
    }

    assert.deepEqual(browserErrors, []);

    await context.close();

    return {
      browser: run.name,
      desktop: 'passed',
      mobile: 'passed',
      clipboardLength,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const testEnv = {
    ...process.env,
    VITE_FIREBASE_API_KEY: 'test',
    VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'testebolao2',
    VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: '1:123:web:test',
    VITE_ENABLE_LOCAL_FALLBACK: 'true',
  };

  console.log('[browser-smoke] building production bundle with local fallback');
  await runCommand(process.execPath, [VITE_BIN, 'build'], testEnv);

  let server: ChildProcess | null = null;

  try {
    console.log(`[browser-smoke] starting preview on ${BASE_URL}`);
    server = startPreviewServer();
    await waitForServer();

    const browserRuns: BrowserRun[] = [
      { name: 'Chromium', browserType: chromium },
      { name: 'Firefox', browserType: firefox },
    ];
    const edgePath = EDGE_PATHS.find((path) => existsSync(path));

    if (edgePath) {
      browserRuns.push({
        name: 'Microsoft Edge',
        browserType: chromium,
        launchOptions: { executablePath: edgePath },
      });
    }

    const results = [];

    for (const run of browserRuns) {
      results.push(
        await withTimeout(runBrowserSmoke(run), 60000, `${run.name} smoke`)
      );
    }

    console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  } finally {
    stopProcessTree(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
