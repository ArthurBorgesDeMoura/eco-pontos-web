import { Page, TestInfo, expect, test } from '@playwright/test';

const OPCOES = [
  'Todos os bairros',
  'Altamira',
  'Alto Umuarama',
  'Brasil',
  'Centro',
  'Copacabana',
  'Custódio Pereira',
  'Daniel Fonseca',
  'Fundinho',
  'Jardim Brasília',
  'Jardim Karaíba',
  'Luizote de Freitas',
  'Morada da Colina',
  'Morumbi',
  'Osvaldo Rezende',
  'Presidente Roosevelt',
  'Santa Luzia',
  'Santa Mônica',
  'Santa Rosa',
  'Saraiva',
  'Tibery',
];

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

const campo = (page: Page) => page.locator('.busca__bairro [role="combobox"]');
const menu = (page: Page) => page.locator('.busca__bairro [role="listbox"]');
const opcoes = (page: Page) => menu(page).locator('[role="option"]');

async function abrirBusca(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await expect(page.locator('.busca__resumo')).toBeVisible();
}

async function opcaoAtiva(page: Page): Promise<string | null> {
  return campo(page).evaluate((caixa) => {
    const id = caixa.getAttribute('aria-activedescendant');
    return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
  });
}

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

test('o menu lista "Todos os bairros" e os 20 bairros em ordem alfabética, com o escolhido marcado', async ({ page }) => {
  await abrirBusca(page);
  await expect(campo(page)).toHaveText('Todos os bairros');

  await campo(page).click();
  await expect(opcoes(page)).toHaveText(OPCOES);
  await expect(menu(page).locator('[aria-selected="true"]')).toHaveText(['Todos os bairros']);
  await expect(menu(page).locator('eco-icone')).toHaveCount(1);
  await expect(opcoes(page).first().locator('eco-icone')).toHaveCount(1);

  await page.getByRole('option', { name: 'Centro', exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(campo(page)).toHaveText('Centro');

  await campo(page).click();
  await expect(menu(page).locator('[aria-selected="true"]')).toHaveText(['Centro']);
  await expect(menu(page).locator('eco-icone')).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Centro', exact: true }).locator('eco-icone')).toHaveCount(1);
});

test('escolher um bairro filtra a lista e atualiza os contadores de materiais', async ({ page }, info) => {
  await abrirBusca(page);
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual([
    '13', '3', '3', '3', '3', '2', '6', '3', '2', '3', '1',
  ]);

  await campo(page).click();
  await page.getByRole('option', { name: 'Centro', exact: true }).click();
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
  await expect(page.locator('.busca__contagem')).toHaveText('2 pontos em Centro');
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual([
    '2', '0', '0', '0', '0', '1', '1', '1', '0', '0', '0',
  ]);
});

test('o material escolhido continua ativo ao trocar de bairro', async ({ page }) => {
  await abrirBusca(page, '/?material=6');
  await campo(page).click();
  await page.getByRole('option', { name: 'Altamira', exact: true }).click();

  await expect(page).toHaveURL(/\/\?material=6&bairro=1$/);
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Pilhas e baterias em Altamira');
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Drogaria São Paulo - DSP Uberlândia III']);
});

test('o menu funciona só com o teclado e, ao fechar com Esc, devolve o foco ao campo', async ({ page }) => {
  await abrirBusca(page);

  for (let passo = 0; passo < 15; passo++) {
    await page.keyboard.press('Tab');
    if (await campo(page).evaluate((caixa) => caixa === document.activeElement)) {
      break;
    }
  }
  await expect(campo(page)).toBeFocused();
  expect(await campo(page).evaluate((caixa) => getComputedStyle(caixa).boxShadow)).not.toBe('none');

  await page.keyboard.press('Enter');
  await expect(campo(page)).toHaveAttribute('aria-expanded', 'true');
  expect(await opcaoAtiva(page)).toBe('Todos os bairros');
  for (let vez = 0; vez < 4; vez++) {
    await page.keyboard.press('ArrowDown');
  }
  expect(await opcaoAtiva(page)).toBe('Centro');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect(campo(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(campo(page)).toBeFocused();
  await expect(campo(page)).toHaveText('Centro');

  await page.keyboard.press(' ');
  await expect(campo(page)).toHaveAttribute('aria-expanded', 'true');
  expect(await opcaoAtiva(page)).toBe('Centro');
  await page.keyboard.press('End');
  expect(await opcaoAtiva(page)).toBe('Tibery');
  await expect(page.getByRole('option', { name: 'Tibery', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(campo(page)).toBeFocused();
  await expect(campo(page)).toHaveText('Centro');
  await expect(page).toHaveURL(/\/\?bairro=4$/);

  await page.keyboard.press('ArrowDown');
  await expect(campo(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(campo(page)).toBeFocused();
  await campo(page).click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(campo(page)).toBeFocused();
});

test('o bairro escolhido continua na URL depois de recarregar a página', async ({ page }, info) => {
  await abrirBusca(page);
  await campo(page).click();
  await page.getByRole('option', { name: 'Santa Mônica', exact: true }).click();
  await expect(page).toHaveURL(/\/\?bairro=17$/);
  const santaMonica = ['1', '1', '1', '1', '1', '0', '0', '0', '0', '0', '0'];
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(santaMonica);

  await page.reload();
  await expect(page).toHaveURL(/\/\?bairro=17$/);
  await expect(campo(page)).toHaveText('Santa Mônica');
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Estação de Reciclagem - Parque do Sabiá']);
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto em Santa Mônica');
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(santaMonica);
  await campo(page).click();
  await expect(menu(page).locator('[aria-selected="true"]')).toHaveText(['Santa Mônica']);
});

test('no desktop, o menu tem as medidas da D06', async ({ page }, info) => {
  test.skip(!noDesktop(info), 'A D06 é do desktop; no celular e no tablet, o teste seguinte.');
  await abrirBusca(page);
  await campo(page).click();

  const medidas = await page.evaluate(() => {
    const caixa = (elemento: Element | null | undefined) => {
      const r = elemento?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    const lista = document.querySelector('.busca__bairro [role="listbox"]');
    const primeira = lista?.querySelector('[role="option"]');
    return { campo: caixa(document.querySelector('.busca__bairro [role="combobox"]')), menu: caixa(lista), primeira: caixa(primeira), check: caixa(primeira?.querySelector('eco-icone')) };
  });
  expect(medidas).toEqual({
    campo: [160, 218, 280, 40],
    menu: [160, 262, 280, 332],
    primeira: [165, 267, 270, 36],
    check: [407, 277, 16, 16],
  });
});

test('no celular e no tablet, as opções têm 44 px, o menu rola e a página não rola para o lado', async ({ page }, info) => {
  test.skip(noDesktop(info), 'No desktop, as opções seguem a D06 (36 px).');
  await abrirBusca(page);
  await campo(page).click();
  await expect(opcoes(page)).toHaveCount(21);

  const alturas = await opcoes(page).evaluateAll((itens) => itens.map((item) => item.getBoundingClientRect().height));
  expect(alturas.every((altura) => altura === 44), alturas.join(', ')).toBe(true);
  const rolagem = await menu(page).evaluate((lista) => ({
    altura: lista.getBoundingClientRect().height,
    rola: lista.scrollHeight > lista.clientHeight,
  }));
  expect(rolagem).toEqual({ altura: 404, rola: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
    false,
  );

  await page.getByRole('option', { name: 'Tibery', exact: true }).tap();
  await expect(page).toHaveURL(/\/\?bairro=20$/);
  await expect(campo(page)).toHaveText('Tibery');

  await page.locator('.busca__material-seletor [role="combobox"]').click();
  const materiais = await page
    .locator('.busca__material-seletor [role="option"]')
    .evaluateAll((itens) => itens.map((item) => item.getBoundingClientRect().height));
  expect(materiais.length).toBe(11);
  expect(materiais.every((altura) => altura === 44), materiais.join(', ')).toBe(true);
});

test('o menu fecha por clique no campo e por clique fora, sem trocar o bairro', async ({ page }) => {
  await abrirBusca(page, '/?bairro=4');
  await expect(campo(page)).toHaveText('Centro');

  await campo(page).click();
  await expect(menu(page)).toBeVisible();
  await campo(page).click();
  await expect(menu(page)).toHaveCount(0);

  await campo(page).click();
  await expect(menu(page)).toBeVisible();
  await page.getByRole('heading', { level: 1, name: 'Pontos de coleta' }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(campo(page)).toHaveText('Centro');
  await expect(page).toHaveURL(/\/\?bairro=4$/);

  await campo(page).click();
  await page.getByRole('option', { name: 'Brasil', exact: true }).hover();
  expect(await opcaoAtiva(page)).toBe('Centro');
  await page.keyboard.press('Tab');
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect(campo(page)).toHaveText('Centro');
});

test('logado, numa tela baixa, a barra inferior não cobre a opção ativa do menu', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'Basta uma largura com a barra inferior: o celular deitado.');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  const barra = page.locator('.tela__barra-inferior');
  await expect(barra).toBeVisible();

  await expect(page.locator('.busca__resumo')).toBeVisible();
  await campo(page).focus();
  await page.keyboard.press('Enter');
  await expect(opcoes(page)).toHaveCount(21);
  await page.keyboard.press('End');
  expect(await opcaoAtiva(page)).toBe('Tibery');
  const tibery = await page.getByRole('option', { name: 'Tibery', exact: true }).boundingBox();
  const topoDaBarra = (await barra.boundingBox())?.y ?? 0;
  expect(tibery).not.toBeNull();
  expect((tibery?.y ?? 0) + (tibery?.height ?? 0)).toBeLessThanOrEqual(topoDaBarra);
});
