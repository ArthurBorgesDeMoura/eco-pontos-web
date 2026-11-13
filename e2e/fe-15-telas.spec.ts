import { Page, TestInfo, expect, test } from '@playwright/test';

import { auditarTela, percorrerComTab } from './apoio/auditoria';

function noDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

async function esperarAnimacoes(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((animacao) => animacao.finished.catch(() => undefined))),
      new Promise((resolver) => setTimeout(resolver, 1500)),
    ]),
  );
}

async function conferir(page: Page, info: TestInfo, tela: string, opcoes: { tab?: boolean } = {}): Promise<void> {
  await esperarAnimacoes(page);
  const problemas = await auditarTela(page);
  if (opcoes.tab ?? true) {
    problemas.push(...(await percorrerComTab(page)));
  }
  expect.soft(problemas, `${tela} (${info.project.name})`).toEqual([]);
  const arquivo = tela
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
  await page.screenshot({ path: `test-results/capturas/fe-15/${info.project.name}/${arquivo}.png`, fullPage: true });
}

async function entrarComo(page: Page, email: string, voltar: string): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

async function pelaBarra(page: Page, desktop: string, celular: string): Promise<void> {
  if (noDesktop(page)) {
    await page.locator('eco-barra-superior nav').getByRole('link', { name: desktop }).click();
  } else {
    await page.locator('eco-barra-inferior').getByRole('link', { name: celular }).click();
  }
}

test.describe.configure({ timeout: 240_000 });

test('visitante: a busca (com bairro, material, vazia e o menu aberto), o detalhe, Entrar, Criar conta e a página não encontrada', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('.busca__resumo')).toBeVisible();
  await conferir(page, info, 'busca inicial');

  await page.locator('.busca__bairro [role="combobox"]').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await conferir(page, info, 'menu de bairros aberto', { tab: false });
  await page.getByRole('option', { name: 'Centro', exact: true }).click();
  await expect(page.locator('.busca__lista .linha__nome')).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
  await conferir(page, info, 'busca com bairro');

  if (noDesktop(page)) {
    await page.locator('.busca__materiais').getByRole('button', { name: /^Lâmpadas/ }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await conferir(page, info, 'menu de materiais aberto', { tab: false });
    await page.getByRole('option', { name: /^Lâmpadas/ }).click();
  }
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Lâmpadas em Centro');
  await conferir(page, info, 'busca com bairro e material');

  await page.goto('/?bairro=2');
  await expect(page.getByText('Nenhum ponto de coleta em Alto Umuarama ainda.')).toBeVisible();
  await conferir(page, info, 'busca sem pontos');

  await page.goto('/pontos/13');
  await expect(page.getByRole('heading', { level: 1, name: 'Ecoponto Luizote de Freitas' })).toBeVisible();
  await conferir(page, info, 'detalhe do ponto');

  await page.goto('/pontos/999');
  await expect(page.getByRole('heading', { level: 1, name: 'Ponto não encontrado' })).toBeVisible();
  await conferir(page, info, 'ponto não encontrado');

  await page.goto('/entrar');
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await conferir(page, info, 'entrar');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('.campo__erro').first()).toBeVisible();
  await conferir(page, info, 'entrar com erros');

  await page.goto('/criar-conta');
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await conferir(page, info, 'criar conta');
  await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.locator('.campo__erro').first()).toBeVisible();
  await conferir(page, info, 'criar conta com erros');

  await page.goto('/endereco-que-nao-existe');
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  await conferir(page, info, 'pagina nao encontrada');
});

test('usuário: Sugerir (também com os erros), Minhas sugestões, Sem permissão e o diálogo da conta', async ({ page }, info) => {
  await entrarComo(page, 'maria.souza@example.com', '/sugerir');
  await expect(page.getByLabel('Nome do ponto')).toBeVisible();
  await conferir(page, info, 'sugerir');
  await page.getByRole('button', { name: 'Enviar sugestão' }).click();
  await expect(page.locator('[data-campo="nome"] .campo__erro')).toBeVisible();
  await conferir(page, info, 'sugerir com erros');

  await pelaBarra(page, 'Minhas sugestões', 'Minhas');
  await expect(page.getByRole('tab', { name: 'Todas' })).toHaveAttribute('aria-selected', 'true');
  await conferir(page, info, 'minhas sugestoes');
  await page.getByRole('tab', { name: 'Recusadas' }).click();
  await expect(page.getByRole('tab', { name: 'Recusadas' })).toHaveAttribute('aria-selected', 'true');
  await conferir(page, info, 'minhas sugestoes recusadas vazia');

  await page.goto('/painel');
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible();
  await conferir(page, info, 'sem permissao');

  if (!noDesktop(page)) {
    await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Conta' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Sair da conta?' })).toBeVisible();
    await conferir(page, info, 'dialogo sair da conta');
    await page.keyboard.press('Escape');
  }
});

test('administrador: as abas do painel, o diálogo de exclusão e os formulários de ponto e de categoria', async ({ page }, info) => {
  await entrarComo(page, 'admin@example.com', '/painel');
  await expect(page.getByRole('tab', { name: 'Pendentes (2)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await conferir(page, info, 'painel pendentes');

  await page.getByRole('tab', { name: 'Pontos (13)', exact: true }).click();
  await expect(page.locator('eco-painel-pontos').getByText('Mostrando 7 de 13 pontos').filter({ visible: true }).first()).toBeVisible();
  await conferir(page, info, 'painel pontos');

  await page.getByRole('button', { name: 'Excluir Bretas - Loja 518', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await conferir(page, info, 'dialogo de exclusao');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeHidden();

  await page.getByRole('link', { name: 'Editar Casas Bahia', exact: true }).filter({ visible: true }).click();
  await expect(page.getByLabel('Nome do ponto')).toHaveValue('Casas Bahia');
  await conferir(page, info, 'editar ponto');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('tab', { name: 'Categorias (10)', exact: true }).click();
  await expect(page.locator('eco-painel-categorias').getByText('10 categorias', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await conferir(page, info, 'painel categorias');

  await page.getByRole('link', { name: 'Nova categoria' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('plástico');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(page.locator('[data-campo="nome"] .campo__erro')).toBeVisible();
  await conferir(page, info, 'nova categoria com nome repetido');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('link', { name: 'Editar Vidro', exact: true }).filter({ visible: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Vidro');
  await conferir(page, info, 'editar categoria');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('tab', { name: /^Pendentes/ }).click();
  await page.getByRole('button', { name: 'Aprovar Ecoponto Daniel Fonseca', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('eco-avisos eco-aviso')).toBeVisible();
  await page.getByRole('button', { name: 'Recusar Cooperativa dos Recicladores de Uberlândia (CORU)', exact: true }).filter({ visible: true }).click();
  await expect(page.getByText('Nenhuma sugestão aguardando análise')).toBeVisible();
  await expect(page.locator('eco-avisos eco-aviso')).toBeVisible();
  await conferir(page, info, 'painel pendentes vazio com o aviso', { tab: false });
  await expect(page.locator('eco-avisos eco-aviso')).toHaveCount(0, { timeout: 8000 });
  await conferir(page, info, 'painel pendentes vazio');
});
