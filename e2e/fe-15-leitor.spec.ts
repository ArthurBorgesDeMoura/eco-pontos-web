import { Page, expect, test } from '@playwright/test';

async function anexarArvore(page: Page, nome: string): Promise<void> {
  await test.info().attach(`arvore-${nome}.yml`, { body: await page.locator('body').ariaSnapshot(), contentType: 'text/yaml' });
}

test('Busca: o título, os filtros com nome e contagem, a lista de pontos e a região que anuncia o resultado', async ({ page }) => {
  await page.goto('/?bairro=4');
  const principal = page.getByRole('main');
  await expect(principal.getByRole('heading', { level: 1, name: 'Pontos de coleta' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const bairro = principal.getByRole('combobox', { name: /Bairro/ });
  await expect(bairro).toHaveText('Centro');
  await expect(bairro).toHaveAttribute('aria-expanded', 'false');
  await expect(principal.getByRole('link', { name: 'Bretas - Loja 518', exact: true })).toBeVisible();
  const cabecalhoDaLista = principal.locator('.busca__lista-cabecalho');
  await expect(cabecalhoDaLista).toHaveAttribute('aria-live', 'polite');
  await expect(cabecalhoDaLista).toContainText('em Centro');
  await anexarArvore(page, 'busca');
});

test('Entrar: os campos com rótulo, o erro ligado ao campo e o botão', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  const email = page.getByRole('textbox', { name: 'E-mail' });
  const senha = page.getByLabel('Senha');
  await expect(email).toBeVisible();
  await expect(senha).toBeVisible();
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(/.+/);
  await expect(email).toBeFocused();
  await anexarArvore(page, 'entrar');
});

test('Sugerir: os campos obrigatórios, o bairro, o grupo de materiais com as caixas de seleção e o envio', async ({ page }) => {
  await page.goto(`/entrar?voltar=${encodeURIComponent('/sugerir')}`);
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();

  const nome = page.getByRole('textbox', { name: 'Nome do ponto' });
  await expect(nome).toHaveAttribute('required', '');
  await expect(page.getByRole('combobox', { name: /Bairro/ })).toHaveAttribute('aria-required', 'true');
  const materiais = page.getByRole('group', { name: 'Materiais aceitos (obrigatório)' });
  await expect(materiais).toBeVisible();
  await expect(materiais).toHaveAccessibleDescription('Marque todos os materiais que o ponto recebe.');
  await expect(materiais.getByRole('checkbox')).toHaveCount(10);
  await expect(materiais.getByRole('checkbox', { name: 'Vidro' })).not.toBeChecked();

  await page.getByRole('button', { name: 'Enviar sugestão' }).click();
  await expect(nome).toHaveAttribute('aria-invalid', 'true');
  await expect(nome).toHaveAccessibleDescription('Informe o nome do ponto.');
  await expect(materiais).toHaveAccessibleDescription('Escolha pelo menos um material.');
  await anexarArvore(page, 'sugerir');
});
