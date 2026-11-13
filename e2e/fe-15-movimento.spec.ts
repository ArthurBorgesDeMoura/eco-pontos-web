import { Page, expect, test } from '@playwright/test';

async function registrarAnimacoes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vistas = new Set<string>();
    (window as unknown as { propriedadesAnimadas: Set<string> }).propriedadesAnimadas = vistas;
    const IGNORAR = new Set(['offset', 'easing', 'composite', 'computedOffset']);
    setInterval(() => {
      for (const animacao of document.getAnimations()) {
        const efeito = animacao.effect as KeyframeEffect | null;
        for (const quadro of efeito?.getKeyframes() ?? []) {
          for (const propriedade of Object.keys(quadro)) {
            if (!IGNORAR.has(propriedade)) {
              vistas.add(propriedade);
            }
          }
        }
      }
    }, 10);
  });
}

async function propriedadesAnimadas(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from((window as unknown as { propriedadesAnimadas: Set<string> }).propriedadesAnimadas).sort(),
  );
}

async function percorrer(page: Page): Promise<string[]> {
  const vistas = new Set<string>();
  await page.goto('/');
  await expect(page.locator('.busca__resumo')).toBeVisible();
  await page.locator('.busca__lista .linha__nome').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(400);
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (desktop) {
    await page.locator('a.ponto__voltar').click();
  } else {
    await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Voltar' }).click();
  }
  await expect(page.locator('.busca__resumo')).toBeVisible();
  await page.waitForTimeout(400);
  (await propriedadesAnimadas(page)).forEach((propriedade) => vistas.add(propriedade));

  await page.goto(`/entrar?voltar=${encodeURIComponent('/painel')}`);
  await page.getByLabel('E-mail').fill('admin@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('tab', { name: 'Pendentes (2)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar Ecoponto Daniel Fonseca', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('eco-avisos eco-aviso')).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: /^Pontos/ }).click();
  await page.getByRole('button', { name: 'Excluir Bretas - Loja 518', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.locator('eco-avisos eco-aviso')).toHaveCount(0, { timeout: 8000 });
  (await propriedadesAnimadas(page)).forEach((propriedade) => vistas.add(propriedade));
  return Array.from(vistas).sort();
}

test('com "reduzir movimento", nada se move além de esmaecer', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await registrarAnimacoes(page);
  const propriedades = await percorrer(page);
  expect(propriedades).toContain('opacity');
  expect(propriedades).toEqual(['opacity']);
});

test('sem o ajuste, o mesmo caminho tem movimento (o diálogo cresce, o aviso desliza)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await registrarAnimacoes(page);
  const propriedades = await percorrer(page);
  expect(propriedades).toContain('opacity');
  expect(propriedades).toContain('transform');
});
