import { expect, test } from '@playwright/test';

test('roda contra as respostas simuladas, sem chamar o backend', async ({ page }) => {
  const chamadasAoBackend: string[] = [];
  page.on('request', (pedido) => {
    if (new URL(pedido.url()).pathname.startsWith('/api')) {
      chamadasAoBackend.push(pedido.url());
    }
  });

  await page.goto('/sistema');
  const painel = page.getByRole('region', { name: 'Conexão com a API' });

  await expect(painel.getByText('Respostas simuladas')).toBeVisible();
  await expect(painel.getByRole('list', { name: /Bairros/ }).getByRole('listitem')).toHaveCount(20);
  await expect(painel.getByRole('list', { name: /Categorias/ }).getByRole('listitem')).toHaveCount(10);
  await expect(painel.getByText('Santa Mônica')).toBeVisible();
  await expect(painel.getByText('Óleo de cozinha usado')).toBeVisible();
  await expect(painel.getByText('Tentar de novo')).toHaveCount(0);
  expect(chamadasAoBackend).toEqual([]);
});
