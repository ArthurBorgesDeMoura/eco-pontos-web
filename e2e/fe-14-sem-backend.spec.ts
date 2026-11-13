import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const REPETIDO = 'Já existe uma categoria com este nome.';
const SEM_CONEXAO = 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.';

interface Backend {
  envios: unknown[];
}

async function responderComoBackend(page: Page, opcoes: { comCampo?: boolean; redeCai?: boolean }): Promise<Backend> {
  const backend: Backend = { envios: [] };
  const categorias = [
    { idCategoria: 1, nome: 'Papel e papelão', descricao: null, pontos: 3 },
    { idCategoria: 2, nome: 'Plástico', descricao: null, pontos: 3 },
  ];
  let redeCaiu = false;
  await page.route(/\/api\//, async (rota: Route) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    if (url.pathname === '/api/auth/eu') {
      await rota.fulfill({ status: 200, json: ADMIN });
    } else if (url.pathname === '/api/admin/resumo') {
      await rota.fulfill({ status: 200, json: { pendentes: 0, pontos: 13, categorias: categorias.length } });
    } else if (url.pathname === '/api/admin/categorias' && metodo === 'GET') {
      await rota.fulfill({ status: 200, json: { itens: categorias, total: categorias.length, pagina: 1, tamanho: 50 } });
    } else if (url.pathname === '/api/admin/categorias' && metodo === 'POST') {
      const corpo = rota.request().postDataJSON() as { nome: string; descricao: string | null };
      backend.envios.push(corpo);
      if (opcoes.redeCai && !redeCaiu) {
        redeCaiu = true;
        await rota.abort('failed');
        return;
      }
      if (corpo.nome.toLowerCase() === 'plástico') {
        const erro = opcoes.comCampo
          ? { codigo: 'NOME_REPETIDO', mensagem: REPETIDO, campos: { nome: REPETIDO } }
          : { codigo: 'NOME_REPETIDO', mensagem: 'Conflito: o nome já existe.' };
        await rota.fulfill({ status: 409, json: erro });
        return;
      }
      const nova = { idCategoria: categorias.length + 1, nome: corpo.nome, descricao: corpo.descricao, pontos: 0 };
      categorias.push(nova);
      await rota.fulfill({ status: 201, json: nova });
    } else {
      await rota.fulfill({ status: 404, json: { codigo: 'NAO_ENCONTRADO', mensagem: 'Não encontrado.' } });
    }
  });
  return backend;
}

for (const largura of LARGURAS) {
  for (const comCampo of [true, false]) {
    test(`${largura.nome}: o 409 do backend (${comCampo ? 'com o campo' : 'só a mensagem'}) aparece no nome, sem fechar o formulário`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura.width, height: largura.height });
      const backend = await responderComoBackend(page, { comCampo });
      await page.goto('/painel/categorias/nova');
      const nome = page.getByLabel('Nome', { exact: true });
      await nome.fill('Plástico');
      await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
      await expect(page.locator('[data-campo="nome"] .campo__erro')).toHaveText(REPETIDO);
      await expect(page).toHaveURL(/\/painel\/categorias\/nova$/);
      await expect(nome).toBeFocused();
      await expect(page.getByRole('button', { name: 'Cadastrar categoria' })).not.toHaveAttribute('aria-disabled', 'true');

      await nome.fill('Plástico filme');
      await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
      await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Categoria cadastrada.');
      await expect(page).toHaveURL(/\/painel\?aba=categorias$/);
      await expect(page.getByRole('tab', { name: 'Categorias (3)', exact: true })).toBeVisible();
      expect(backend.envios).toEqual([
        { nome: 'Plástico', descricao: null },
        { nome: 'Plástico filme', descricao: null },
      ]);
      await page.screenshot({ path: test.info().outputPath(`${largura.nome}-409.png`), fullPage: true });
    });
  }
}

test('a rede cai ao cadastrar: o que foi digitado fica, e "Tentar de novo" reenvia', async ({ page }) => {
  const backend = await responderComoBackend(page, { redeCai: true });
  await page.goto('/painel/categorias/nova');
  await page.getByLabel('Nome', { exact: true }).fill('Isopor');
  await page.getByLabel('Descrição (opcional)').fill('Bandejas limpas.');
  await page.getByRole('button', { name: 'Cadastrar categoria' }).click();
  const aviso = page.locator('.formulario__aviso[role="alert"]');
  await expect(aviso).toContainText(SEM_CONEXAO);
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Isopor');

  await aviso.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Categoria cadastrada.');
  expect(backend.envios.length).toBe(2);
});
