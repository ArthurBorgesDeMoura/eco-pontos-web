import { Page, TestInfo, expect, test } from '@playwright/test';

const MAPA_DO_LUIZOTE =
  'https://www.google.com/maps/search/?api=1&query=Rua%20Wilson%20Gon%C3%A7alves%20de%20Souza%2C%2010%2C%20Luizote%20de%20Freitas%2C%20Uberl%C3%A2ndia%20-%20MG';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

const titulo = (page: Page) => page.getByRole('heading', { level: 1 });
const linhas = (page: Page) => page.locator('.busca__lista .linha__nome');
const linkDoPonto = (page: Page, nome: string) => page.locator('.busca__lista').getByRole('link', { name: nome, exact: true });

async function abrirBusca(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('.busca__resumo')).toBeVisible();
}

async function voltarPelaTela(page: Page, info: TestInfo): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('main').getByRole('link', { name: 'Pontos de coleta', exact: true }).click();
  } else {
    await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Voltar' }).click();
  }
}

test('o Ecoponto Luizote de Freitas abre com todos os campos e "Não informado" no contato', async ({ page }, info) => {
  await abrirBusca(page);
  await linkDoPonto(page, 'Ecoponto Luizote de Freitas').click();

  await expect(page).toHaveURL(/\/pontos\/13$/);
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
  await expect(page).toHaveTitle('Ecoponto Luizote de Freitas · EcoPonto');
  await expect(page.locator('.ponto__subtitulo')).toHaveText('Luizote de Freitas · Uberlândia – MG');
  await expect(page.locator('.ponto__rotulo')).toHaveText(['Endereço', 'Bairro', 'Horário de funcionamento', 'Contato']);
  await expect(page.locator('.ponto__valor')).toHaveText([
    'Rua Wilson Gonçalves de Souza, 10',
    'Luizote de Freitas',
    '7h às 19h, todos os dias',
    'Não informado',
  ]);
  await expect(page.locator('.ponto__material-nome')).toHaveText([
    'Papel e papelão',
    'Plástico',
    'Metal',
    'Vidro',
    'Entulho e volumosos',
  ]);
  await expect(page.locator('.ponto__material-descricao')).toHaveCount(5);
  await expect(page.locator('.ponto__material-descricao').first()).toHaveText(
    'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
  );
  await expect(titulo(page)).toBeFocused();

  if (noDesktop(info)) {
    await page.evaluate(() => document.fonts.ready);
    const medidas = await page.evaluate(() => {
      const caixa = (seletor: string) => {
        const r = document.querySelector(seletor)?.getBoundingClientRect();
        return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
      };
      return {
        voltar: caixa('.ponto__voltar'),
        titulo: caixa('h1'),
        informacoes: caixa('.ponto__informacoes'),
        mapa: caixa('.ponto__mapa'),
        materiais: caixa('.ponto__materiais'),
        cabecalho: caixa('.ponto__materiais-cabecalho'),
        material: caixa('.ponto__material:nth-child(2)'),
      };
    });
    expect(medidas).toEqual({
      voltar: [160, 96, 120, 32],
      titulo: [160, 152, 1120, 32],
      informacoes: [160, 232, 376, 361],
      mapa: [181, 528, 334, 44],
      materiais: [560, 232, 720, 395],
      cabecalho: [561, 233, 718, 49],
      material: [561, 350, 718, 69],
    });
  } else {
    await expect(page.locator('eco-cabecalho-celular .cabecalho__titulo')).toHaveText('Detalhes do ponto');
    await expect(page.locator('.ponto__voltar')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  }
});

test('"Abrir no mapa" abre o Google Maps com o endereço do ponto, em outra aba', async ({ page, context }) => {
  await context.route('https://www.google.com/**', (rota) => rota.fulfill({ status: 200, body: 'mapa' }));
  await page.goto('/pontos/13');
  const mapa = page.getByRole('link', { name: 'Abrir no mapa (abre em outra aba)' });

  await expect(mapa).toHaveAttribute('href', MAPA_DO_LUIZOTE);
  await expect(mapa).toHaveAttribute('target', '_blank');
  await expect(mapa).toHaveAttribute('rel', 'noopener noreferrer');
  const [aba] = await Promise.all([context.waitForEvent('page'), mapa.click()]);
  await aba.waitForLoadState();
  expect(aba.url()).toBe(MAPA_DO_LUIZOTE);
  expect(new URL(aba.url()).searchParams.get('query')).toBe('Rua Wilson Gonçalves de Souza, 10, Luizote de Freitas, Uberlândia - MG');
  expect(await aba.evaluate(() => window.opener)).toBeNull();
  await expect(page).toHaveURL(/\/pontos\/13$/);
});

test('um id inexistente mostra "Ponto não encontrado", com o link para a busca', async ({ page }) => {
  for (const id of ['999', '14', 'abc']) {
    await page.goto(`/pontos/${id}`);
    await expect(titulo(page), id).toHaveText('Ponto não encontrado');
    await expect(page).toHaveTitle('Ponto não encontrado · EcoPonto');
  }
  await page.getByRole('link', { name: 'Ir para a busca' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
});

test('voltar no navegador retorna à lista com os mesmos filtros', async ({ page }) => {
  await abrirBusca(page, '/?bairro=4&material=6');
  await expect(linhas(page)).toHaveText(['Casas Bahia']);
  await linkDoPonto(page, 'Casas Bahia').click();
  await expect(titulo(page)).toHaveText('Casas Bahia');

  await page.goBack();
  await expect(page).toHaveURL(/\/\?bairro=4&material=6$/);
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Pilhas e baterias em Centro');
  await expect(linhas(page)).toHaveText(['Casas Bahia']);
  await expect(page.locator('.busca__bairro [role="combobox"]')).toHaveText('Centro');
  await expect(linkDoPonto(page, 'Casas Bahia')).toBeFocused();
});

test('voltar mantém o "Mostrar mais" e a rolagem, pelo navegador e pelo "Voltar" da tela', async ({ page }, info) => {
  await abrirBusca(page);
  await page.getByRole('button', { name: 'Mostrar mais' }).click();
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 13 de 13 pontos');

  for (const como of ['navegador', 'tela'] as const) {
    const dmae = linkDoPonto(page, 'Dmae - Núcleo de Coleta Seletiva');
    await dmae.scrollIntoViewIfNeeded();
    const rolagem = await page.evaluate(() => window.scrollY);
    await dmae.click();
    await expect(titulo(page)).toHaveText('Dmae - Núcleo de Coleta Seletiva');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('.ponto__valor').nth(3)).toHaveText('(34) 3228-7744');

    if (como === 'navegador') {
      await page.goBack();
    } else {
      await voltarPelaTela(page, info);
    }
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.busca__resumo'), como).toHaveText('Mostrando 13 de 13 pontos');
    await expect(linhas(page)).toHaveCount(13);
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: como }).toBe(rolagem);
    await expect(dmae).toBeFocused();
  }
});

test('abrir o detalhe por um link direto e tocar em "Voltar" leva à busca', async ({ page }, info) => {
  await page.goto('/pontos/13');
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
  await voltarPelaTela(page, info);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
});

test('link direto, "Entrar" e voltar: o "Voltar" da tela leva à busca, sem sair do sistema', async ({ page }, info) => {
  test.skip(!noDesktop(info), 'No celular, o detalhe tem o cabeçalho Interno, sem "Entrar".');
  await page.goto('/pontos/13');
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
  await page.locator('eco-barra-superior').getByRole('link', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goBack();
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');

  await voltarPelaTela(page, info);
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
});

test('um toque duplo no "Voltar" do celular volta uma página só, com a busca como estava', async ({ page }, info) => {
  test.skip(noDesktop(info), 'O toque duplo durante a saída é do celular e do tablet.');
  await abrirBusca(page);
  await page.getByRole('button', { name: 'Mostrar mais' }).click();
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 13 de 13 pontos');
  await linkDoPonto(page, 'Bahamas Mix').click();
  await expect(titulo(page)).toHaveText('Bahamas Mix');

  await page.locator('eco-cabecalho-celular').getByRole('button', { name: 'Voltar' }).dblclick();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 13 de 13 pontos');
  await page.goForward();
  await expect(titulo(page)).toHaveText('Bahamas Mix');
});

test.describe('movimento', () => {
  async function gravarAnimacoes(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const nomes: string[] = [];
      (window as unknown as { animacoes: string[] }).animacoes = nomes;
      document.addEventListener('animationstart', (evento) => {
        if ((evento.target as Element).tagName === 'ECO-PAGINA-PONTO') {
          nomes.push(evento.animationName);
        }
      });
    });
  }

  const animacoes = (page: Page) => page.evaluate(() => (window as unknown as { animacoes: string[] }).animacoes);

  test('no celular, o detalhe entra e sai pela direita; no desktop, não anima', async ({ page }, info) => {
    await gravarAnimacoes(page);
    await abrirBusca(page);
    await linkDoPonto(page, 'Ecoponto Luizote de Freitas').click();
    await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
    await page.goBack();
    await expect(page.locator('.busca__resumo')).toBeVisible();

    if (noDesktop(info)) {
      expect(await animacoes(page)).toEqual([]);
    } else {
      expect(await animacoes(page)).toEqual(['eco-empurrar-entrar', 'eco-empurrar-sair']);
    }
  });

  test.describe('com "reduzir movimento"', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no celular, o empurrar vira esmaecer', async ({ page }, info) => {
      test.skip(noDesktop(info), 'No desktop, o detalhe não anima.');
      await gravarAnimacoes(page);
      await abrirBusca(page);
      await linkDoPonto(page, 'Ecoponto Luizote de Freitas').click();
      await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
      await page.goBack();
      await expect(page.locator('.busca__resumo')).toBeVisible();
      expect(await animacoes(page)).toEqual(['eco-esmaecer-entrar', 'eco-esmaecer-sair']);
    });
  });
});

test('enquanto carrega, o detalhe mostra o esqueleto, escondido do leitor de tela', async ({ page }) => {
  const agora = Date.now();
  await page.clock.install({ time: agora });
  await page.clock.pauseAt(agora + 1000);
  await page.goto('/pontos/13');

  await expect(page.locator('.ponto__pagina[aria-hidden="true"] .esqueleto-barra').first()).toBeVisible();
  await expect(page.locator('.ponto [role="status"]')).toHaveText('Carregando o ponto…');
  await expect(titulo(page)).toHaveCount(0);

  await page.clock.runFor(2000);
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');
  await expect(page.locator('.esqueleto-barra')).toHaveCount(0);
});

test('o detalhe se usa só com o teclado, com foco visível', async ({ page }, info) => {
  await page.goto('/pontos/13');
  await expect(titulo(page)).toHaveText('Ecoponto Luizote de Freitas');

  const paradas: string[] = [];
  for (let passo = 0; passo < 12; passo++) {
    await page.keyboard.press('Tab');
    const parada = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement;
      const contorno = (estilo: CSSStyleDeclaration) => estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
      const visivel = ativo.matches(':focus-visible') && (contorno(getComputedStyle(ativo)) || contorno(getComputedStyle(ativo, '::after')));
      return { nome: (ativo.getAttribute('aria-label') ?? ativo.textContent ?? '').replace(/\s+/g, ' ').trim(), visivel };
    });
    expect(parada.visivel, parada.nome).toBe(true);
    paradas.push(parada.nome);
    if (parada.nome.startsWith('Abrir no mapa')) {
      break;
    }
  }
  expect(paradas).toContain(noDesktop(info) ? 'Pontos de coleta' : 'Voltar');
  expect(paradas[paradas.length - 1]).toBe('Abrir no mapa (abre em outra aba)');
});
