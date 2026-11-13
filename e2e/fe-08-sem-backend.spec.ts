import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const erro = (page: Page) => page.locator('.busca__resultados [role="alert"]');

const RESPOSTAS: Record<string, unknown> = {
  '/api/bairros': [
    { idBairro: 2, nome: 'Alto Umuarama' },
    { idBairro: 4, nome: 'Centro' },
  ],
  '/api/categorias': [
    { idCategoria: 5, nome: 'Eletrônicos', descricao: null },
    { idCategoria: 6, nome: 'Pilhas e baterias', descricao: null },
    { idCategoria: 7, nome: 'Lâmpadas', descricao: null },
  ],
  '/api/pontos': {
    itens: [
      {
        idPonto: 4,
        nome: 'Bretas - Loja 518',
        endereco: 'Av. João Pinheiro, 77',
        bairro: { idBairro: 4, nome: 'Centro' },
        materiais: [{ idCategoria: 7, nome: 'Lâmpadas' }],
      },
      {
        idPonto: 8,
        nome: 'Casas Bahia',
        endereco: 'Av. Afonso Pena, 526',
        bairro: { idBairro: 4, nome: 'Centro' },
        materiais: [
          { idCategoria: 5, nome: 'Eletrônicos' },
          { idCategoria: 6, nome: 'Pilhas e baterias' },
        ],
      },
    ],
    total: 2,
    pagina: 1,
    tamanho: 7,
  },
  '/api/pontos/contagem': {
    total: 2,
    categorias: [
      { idCategoria: 5, quantidade: 1 },
      { idCategoria: 6, quantidade: 1 },
      { idCategoria: 7, quantidade: 1 },
    ],
  },
};

async function responderComoBackend(route: Route): Promise<void> {
  const caminho = new URL(route.request().url()).pathname;
  const corpo = RESPOSTAS[caminho];
  if (corpo === undefined) {
    await route.fulfill({ status: 401, json: { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta.' } });
    return;
  }
  await route.fulfill({ status: 200, json: corpo });
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: com o backend desligado aparece o erro com "Tentar de novo"`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    const respostas: number[] = [];
    page.on('response', (resposta) => {
      if (new URL(resposta.url()).pathname === '/api/pontos') {
        respostas.push(resposta.status());
      }
    });
    await page.goto('/');

    await expect(erro(page)).toBeVisible({ timeout: 15_000 });
    await expect(erro(page).locator('.busca__estado-mensagem')).toHaveText(
      'O servidor está fora do ar agora. Tente de novo em alguns instantes.',
    );
    await expect(erro(page).getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    expect(respostas).toContain(504);
    await expect(page.locator('.busca__contagem [aria-hidden="true"]')).toHaveText('– pontos');
    await expect(page.locator('.busca__contagem')).toHaveAccessibleName('Não foi possível buscar os pontos.');
    await expect(page.locator('.linha--esqueleto')).toHaveCount(0);
    await expect(page.locator('.busca__estado-orientacao')).toHaveCount(0);
    await expect(page.locator('.busca__rodape')).toHaveCount(0);
    if (largura.nome !== 'desktop') {
      const alvo = await erro(page)
        .getByRole('button', { name: 'Tentar de novo' })
        .evaluate((botao) => {
          const marcador = botao.querySelector<HTMLElement>(':scope > .botao__alvo')?.getBoundingClientRect().height ?? 0;
          return Math.max(botao.getBoundingClientRect().height, marcador);
        });
      expect(alvo).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
        false,
      );
    }
    await page.screenshot({ path: test.info().outputPath(`${largura.nome}-erro.png`), fullPage: true });
  });
}

test('"Tentar de novo" só com o teclado: o foco não se perde, falhe ou dê certo', async ({ page }) => {
  await page.goto('/');
  const botao = erro(page).getByRole('button', { name: 'Tentar de novo' });
  await expect(botao).toBeVisible({ timeout: 15_000 });

  for (let passo = 0; passo < 30; passo++) {
    await page.keyboard.press('Tab');
    if (await botao.evaluate((alvo) => alvo === document.activeElement).catch(() => false)) {
      break;
    }
  }
  await expect(botao).toBeFocused();
  const focoVisivel = await botao.evaluate((alvo) => {
    const contorno = (estilo: CSSStyleDeclaration) => estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
    return alvo.matches(':focus-visible') && (contorno(getComputedStyle(alvo)) || contorno(getComputedStyle(alvo, '::after')));
  });
  expect(focoVisivel).toBe(true);

  await page.keyboard.press('Enter');
  await expect(botao).toBeVisible({ timeout: 15_000 });
  await expect(botao).toBeFocused();

  await page.route(/\/api\//, responderComoBackend);
  await page.keyboard.press('Enter');
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
  await expect(page.locator('.busca__contagem')).toBeFocused();
  await expect(page.locator('.busca__contagem')).toHaveText('2 pontos');
});

test('quando o backend volta, "Tentar de novo" mostra a lista e traz os filtros de volta', async ({ page }) => {
  await page.goto('/?bairro=4');
  await expect(erro(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.busca__bairro [role="combobox"]')).toHaveText('Bairros indisponíveis');

  await page.route(/\/api\//, responderComoBackend);
  await erro(page).getByRole('button', { name: 'Tentar de novo' }).click();

  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
  await expect(page.locator('.busca__contagem')).toHaveText('2 pontos em Centro');
  await expect(page.locator('.busca__contagem')).toBeFocused();
  await expect(page.locator('.busca__bairro [role="combobox"]')).toHaveText('Centro');
  await expect(erro(page)).toHaveCount(0);
});
