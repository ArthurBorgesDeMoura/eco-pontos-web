import { Page, TestInfo, expect, test } from '@playwright/test';

const PRIMEIROS_SETE = [
  'Drogaria São Paulo - DSP Uberlândia III',
  'Pão de Açúcar',
  'Drogasil - Uberlândia 14',
  'Bretas - Loja 518',
  'Casas Bahia',
  'Drogasil - Uberlândia 11',
  'Ecoponto Luizote de Freitas',
];
const SEIS_RESTANTES = [
  'Atacadão',
  'Loja Elétrica',
  'Estação de Reciclagem - Parque do Sabiá',
  'Bahamas Mix',
  'Dmae - Núcleo de Coleta Seletiva',
  'Estação de Reciclagem - Teatro Municipal',
];

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

async function abrirBusca(page: Page, caminho = '/'): Promise<void> {
  await page.goto(caminho);
  await expect(page.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await expect(page.locator('.busca__resumo')).toBeVisible();
}

function nomes(page: Page) {
  return page.locator('.busca__lista .linha__nome');
}

async function escolherMaterial(page: Page, info: TestInfo, material: string): Promise<void> {
  if (noDesktop(info)) {
    await page.locator('.busca__materiais').getByRole('button', { name: material }).click();
  } else {
    await page.locator('.busca__material-seletor [role="combobox"]').click();
    await page.getByRole('option', { name: material }).click();
  }
}

test('ao abrir, a lista mostra 7 dos 13 pontos aprovados, em ordem de bairro e nome', async ({ page }, info) => {
  await abrirBusca(page);

  await expect(nomes(page)).toHaveText(PRIMEIROS_SETE);
  await expect(page.locator('.busca__contagem')).toHaveText('13 pontos');
  await expect(page.locator('.busca__ordem')).toHaveText('Ordenados por bairro, de A a Z');
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 7 de 13 pontos');
  await expect(page.locator('.busca__lista .linha__local').first()).toHaveText(
    'Altamira · Av. Nicomedes Alves dos Santos, 2100',
  );
  await expect(page.locator('.busca__lista .linha__materiais').first()).toHaveText(
    'Pilhas e baterias, Medicamentos vencidos',
  );
  await page.screenshot({ path: `test-results/capturas/busca-${info.project.name}.png`, fullPage: true });
});

test('no desktop, as medidas batem com a D03', async ({ page }, info) => {
  test.skip(!noDesktop(info), 'As medidas da D03 são do desktop (1440 px).');
  await abrirBusca(page);

  const medidas = await page.evaluate(() => {
    const caixa = (seletor: string) => {
      const r = (document.querySelector(seletor) as HTMLElement).getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    };
    return {
      titulo: caixa('.busca__titulo'),
      filtros: caixa('.busca__filtros'),
      resultados: caixa('.busca__resultados'),
      cabecalho: caixa('.busca__lista-cabecalho'),
      linha: caixa('.busca__lista > li'),
      rodape: caixa('.busca__rodape'),
    };
  });
  expect(medidas.titulo.slice(0, 2)).toEqual([160, 104]);
  expect(medidas.filtros).toEqual([160, 192, 280, 534]);
  expect(medidas.resultados).toEqual([464, 192, 816, 716]);
  expect(medidas.cabecalho.slice(2)).toEqual([814, 49]);
  expect(medidas.linha.slice(2)).toEqual([814, 87]);
  expect(medidas.rodape.slice(2)).toEqual([814, 56]);
});

test('"Mostrar mais" traz os 6 restantes sem voltar ao topo, e o rodapé passa a 13 de 13', async ({ page }) => {
  await abrirBusca(page);
  const mostrarMais = page.getByRole('button', { name: 'Mostrar mais' });
  await mostrarMais.scrollIntoViewIfNeeded();
  const rolagemAntes = await page.evaluate(() => window.scrollY);
  await page.locator('.busca__lista > li').first().evaluate((linha) => (linha.dataset['marca'] = 'primeira'));

  await mostrarMais.click();
  await expect(page.locator('.busca__resumo')).toHaveText('Mostrando 13 de 13 pontos');
  await expect(nomes(page)).toHaveText([...PRIMEIROS_SETE, ...SEIS_RESTANTES]);
  await expect(mostrarMais).toHaveCount(0);
  await expect(nomes(page).nth(7)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(rolagemAntes);
  await expect(page.locator('.busca__lista > li').first()).toHaveAttribute('data-marca', 'primeira');
});

test('a URL guarda os filtros; recarregar e voltar mantêm a mesma busca', async ({ page }, info) => {
  await abrirBusca(page);

  const bairro = page.locator('.busca__bairro [role="combobox"]');
  await bairro.click();
  await page.getByRole('option', { name: 'Centro' }).click();
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect(nomes(page)).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);
  await expect(page.locator('.busca__contagem')).toHaveText('2 pontos em Centro');

  await escolherMaterial(page, info, 'Pilhas e baterias');
  await expect(page).toHaveURL(/\/\?bairro=4&material=6$/);
  await expect(nomes(page)).toHaveText(['Casas Bahia']);
  await expect(page.locator('.busca__contagem')).toHaveText('1 ponto aceita Pilhas e baterias em Centro');

  await page.reload();
  await expect(nomes(page)).toHaveText(['Casas Bahia']);
  await expect(bairro).toContainText('Centro');

  await page.goBack();
  await expect(page).toHaveURL(/\/\?bairro=4$/);
  await expect(nomes(page)).toHaveText(['Bretas - Loja 518', 'Casas Bahia']);

  await abrirBusca(page, '/?material=10');
  await expect(nomes(page)).toHaveText(['Ecoponto Luizote de Freitas']);
});

test('a lista funciona só com o teclado, com foco visível', async ({ page }) => {
  await abrirBusca(page);

  const bairro = page.locator('.busca__bairro [role="combobox"]');
  await bairro.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/\?bairro=1$/);
  await expect(nomes(page)).toHaveText(['Drogaria São Paulo - DSP Uberlândia III', 'Pão de Açúcar']);

  const primeira = nomes(page).first();
  for (let passo = 0; passo < 30; passo++) {
    await page.keyboard.press('Tab');
    const visivel = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement;
      const caixa = ativo.closest('.seletor__caixa, .campo__caixa');
      const contorno = (estilo: CSSStyleDeclaration) => estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
      return (
        contorno(getComputedStyle(ativo)) ||
        contorno(getComputedStyle(ativo, '::after')) ||
        (!!caixa && getComputedStyle(caixa).boxShadow !== 'none')
      );
    });
    expect(visivel).toBe(true);
    if (await primeira.evaluate((link) => link === document.activeElement)) {
      break;
    }
  }
  await expect(primeira).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.busca__lista a.linha__mapa:visible').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pontos\/2$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Drogaria São Paulo - DSP Uberlândia III' })).toBeVisible();
});

test('"Abrir no mapa" vai direto ao Google Maps, em outra aba', async ({ page }) => {
  await abrirBusca(page);
  const mapa = page.locator('.busca__lista a.linha__mapa:visible').first();

  await expect(mapa).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Av.%20Nicomedes%20Alves%20dos%20Santos%2C%202100%2C%20Altamira%2C%20Uberl%C3%A2ndia%20-%20MG',
  );
  await expect(mapa).toHaveAttribute('target', '_blank');
  await expect(mapa).toHaveAttribute('rel', 'noopener noreferrer');
});

test('no celular e no tablet, a lista se usa com o dedo: alvos de 44 px e sem rolagem lateral', async ({ page }, info) => {
  test.skip(noDesktop(info), 'Os alvos de 44 px valem no celular e no tablet.');
  await abrirBusca(page);

  const pequenos = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main a, main button, main [role="combobox"]'))
      .filter((elemento) => elemento.getBoundingClientRect().height > 0)
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        const depois = getComputedStyle(elemento, '::after');
        const extra = depois.content !== 'none' && depois.position === 'absolute' ? parseFloat(depois.height) || 0 : 0;
        const alvo = elemento.querySelector<HTMLElement>(':scope > .botao__alvo')?.getBoundingClientRect().height ?? 0;
        return { nome: (elemento.textContent ?? '').trim().slice(0, 30), altura: Math.max(caixa.height, extra, alvo) };
      })
      .filter((alvo) => alvo.altura < 44)
      .map((alvo) => `${alvo.nome}: ${Math.round(alvo.altura)} px`),
  );
  expect(pequenos).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
    false,
  );

  await page.locator('.busca__lista eco-linha-ponto').first().tap();
  await expect(page).toHaveURL(/\/pontos\/2$/);
});
