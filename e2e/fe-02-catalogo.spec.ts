import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Locator, Page, expect, test } from '@playwright/test';

interface VariantesDoFigma {
  componentes: Record<string, string[]>;
}

const FIGMA: VariantesDoFigma = JSON.parse(readFileSync(join(__dirname, 'variantes-figma.json'), 'utf8'));

const TEXTO_DO_AVISO = 'Sugestão enviada. Ela fica pendente até a análise.';

async function abrirCatalogo(page: Page): Promise<void> {
  await page.goto('/catalogo');
  await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function abrirComRelogioParado(page: Page): Promise<void> {
  await page.clock.install();
  await abrirCatalogo(page);
  await page.clock.pauseAt(Date.now() + 60_000);
}

async function esperarAnimacoes(alvo: Locator): Promise<void> {
  await alvo.evaluate((elemento) => Promise.all(elemento.getAnimations().map((animacao) => animacao.finished)));
}

test('o catálogo mostra cada variante do Figma, com o nome dela', async ({ page }, info) => {
  await abrirCatalogo(page);

  const faltando: string[] = [];
  for (const [componente, variantes] of Object.entries(FIGMA.componentes)) {
    const secao = page.locator(`section[data-componente="${componente}"]`);
    if ((await secao.count()) !== 1) {
      faltando.push(`${componente}: seção`);
      continue;
    }
    const nomes = await secao.evaluate((elemento) =>
      Array.from(elemento.querySelectorAll('[data-variante], [data-variantes]')).flatMap((variante) =>
        (variante.getAttribute('data-variante') ?? variante.getAttribute('data-variantes') ?? '').split('|'),
      ),
    );
    faltando.push(...variantes.filter((variante) => !nomes.includes(variante)).map((v) => `${componente}: ${v}`));
  }
  expect(faltando).toEqual([]);

  const vazias = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('figure[data-variante] .variante__amostra'))
      .filter((amostra) => {
        const conteudo = amostra.firstElementChild?.getBoundingClientRect();
        return !conteudo || conteudo.width === 0 || conteudo.height === 0;
      })
      .map((amostra) => amostra.closest('figure')?.getAttribute('data-variante')),
  );
  expect(vazias).toEqual([]);

  const rolagemLateral = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(rolagemLateral).toBe(false);

  await page.screenshot({ path: `test-results/capturas/catalogo-${info.project.name}.png`, fullPage: true });
});

test('os links das barras levam a telas que existem; um endereço inventado mostra "Página não encontrada"', async ({
  page,
}) => {
  for (const caminho of ['/sugerir', '/minhas-sugestoes', '/painel']) {
    await page.goto(caminho);
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' }), caminho).toBeVisible();
  }
  await page.goto('/tela-que-nao-existe');
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
});

test('a barra superior troca de variante conforme o perfil; a inferior mostra 3 ou 4 itens', async ({ page }) => {
  await abrirCatalogo(page);
  const secao = page.locator('section[data-componente="Barras ao vivo"]');
  const superior = secao.locator('eco-barra-superior');
  const inferior = secao.locator('eco-barra-inferior');
  const cabecalho = secao.locator('eco-cabecalho-celular');

  const casos = [
    { perfil: 'Acesso', links: [], botoes: [], itens: [], conta: false, entrar: false },
    {
      perfil: 'Visitante',
      links: ['Pontos de coleta'],
      botoes: ['Entrar', 'Criar conta'],
      itens: [],
      conta: false,
      entrar: true,
    },
    {
      perfil: 'Usuário',
      links: ['Pontos de coleta', 'Sugerir ponto', 'Minhas sugestões'],
      botoes: ['Sair'],
      itens: ['Pontos', 'Sugerir', 'Minhas'],
      conta: true,
      entrar: false,
    },
    {
      perfil: 'Administrador',
      links: ['Pontos de coleta', 'Sugerir ponto', 'Minhas sugestões', 'Painel'],
      botoes: ['Sair'],
      itens: ['Pontos', 'Sugerir', 'Minhas', 'Painel'],
      conta: true,
      entrar: false,
    },
  ];

  for (const caso of casos) {
    await secao.getByRole('tab', { name: caso.perfil }).click();
    await expect(superior.locator('nav a'), caso.perfil).toHaveText(caso.links);
    await expect(superior.locator('[eco-botao]'), caso.perfil).toHaveText(caso.botoes);
    if (caso.itens.length === 0) {
      await expect(inferior, caso.perfil).toBeHidden();
    } else {
      await expect(inferior.locator('a'), caso.perfil).toHaveText(caso.itens);
      await expect(inferior.locator('a[aria-current="page"]'), caso.perfil).toHaveText('Pontos');
    }
    await expect(cabecalho.getByRole('button', { name: 'Conta' }), caso.perfil).toHaveCount(caso.conta ? 1 : 0);
    await expect(cabecalho.getByRole('link', { name: 'Entrar' }), caso.perfil).toHaveCount(caso.entrar ? 1 : 0);
  }

  const variante = (nome: string): Locator =>
    page.locator(`section[data-componente="Barra inferior (celular)"] [data-variante="${nome}"]`);
  await expect(variante('Perfil=Usuário, Ativa=Sugerir').locator('a')).toHaveCount(3);
  await expect(variante('Perfil=Usuário, Ativa=Sugerir').locator('a[aria-current="page"]')).toHaveText('Sugerir');
  await expect(variante('Perfil=Administrador, Ativa=Painel').locator('a')).toHaveCount(4);
  await expect(variante('Perfil=Administrador, Ativa=Painel').locator('a[aria-current="page"]')).toHaveText('Painel');
});

test('todos os componentes funcionam só com o teclado e têm foco visível', async ({ page }) => {
  test.slow();
  await abrirCatalogo(page);

  const paradas: string[] = [];
  const semFoco: string[] = [];
  for (let passo = 0; passo < 300; passo++) {
    await page.keyboard.press('Tab');
    const parada = await page.evaluate(() => {
      const elemento = document.activeElement as HTMLElement | null;
      if (!elemento || elemento === document.body) {
        return null;
      }
      const janela = window as unknown as { proximaParada?: number };
      if (elemento.dataset['paradaDeTeste']) {
        return { repetida: true, nome: '', visivel: true };
      }
      janela.proximaParada = (janela.proximaParada ?? 0) + 1;
      elemento.dataset['paradaDeTeste'] = String(janela.proximaParada);

      const temContorno = (estilo: CSSStyleDeclaration): boolean =>
        estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
      let visivel: boolean;
      if (elemento.matches('input[type="checkbox"]')) {
        const chip = elemento.nextElementSibling as HTMLElement | null;
        visivel = !!chip && temContorno(getComputedStyle(chip));
      } else {
        const caixa = elemento.closest('.campo__caixa, .seletor__caixa');
        visivel =
          temContorno(getComputedStyle(elemento)) ||
          temContorno(getComputedStyle(elemento, '::after')) ||
          (!!caixa && getComputedStyle(caixa).boxShadow !== 'none');
      }
      const texto = (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        repetida: false,
        nome: `${elemento.tagName.toLowerCase()}${elemento.getAttribute('role') ? `[${elemento.getAttribute('role')}]` : ''} "${texto.slice(0, 40)}"`,
        visivel: visivel && elemento.matches(':focus-visible'),
      };
    });
    if (!parada || parada.repetida) {
      break;
    }
    paradas.push(parada.nome);
    if (!parada.visivel) {
      semFoco.push(parada.nome);
    }
  }
  expect(semFoco).toEqual([]);
  for (const esperada of ['[combobox]', '[tab]', '"Mostrar mais"', '"Abrir diálogo"', '"Conta"', '"Entrar"']) {
    expect(paradas.some((nome) => nome.includes(esperada)), esperada).toBe(true);
  }

  const seletor = page.locator('[data-ao-vivo="Seletor"] [role="combobox"]');
  await seletor.focus();
  await page.keyboard.press('ArrowDown');
  await expect(seletor).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(seletor).toHaveAttribute('aria-expanded', 'false');
  await expect(seletor).toContainText('Altamira');
  await page.keyboard.type('tib');
  await expect(seletor).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(seletor).toContainText('Tibery');

  const campo = page.locator('[data-ao-vivo="Campo de texto"] input');
  await campo.focus();
  await page.keyboard.type('Ecoponto Luizote');
  await expect(campo).toHaveValue('Ecoponto Luizote');

  const chip = page.locator('[data-ao-vivo="Chip de material"] button', { hasText: 'Papel e papelão' });
  await chip.focus();
  await page.keyboard.press('Space');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  const caixa = page.locator('[data-ao-vivo="Chip de material (formulário)"] input[type="checkbox"]').nth(2);
  await caixa.focus();
  await page.keyboard.press('Space');
  await expect(caixa).toBeChecked();

  const filtro = page.locator('[data-ao-vivo="Item de filtro"] button', { hasText: 'Vidro' });
  await filtro.focus();
  await page.keyboard.press('Enter');
  await expect(filtro).toHaveAttribute('aria-pressed', 'true');

  const abas = page.locator('[data-ao-vivo="Aba"]');
  await abas.getByRole('tab', { name: 'Pontos' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(abas.getByRole('tab', { name: 'Categorias' })).toBeFocused();
  await expect(abas.getByRole('tab', { name: 'Categorias' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(abas.getByRole('tab', { name: 'Pendentes' })).toHaveAttribute('aria-selected', 'true');
});

test('o aviso some sozinho depois de 4 s e entra pelo lado certo', async ({ page }, info) => {
  await abrirComRelogioParado(page);
  const aviso = page.locator('eco-avisos eco-aviso');

  await page.getByRole('button', { name: 'Mostrar aviso' }).click();
  await expect(aviso).toHaveText(TEXTO_DO_AVISO);
  await expect(page.locator('eco-avisos [role="status"]')).toContainText(TEXTO_DO_AVISO);
  await esperarAnimacoes(aviso);

  const caixa = await aviso.boundingBox();
  const { width: largura, height: altura } = page.viewportSize() ?? { width: 0, height: 0 };
  const deslocamento = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--deslocamento-aviso').trim(),
  );
  expect(Math.abs((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2 - largura / 2)).toBeLessThan(1);
  if (info.project.name === 'desktop') {
    expect(caixa?.y).toBe(80);
    expect(deslocamento).toBe('-100%');
  } else {
    expect((caixa?.y ?? 0) + (caixa?.height ?? 0)).toBe(altura - 100);
    expect(deslocamento).toBe('100%');
  }

  await page.clock.runFor(3900);
  await expect(aviso).toBeVisible();
  await page.clock.runFor(100);
  await page.clock.runFor(400);
  await expect(aviso).toHaveCount(0);
});

test('o relógio do aviso para com o ponteiro em cima', async ({ page }) => {
  await abrirComRelogioParado(page);
  const aviso = page.locator('eco-avisos eco-aviso');

  await page.getByRole('button', { name: 'Mostrar aviso' }).click();
  await esperarAnimacoes(aviso);
  await aviso.hover();
  await page.clock.runFor(6000);
  await expect(aviso).toBeVisible();

  await page.mouse.move(1, 1);
  await page.clock.runFor(4500);
  await expect(aviso).toHaveCount(0);
});

test('no celular e no tablet, um toque no aviso não o deixa preso na tela', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'O toque vale no celular e no tablet.');
  await abrirComRelogioParado(page);
  const aviso = page.locator('eco-avisos eco-aviso');

  await page.getByRole('button', { name: 'Mostrar aviso' }).click();
  await esperarAnimacoes(aviso);
  await aviso.tap();
  await page.clock.runFor(4500);
  await expect(aviso).toHaveCount(0);
});

test('o diálogo abre no centro, prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
  await abrirCatalogo(page);
  const abrir = page.getByRole('button', { name: 'Abrir diálogo' });
  const tela = page.locator('eco-root > .tela');

  await abrir.focus();
  await page.keyboard.press('Enter');
  const dialogo = page.getByRole('alertdialog', { name: 'Excluir este ponto?' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await expect(tela).toHaveAttribute('inert', '');

  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Excluir ponto' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await esperarAnimacoes(dialogo);
  const caixa = await dialogo.boundingBox();
  const { width: largura, height: altura } = page.viewportSize() ?? { width: 0, height: 0 };
  expect(Math.abs((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2 - largura / 2)).toBeLessThan(1);
  expect(Math.abs((caixa?.y ?? 0) + (caixa?.height ?? 0) / 2 - altura / 2)).toBeLessThan(1);
  await expect(page.locator('.dialogo__fundo')).toHaveCSS('background-color', 'rgba(22, 27, 23, 0.4)');
  await expect(dialogo.getByRole('button', { name: 'Excluir ponto' })).toHaveCSS(
    'background-color',
    'rgb(180, 35, 24)',
  );

  await dialogo.locator('.dialogo__texto').click();
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(abrir).toBeFocused();
  await expect(tela).not.toHaveAttribute('inert');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Pão de Açúcar excluído.');
});

test('com "reduzir movimento", o aviso e o diálogo só esmaecem', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrirCatalogo(page);

  await page.getByRole('button', { name: 'Mostrar aviso' }).click();
  const aviso = page.locator('eco-avisos eco-aviso');
  await expect(aviso).toHaveCSS('animation-name', 'eco-esmaecer-entrar');

  await page.getByRole('button', { name: 'Abrir diálogo' }).click();
  await expect(page.locator('.dialogo__janela')).toHaveCSS('animation-name', 'eco-esmaecer-entrar');
  await expect(page.locator('.dialogo__fundo')).toHaveCSS('animation-name', 'eco-esmaecer-entrar');
  await expect(page.locator('.dialogo__janela')).toHaveCSS('transform', 'none');
});

test('no celular e no tablet, os alvos de toque têm pelo menos 44 px', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Os alvos de 44 px valem no celular e no tablet.');
  await abrirCatalogo(page);

  const pequenos = await page.evaluate(() => {
    const seletor = 'a[href], button:not([disabled]), input:not([disabled]), [role="combobox"], [role="tab"]';
    return Array.from(document.querySelectorAll<HTMLElement>(seletor))
      .filter((elemento) => !elemento.closest('[inert]'))
      .filter((elemento) => !(elemento.tagName === 'A' && elemento.parentElement?.tagName === 'P'))
      .filter((elemento) => !elemento.closest('eco-barra-superior'))
      .map((elemento) => {
        let alvo: HTMLElement = elemento;
        if (elemento.matches('input[type="checkbox"]')) {
          alvo = elemento.nextElementSibling as HTMLElement;
        } else if (elemento.closest('.campo__caixa')) {
          alvo = elemento.closest('.campo__caixa') as HTMLElement;
        }
        const caixa = alvo.getBoundingClientRect();
        let largura = caixa.width;
        let altura = caixa.height;
        const depois = getComputedStyle(alvo, '::after');
        if (depois.content !== 'none' && depois.position === 'absolute') {
          largura = Math.max(largura, parseFloat(depois.width) || 0);
          altura = Math.max(altura, parseFloat(depois.height) || 0);
        }
        const extra = alvo.querySelector<HTMLElement>(':scope > .botao__alvo')?.getBoundingClientRect();
        if (extra) {
          largura = Math.max(largura, extra.width);
          altura = Math.max(altura, extra.height);
        }
        const texto = (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '').replace(/\s+/g, ' ').trim();
        return { nome: `${elemento.tagName.toLowerCase()} "${texto.slice(0, 30)}"`, largura, altura, visivel: caixa.height > 0 };
      })
      .filter((alvo) => alvo.visivel && (alvo.largura < 44 || alvo.altura < 44))
      .map((alvo) => `${alvo.nome}: ${Math.round(alvo.largura)} × ${Math.round(alvo.altura)}`);
  });
  expect(pequenos).toEqual([]);
});
