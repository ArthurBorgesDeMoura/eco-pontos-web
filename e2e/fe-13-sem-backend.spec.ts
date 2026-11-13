import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const SEM_CONEXAO = 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.';

function aprovado(idPonto: number, nome: string, bairro: string): { idPonto: number; nome: string } {
  return {
    idPonto,
    nome,
    endereco: `Rua ${idPonto}, 10`,
    bairro: { idBairro: idPonto, nome: bairro },
    materiais: [{ idCategoria: 6, nome: 'Pilhas e baterias' }],
    horario: null,
    contato: null,
    status: 'APROVADO',
    sugeridoPor: { idUsuario: 1, nome: 'Administrador EcoPonto' },
  } as { idPonto: number; nome: string };
}

interface Backend {
  exclusoes: number[];
}

async function responderComoBackend(page: Page, opcoes: { jaExcluido?: boolean; redeCai?: boolean }): Promise<Backend> {
  const backend: Backend = { exclusoes: [] };
  let aprovados = [
    aprovado(2, 'Drogaria São Paulo - DSP Uberlândia III', 'Altamira'),
    aprovado(10, 'Pão de Açúcar', 'Altamira'),
    aprovado(3, 'Drogasil - Uberlândia 14', 'Brasil'),
    aprovado(4, 'Bretas - Loja 518', 'Centro'),
    aprovado(8, 'Casas Bahia', 'Centro'),
    aprovado(1, 'Drogasil - Uberlândia 11', 'Fundinho'),
    aprovado(13, 'Ecoponto Luizote de Freitas', 'Luizote de Freitas'),
    aprovado(6, 'Atacadão', 'Presidente Roosevelt'),
    aprovado(5, 'Loja Elétrica', 'Santa Luzia'),
  ];
  let redeCaiu = false;
  await page.route(/\/api\//, async (rota: Route) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    const umPonto = /^\/api\/admin\/pontos\/(\d+)$/.exec(url.pathname);
    if (url.pathname === '/api/auth/eu') {
      await rota.fulfill({ status: 200, json: ADMIN });
    } else if (url.pathname === '/api/admin/resumo') {
      await rota.fulfill({ status: 200, json: { pendentes: 2, pontos: aprovados.length, categorias: 10 } });
    } else if (url.pathname === '/api/admin/pontos') {
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const tamanho = Number(url.searchParams.get('tamanho') ?? 7);
      const itens = aprovados.slice((pagina - 1) * tamanho, pagina * tamanho);
      await rota.fulfill({ status: 200, json: { itens, total: aprovados.length, pagina, tamanho } });
      if (opcoes.jaExcluido) {
        aprovados = aprovados.filter((item) => item.idPonto !== 4);
      }
    } else if (umPonto && metodo === 'DELETE') {
      const idPonto = Number(umPonto[1]);
      backend.exclusoes.push(idPonto);
      if (opcoes.redeCai && !redeCaiu) {
        redeCaiu = true;
        await rota.abort('failed');
        return;
      }
      if (!aprovados.some((item) => item.idPonto === idPonto)) {
        await rota.fulfill({ status: 404, json: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' } });
        return;
      }
      aprovados = aprovados.filter((item) => item.idPonto !== idPonto);
      await rota.fulfill({ status: 204, body: '' });
    } else if (url.pathname === '/api/bairros') {
      await rota.fulfill({ status: 200, json: [{ idBairro: 4, nome: 'Centro' }] });
    } else if (url.pathname === '/api/categorias') {
      await rota.fulfill({ status: 200, json: [{ idCategoria: 7, nome: 'Lâmpadas', descricao: null }] });
    } else if (url.pathname === '/api/pontos/4') {
      await rota.fulfill({
        status: 200,
        json: { ...aprovado(4, 'Bretas - Loja 518', 'Centro'), materiais: [{ idCategoria: 7, nome: 'Lâmpadas', descricao: null }] },
      });
    } else if (umPonto && metodo === 'PUT') {
      await rota.fulfill({ status: 404, json: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' } });
    } else {
      await rota.fulfill({ status: 404, json: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' } });
    }
  });
  return backend;
}

function nomes(page: Page) {
  return page.locator('eco-painel-pontos').locator('.celula__nome, .painel__nome').filter({ visible: true });
}

async function excluirBretas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Excluir Bretas - Loja 518', exact: true }).filter({ visible: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir ponto' }).click();
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: o ponto que outro administrador já excluiu (404) sai da lista, com o aviso`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    const backend = await responderComoBackend(page, { jaExcluido: true });
    await page.goto('/painel?aba=pontos');
    await expect(nomes(page)).toHaveCount(7);
    await expect(nomes(page).nth(3)).toHaveText('Bretas - Loja 518');

    await excluirBretas(page);
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Este ponto já tinha sido excluído.');
    await expect(nomes(page)).toHaveCount(7);
    await expect(nomes(page).filter({ hasText: 'Bretas' })).toHaveCount(0);
    await expect(nomes(page).nth(6)).toHaveText('Atacadão');
    await expect(page.locator('[role="tab"] .abas__contagem')).toHaveText(['2', '8', '10']);
    await expect(page.locator('eco-painel-pontos').getByText('Mostrando 7 de 8 pontos').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir Casas Bahia', exact: true }).filter({ visible: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir ponto' }).click();
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Casas Bahia excluído.');
    expect(backend.exclusoes).toEqual([4, 8]);
    await page.screenshot({ path: test.info().outputPath(`${largura.nome}-404.png`), fullPage: true });
  });

  test(`${largura.nome}: a rede cai no DELETE: o aviso conta, a linha fica e a exclusão pode ser feita de novo`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    const backend = await responderComoBackend(page, { redeCai: true });
    await page.goto('/painel?aba=pontos');
    await expect(nomes(page)).toHaveCount(7);

    await excluirBretas(page);
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText(SEM_CONEXAO);
    await expect(nomes(page).nth(3)).toHaveText('Bretas - Loja 518');
    const excluir = page.getByRole('button', { name: 'Excluir Bretas - Loja 518', exact: true }).filter({ visible: true });
    await expect(excluir).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[role="tab"] .abas__contagem')).toHaveText(['2', '9', '10']);

    await excluirBretas(page);
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Bretas - Loja 518 excluído.');
    await expect(nomes(page).filter({ hasText: 'Bretas' })).toHaveCount(0);
    await expect(page.locator('[role="tab"] .abas__contagem')).toHaveText(['2', '8', '10']);
    expect(backend.exclusoes).toEqual([4, 4]);
  });
}

test('a edição de um ponto que outro administrador excluiu: salvar mostra a mensagem, sem "Tentar de novo"', async ({ page }) => {
  await responderComoBackend(page, {});
  await page.goto('/painel/pontos/4/editar');
  await expect(page.getByLabel('Nome do ponto')).toHaveValue('Bretas - Loja 518');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  const aviso = page.locator('.formulario__aviso[role="alert"]');
  await expect(aviso).toContainText('Ponto não encontrado.');
  await expect(aviso.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).not.toHaveAttribute('aria-disabled', 'true');
});

test('abrir a edição de um ponto que não existe mais: "Ponto não encontrado", com o caminho de volta ao painel', async ({ page }) => {
  await responderComoBackend(page, {});
  await page.goto('/painel/pontos/999/editar');
  await expect(page.getByRole('heading', { level: 1, name: 'Ponto não encontrado' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao painel' }).click();
  await expect(page).toHaveURL(/\/painel\?aba=pontos$/);
  await expect(nomes(page)).toHaveCount(7);
});
