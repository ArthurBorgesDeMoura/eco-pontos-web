import { Page, TestInfo, expect, test } from '@playwright/test';

const MATERIAIS = [
  'Todos os materiais',
  'Papel e papelão',
  'Plástico',
  'Metal',
  'Vidro',
  'Eletrônicos',
  'Pilhas e baterias',
  'Lâmpadas',
  'Óleo de cozinha usado',
  'Medicamentos vencidos',
  'Entulho e volumosos',
];
const CONTAGENS = ['13', '3', '3', '3', '3', '2', '6', '3', '2', '3', '1'];

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

async function abrirBusca(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await expect(page.locator('.busca__resumo')).toBeVisible();
}

async function contadores(page: Page, info: TestInfo): Promise<string[]> {
  if (noDesktop(info)) {
    return (await page.locator('.busca__materiais .item__contagem').allTextContents()).map((texto) => texto.trim());
  }
  const seletor = page.locator('.busca__material-seletor [role="combobox"]');
  await seletor.click();
  const opcoes = page.locator('.busca__material-seletor [role="option"]');
  await expect(opcoes).toHaveCount(11);
  const rotulos = await opcoes.allTextContents();
  await page.keyboard.press('Escape');
  return rotulos.map((rotulo) => rotulo.match(/\((\d+)\)/)?.[1] ?? '');
}

async function escolherBairro(page: Page, bairro: string): Promise<void> {
  await page.locator('.busca__bairro [role="combobox"]').click();
  await page.getByRole('option', { name: bairro, exact: true }).click();
}

test('os contadores mostram 13 em "Todos os materiais" e a quantidade de cada material', async ({ page }, info) => {
  await abrirBusca(page);

  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(CONTAGENS);
  if (noDesktop(info)) {
    const nomes = await page.locator('.busca__materiais .item__nome').allTextContents();
    expect(nomes.map((nome) => nome.trim())).toEqual(MATERIAIS);
  }
});

test('escolher "Papel e papelão" mostra 3 pontos e a descrição do material no cabeçalho', async ({ page }, info) => {
  await abrirBusca(page);
  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: /^Papel e papelão/ }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: /^Papel e papelão/ }).click();
  }

  await expect(page).toHaveURL(/\/\?material=1$/);
  await expect(page.locator('.busca__contagem')).toHaveText('3 pontos aceitam Papel e papelão');
  await expect(page.locator('.busca__descricao')).toHaveText(
    'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
  );
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText([
    'Ecoponto Luizote de Freitas',
    'Estação de Reciclagem - Parque do Sabiá',
    'Estação de Reciclagem - Teatro Municipal',
  ]);
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 3 de 3 pontos');

  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: /^Todos os materiais/ }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: /^Todos os materiais/ }).click();
  }
  await expect(page.locator('.busca__contagem')).toHaveText('13 pontos');
  await expect(page.locator('.busca__descricao')).toHaveCount(0);
});

test('trocar o bairro atualiza os contadores; em Alto Umuarama, todos mostram 0', async ({ page }, info) => {
  await abrirBusca(page);

  await escolherBairro(page, 'Centro');
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(['2', '0', '0', '0', '0', '1', '1', '1', '0', '0', '0']);

  await escolherBairro(page, 'Alto Umuarama');
  await expect.poll(() => contadores(page, info), { timeout: 15_000 }).toEqual(Array(11).fill('0'));
  await expect(page.locator('.busca__contagem')).toHaveText('0 pontos em Alto Umuarama');
});

test('o material escolhido continua ao trocar de bairro', async ({ page }, info) => {
  await page.goto('/?material=6');
  await expect(page.locator('.busca__contagem')).toHaveText('6 pontos aceitam Pilhas e baterias');

  await escolherBairro(page, 'Centro');
  await expect(page).toHaveURL(/\/\?material=6&bairro=4$/);
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Pilhas e baterias em Centro');
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Casas Bahia']);
  if (noDesktop(info)) {
    await expect(page.locator('.busca__materiais').getByRole('button', { name: /^Pilhas e baterias/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});

test('no celular e no tablet, o seletor de material funciona com Tab, setas e Enter, e anuncia a escolha', async ({
  page,
}, info) => {
  test.skip(noDesktop(info), 'No desktop, a lista de materiais (teste seguinte).');
  await abrirBusca(page);

  const material = page.locator('.busca__material-seletor [role="combobox"]');
  await page.locator('.busca__bairro [role="combobox"]').focus();
  await page.keyboard.press('Tab');
  await expect(material).toBeFocused();
  expect(await material.evaluate((caixa) => getComputedStyle(caixa.closest('.seletor__caixa') ?? caixa).boxShadow)).not.toBe('none');

  await page.keyboard.press('Enter');
  await expect(material).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/\?material=1$/);
  await expect(material).toBeFocused();
  await expect(material).toHaveAccessibleName(/^Material/);
  await expect(material).toContainText('Papel e papelão (3)');
  await expect(page.locator('.busca__lista-cabecalho')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.busca__contagem')).toHaveText('3 pontos aceitam Papel e papelão');
});

test('o filtro funciona com Tab e Enter, e o item escolhido é anunciado por leitores de tela', async ({ page }, info) => {
  test.skip(!noDesktop(info), 'No celular e no tablet, o seletor de material (teste anterior).');
  await abrirBusca(page);

  const papel = page.locator('.busca__materiais').getByRole('button', { name: 'Papel e papelão (3 pontos)' });
  await expect(papel).toHaveAttribute('aria-pressed', 'false');
  for (let passo = 0; passo < 30; passo++) {
    await page.keyboard.press('Tab');
    if (await papel.evaluate((botao) => botao === document.activeElement)) {
      break;
    }
  }
  await expect(papel).toBeFocused();
  expect(await papel.evaluate((botao) => getComputedStyle(botao).outlineStyle)).not.toBe('none');

  await page.keyboard.press('Enter');
  await expect(papel).toHaveAttribute('aria-pressed', 'true');
  await expect(papel).toBeFocused();
  await expect(page.locator('.busca__lista-cabecalho')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.busca__contagem')).toHaveText('3 pontos aceitam Papel e papelão');
  await expect(page.locator('.busca__materiais').getByRole('button', { pressed: true })).toHaveCount(1);
});
