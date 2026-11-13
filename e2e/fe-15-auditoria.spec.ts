import { expect, test } from '@playwright/test';

import { auditarTela, percorrerComTab } from './apoio/auditoria';

test('a auditoria acusa cada defeito posto de propósito na tela', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.busca__resumo')).toBeVisible();
  expect(await auditarTela(page), 'a busca limpa passa').toEqual([]);
  expect(await percorrerComTab(page), 'o Tab da busca limpa passa').toEqual([]);

  await page.evaluate(() => {
    const principal = document.querySelector('main') as HTMLElement;
    const largo = document.createElement('div');
    largo.style.width = '2000px';
    largo.textContent = 'largo demais';
    const rolagem = document.createElement('div');
    rolagem.style.cssText = 'width: 100px; overflow-x: auto';
    rolagem.innerHTML = '<div style="width: 500px">rola por dentro</div>';
    const cortado = document.createElement('p');
    cortado.style.cssText = 'width: 50px; overflow: hidden; white-space: nowrap';
    cortado.textContent = 'um texto comprido demais';
    const semRotulo = document.createElement('input');
    const pequeno = document.createElement('button');
    pequeno.textContent = 'x';
    pequeno.style.cssText = 'width: 20px; height: 20px; padding: 0; outline: none';
    principal.append(largo, rolagem, cortado, semRotulo, pequeno);
  });
  const problemas = await auditarTela(page);
  const acusou = (inicio: string, trecho: string) => problemas.some((problema) => problema.startsWith(inicio) && problema.includes(trecho));
  expect(acusou('passa da janela', 'largo demais'), 'elemento mais largo que a janela').toBe(true);
  expect(acusou('rola para o lado por dentro', 'rola por dentro'), 'caixa que rola por dentro').toBe(true);
  expect(acusou('texto cortado', 'um texto comprido'), 'texto cortado').toBe(true);
  expect(acusou('axe', 'label'), 'campo sem rótulo (axe)').toBe(true);
  if (info.project.name !== 'desktop') {
    expect(acusou('alvo de toque pequeno', '"x"'), 'botão de 20 px no celular e no tablet').toBe(true);
  }

  await page.evaluate(() => {
    const furaFila = document.createElement('button');
    furaFila.textContent = 'fura a fila';
    furaFila.tabIndex = 1;
    document.querySelector('main')?.append(furaFila);
  });
  const doTab = await percorrerComTab(page);
  expect(doTab.some((problema) => problema.startsWith('foco invisível') && problema.includes('"x"')), 'foco invisível').toBe(true);
  expect(doTab.some((problema) => problema.startsWith('ordem do Tab')), 'ordem do Tab').toBe(true);
});
