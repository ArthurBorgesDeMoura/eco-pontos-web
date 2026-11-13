import { Locator, Page, expect, test } from '@playwright/test';

import { focoEstaVisivel } from './apoio/auditoria';

const NOVO = 'Ecoponto Teclado';

function noDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

async function tabAte(page: Page, alvo: Locator, limite = 60): Promise<void> {
  await expect(alvo).toBeVisible();
  const antes = await alvo.evaluate((elemento) => {
    const ativo = document.activeElement;
    return !!ativo && ativo !== document.body && !!(elemento.compareDocumentPosition(ativo) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  const tecla = antes ? 'Shift+Tab' : 'Tab';
  for (let passo = 1; passo <= limite; passo++) {
    await page.keyboard.press(tecla);
    const ativo = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160) ?? '');
    expect(await focoEstaVisivel(page), `foco visível no passo ${passo}: ${ativo}`).toBe(true);
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      return;
    }
  }
  await expect(alvo).toBeFocused();
}

test('buscar, filtrar, abrir um ponto, entrar e sugerir, só com o teclado', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.locator('.busca__resumo')).toBeVisible();

  const bairro = page.locator('.busca__bairro [role="combobox"]');
  await tabAte(page, bairro);
  await page.keyboard.press('Enter');
  await page.keyboard.type('centro');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?bairro=4$/);
  await expect(bairro).toBeFocused();

  if (noDesktop(page)) {
    await tabAte(page, page.locator('.busca__materiais').getByRole('button', { name: /^Lâmpadas/ }));
  } else {
    const material = page.locator('.busca__material-seletor [role="combobox"]');
    await tabAte(page, material);
    await page.keyboard.press('Enter');
    await page.keyboard.type('lâm');
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Lâmpadas em Centro');

  const ponto = page.locator('.busca__lista .linha__nome').first();
  await tabAte(page, ponto);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Bretas - Loja 518' })).toBeVisible();
  const voltar = noDesktop(page)
    ? page.locator('a.ponto__voltar')
    : page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Voltar' });
  await tabAte(page, voltar);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?bairro=4&material=7$/);

  const barra = noDesktop(page) ? page.locator('eco-barra-superior') : page.locator('eco-cabecalho-celular');
  await tabAte(page, barra.getByRole('link', { name: 'Entrar' }));
  await page.keyboard.press('Enter');
  const email = page.getByLabel('E-mail');
  await tabAte(page, email);
  await page.keyboard.type('maria.souza@example.com');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha')).toBeFocused();
  await page.keyboard.type('senha-de-teste');
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/\/entrar/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeFocused();

  const sugerir = noDesktop(page)
    ? page.locator('eco-barra-superior nav').getByRole('link', { name: 'Sugerir ponto' })
    : page.locator('eco-barra-inferior').getByRole('link', { name: 'Sugerir' });
  await tabAte(page, sugerir);
  await page.keyboard.press('Enter');
  const nome = page.getByLabel('Nome do ponto');
  await tabAte(page, nome);
  await page.keyboard.type(NOVO);
  await page.keyboard.press('Tab');
  await page.keyboard.type('Rua do Teclado, 10');
  await page.keyboard.press('Tab');
  const seletorDoBairro = page.locator('[data-campo="idBairro"] [role="combobox"]');
  await expect(seletorDoBairro).toBeFocused();
  await expect(seletorDoBairro).toHaveText('Selecione o bairro');
  await page.keyboard.press('Enter');
  await page.keyboard.type('centro');
  await page.keyboard.press('Enter');
  const chip = page.getByRole('checkbox', { name: 'Lâmpadas' });
  await tabAte(page, chip);
  await page.keyboard.press('Space');
  await expect(chip).toBeChecked();
  await tabAte(page, page.getByRole('button', { name: 'Enviar sugestão' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/minhas-sugestoes$/);
  await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Sugestão enviada. Ela fica pendente até a análise.');
  await expect(page.locator('.celula__nome, .minhas__nome').filter({ visible: true }).first()).toHaveText(NOVO);
});
