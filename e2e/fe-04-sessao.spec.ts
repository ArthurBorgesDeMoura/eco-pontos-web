import { Page, TestInfo, expect, test } from '@playwright/test';

const NA_BUSCA = /^https?:\/\/[^/]+\/$/;

const SENHA = 'senha-de-teste';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

async function entrarComo(page: Page, email: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function itensDaBarra(page: Page, info: TestInfo): Promise<string[]> {
  const links = noDesktop(info) ? page.locator('eco-barra-superior nav a') : page.locator('eco-barra-inferior a');
  return links.allTextContents().then((textos) => textos.map((texto) => texto.trim()));
}

async function chegarPeloTeclado(page: Page, nome: string): Promise<void> {
  const link = page.getByRole('link', { name: nome });
  for (let passo = 0; passo < 12; passo++) {
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(contorno, `foco visível no passo ${passo + 1}`).not.toBe('none');
    if (await link.evaluate((elemento) => elemento === document.activeElement)) {
      break;
    }
  }
  await expect(link).toBeFocused();
}

async function sair(page: Page, info: TestInfo): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior').getByRole('button', { name: 'Sair' }).click();
  } else {
    await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Conta' }).click();
    await page.getByRole('alertdialog', { name: 'Sair da conta?' }).getByRole('button', { name: 'Sair' }).click();
  }
}

test('visitante, usuário e administrador veem a barra certa no desktop e no celular', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  if (noDesktop(info)) {
    await expect(page.locator('eco-barra-superior nav a')).toHaveText(['Pontos de coleta']);
    await expect(page.locator('eco-barra-superior [eco-botao]')).toHaveText(['Entrar', 'Criar conta']);
  } else {
    await expect(page.locator('eco-cabecalho-celular').getByRole('link', { name: 'Entrar' })).toBeVisible();
    await expect(page.locator('eco-barra-inferior')).toHaveCount(0);
  }

  await page.goto('/entrar');
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(NA_BUSCA);
  await expect.poll(() => itensDaBarra(page, info)).toEqual(
    noDesktop(info) ? ['Pontos de coleta', 'Sugerir ponto', 'Minhas sugestões'] : ['Pontos', 'Sugerir', 'Minhas'],
  );

  await sair(page, info);
  await page.goto('/entrar');
  await entrarComo(page, 'admin@example.com');
  await expect(page).toHaveURL(NA_BUSCA);
  await expect.poll(() => itensDaBarra(page, info)).toEqual(
    noDesktop(info)
      ? ['Pontos de coleta', 'Sugerir ponto', 'Minhas sugestões', 'Painel']
      : ['Pontos', 'Sugerir', 'Minhas', 'Painel'],
  );
});

test('"Sugerir ponto" sem login leva a Entrar e, depois do login, de volta ao formulário', async ({ page }) => {
  await page.goto('/sugerir');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsugerir$/);

  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
});

test('usuário comum que digita o endereço do painel vê "Sem permissão", e o administrador vê o painel', async ({
  page,
}, info) => {
  await page.goto('/entrar');
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(NA_BUSCA);

  await page.goto('/painel');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Painel' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Voltar à busca' })).toHaveAttribute('href', '/');
  await chegarPeloTeclado(page, 'Voltar à busca');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(NA_BUSCA);

  await sair(page, info);
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel$/);
  await entrarComo(page, 'admin@example.com');
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
});

test('"Sair" encerra a sessão, e recarregar a página mantém logado quem não saiu', async ({ page }, info) => {
  await page.goto('/sugerir');
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
  await expect.poll(() => itensDaBarra(page, info)).toContain(noDesktop(info) ? 'Sugerir ponto' : 'Sugerir');

  await sair(page, info);
  await expect(page).toHaveURL(NA_BUSCA);
  await page.reload();
  await page.goto('/sugerir');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsugerir$/);
});

test('enquanto a sessão carrega, a barra fica sem itens de perfil', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('/entrar');
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(NA_BUSCA);

  await page.clock.pauseAt(Date.now() + 60_000);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await expect(page.locator('eco-barra-superior nav')).toHaveCount(0);
  await expect(page.locator('eco-barra-superior [eco-botao], eco-cabecalho-celular [eco-botao]')).toHaveCount(0);
  await expect(page.locator('eco-cabecalho-celular button[aria-label="Conta"]')).toHaveCount(0);

  await page.clock.runFor(400);
  await expect.poll(() => itensDaBarra(page, info)).toContain(noDesktop(info) ? 'Minhas sugestões' : 'Minhas');
});

test('quem já está logado e abre Entrar vai à página inicial', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'maria.souza@example.com');
  await expect(page).toHaveURL(NA_BUSCA);

  await page.goto('/entrar');
  await expect(page).toHaveURL(NA_BUSCA);
  await page.goto('/criar-conta');
  await expect(page).toHaveURL(NA_BUSCA);
});

test('um endereço que não existe mostra "Página não encontrada", com o caminho de volta pelo teclado', async ({
  page,
}) => {
  await page.goto('/nao-existe/de-jeito-nenhum');
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  await expect(page).toHaveTitle('Página não encontrada · EcoPonto');

  await chegarPeloTeclado(page, 'Ir para a busca');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(NA_BUSCA);
});
