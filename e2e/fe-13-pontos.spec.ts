import { Locator, Page, TestInfo, expect, test } from '@playwright/test';

const BRETAS = 'Bretas - Loja 518';
const D14 = [
  'Drogaria São Paulo - DSP Uberlândia III',
  'Pão de Açúcar',
  'Drogasil - Uberlândia 14',
  BRETAS,
  'Casas Bahia',
  'Drogasil - Uberlândia 11',
  'Ecoponto Luizote de Freitas',
];
const D17 = [...D14.filter((nome) => nome !== BRETAS), 'Atacadão'];

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

function nomes(page: Page, info: TestInfo): Locator {
  return noDesktop(info)
    ? page.locator('eco-painel-pontos eco-tabela .celula__nome')
    : page.locator('eco-painel-pontos .painel__cartao .painel__nome');
}

function resumo(page: Page, info: TestInfo): Locator {
  return noDesktop(info) ? page.locator('eco-painel-pontos .tabela__resumo') : page.locator('eco-painel-pontos .painel__resumo');
}

function contadores(page: Page): Locator {
  return page.locator('[role="tab"] .abas__contagem');
}

function aviso(page: Page): Locator {
  return page.locator('eco-avisos eco-aviso');
}

function acao(page: Page, nome: 'Editar' | 'Excluir', ponto: string): Locator {
  const papel = nome === 'Editar' ? 'link' : 'button';
  return page.getByRole(papel, { name: `${nome} ${ponto}`, exact: true }).filter({ visible: true });
}

function dialogo(page: Page, ponto = BRETAS): Locator {
  return page.getByRole('alertdialog', { name: `Excluir “${ponto}”?` });
}

async function entrarComo(page: Page, email: string, voltar: string): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function abrirPontos(page: Page, info: TestInfo): Promise<void> {
  await entrarComo(page, 'admin@example.com', '/painel?aba=pontos');
  await expect(page.getByRole('tab', { name: 'Pontos (13)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(nomes(page, info)).toHaveText(D14);
  await expect(resumo(page, info)).toHaveText('Mostrando 7 de 13 pontos');
}

async function irPelaBarra(page: Page, info: TestInfo, desktop: string, celular: string): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior nav').getByRole('link', { name: desktop }).click();
  } else {
    await page.locator('eco-barra-inferior').getByRole('link', { name: celular }).click();
  }
}

async function tabAte(page: Page, alvo: Locator, limite = 40): Promise<void> {
  await expect(alvo).toBeVisible();
  for (let passo = 0; passo < limite; passo++) {
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(contorno, `foco visível no passo ${passo + 1}`).not.toBe('none');
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      return;
    }
  }
  await expect(alvo).toBeFocused();
}

test('editar o nome de um ponto muda a linha da lista (com o foco no "Editar" dela) e a busca pública', async ({ page }, info) => {
  await abrirPontos(page, info);
  await acao(page, 'Editar', BRETAS).click();
  await expect(page).toHaveURL(/\/painel\/pontos\/4\/editar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editar ponto' })).toBeVisible();
  const nome = page.getByLabel('Nome do ponto');
  await expect(nome).toHaveValue(BRETAS);
  await expect(page.getByLabel('Endereço')).toHaveValue('Av. João Pinheiro, 77');
  await expect(page.locator('[data-campo="idBairro"] [role="combobox"]')).toHaveText('Centro');
  await expect(page.getByRole('checkbox', { name: 'Lâmpadas' })).toBeChecked();

  await nome.fill('Bretas - Loja 518 Centro');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(aviso(page)).toHaveText('Ponto atualizado.');
  await expect(page).toHaveURL(/\/painel\?aba=pontos$/);
  const novo = [...D14];
  novo[3] = 'Bretas - Loja 518 Centro';
  await expect(nomes(page, info)).toHaveText(novo);
  await expect(acao(page, 'Editar', 'Bretas - Loja 518 Centro')).toBeFocused();

  await irPelaBarra(page, info, 'Pontos de coleta', 'Pontos');
  const naBusca = page.locator('.busca__lista .linha__nome');
  await expect(naBusca.filter({ hasText: 'Bretas - Loja 518 Centro' })).toHaveCount(1);
  await expect(naBusca.filter({ hasText: /^Bretas - Loja 518$/ })).toHaveCount(0);
});

test('excluir o Bretas - Loja 518 mostra o diálogo, tira a linha e leva o total a 12 (D17)', async ({ page }, info) => {
  await abrirPontos(page, info);
  await acao(page, 'Excluir', BRETAS).click();
  await expect(dialogo(page)).toBeVisible();
  await expect(dialogo(page)).toContainText('Ele sai da busca e da lista do painel. Essa ação não pode ser desfeita.');
  await expect(dialogo(page).getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await expect(page.locator('.tela')).toHaveAttribute('inert', '');

  await dialogo(page).getByRole('button', { name: 'Excluir ponto' }).click();
  await expect(dialogo(page)).toBeHidden();
  await expect(aviso(page)).toHaveText(`${BRETAS} excluído.`);
  await expect(nomes(page, info)).toHaveText(D17);
  await expect(resumo(page, info)).toHaveText('Mostrando 7 de 12 pontos');
  await expect(contadores(page)).toHaveText(['2', '12', '10']);
  await expect(page.getByRole('tab', { name: 'Pontos (12)', exact: true })).toBeVisible();

  await irPelaBarra(page, info, 'Pontos de coleta', 'Pontos');
  await expect(page.locator('.busca__contagem')).toHaveText('12 pontos');
  await expect(page.locator('.busca__lista .linha__nome').filter({ hasText: BRETAS })).toHaveCount(0);
});

test('só com o teclado: o diálogo prende o Tab, fecha com Esc e com "Cancelar" e devolve o foco ao "Excluir"', async ({
  page,
}, info) => {
  await abrirPontos(page, info);
  const excluir = acao(page, 'Excluir', BRETAS);
  await tabAte(page, excluir);

  await page.keyboard.press('Enter');
  const cancelar = dialogo(page).getByRole('button', { name: 'Cancelar' });
  const confirmar = dialogo(page).getByRole('button', { name: 'Excluir ponto' });
  await expect(cancelar).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(confirmar).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancelar).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirmar).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toBeHidden();
  await expect(excluir).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(cancelar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialogo(page)).toBeHidden();
  await expect(excluir).toBeFocused();
  await expect(nomes(page, info)).toHaveText(D14);

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(confirmar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(nomes(page, info)).toHaveText(D17);
  await expect(acao(page, 'Excluir', 'Casas Bahia')).toBeFocused();
});

test('só com o teclado: "Editar", Enter no nome salva, e o foco volta ao "Editar" da linha', async ({ page }, info) => {
  await abrirPontos(page, info);
  const editar = acao(page, 'Editar', 'Casas Bahia');
  await tabAte(page, editar);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Editar ponto' })).toBeFocused();
  await page.keyboard.press('Tab');
  const nome = page.getByLabel('Nome do ponto');
  await expect(nome).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' - Centro');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toHaveText('Ponto atualizado.');
  await expect(acao(page, 'Editar', 'Casas Bahia - Centro')).toBeFocused();
});

test('"Mostrar mais" carrega os pontos restantes: os 13, sem o botão, e o foco vai ao resumo', async ({ page }, info) => {
  await abrirPontos(page, info);
  await page.getByRole('button', { name: 'Mostrar mais' }).filter({ visible: true }).click();
  await expect(nomes(page, info)).toHaveCount(13);
  await expect(resumo(page, info)).toHaveText('Mostrando 13 de 13 pontos');
  await expect(page.getByRole('button', { name: 'Mostrar mais' }).filter({ visible: true })).toHaveCount(0);
  await expect(resumo(page, info)).toBeFocused();
});

test('só o administrador abre a aba Pontos e a edição: o visitante vai a Entrar, e o usuário comum vê "Sem permissão"', async ({
  page,
}) => {
  await page.goto('/painel?aba=pontos');
  await expect(page).toHaveURL(/\/entrar\?voltar=/);
  await page.goto('/painel/pontos/4/editar');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel%2Fpontos%2F4%2Feditar$/);

  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByLabel('Nome do ponto')).toHaveCount(0);

  await page.goto('/painel?aba=pontos');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('button', { name: /^Excluir/ })).toHaveCount(0);
});

test('nos três tamanhos, sem rolagem lateral; no desktop, as medidas da D14, da D15 e da D17', async ({ page }, info) => {
  await abrirPontos(page, info);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  const medidas = await page.evaluate(() => {
    const caixa = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    return {
      tabela: caixa(document.querySelector('eco-painel-pontos eco-tabela')),
      linhas: [...document.querySelectorAll('eco-painel-pontos eco-tabela tbody tr')].map(caixa),
      colunas: [...document.querySelectorAll('eco-painel-pontos eco-tabela thead th')].map(caixa),
      botoes: [...document.querySelectorAll('eco-painel-pontos eco-tabela tbody tr:first-child [data-acao]')].map(caixa),
      rodape: caixa(document.querySelector('eco-painel-pontos .tabela__rodape')),
      acoesDosCartoes: [...document.querySelectorAll('eco-painel-pontos .painel__cartao [data-acao]')].map(caixa),
    };
  });

  if (noDesktop(info)) {
    expect(medidas.tabela).toEqual([160, 252, 1120, 608]);
    expect(medidas.linhas.map((linha) => linha?.[1])).toEqual([292, 365, 438, 511, 584, 657, 730]);
    expect(medidas.colunas.map((coluna) => coluna?.[2])).toEqual([646, 284, 188]);
    const [editar, excluir] = medidas.botoes;
    expect(medidas.botoes.map((item) => [(item?.[1] ?? 0) - 292, item?.[3]])).toEqual([
      [20, 32],
      [20, 32],
    ]);
    expect((excluir?.[0] ?? 0) - ((editar?.[0] ?? 0) + (editar?.[2] ?? 0))).toBe(8);
    expect((excluir?.[0] ?? 0) + (excluir?.[2] ?? 0)).toBe(1259);
    expect(Math.abs((editar?.[2] ?? 0) - 60)).toBeLessThanOrEqual(2);
    expect(Math.abs((excluir?.[2] ?? 0) - 65)).toBeLessThanOrEqual(2);
    expect(medidas.rodape?.[1]).toBe(803);
    expect(medidas.rodape?.[3]).toBe(56);
  } else {
    expect(medidas.tabela?.[2]).toBe(0);
    expect(medidas.acoesDosCartoes.length).toBe(14);
    expect(medidas.acoesDosCartoes.every((item) => item?.[3] === 44)).toBe(true);
  }
  await page.screenshot({ path: `test-results/capturas/pontos-${info.project.name}.png`, fullPage: true });

  await acao(page, 'Excluir', BRETAS).click();
  const janela = page.locator('.dialogo__janela');
  await expect(janela).toBeVisible();
  await janela.evaluate((elemento) => Promise.all(elemento.getAnimations().map((animacao) => animacao.finished)));
  const { width: largura, height: altura } = page.viewportSize() ?? { width: 0, height: 0 };
  const caixaDoDialogo = await janela.boundingBox();
  expect(Math.round(caixaDoDialogo?.width ?? 0)).toBe(Math.min(440, largura - 32));
  const linhas = await page.evaluate(() =>
    ['.dialogo__titulo', '.dialogo__texto'].map((seletor) => {
      const faixa = document.createRange();
      faixa.selectNodeContents(document.querySelector(seletor) as Element);
      return faixa.getClientRects().length;
    }),
  );
  if (largura >= 768) {
    expect(linhas).toEqual([1, 2]);
  }
  await expect(janela.getByRole('button', { name: 'Excluir ponto' })).toHaveClass(/botao--exclusao/);
  await page.screenshot({ path: `test-results/capturas/pontos-dialogo-${info.project.name}.png` });

  await janela.getByRole('button', { name: 'Excluir ponto' }).click();
  await expect(aviso(page)).toHaveText(`${BRETAS} excluído.`);
  await expect(nomes(page, info)).toHaveText(D17);
  await aviso(page).evaluate((elemento) => Promise.all(elemento.getAnimations().map((animacao) => animacao.finished)));
  const caixaDoAviso = await aviso(page).boundingBox();
  expect(Math.abs((caixaDoAviso?.x ?? 0) + (caixaDoAviso?.width ?? 0) / 2 - largura / 2)).toBeLessThan(1);
  if (noDesktop(info)) {
    expect(caixaDoAviso?.y).toBe(80);
  } else {
    expect((caixaDoAviso?.y ?? 0) + (caixaDoAviso?.height ?? 0)).toBe(altura - 100);
  }
  await page.screenshot({ path: `test-results/capturas/pontos-depois-de-excluir-${info.project.name}.png`, fullPage: true });
});

test('no celular e no tablet, a edição usa o cabeçalho Interno, e o "Voltar" leva de volta à aba Pontos', async ({ page }, info) => {
  test.skip(noDesktop(info), 'o cabeçalho Interno é do celular e do tablet');
  await abrirPontos(page, info);
  await acao(page, 'Editar', BRETAS).click();
  const cabecalho = page.locator('eco-cabecalho-celular');
  await expect(cabecalho).toContainText('Editar ponto');
  await cabecalho.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=pontos$/);
  await expect(nomes(page, info)).toHaveText(D14);
  await expect(acao(page, 'Editar', BRETAS)).toBeFocused();

  await page.goto('/painel/pontos/4/editar');
  await expect(page.getByLabel('Nome do ponto')).toHaveValue(BRETAS);
  await cabecalho.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=pontos$/);
});

for (const reduzir of [false, true]) {
  test(`a linha excluída esmaece por ${reduzir ? '150 ms (reduzir movimento)' : '160 ms'} e sai`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: reduzir ? 'reduce' : 'no-preference' });
    await page.clock.install();
    await abrirPontos(page, info);
    await acao(page, 'Excluir', BRETAS).click();
    await expect(dialogo(page)).toBeVisible();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

    await dialogo(page).getByRole('button', { name: 'Excluir ponto' }).click();
    await page.clock.runFor(350);
    const linha = noDesktop(info)
      ? page.locator('eco-painel-pontos eco-tabela tbody tr').nth(3)
      : page.locator('eco-painel-pontos .painel__cartao').nth(3);
    await expect(linha).toHaveClass(/saindo/);
    const animacao = await linha.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return [estilo.animationName, estilo.animationDuration];
    });
    expect(animacao).toEqual(['eco-esmaecer-sair', reduzir ? '0.15s' : '0.16s']);
    await expect(nomes(page, info)).toHaveText(D14);

    await page.clock.runFor(600);
    await expect(nomes(page, info)).toHaveText(D17);
  });
}
