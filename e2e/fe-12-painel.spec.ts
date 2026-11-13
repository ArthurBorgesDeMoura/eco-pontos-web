import { Locator, Page, TestInfo, expect, test } from '@playwright/test';

const DANIEL = 'Ecoponto Daniel Fonseca';
const CORU = 'Cooperativa dos Recicladores de Uberlândia (CORU)';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

function nomesDaFila(page: Page, info: TestInfo): Locator {
  return noDesktop(info) ? page.locator('eco-tabela .celula__nome') : page.locator('.painel__cartao .painel__nome');
}

function resumoDaFila(page: Page, info: TestInfo): Locator {
  return noDesktop(info) ? page.locator('.tabela__resumo') : page.locator('.painel__resumo');
}

function contadores(page: Page): Locator {
  return page.locator('[role="tab"] .abas__contagem');
}

function aviso(page: Page): Locator {
  return page.locator('eco-avisos eco-aviso');
}

function botao(page: Page, acao: 'Aprovar' | 'Recusar', ponto: string): Locator {
  return page.getByRole('button', { name: `${acao} ${ponto}`, exact: true }).filter({ visible: true });
}

async function entrarComo(page: Page, email: string, voltar = '/painel'): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function abrirPainel(page: Page): Promise<void> {
  await entrarComo(page, 'admin@example.com');
  await expect(page.getByRole('heading', { level: 1, name: 'Painel de administração' })).toBeVisible();
  await expect(contadores(page)).toHaveText(['2', '13', '10']);
}

async function irPelaBarra(page: Page, info: TestInfo, desktop: string, celular: string): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('eco-barra-superior nav').getByRole('link', { name: desktop }).click();
  } else {
    await page.locator('eco-barra-inferior').getByRole('link', { name: celular }).click();
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

test('aprovar um pendente o tira da fila, mostra o aviso e muda os contadores para 1, 14 e 10', async ({ page }, info) => {
  await abrirPainel(page);
  await expect(nomesDaFila(page, info)).toHaveText([DANIEL, CORU]);
  await expect(resumoDaFila(page, info)).toHaveText('2 sugestões aguardando análise');
  await expect(page.getByRole('tab', { name: 'Pendentes (2)', exact: true })).toHaveAttribute('aria-selected', 'true');

  await botao(page, 'Aprovar', DANIEL).click();
  await expect(aviso(page)).toHaveText(`${DANIEL} aprovado e publicado.`);
  await expect(nomesDaFila(page, info)).toHaveText([CORU]);
  await expect(contadores(page)).toHaveText(['1', '14', '10']);
  await expect(page.getByRole('tab', { name: 'Pontos (14)', exact: true })).toBeVisible();
  await expect(resumoDaFila(page, info)).toHaveText('1 sugestão aguardando análise');
});

test('o aprovado aparece na busca e o recusado não; a autora vê o recusado em Recusadas', async ({ page }, info) => {
  await abrirPainel(page);
  await botao(page, 'Aprovar', DANIEL).click();
  await expect(nomesDaFila(page, info)).toHaveText([CORU]);
  await botao(page, 'Recusar', CORU).click();
  await expect(aviso(page)).toHaveText(`${CORU} recusado.`);
  await expect(page.locator('.painel__estado-mensagem')).toHaveText('Nenhuma sugestão aguardando análise');
  await expect(contadores(page)).toHaveText(['0', '14', '10']);

  await irPelaBarra(page, info, 'Pontos de coleta', 'Pontos');
  await expect(page.locator('.busca__contagem')).toHaveText('14 pontos');
  await page.getByRole('button', { name: 'Mostrar mais' }).filter({ visible: true }).click();
  const naBusca = page.locator('.busca__lista .linha__nome');
  await expect(naBusca).toHaveCount(14);
  await expect(naBusca.filter({ hasText: DANIEL })).toHaveCount(1);
  await expect(naBusca.filter({ hasText: CORU })).toHaveCount(0);

  await sair(page, info);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  const barra = noDesktop(info) ? page.locator('eco-barra-superior') : page.locator('eco-cabecalho-celular');
  await barra.getByRole('link', { name: 'Entrar' }).click();
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await irPelaBarra(page, info, 'Minhas sugestões', 'Minhas');
  await page.getByRole('tab', { name: 'Recusadas' }).click();
  await expect(page.locator('eco-etiqueta-status').filter({ visible: true })).toHaveText(['Recusada']);
  await expect(page.locator('.celula__nome, .minhas__nome').filter({ visible: true })).toHaveText([CORU]);
});

test('um toque duplo em "Aprovar" decide uma vez só, e a tela segue inteira', async ({ page }, info) => {
  await abrirPainel(page);
  await botao(page, 'Aprovar', DANIEL).dblclick();
  await expect(aviso(page)).toHaveText(`${DANIEL} aprovado e publicado.`);
  await expect(contadores(page)).toHaveText(['1', '14', '10']);
  await page.waitForTimeout(700);
  await expect(aviso(page)).toHaveText(`${DANIEL} aprovado e publicado.`);
  await expect(nomesDaFila(page, info)).toHaveText([CORU]);
  await expect(botao(page, 'Aprovar', CORU)).not.toHaveAttribute('aria-disabled', 'true');
});

test('usuário comum vê "Sem permissão", e o visitante vai a Entrar', async ({ page }) => {
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel$/);
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Aprovar/ })).toHaveCount(0);
});

test('nos três tamanhos, sem rolagem lateral; no desktop, as medidas da D12; o aviso entra por baixo no celular', async ({
  page,
}, info) => {
  await abrirPainel(page);
  await expect(nomesDaFila(page, info)).toHaveText([DANIEL, CORU]);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  const medidas = await page.evaluate(() => {
    const caixa = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    return {
      titulo: caixa(document.querySelector('h1')),
      abas: [...document.querySelectorAll('[role="tab"]')].map(caixa),
      tabela: caixa(document.querySelector('eco-tabela')),
      cabecalho: caixa(document.querySelector('eco-tabela thead tr')),
      linhas: [...document.querySelectorAll('eco-tabela tbody tr')].map(caixa),
      colunas: [...document.querySelectorAll('eco-tabela thead th')].map(caixa),
      celula: [...document.querySelectorAll('eco-tabela tbody tr:first-child eco-celula-ponto > span')].map(caixa),
      autor: caixa(document.querySelector('eco-tabela .painel__autor')),
      botoes: [...document.querySelectorAll('eco-tabela tbody tr:first-child button')].map(caixa),
      rodape: caixa(document.querySelector('.tabela__rodape')),
      botoesDosCartoes: [...document.querySelectorAll('.painel__cartao button')].map(caixa),
    };
  });

  if (noDesktop(info)) {
    expect(medidas.titulo?.[1]).toBe(104);
    expect(medidas.abas.map((aba) => [aba?.[1], aba?.[3]])).toEqual(Array(3).fill([184, 44]));
    expect(medidas.tabela).toEqual([160, 252, 1120, 269]);
    expect(medidas.cabecalho?.[3]).toBe(39);
    expect(medidas.linhas.map((linha) => linha?.[3])).toEqual([93, 93]);
    expect(medidas.colunas.map((coluna) => coluna?.[2])).toEqual([462, 284, 164, 208]);
    const topo = medidas.linhas[0]?.[1] ?? 0;
    expect(medidas.celula.map((linha) => [(linha?.[1] ?? 0) - topo, linha?.[3]])).toEqual([
      [16, 20],
      [38, 18],
      [58, 18],
    ]);
    expect(medidas.autor?.[3]).toBe(20);
    expect(medidas.botoes.map((item) => item?.[3])).toEqual([32, 32]);
    const [recusar, aprovar] = medidas.botoes;
    expect((aprovar?.[0] ?? 0) - ((recusar?.[0] ?? 0) + (recusar?.[2] ?? 0))).toBe(8);
    expect((aprovar?.[0] ?? 0) + (aprovar?.[2] ?? 0)).toBe(1259);
    expect(Math.abs((recusar?.[2] ?? 0) - 72)).toBeLessThanOrEqual(2);
    expect(Math.abs((aprovar?.[2] ?? 0) - 73)).toBeLessThanOrEqual(2);
    expect(medidas.rodape?.[3]).toBe(42);
  } else {
    expect(medidas.tabela?.[2]).toBe(0);
    expect(medidas.botoesDosCartoes.every((item) => item?.[3] === 44)).toBe(true);
    await expect(page.locator('eco-barra-inferior a')).toHaveText(['Pontos', 'Sugerir', 'Minhas', 'Painel']);
    await expect(page.locator('eco-barra-inferior a[aria-current="page"]')).toHaveText('Painel');
  }
  await page.screenshot({ path: `test-results/capturas/painel-${info.project.name}.png`, fullPage: true });

  await botao(page, 'Aprovar', DANIEL).click();
  await expect(aviso(page)).toHaveText(`${DANIEL} aprovado e publicado.`);
  await aviso(page).evaluate((elemento) => Promise.all(elemento.getAnimations().map((animacao) => animacao.finished)));
  const caixa = await aviso(page).boundingBox();
  const { width: largura, height: altura } = page.viewportSize() ?? { width: 0, height: 0 };
  const deslocamento = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--deslocamento-aviso').trim(),
  );
  expect(Math.abs((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2 - largura / 2)).toBeLessThan(1);
  if (noDesktop(info)) {
    expect(caixa?.y).toBe(80);
    expect(deslocamento).toBe('-100%');
  } else {
    expect((caixa?.y ?? 0) + (caixa?.height ?? 0)).toBe(altura - 100);
    expect(deslocamento).toBe('100%');
  }
  await page.screenshot({ path: `test-results/capturas/painel-depois-de-aprovar-${info.project.name}.png`, fullPage: true });
});

test('só com o teclado: Tab até "Aprovar", Enter decide, e o foco vai ao "Aprovar" da linha seguinte', async ({ page }) => {
  await abrirPainel(page);
  const alvo = botao(page, 'Aprovar', DANIEL);
  await expect(alvo).toBeVisible();
  for (let passo = 0; passo < 30; passo++) {
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(contorno, `foco visível no passo ${passo + 1}`).not.toBe('none');
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) {
      break;
    }
  }
  await expect(alvo).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(aviso(page)).toHaveText(`${DANIEL} aprovado e publicado.`);
  const seguinte = botao(page, 'Aprovar', CORU);
  await expect(seguinte).toBeFocused();
  expect(await seguinte.evaluate((elemento) => getComputedStyle(elemento).outlineStyle)).not.toBe('none');

  await page.keyboard.press('Shift+Tab');
  await expect(botao(page, 'Recusar', CORU)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.painel__estado-mensagem')).toBeFocused();
});

for (const reduzir of [false, true]) {
  test(`a linha decidida esmaece por ${reduzir ? '150 ms (reduzir movimento)' : '160 ms'} e sai`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: reduzir ? 'reduce' : 'no-preference' });
    await page.clock.install();
    await abrirPainel(page);
    await expect(nomesDaFila(page, info)).toHaveText([DANIEL, CORU]);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

    await botao(page, 'Aprovar', DANIEL).click();
    await page.clock.runFor(350);
    const linha = noDesktop(info) ? page.locator('eco-tabela tbody tr').first() : page.locator('.painel__cartao').first();
    await expect(linha).toHaveClass(/saindo/);
    const animacao = await linha.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return [estilo.animationName, estilo.animationDuration];
    });
    expect(animacao).toEqual(['eco-esmaecer-sair', reduzir ? '0.15s' : '0.16s']);
    await expect(nomesDaFila(page, info)).toHaveText([DANIEL, CORU]);

    await page.clock.runFor(200);
    await expect(nomesDaFila(page, info)).toHaveText([CORU]);
  });
}
