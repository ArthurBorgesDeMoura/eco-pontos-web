import { Page, TestInfo, expect, test } from '@playwright/test';

const ORIENTACAO = 'Conhece um local onde algum material pode ser descartado? Sugira o ponto para análise.';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

const contagem = (page: Page) => page.locator('.busca__contagem');
const estado = (page: Page) => page.locator('.busca__estado');
const sugerir = (page: Page) => estado(page).getByRole('link', { name: 'Sugerir um ponto' });

async function contadores(page: Page, info: TestInfo): Promise<string[]> {
  if (noDesktop(info)) {
    return (await page.locator('.busca__materiais .item__contagem').allTextContents()).map((texto) => texto.trim());
  }
  await page.locator('.busca__material-seletor [role="combobox"]').click();
  const itens = page.locator('.busca__material-seletor [role="option"]');
  await expect(itens).toHaveCount(11);
  const rotulos = await itens.allTextContents();
  await page.keyboard.press('Escape');
  return rotulos.map((rotulo) => rotulo.match(/\((\d+)\)/)?.[1] ?? '');
}

async function entrarComo(page: Page, email: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

test('Alto Umuarama mostra o estado vazio igual ao D07, com todos os contadores em 0', async ({ page, browserName }, info) => {
  await page.goto('/?bairro=2');
  await expect(contagem(page)).toHaveText('0 pontos em Alto Umuarama');
  await expect(estado(page).locator('.busca__estado-mensagem')).toHaveText('Nenhum ponto de coleta em Alto Umuarama ainda.');
  await expect(estado(page).locator('.busca__estado-orientacao')).toHaveText(ORIENTACAO);
  await expect(sugerir(page)).toBeVisible();
  await expect(page.locator('.busca__ordem')).toHaveCount(0);
  await expect(page.locator('.busca__lista')).toHaveCount(0);
  await expect(page.locator('.busca__rodape')).toHaveCount(0);
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(Array(11).fill('0'));

  if (noDesktop(info)) {
    await page.evaluate(() => document.fonts.ready);
    const medidas = await page.evaluate(() => {
      const caixa = (seletor: string) => {
        const r = document.querySelector(seletor)?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, largura: r.width, altura: r.height } : null;
      };
      return {
        resultados: caixa('.busca__resultados'),
        cabecalho: caixa('.busca__lista-cabecalho'),
        estado: caixa('.busca__estado'),
        texto: caixa('.busca__estado-texto'),
        botao: caixa('.busca__estado a'),
      };
    });
    const { resultados, cabecalho, estado: bloco, texto, botao } = medidas;
    const folga = browserName === 'chromium' ? 2 : 4;
    expect([resultados?.x, resultados?.y, resultados?.largura, resultados?.altura]).toEqual([464, 192, 816, 295]);
    expect(cabecalho?.altura).toBe(49);
    expect([bloco?.largura, bloco?.altura]).toEqual([814, 244]);
    expect((texto?.y ?? 0) - (bloco?.y ?? 0)).toBe(72);
    expect(texto?.altura).toBe(44);
    expect(Math.abs((texto?.largura ?? 0) - 555)).toBeLessThanOrEqual(folga);
    expect((botao?.y ?? 0) - ((texto?.y ?? 0) + (texto?.altura ?? 0))).toBe(20);
    expect(botao?.altura).toBe(36);
    expect(Math.abs((botao?.largura ?? 0) - 140)).toBeLessThanOrEqual(folga);
    const meioDoBloco = (bloco?.x ?? 0) + (bloco?.largura ?? 0) / 2;
    for (const parte of [texto, botao]) {
      expect(Math.abs((parte?.x ?? 0) + (parte?.largura ?? 0) / 2 - meioDoBloco)).toBeLessThanOrEqual(1);
    }
  } else {
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    const alvo = await sugerir(page).evaluate((link) => {
      const depois = getComputedStyle(link, '::after');
      const extra = depois.content !== 'none' ? parseFloat(depois.height) || 0 : 0;
      const marcador = link.querySelector<HTMLElement>(':scope > .botao__alvo')?.getBoundingClientRect().height ?? 0;
      return Math.max(link.getBoundingClientRect().height, extra, marcador);
    });
    expect(alvo).toBeGreaterThanOrEqual(44);
  }
});

test('uma combinação de bairro e material sem resultado mostra a frase com os dois nomes', async ({ page }, info) => {
  await page.goto('/?bairro=4');
  await expect(contagem(page)).toHaveText('2 pontos em Centro');
  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: /^Papel e papelão/ }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: /^Papel e papelão/ }).click();
  }

  await expect(page).toHaveURL(/\/\?bairro=4&material=1$/);
  await expect(contagem(page)).toHaveText('0 pontos aceitam Papel e papelão em Centro');
  await expect(estado(page).locator('.busca__estado-mensagem')).toHaveText('Nenhum ponto aceita Papel e papelão em Centro ainda.');
  await expect(estado(page).locator('.busca__estado-orientacao')).toHaveText(ORIENTACAO);

  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: /^Todos os materiais/ }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: /^Todos os materiais/ }).click();
  }
  await expect(contagem(page)).toHaveText('2 pontos em Centro');
  await expect(estado(page)).toHaveCount(0);
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
});

test('durante a busca aparecem as linhas-esqueleto, do tamanho das reais, e um traço no lugar do total', async ({ page }) => {
  const agora = Date.now();
  await page.clock.install({ time: agora });
  await page.clock.pauseAt(agora + 1000);
  await page.goto('/');

  const esqueletos = page.locator('.busca__lista eco-linha-ponto.linha--esqueleto');
  await expect(esqueletos).toHaveCount(7);
  await expect(page.locator('.busca__lista')).toHaveAttribute('aria-hidden', 'true');
  await expect(contagem(page).locator('[aria-hidden="true"]')).toHaveText('– pontos');
  await expect(contagem(page)).toHaveAccessibleName('Buscando pontos…');
  await expect(page.locator('.busca__lista a[href]')).toHaveCount(0);
  await expect(page.locator('.busca__rodape')).toHaveCount(0);
  const alturasDoEsqueleto = await esqueletos.evaluateAll((linhas) => linhas.map((linha) => linha.getBoundingClientRect().height));
  await page.screenshot({ path: test.info().outputPath('esqueleto.png') });

  await page.clock.runFor(2000);
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 7 de 13 pontos');
  await expect(esqueletos).toHaveCount(0);
  await expect(contagem(page)).toHaveText('13 pontos');
  const alturasReais = await page
    .locator('.busca__lista eco-linha-ponto')
    .evaluateAll((linhas) => linhas.map((linha) => linha.getBoundingClientRect().height));
  expect(alturasDoEsqueleto).toEqual(alturasReais);
});

test('"Sugerir um ponto" leva o visitante a Entrar e, depois de entrar, ao formulário', async ({ page }) => {
  await page.goto('/?bairro=2');
  await expect(sugerir(page)).toBeVisible();

  for (let passo = 0; passo < 40; passo++) {
    await page.keyboard.press('Tab');
    if (await sugerir(page).evaluate((link) => link === document.activeElement)) {
      break;
    }
  }
  await expect(sugerir(page)).toBeFocused();
  const focoVisivel = await sugerir(page).evaluate((link) => {
    const contorno = (estilo: CSSStyleDeclaration) => estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
    return link.matches(':focus-visible') && (contorno(getComputedStyle(link)) || contorno(getComputedStyle(link, '::after')));
  });
  expect(focoVisivel).toBe(true);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsugerir$/);
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
});

test('"Sugerir um ponto" leva direto ao formulário quem já entrou', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'joao.pereira@example.com');
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();

  await page.goto('/?bairro=2');
  await sugerir(page).click();
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
});
