import { Locator, Page, TestInfo, expect, test } from '@playwright/test';

const AVISO = 'Sugestão enviada. Ela fica pendente até a análise.';
const CORU = 'Cooperativa dos Recicladores de Uberlândia (CORU)';

function noCelular(info: TestInfo): boolean {
  return info.project.name === 'celular';
}

function nomes(page: Page, info: TestInfo): Locator {
  return noCelular(info) ? page.locator('.minhas__cartao .minhas__nome') : page.locator('eco-tabela .celula__nome');
}

function etiquetas(page: Page, info: TestInfo): Locator {
  return noCelular(info)
    ? page.locator('.minhas__cartao eco-etiqueta-status')
    : page.locator('eco-tabela eco-etiqueta-status');
}

function resumo(page: Page, info: TestInfo): Locator {
  return noCelular(info) ? page.locator('.minhas__resumo') : page.locator('.tabela__resumo');
}

async function entrarComo(page: Page, email: string, voltar = '/minhas-sugestoes'): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function abrirMinhas(page: Page, email: string): Promise<void> {
  await entrarComo(page, email);
  await expect(page.getByRole('heading', { level: 1, name: 'Minhas sugestões' })).toBeVisible();
}

test('cada sugestão aparece com a etiqueta do seu status, e cada aba mostra só o seu status', async ({ page }, info) => {
  await abrirMinhas(page, 'maria.souza@example.com');
  await expect(nomes(page, info)).toHaveText([CORU]);
  await expect(etiquetas(page, info)).toHaveText(['Pendente']);
  await expect(resumo(page, info)).toHaveText('Mostrando 1 de 1 sugestão');

  await page.getByRole('tab', { name: 'Pendentes' }).click();
  await expect(page).toHaveURL(/\/minhas-sugestoes\?aba=pendentes$/);
  await expect(nomes(page, info)).toHaveText([CORU]);
  await page.getByRole('tab', { name: 'Aprovadas' }).click();
  await expect(page.locator('.minhas__estado-mensagem')).toHaveText('Nenhuma sugestão aprovada ainda.');

  await page.evaluate(() => sessionStorage.clear());
  await abrirMinhas(page, 'joao.pereira@example.com');
  await expect(nomes(page, info)).toHaveText(['Ecoponto Daniel Fonseca']);
});

test('a administração vê os 13 aprovados, em Aprovadas, com "Mostrar mais"', async ({ page }, info) => {
  await abrirMinhas(page, 'admin@example.com');
  await page.getByRole('tab', { name: 'Aprovadas' }).click();
  await expect(resumo(page, info)).toHaveText('Mostrando 7 de 13 sugestões');
  await expect(etiquetas(page, info)).toHaveText(Array(7).fill('Aprovada'));

  await page.getByRole('button', { name: 'Mostrar mais' }).filter({ visible: true }).click();
  await expect(resumo(page, info)).toHaveText('Mostrando 13 de 13 sugestões');
  await page.getByRole('tab', { name: 'Pendentes' }).click();
  await expect(page.locator('.minhas__estado-mensagem')).toHaveText('Nenhuma sugestão pendente.');
});

test('depois de enviar uma sugestão, ela aparece como Pendente, no topo, e o aviso some em 4 s', async ({ page }, info) => {
  await page.clock.install();
  await entrarComo(page, 'maria.souza@example.com', '/sugerir');
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Vidro', exact: true })).toBeAttached();
  await page.getByLabel('Nome do ponto').fill('Ecoponto Morumbi');
  await page.getByLabel('Endereço').fill('Rua das Flores, 100');
  await page.locator('[data-campo="idBairro"] [role="combobox"]').click();
  await page.getByRole('option', { name: 'Morumbi', exact: true }).click();
  await page.getByRole('group', { name: 'Materiais aceitos' }).getByText('Vidro', { exact: true }).click();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  await page.getByRole('button', { name: 'Enviar sugestão' }).click();
  await page.clock.runFor(400);
  await expect(page).toHaveURL(/\/minhas-sugestoes$/);
  const aviso = page.locator('eco-avisos eco-aviso');
  await expect(aviso).toHaveText(AVISO);
  await page.clock.runFor(400);
  await expect(nomes(page, info)).toHaveText(['Ecoponto Morumbi', CORU]);
  await expect(etiquetas(page, info)).toHaveText(['Pendente', 'Pendente']);

  await page.clock.runFor(3200);
  await expect(aviso).toBeVisible();
  await page.clock.runFor(700);
  await expect(aviso).toHaveCount(0);
});

test('uma aba sem itens mostra uma mensagem; em Todas, com "Sugerir um ponto"', async ({ page }) => {
  await page.goto('/criar-conta?voltar=%2Fminhas-sugestoes');
  await page.getByLabel('Nome').fill('Ana Lima');
  await page.getByLabel('E-mail').fill('ana.lima@example.com');
  await page.getByLabel('Senha').fill('senha-nova-1');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Minhas sugestões' })).toBeVisible();

  await expect(page.locator('.minhas__estado-mensagem')).toHaveText('Você ainda não sugeriu nenhum ponto.');
  await expect(page.locator('.minhas__estado').getByRole('link', { name: 'Sugerir um ponto' })).toHaveAttribute('href', '/sugerir');
  for (const [aba, frase] of [
    ['Pendentes', 'Nenhuma sugestão pendente.'],
    ['Aprovadas', 'Nenhuma sugestão aprovada ainda.'],
    ['Recusadas', 'Nenhuma sugestão recusada.'],
  ]) {
    await page.getByRole('tab', { name: aba }).click();
    await expect(page.locator('.minhas__estado-mensagem'), aba).toHaveText(frase);
    await expect(page.locator('.minhas__estado a'), aba).toHaveCount(0);
  }
});

test('sem login, a tela leva a Entrar e volta a ela depois', async ({ page }) => {
  await page.goto('/minhas-sugestoes?aba=pendentes');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fminhas-sugestoes%3Faba%3Dpendentes$/);
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/minhas-sugestoes\?aba=pendentes$/);
  await expect(page.getByRole('tab', { name: 'Pendentes' })).toHaveAttribute('aria-selected', 'true');
});

test('as abas trocam pelas setas, e a aba fica na URL ao recarregar e ao voltar', async ({ page }) => {
  await abrirMinhas(page, 'maria.souza@example.com');
  const todas = page.getByRole('tab', { name: 'Todas' });
  await todas.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Pendentes' })).toBeFocused();
  await expect(page).toHaveURL(/\?aba=pendentes$/);
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Recusadas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?aba=recusadas$/);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Recusadas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.minhas__estado-mensagem')).toHaveText('Nenhuma sugestão recusada.');
  await page.goBack();
  await expect(page).toHaveURL(/\?aba=pendentes$/);
  await expect(page.getByRole('tab', { name: 'Pendentes' })).toHaveAttribute('aria-selected', 'true');
});

test('no desktop, as medidas da D10; no celular, cartões sem rolagem lateral e a barra marcando "Minhas"', async ({ page }, info) => {
  await abrirMinhas(page, 'maria.souza@example.com');
  await expect(nomes(page, info)).toHaveText([CORU]);
  await page.evaluate(() => document.fonts.ready);
  const medidas = await page.evaluate(() => {
    const caixa = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    return {
      abas: [...document.querySelectorAll('[role="tab"]')].map(caixa),
      tabela: caixa(document.querySelector('eco-tabela')),
      cabecalho: caixa(document.querySelector('eco-tabela thead tr')),
      linha: caixa(document.querySelector('eco-tabela tbody tr')),
      colunas: [...document.querySelectorAll('eco-tabela thead th')].map(caixa),
      etiqueta: caixa(document.querySelector('eco-tabela eco-etiqueta-status')),
      rodape: caixa(document.querySelector('.tabela__rodape')),
    };
  });

  if (info.project.name === 'desktop') {
    const posicoes = medidas.abas.map((aba) => aba?.[0] ?? 0);
    [160, 242, 351, 460].forEach((esperada, i) => expect(Math.abs(posicoes[i] - esperada)).toBeLessThanOrEqual(1));
    expect(medidas.abas.every((aba) => aba?.[3] === 44)).toBe(true);
    expect(medidas.tabela).toEqual([160, 252, 1120, 156]);
    expect(medidas.cabecalho?.[3]).toBe(39);
    expect(medidas.linha?.[3]).toBe(73);
    expect(medidas.colunas.map((coluna) => coluna?.[2])).toEqual([690, 284, 144]);
    expect(medidas.etiqueta?.[3]).toBe(22);
    expect(medidas.rodape?.[3]).toBe(42);
  } else {
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
    await expect(page.locator('eco-barra-inferior a[aria-current="page"]')).toHaveText('Minhas');
  }
  if (info.project.name === 'tablet') {
    expect(await page.locator('.tabela__rolagem').evaluate((rolagem) => rolagem.scrollWidth > rolagem.clientWidth)).toBe(false);
  }
});
