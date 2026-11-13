import { expect, test } from '@playwright/test';

test('a página de teste funciona só com o teclado, com foco visível', async ({ page }) => {
  await page.goto('/sistema');
  await expect(page.getByRole('list', { name: /Bairros/ })).toBeVisible();

  const visitados: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      if (!ativo || ativo === document.body || ativo.dataset['jaVisitado'] === 'sim') {
        return null;
      }
      ativo.dataset['jaVisitado'] = 'sim';
      const estilo = getComputedStyle(ativo);
      return {
        texto: ativo.textContent?.trim() ?? '',
        contorno: estilo.outlineStyle,
        espessura: estilo.outlineWidth,
        noConteudo: !!ativo.closest('main'),
      };
    });
    if (!foco) {
      break;
    }
    expect(foco.contorno, `foco visível em "${foco.texto}"`).not.toBe('none');
    expect(foco.espessura, `contorno de 2 px em "${foco.texto}"`).toBe('2px');
    if (foco.noConteudo) {
      visitados.push(foco.texto);
    }
  }
  expect(visitados).toEqual(['Pressione e segure', 'Abrir diálogo', 'Abrir detalhes']);

  const abrirDialogo = page.getByRole('button', { name: 'Abrir diálogo' });
  await abrirDialogo.focus();
  await page.keyboard.press('Enter');
  const dialogo = page.getByRole('dialog', { name: 'Diálogo de exemplo' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(abrirDialogo).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(dialogo).toBeVisible();
  await dialogo.getByText(/Esc, o botão Fechar/).click();
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);

  const abrirDetalhes = page.getByRole('button', { name: 'Abrir detalhes' });
  await abrirDetalhes.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Voltar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Tela de detalhes' })).toHaveCount(0);
  await expect(abrirDetalhes).toBeFocused();
});
