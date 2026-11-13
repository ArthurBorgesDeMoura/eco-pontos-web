import { expect, test } from '@playwright/test';

const MARGEM_DO_PROTOTIPO: Record<string, number> = {
  celular: 16,
  tablet: 32,
  desktop: 160,
};

test('a página de teste abre com o fundo, a fonte e as margens do protótipo', async ({ page }, info) => {
  const margem = MARGEM_DO_PROTOTIPO[info.project.name];
  const largura = page.viewportSize()?.width ?? 0;

  await page.goto('/sistema');
  await expect(page.getByRole('heading', { level: 1, name: 'Sistema' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const medidas = await page.evaluate(() => {
    const raiz = document.documentElement;
    const conteudo = document.querySelector('main.conteudo')?.getBoundingClientRect();
    return {
      fundo: getComputedStyle(document.body).backgroundColor,
      fonte: getComputedStyle(document.body).fontFamily,
      pesosCarregados: [
        ...new Set(
          [...document.fonts]
            .filter((face) => face.family.replace(/["']/g, '') === 'Atkinson Hyperlegible Next')
            .filter((face) => face.status === 'loaded')
            .map((face) => Number(face.weight)),
        ),
      ].sort((a, b) => a - b),
      larguraUtil: raiz.clientWidth,
      esquerda: conteudo?.left,
      direita: conteudo ? raiz.clientWidth - conteudo.right : undefined,
      coluna: conteudo?.width,
      rolagemLateral: raiz.scrollWidth > raiz.clientWidth,
    };
  });

  expect(medidas.fundo).toBe('rgb(243, 244, 238)');
  expect(medidas.fonte).toMatch(/^"Atkinson Hyperlegible Next"/);
  expect(medidas.pesosCarregados).toEqual([400, 500, 600]);
  expect(medidas.larguraUtil, 'sem barra de rolagem ocupando largura').toBe(largura);
  expect(medidas.esquerda).toBe(margem);
  expect(medidas.direita).toBe(margem);
  expect(medidas.coluna).toBe(Math.min(1120, largura - 2 * margem));
  expect(medidas.rolagemLateral).toBe(false);
  await expect(page.getByText(`margem de ${margem} px`)).toBeVisible();

  await page.screenshot({ path: `test-results/capturas/sistema-${info.project.name}.png`, fullPage: true });
});
