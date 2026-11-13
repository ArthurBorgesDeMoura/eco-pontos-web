import { Page, TestInfo, expect, test } from '@playwright/test';

const NA_BUSCA = /^https?:\/\/[^/]+\/$/;

const LOGIN_ERRADO = 'E-mail ou senha incorretos.';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

async function criarConta(page: Page, nome: string, email: string, senha: string): Promise<void> {
  await page.getByLabel('Nome').fill(nome);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();
}

async function esperarLogado(page: Page, info: TestInfo, nome: string, inicial: string): Promise<void> {
  await expect(page).toHaveURL(NA_BUSCA);
  if (noDesktop(info)) {
    await expect(page.locator('eco-barra-superior .barra__nome')).toHaveText(nome);
    await expect(page.locator('eco-barra-superior').getByRole('button', { name: 'Sair' })).toBeVisible();
  } else {
    await expect(page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Conta' })).toHaveText(inicial);
    await expect(page.locator('eco-barra-inferior a')).toHaveText(['Pontos', 'Sugerir', 'Minhas']);
  }
}

async function sair(page: Page, info: TestInfo): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior').getByRole('button', { name: 'Sair' }).click();
  } else {
    await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Conta' }).click();
    await page.getByRole('alertdialog', { name: 'Sair da conta?' }).getByRole('button', { name: 'Sair' }).click();
  }
}

async function irParaEntrar(page: Page, info: TestInfo): Promise<void> {
  const barra = noDesktop(info) ? page.locator('eco-barra-superior') : page.locator('eco-cabecalho-celular');
  await barra.getByRole('link', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
}

test('criar uma conta válida leva à página inicial, já logado, com o nome na barra', async ({ page }, info) => {
  await page.goto('/criar-conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();

  await criarConta(page, 'Ana Lima', 'ana.lima@example.com', 'senha-segura-1');
  await esperarLogado(page, info, 'Ana Lima', 'A');
});

test('e-mail repetido mostra o erro no campo e-mail', async ({ page }) => {
  await page.goto('/criar-conta');
  await criarConta(page, 'Outra Maria', 'maria.souza@example.com', 'senha-segura-1');

  const email = page.getByLabel('E-mail');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toBeFocused();
  const descricao = await email.getAttribute('aria-describedby');
  await expect(page.locator(`#${descricao}`)).toHaveText('Este e-mail já tem conta. Entre ou use outro e-mail.');
  await expect(page).toHaveURL(/\/criar-conta$/);
});

test('senha errada mostra a mensagem única; a certa entra', async ({ page }, info) => {
  await page.goto('/criar-conta');
  await criarConta(page, 'Ana Lima', 'ana.lima@example.com', 'senha-segura-1');
  await esperarLogado(page, info, 'Ana Lima', 'A');
  await sair(page, info);
  await irParaEntrar(page, info);

  await page.getByLabel('E-mail').fill('ana.lima@example.com');
  await page.getByLabel('Senha').fill('outra-senha');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(LOGIN_ERRADO);
  await expect(page.getByLabel('E-mail')).not.toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('E-mail').fill('ninguem@example.com');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(LOGIN_ERRADO);

  await page.getByLabel('E-mail').fill('ana.lima@example.com');
  await page.getByLabel('Senha').fill('senha-segura-1');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await esperarLogado(page, info, 'Ana Lima', 'A');
});

test('a senha fica escondida e os campos têm o preenchimento automático certo', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByLabel('E-mail')).toHaveAttribute('type', 'email');
  await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Senha')).toHaveAttribute('type', 'password');
  await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'current-password');

  await page.goto('/criar-conta');
  await expect(page.getByLabel('Nome')).toHaveAttribute('autocomplete', 'name');
  await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Senha')).toHaveAttribute('type', 'password');
  await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'new-password');
});

async function focoVisivel(page: Page): Promise<{ nome: string; visivel: boolean }> {
  return page.evaluate(() => {
    const ativo = document.activeElement as HTMLElement;
    const caixa = ativo.closest('.campo__caixa');
    const estilo = getComputedStyle(ativo);
    const contorno = estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
    const anel = !!caixa && getComputedStyle(caixa).boxShadow !== 'none';
    const nome = (ativo.getAttribute('aria-label') ?? ativo.textContent ?? ativo.id).replace(/\s+/g, ' ').trim();
    return { nome: `${ativo.tagName.toLowerCase()} ${nome}`, visivel: contorno || anel };
  });
}

test('Criar conta funciona só com o teclado: Tab, digitar e Enter, com foco visível', async ({ page }, info) => {
  await page.goto('/criar-conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();

  await page.keyboard.press('Tab');
  expect((await focoVisivel(page)).visivel).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Nome')).toBeFocused();
  expect((await focoVisivel(page)).visivel).toBe(true);

  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Nome')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Senha')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Nome')).toBeFocused();

  await page.keyboard.type('Ana Lima');
  await page.keyboard.press('Tab');
  await page.keyboard.type('ana.lima@example.com');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha')).toBeFocused();
  await page.keyboard.type('senha-segura-1');
  await page.keyboard.press('Tab');
  await expect(page.locator('form').getByRole('button', { name: 'Criar conta' })).toBeFocused();
  expect((await focoVisivel(page)).visivel).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Entrar' }).last()).toBeFocused();
  expect((await focoVisivel(page)).visivel).toBe(true);

  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await esperarLogado(page, info, 'Ana Lima', 'A');
});

test('Entrar funciona só com o teclado e leva o foco ao campo com erro', async ({ page }, info) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('E-mail')).toBeFocused();
  await page.keyboard.type('admin@example');
  await page.keyboard.press('Tab');
  await page.keyboard.type('senha-de-teste');
  await page.keyboard.press('Enter');

  await expect(page.getByLabel('E-mail')).toBeFocused();
  await expect(page.getByText('Digite um e-mail válido, como nome@exemplo.com.')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.type('.com');
  await expect(page.getByLabel('E-mail')).not.toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(NA_BUSCA);
  if (noDesktop(info)) {
    await expect(page.locator('eco-barra-superior nav a')).toHaveText([
      'Pontos de coleta',
      'Sugerir ponto',
      'Minhas sugestões',
      'Painel',
    ]);
  } else {
    await expect(page.locator('eco-barra-inferior a')).toHaveText(['Pontos', 'Sugerir', 'Minhas', 'Painel']);
  }
});

test('enquanto envia, o botão diz "Entrando…" e fica indisponível; o destino esmaece em 160 ms', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.clock.pauseAt(Date.now() + 60_000);

  const pedidos: string[] = [];
  page.on('request', (pedido) => pedido.url().includes('/api/') && pedidos.push(pedido.url()));
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  const botao = page.locator('form button[type="submit"]');
  await botao.click();

  await expect(botao).toHaveText('Entrando…');
  await expect(botao).toHaveAttribute('aria-disabled', 'true');
  await botao.click({ force: true });
  await page.keyboard.press('Enter');

  await page.clock.runFor(400);
  await expect(page).toHaveURL(NA_BUSCA);
  const pagina = page.locator('.tela > router-outlet + *');
  await expect(pagina).toHaveCSS('animation-name', 'eco-esmaecer-entrar');
  await expect(pagina).toHaveCSS('animation-duration', '0.16s');
  expect(pedidos, 'nenhuma chamada passa da simulação').toEqual([]);
});

test('no celular e no tablet, campos, botão e links têm alvo de 44 px', async ({ page }, info) => {
  test.skip(noDesktop(info), 'Os alvos de 44 px valem no celular e no tablet.');

  for (const caminho of ['/entrar', '/criar-conta']) {
    await page.goto(caminho);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const pequenos = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('main input, main button, main a, header a, header button'))
        .map((elemento) => {
          const alvo = (elemento.closest('.campo__caixa') as HTMLElement | null) ?? elemento;
          const caixa = alvo.getBoundingClientRect();
          const depois = getComputedStyle(alvo, '::after');
          const extra = depois.content !== 'none' && depois.position === 'absolute' ? parseFloat(depois.height) || 0 : 0;
          const altura = Math.max(caixa.height, extra);
          const texto = (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '').trim();
          return { nome: `${elemento.tagName.toLowerCase()} "${texto.slice(0, 30)}"`, altura, visivel: caixa.height > 0 };
        })
        .filter((alvo) => alvo.visivel && alvo.altura < 44)
        .map((alvo) => `${alvo.nome}: ${Math.round(alvo.altura)} px`),
    );
    expect(pequenos, caminho).toEqual([]);
  }
});
