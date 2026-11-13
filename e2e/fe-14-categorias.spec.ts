import { Locator, Page, TestInfo, expect, test } from '@playwright/test';

const D16: [nome: string, pontos: number][] = [
  ['Papel e papelão', 3],
  ['Plástico', 3],
  ['Metal', 3],
  ['Vidro', 3],
  ['Eletrônicos', 2],
  ['Pilhas e baterias', 6],
  ['Lâmpadas', 3],
  ['Óleo de cozinha usado', 2],
  ['Medicamentos vencidos', 3],
  ['Entulho e volumosos', 1],
];
const REPETIDO = 'Já existe uma categoria com este nome.';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

function nomes(page: Page, info: TestInfo): Locator {
  return noDesktop(info)
    ? page.locator('eco-painel-categorias eco-tabela .categorias__nome')
    : page.locator('eco-painel-categorias .painel__cartao .painel__nome');
}

async function pontos(page: Page, info: TestInfo): Promise<number[]> {
  const textos = noDesktop(info)
    ? await page.locator('eco-painel-categorias eco-tabela .categorias__pontos').allTextContents()
    : await page.locator('eco-painel-categorias .painel__cartao .painel__materiais').allTextContents();
  return textos.map((texto) => Number(texto.trim().split(' ')[0]));
}

function resumo(page: Page, info: TestInfo): Locator {
  return noDesktop(info)
    ? page.locator('eco-painel-categorias .tabela__resumo')
    : page.locator('eco-painel-categorias .painel__resumo');
}

function aviso(page: Page): Locator {
  return page.locator('eco-avisos eco-aviso');
}

function editar(page: Page, categoria: string): Locator {
  return page.getByRole('link', { name: `Editar ${categoria}`, exact: true }).filter({ visible: true });
}

function novaCategoria(page: Page): Locator {
  return page.getByRole('link', { name: 'Nova categoria', exact: true });
}

function erroDoNome(page: Page): Locator {
  return page.locator('[data-campo="nome"] .campo__erro');
}

async function entrarComo(page: Page, email: string, voltar: string): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function abrirCategorias(page: Page, info: TestInfo): Promise<void> {
  await entrarComo(page, 'admin@example.com', '/painel?aba=categorias');
  await expect(page.getByRole('tab', { name: 'Categorias (10)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(nomes(page, info)).toHaveText(D16.map(([nome]) => nome));
  await expect(resumo(page, info)).toHaveText('10 categorias');
}

async function irParaABusca(page: Page, info: TestInfo): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior nav').getByRole('link', { name: 'Pontos de coleta' }).click();
  } else {
    await page.locator('eco-barra-inferior').getByRole('link', { name: 'Pontos' }).click();
  }
  await expect(page.locator('.busca__resumo')).toBeVisible();
}

async function escolherMaterial(page: Page, info: TestInfo, material: string): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: new RegExp(`^${material}`) }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: new RegExp(`^${material}`) }).click();
  }
}

async function materialNoFiltro(page: Page, info: TestInfo, material: string): Promise<string> {
  if (noDesktop(info)) {
    const item = page.locator('.busca__materiais').getByRole('button', { name: new RegExp(`^${material}`) });
    return (await item.innerText()).replace(/\s+/g, ' ').trim();
  }
  await page.locator('.busca__material-seletor [role="combobox"]').click();
  const opcao = page.locator('.busca__material-seletor [role="option"]').filter({ hasText: material });
  const texto = (await opcao.innerText()).replace(/\s+/g, ' ').trim();
  await page.keyboard.press('Escape');
  return texto;
}

async function tabAte(page: Page, alvo: Locator, limite = 40, tecla = 'Tab'): Promise<void> {
  await expect(alvo).toBeVisible();
  for (let passo = 0; passo < limite; passo++) {
    await page.keyboard.press(tecla);
    const contorno = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(contorno, `foco visível no passo ${passo + 1}`).not.toBe('none');
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      return;
    }
  }
  await expect(alvo).toBeFocused();
}

test('a tabela mostra as 10 categorias do script, com os pontos aprovados de cada uma', async ({ page }, info) => {
  await abrirCategorias(page, info);
  expect(await pontos(page, info)).toEqual(D16.map(([, quantidade]) => quantidade));
  if (noDesktop(info)) {
    await expect(page.locator('eco-painel-categorias eco-tabela thead th')).toHaveText(['Categoria', 'Descrição', 'Pontos', 'Ações']);
    await expect(page.locator('eco-painel-categorias eco-tabela tbody tr').first().locator('td').nth(1)).toHaveText(
      'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
    );
  } else {
    await expect(page.locator('eco-painel-categorias .painel__cartao .painel__local').first()).toHaveText(
      'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
    );
  }
  await expect(page.locator('eco-painel-categorias').getByRole('button', { name: /^Excluir/ })).toHaveCount(0);
});

test('criar uma categoria a põe na tabela com 0 pontos, no contador e no filtro de materiais da busca', async ({ page }, info) => {
  await abrirCategorias(page, info);
  await novaCategoria(page).click();
  await expect(page).toHaveURL(/\/painel\/categorias\/nova$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nova categoria' })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Isopor');
  await page.getByLabel('Descrição (opcional)').fill('Bandejas, caixas e embalagens de isopor limpas.');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();

  await expect(aviso(page)).toHaveText('Categoria cadastrada.');
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(nomes(page, info)).toHaveText([...D16.map(([nome]) => nome), 'Isopor']);
  expect((await pontos(page, info)).at(-1)).toBe(0);
  await expect(resumo(page, info)).toHaveText('11 categorias');
  await expect(page.getByRole('tab', { name: 'Categorias (11)', exact: true })).toBeVisible();
  await expect(editar(page, 'Isopor')).toBeFocused();

  await irParaABusca(page, info);
  expect(await materialNoFiltro(page, info, 'Isopor')).toMatch(/^Isopor\b.*\b0\b/);
});

test('editar muda nome e descrição sem perder os pontos vinculados', async ({ page }, info) => {
  await abrirCategorias(page, info);
  await editar(page, 'Pilhas e baterias').click();
  await expect(page).toHaveURL(/\/painel\/categorias\/6\/editar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editar categoria' })).toBeVisible();
  const nome = page.getByLabel('Nome', { exact: true });
  await expect(nome).toHaveValue('Pilhas e baterias');
  await expect(page.getByLabel('Descrição (opcional)')).toHaveValue('Pilhas e baterias usadas, que não podem ir para o lixo comum.');

  await nome.fill('Pilhas, baterias e carregadores');
  await page.getByLabel('Descrição (opcional)').fill('Pilhas, baterias e carregadores sem uso.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(aviso(page)).toHaveText('Categoria atualizada.');
  const novos = D16.map(([item]) => item);
  novos[5] = 'Pilhas, baterias e carregadores';
  await expect(nomes(page, info)).toHaveText(novos);
  expect((await pontos(page, info))[5]).toBe(6);
  await expect(editar(page, 'Pilhas, baterias e carregadores')).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Categorias (10)', exact: true })).toBeVisible();

  await irParaABusca(page, info);
  await escolherMaterial(page, info, 'Pilhas, baterias e carregadores');
  await expect(page.locator('.busca__contagem')).toHaveText('6 pontos aceitam Pilhas, baterias e carregadores');
  await expect(page.locator('.busca__descricao')).toHaveText('Pilhas, baterias e carregadores sem uso.');
});

test('nome repetido mostra o erro no campo, sem fechar o formulário; corrigido, a categoria entra', async ({ page }, info) => {
  await abrirCategorias(page, info);
  await novaCategoria(page).click();
  const nome = page.getByLabel('Nome', { exact: true });
  await nome.fill('plástico');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(erroDoNome(page)).toHaveText(REPETIDO);
  await expect(page).toHaveURL(/\/painel\/categorias\/nova$/);
  await expect(nome).toBeFocused();
  await expect(nome).toHaveValue('plástico');
  await expect(nome).toHaveAttribute('aria-invalid', 'true');

  await nome.fill('Plástico filme');
  await expect(erroDoNome(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(aviso(page)).toHaveText('Categoria cadastrada.');
  await expect(nomes(page, info).last()).toHaveText('Plástico filme');
});

test('só o administrador abre a aba e os formulários: o visitante vai a Entrar, e o usuário comum vê "Sem permissão"', async ({
  page,
}) => {
  await page.goto('/painel?aba=categorias');
  await expect(page).toHaveURL(/\/entrar\?voltar=/);
  await page.goto('/painel/categorias/nova');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel%2Fcategorias%2Fnova$/);

  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByLabel('Nome', { exact: true })).toHaveCount(0);

  await page.goto('/painel/categorias/6/editar');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await page.goto('/painel?aba=categorias');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(novaCategoria(page)).toHaveCount(0);
});

test('aberto sem login, Entrar leva ao formulário, e "Cancelar" volta à aba Categorias (Entrar sai do histórico)', async ({ page }) => {
  await page.goto('/painel/categorias/nova');
  await expect(page).toHaveURL(/\/entrar\?voltar=/);
  await page.getByLabel('E-mail').fill('admin@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel\/categorias\/nova$/);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(page.getByRole('tab', { name: 'Categorias (10)', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('a sessão termina no formulário: depois de entrar de novo, salvar volta à aba Categorias, com a categoria nova', async ({
  page,
}, info) => {
  await abrirCategorias(page, info);
  await novaCategoria(page).click();
  await expect(page.getByLabel('Nome', { exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem('ecoponto.simulacao.sessao'));
  await page.getByLabel('Nome', { exact: true }).fill('Isopor');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel%2Fcategorias%2Fnova&motivo=sessao$/);
  await page.getByLabel('E-mail').fill('admin@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel\/categorias\/nova$/);
  await page.getByLabel('Nome', { exact: true }).fill('Isopor');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(aviso(page)).toHaveText('Categoria cadastrada.');
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(nomes(page, info).last()).toHaveText('Isopor');
});

test('depois de criar uma categoria, a busca retomada pelo "voltar" do navegador já tem o material novo', async ({ page }, info) => {
  await entrarComo(page, 'admin@example.com', '/');
  await expect(page.locator('.busca__resumo')).toBeVisible();
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior nav').getByRole('link', { name: 'Painel' }).click();
  } else {
    await page.locator('eco-barra-inferior').getByRole('link', { name: 'Painel' }).click();
  }
  await page.getByRole('tab', { name: 'Categorias (10)', exact: true }).click();
  await novaCategoria(page).click();
  await page.getByLabel('Nome', { exact: true }).fill('Isopor');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(nomes(page, info).last()).toHaveText('Isopor');

  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.busca__resumo')).toBeVisible();
  expect(await materialNoFiltro(page, info, 'Isopor')).toMatch(/^Isopor\b/);
});

test('só com o teclado: "Nova categoria", Enter no nome cadastra, e o foco volta ao "Editar" dela; cancelar volta ao botão', async ({
  page,
}, info) => {
  await abrirCategorias(page, info);
  await tabAte(page, novaCategoria(page));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Nova categoria' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Nome', { exact: true })).toBeFocused();
  await page.keyboard.type('Isopor');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toHaveText('Categoria cadastrada.');
  await expect(editar(page, 'Isopor')).toBeFocused();

  await tabAte(page, novaCategoria(page), 40, 'Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Nova categoria' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Nome', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Descrição (opcional)')).toBeFocused();
  await page.keyboard.press('Tab');
  const cancelar = page.getByRole('button', { name: 'Cancelar' });
  await expect(cancelar).toBeFocused();
  expect(await cancelar.evaluate((elemento) => getComputedStyle(elemento).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(novaCategoria(page)).toBeFocused();
});

test('nos três tamanhos, sem rolagem lateral; no desktop, as medidas da D16', async ({ page }, info) => {
  await abrirCategorias(page, info);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  const medidas = await page.evaluate(() => {
    const caixa = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    return {
      nova: caixa(document.querySelector('[data-acao="nova-categoria"]')),
      tabela: caixa(document.querySelector('eco-painel-categorias eco-tabela')),
      linhas: [...document.querySelectorAll('eco-painel-categorias eco-tabela tbody tr')].map(caixa),
      colunas: [...document.querySelectorAll('eco-painel-categorias eco-tabela thead th')].map(caixa),
      nome: caixa(document.querySelector('eco-painel-categorias eco-tabela .categorias__nome')),
      editar: caixa(document.querySelector('eco-painel-categorias eco-tabela [data-acao="editar"]')),
      rodape: caixa(document.querySelector('eco-painel-categorias .tabela__rodape')),
      editarDosCartoes: [...document.querySelectorAll('eco-painel-categorias .painel__cartao [data-acao="editar"]')].map(caixa),
    };
  });

  if (noDesktop(info)) {
    expect(medidas.tabela).toEqual([160, 252, 1120, 693]);
    expect(medidas.linhas.map((linha) => linha?.[1])).toEqual([292, 353, 414, 475, 536, 597, 658, 719, 780, 841]);
    expect(medidas.colunas.map((coluna) => coluna?.[2])).toEqual([232, 686, 96, 104]);
    expect((medidas.nome?.[1] ?? 0) - 292).toBe(20);
    expect([(medidas.editar?.[1] ?? 0) - 292, medidas.editar?.[3]]).toEqual([14, 32]);
    expect((medidas.editar?.[0] ?? 0) + (medidas.editar?.[2] ?? 0)).toBe(1259);
    expect(Math.abs((medidas.editar?.[2] ?? 0) - 60)).toBeLessThanOrEqual(2);
    expect(medidas.rodape?.[1]).toBe(902);
    expect(medidas.rodape?.[3]).toBe(42);
    expect(medidas.nova?.[1]).toBe(124);
    expect(medidas.nova?.[3]).toBe(36);
    expect((medidas.nova?.[0] ?? 0) + (medidas.nova?.[2] ?? 0)).toBe(1280);
    expect(Math.abs((medidas.nova?.[2] ?? 0) - 125)).toBeLessThanOrEqual(3);
  } else {
    expect(medidas.tabela?.[2]).toBe(0);
    expect(medidas.editarDosCartoes.length).toBe(10);
    expect(medidas.editarDosCartoes.every((item) => item?.[3] === 44)).toBe(true);
    const { width: largura } = page.viewportSize() ?? { width: 0 };
    const margem = largura >= 768 ? 32 : 16;
    expect(medidas.nova).toEqual([margem, medidas.nova?.[1], largura - 2 * margem, 44]);
  }
  await page.screenshot({ path: `test-results/capturas/categorias-${info.project.name}.png`, fullPage: true });
});

test('no celular e no tablet, o formulário usa o cabeçalho Interno, e o "Voltar" leva de volta à aba', async ({ page }, info) => {
  test.skip(noDesktop(info), 'o cabeçalho Interno é do celular e do tablet');
  await abrirCategorias(page, info);
  await editar(page, 'Vidro').click();
  const cabecalho = page.locator('eco-cabecalho-celular');
  await expect(cabecalho).toContainText('Editar categoria');
  await cabecalho.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
  await expect(editar(page, 'Vidro')).toBeFocused();

  await page.goto('/painel/categorias/nova');
  await expect(page.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(cabecalho).toContainText('Nova categoria');
  await cabecalho.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
});
