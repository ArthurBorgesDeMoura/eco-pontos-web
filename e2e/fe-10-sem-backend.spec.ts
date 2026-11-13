import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const RESPOSTAS: Record<string, unknown> = {
  '/api/auth/eu': MARIA,
  '/api/bairros': [
    { idBairro: 11, nome: 'Luizote de Freitas' },
    { idBairro: 13, nome: 'Morumbi' },
  ],
  '/api/minhas-sugestoes': { itens: [], total: 0, pagina: 1, tamanho: 7 },
  '/api/categorias': [
    { idCategoria: 1, nome: 'Papel e papelão', descricao: null },
    { idCategoria: 2, nome: 'Plástico', descricao: null },
  ],
};

type Envio = 'erro-400' | 'rede-caiu' | 'criado';

async function responderComoBackend(page: Page, envio: () => Envio, corpos: unknown[]): Promise<void> {
  await page.route(/\/api\//, async (rota: Route) => {
    const pedido = rota.request();
    const caminho = new URL(pedido.url()).pathname;
    if (pedido.method() === 'POST' && caminho === '/api/pontos') {
      corpos.push(pedido.postDataJSON());
      const agora = envio();
      if (agora === 'rede-caiu') {
        await rota.abort('connectionrefused');
      } else if (agora === 'erro-400') {
        await rota.fulfill({
          status: 400,
          json: { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos destacados.', campos: { endereco: 'Este endereço já foi sugerido.' } },
        });
      } else {
        await rota.fulfill({ status: 201, json: { idPonto: 16, status: 'PENDENTE' } });
      }
      return;
    }
    const corpo = RESPOSTAS[caminho];
    await (corpo === undefined ? rota.fulfill({ status: 404, json: {} }) : rota.fulfill({ status: 200, json: corpo }));
  });
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: um 400 aparece no campo certo; a rede que cai não apaga o que foi digitado`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    let proximo: Envio = 'erro-400';
    const corpos: unknown[] = [];
    await responderComoBackend(page, () => proximo, corpos);
    await page.goto('/sugerir');
    await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();

    await page.getByLabel('Nome do ponto').fill('Ecoponto Morumbi');
    await page.getByLabel('Endereço').fill('Rua das Flores, 100');
    await page.locator('[data-campo="idBairro"] [role="combobox"]').click();
    await page.getByRole('option', { name: 'Morumbi', exact: true }).click();
    await page.getByLabel('Contato (opcional)').fill('(34) 3000-0000');
    await page.getByRole('group', { name: 'Materiais aceitos' }).getByText('Plástico', { exact: true }).click();

    await page.getByRole('button', { name: 'Enviar sugestão' }).click();
    await expect(page.locator('[data-campo="endereco"] .campo__erro')).toHaveText('Este endereço já foi sugerido.');
    await expect(page.getByLabel('Endereço')).toBeFocused();
    expect(corpos[0]).toEqual({
      nome: 'Ecoponto Morumbi',
      endereco: 'Rua das Flores, 100',
      idBairro: 13,
      horario: null,
      contato: '(34) 3000-0000',
      categorias: [2],
    });

    await page.getByLabel('Endereço').fill('Rua das Flores, 101');
    await expect(page.locator('[data-campo="endereco"] .campo__erro')).toHaveCount(0);
    proximo = 'rede-caiu';
    await page.getByRole('button', { name: 'Enviar sugestão' }).click();
    const aviso = page.locator('.formulario__aviso[role="alert"]');
    await expect(aviso).toContainText('Não foi possível falar com o servidor.');
    await expect(page.getByLabel('Nome do ponto')).toHaveValue('Ecoponto Morumbi');
    await expect(page.getByLabel('Endereço')).toHaveValue('Rua das Flores, 101');
    await expect(page.getByLabel('Contato (opcional)')).toHaveValue('(34) 3000-0000');
    await expect(page.locator('[data-campo="idBairro"] [role="combobox"]')).toHaveText('Morumbi');
    await expect(page.getByRole('checkbox', { name: 'Plástico', exact: true })).toBeChecked();
    await page.screenshot({ path: test.info().outputPath(`${largura.nome}-rede-caiu.png`), fullPage: true });

    proximo = 'criado';
    await aviso.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page).toHaveURL(/\/minhas-sugestoes$/);
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Sugestão enviada. Ela fica pendente até a análise.');
    expect(corpos).toHaveLength(3);
  });
}
