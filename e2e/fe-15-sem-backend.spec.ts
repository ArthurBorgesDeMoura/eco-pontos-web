import { Page, Route, expect, test } from '@playwright/test';

import { auditarTela, percorrerComTab } from './apoio/auditoria';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const FORA_DO_AR = { codigo: 'SERVIDOR_INDISPONIVEL', mensagem: 'Fora do ar.' };

async function conferir(page: Page, tela: string): Promise<void> {
  const problemas = [...(await auditarTela(page)), ...(await percorrerComTab(page))];
  expect.soft(problemas, tela).toEqual([]);
}

async function backendComErro(page: Page, usuario: object, respostas: Record<string, { status: number; json: unknown }> = {}) {
  await page.route(/\/api\//, async (rota: Route) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho === '/api/auth/eu') {
      await rota.fulfill({ status: 200, json: usuario });
      return;
    }
    const resposta = respostas[caminho];
    await rota.fulfill(resposta ?? { status: 503, json: FORA_DO_AR });
  });
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: a busca e o detalhe com o servidor fora do ar`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await conferir(page, `${largura.nome}: busca com erro`);

    await page.goto('/pontos/13');
    await expect(page.getByRole('heading', { level: 1, name: 'Não foi possível abrir o ponto' })).toBeVisible();
    await conferir(page, `${largura.nome}: detalhe com erro`);
  });

  test(`${largura.nome}: Minhas sugestões e Sugerir com o servidor respondendo erro`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    await backendComErro(page, MARIA);
    await page.goto('/minhas-sugestoes');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await conferir(page, `${largura.nome}: minhas sugestões com erro`);

    await page.goto('/sugerir');
    await expect(page.getByText(/Não foi possível carregar os bairros e os materiais/)).toBeVisible();
    await conferir(page, `${largura.nome}: sugerir sem os bairros e os materiais`);
  });

  test(`${largura.nome}: as abas do painel com erro e as edições com "não encontrado" e com erro`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    await backendComErro(page, ADMIN, {
      '/api/pontos/999': { status: 404, json: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' } },
      '/api/admin/categorias': { status: 200, json: { itens: [], total: 0, pagina: 1, tamanho: 50 } },
    });
    for (const [aba, url] of [
      ['Pendentes', '/painel'],
      ['Pontos', '/painel?aba=pontos'],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await conferir(page, `${largura.nome}: painel, ${aba}, com erro`);
    }
    await page.goto('/painel?aba=categorias');
    await expect(page.locator('.painel__estado-mensagem', { hasText: 'Nenhuma categoria cadastrada' })).toBeVisible();
    await conferir(page, `${largura.nome}: painel, Categorias, vazia`);

    await page.goto('/painel/pontos/999/editar');
    await expect(page.getByRole('heading', { level: 1, name: 'Ponto não encontrado' })).toBeVisible();
    await conferir(page, `${largura.nome}: editar ponto não encontrado`);
    await page.goto('/painel/pontos/4/editar');
    await expect(page.getByRole('heading', { level: 1, name: 'Não foi possível abrir o ponto' })).toBeVisible();
    await conferir(page, `${largura.nome}: editar ponto com erro`);

    await page.goto('/painel/categorias/99/editar');
    await expect(page.getByRole('heading', { level: 1, name: 'Categoria não encontrada' })).toBeVisible();
    await conferir(page, `${largura.nome}: editar categoria não encontrada`);
  });
}

test('a aba Categorias e a edição de categoria com o servidor respondendo erro', async ({ page }) => {
  await backendComErro(page, ADMIN);
  await page.goto('/painel?aba=categorias');
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await conferir(page, 'painel, Categorias, com erro');
  await page.goto('/painel/categorias/6/editar');
  await expect(page.getByRole('heading', { level: 1, name: 'Não foi possível abrir a categoria' })).toBeVisible();
  await conferir(page, 'editar categoria com erro');
});
