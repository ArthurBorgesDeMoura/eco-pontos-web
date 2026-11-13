import { Page, Route, expect, test } from '@playwright/test';

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'desktop', width: 1440, height: 900 },
];

const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const DANIEL = 'Ecoponto Daniel Fonseca';
const CORU = 'Cooperativa dos Recicladores de Uberlândia (CORU)';

function pendente(idPonto: number, nome: string, autor: string): unknown {
  return {
    idPonto,
    nome,
    endereco: 'Rua Itabira, 1720',
    bairro: { idBairro: 7, nome: 'Daniel Fonseca' },
    materiais: [{ idCategoria: 1, nome: 'Papel e papelão' }],
    horario: null,
    contato: null,
    status: 'PENDENTE',
    sugeridoPor: { idUsuario: 3, nome: autor },
  };
}

interface Backend {
  decisoes: string[];
  soltar?: () => void;
}

async function responderComoBackend(page: Page, opcoes: { jaDecidido?: boolean; segurar?: boolean }): Promise<Backend> {
  const backend: Backend = { decisoes: [] };
  let pendentes = [pendente(14, DANIEL, 'João Pereira'), pendente(15, CORU, 'Maria Souza')] as { idPonto: number }[];
  let aprovados = 13;
  await page.route(/\/api\//, async (rota: Route) => {
    const url = new URL(rota.request().url());
    const decisao = /^\/api\/admin\/pontos\/(\d+)\/(aprovar|recusar)$/.exec(url.pathname);
    if (url.pathname === '/api/auth/eu') {
      await rota.fulfill({ status: 200, json: ADMIN });
    } else if (url.pathname === '/api/admin/resumo') {
      await rota.fulfill({ status: 200, json: { pendentes: pendentes.length, pontos: aprovados, categorias: 10 } });
    } else if (url.pathname === '/api/admin/pontos') {
      await rota.fulfill({ status: 200, json: { itens: pendentes, total: pendentes.length, pagina: 1, tamanho: 7 } });
      if (opcoes.jaDecidido) {
        pendentes = pendentes.filter((item) => item.idPonto !== 14);
        aprovados = 14;
      }
    } else if (decisao && rota.request().method() === 'POST') {
      backend.decisoes.push(`${decisao[1]}/${decisao[2]}`);
      if (opcoes.segurar) {
        await new Promise<void>((resolver) => (backend.soltar = resolver));
      }
      const idPonto = Number(decisao[1]);
      const item = pendentes.find((ponto) => ponto.idPonto === idPonto);
      if (!item) {
        await rota.fulfill({ status: 409, json: { codigo: 'JA_ANALISADO', mensagem: 'Esta sugestão já foi analisada.' } });
        return;
      }
      pendentes = pendentes.filter((ponto) => ponto.idPonto !== idPonto);
      aprovados += decisao[2] === 'aprovar' ? 1 : 0;
      await rota.fulfill({ status: 200, json: { ...item, status: decisao[2] === 'aprovar' ? 'APROVADO' : 'RECUSADO' } });
    } else {
      await rota.fulfill({ status: 404, json: {} });
    }
  });
  return backend;
}

for (const largura of LARGURAS) {
  test(`${largura.nome}: o ponto que outro administrador já decidiu (409) sai da fila, com o aviso`, async ({ page }) => {
    await page.setViewportSize({ width: largura.width, height: largura.height });
    const backend = await responderComoBackend(page, { jaDecidido: true });
    await page.goto('/painel');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel de administração' })).toBeVisible();
    const nomes = page.locator('.celula__nome, .painel__nome').filter({ visible: true });
    await expect(nomes).toHaveText([DANIEL, CORU]);

    await page.getByRole('button', { name: `Aprovar ${DANIEL}` }).filter({ visible: true }).click();
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText('Esta sugestão já foi analisada.');
    await expect(nomes).toHaveText([CORU]);
    await expect(page.locator('[role="tab"] .abas__contagem')).toHaveText(['1', '14', '10']);
    await page.getByRole('button', { name: `Recusar ${CORU}` }).filter({ visible: true }).click();
    await expect(page.locator('eco-avisos eco-aviso')).toHaveText(`${CORU} recusado.`);
    await expect(page.locator('.painel__estado-mensagem')).toHaveText('Nenhuma sugestão aguardando análise');
    expect(backend.decisoes).toEqual(['14/aprovar', '15/recusar']);
    await page.screenshot({ path: test.info().outputPath(`${largura.nome}-409.png`), fullPage: true });
  });
}

test('um toque duplo em "Aprovar" faz uma chamada só; durante ela, os dois botões da linha ficam indisponíveis', async ({
  page,
}) => {
  const backend = await responderComoBackend(page, { segurar: true });
  await page.goto('/painel');
  const aprovar = page.getByRole('button', { name: `Aprovar ${DANIEL}` }).filter({ visible: true });
  const recusar = page.getByRole('button', { name: `Recusar ${DANIEL}` }).filter({ visible: true });
  await aprovar.dblclick();
  await expect(aprovar).toHaveAttribute('aria-disabled', 'true');
  await expect(recusar).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: `Aprovar ${CORU}` })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(aprovar).toBeFocused();
  await recusar.click({ force: true });
  await aprovar.click({ force: true });
  await expect.poll(() => backend.decisoes.length).toBe(1);

  backend.soltar?.();
  await expect(page.locator('eco-avisos eco-aviso')).toHaveText(`${DANIEL} aprovado e publicado.`);
  await expect(page.locator('.celula__nome')).toHaveText([CORU]);
  expect(backend.decisoes).toEqual(['14/aprovar']);
});
