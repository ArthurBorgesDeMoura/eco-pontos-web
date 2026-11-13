import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

function sugestao(idPonto: number, nome: string, status: string): unknown {
  return {
    idPonto,
    nome,
    endereco: 'Rua Maria Abadia, 177',
    bairro: { idBairro: 9, nome: 'Jardim Brasília' },
    materiais: [{ idCategoria: 8, nome: 'Óleo de cozinha usado' }],
    status,
  };
}

const TODAS = [
  sugestao(17, 'Caçamba comunitária', 'RECUSADO'),
  sugestao(16, 'Ecoponto Morumbi', 'APROVADO'),
  sugestao(15, 'Cooperativa dos Recicladores de Uberlândia (CORU)', 'PENDENTE'),
] as { status: string }[];

async function responderComoBackend(page: Page, pedidos: string[]): Promise<void> {
  await page.route(/\/api\//, async (rota: Route) => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/api/auth/eu') {
      await rota.fulfill({ status: 200, json: MARIA });
      return;
    }
    if (url.pathname === '/api/minhas-sugestoes') {
      const status = url.searchParams.get('status');
      pedidos.push(status ?? 'todas');
      const itens = TODAS.filter((item) => status === null || item.status === status);
      await rota.fulfill({ status: 200, json: { itens, total: itens.length, pagina: 1, tamanho: 7 } });
      return;
    }
    await rota.fulfill({ status: 404, json: {} });
  });
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: uma sugestão recusada pelo administrador aparece em Recusadas`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    const pedidos: string[] = [];
    await responderComoBackend(page, pedidos);
    await page.goto('/minhas-sugestoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Minhas sugestões' })).toBeVisible();

    const visiveis = page.locator('eco-etiqueta-status').filter({ visible: true });
    await expect(visiveis).toHaveText(['Recusada', 'Aprovada', 'Pendente']);

    await page.getByRole('tab', { name: 'Recusadas' }).click();
    await expect(page).toHaveURL(/\?aba=recusadas$/);
    await expect(visiveis).toHaveText(['Recusada']);
    await expect(page.getByText('Caçamba comunitária').filter({ visible: true })).toBeVisible();
    expect(pedidos).toEqual(['todas', 'RECUSADO']);
    await page.screenshot({ path: test.info().outputPath(`${largura.nome}-recusadas.png`), fullPage: true });
  });
}
