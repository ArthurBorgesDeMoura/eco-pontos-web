import { Page, TestInfo, expect, test } from '@playwright/test';

const AVISO = 'Sugestão enviada. Ela fica pendente até a análise.';

function noDesktop(info: TestInfo): boolean {
  return info.project.name === 'desktop';
}

const materiais = (page: Page) => page.getByRole('group', { name: 'Materiais aceitos' });
const caixa = (page: Page, nome: string) => materiais(page).getByRole('checkbox', { name: nome, exact: true });
const enviar = (page: Page) => page.getByRole('button', { name: 'Enviar sugestão' });

async function abrirFormulario(page: Page): Promise<void> {
  await page.goto('/entrar?voltar=%2Fsugerir');
  await page.getByLabel('E-mail').fill('maria.souza@example.com');
  await page.getByLabel('Senha').fill('senha-de-teste');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sugerir novo ponto' })).toBeVisible();
  await expect(caixa(page, 'Entulho e volumosos')).toBeAttached();
}

async function escolherBairro(page: Page, nome: string): Promise<void> {
  await page.locator('[data-campo="idBairro"] [role="combobox"]').click();
  await page.getByRole('option', { name: nome, exact: true }).click();
}

async function preencher(page: Page): Promise<void> {
  await page.getByLabel('Nome do ponto').fill('Ecoponto Morumbi');
  await page.getByLabel('Endereço').fill('Rua das Flores, 100');
  await escolherBairro(page, 'Morumbi');
  await page.getByLabel('Horário (opcional)').fill('8h às 17h, de segunda a sábado');
}

test('um envio válido cria a sugestão e leva a "Minhas sugestões" com o aviso, que some em 4 s', async ({ page }) => {
  await page.clock.install();
  await abrirFormulario(page);
  await preencher(page);
  await materiais(page).getByText('Papel e papelão', { exact: true }).click();
  await materiais(page).getByText('Vidro', { exact: true }).click();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  await enviar(page).click();
  await expect(page.locator('.formulario__enviar')).toHaveText('Enviando…');
  await page.clock.runFor(400);
  await expect(page).toHaveURL(/\/minhas-sugestoes$/);
  const aviso = page.locator('eco-avisos eco-aviso');
  await expect(aviso).toHaveText(AVISO);
  await expect(page.locator('eco-avisos [role="status"]')).toContainText(AVISO);

  await page.clock.runFor(3800);
  await expect(aviso).toBeVisible();
  await page.clock.runFor(700);
  await expect(aviso).toHaveCount(0);

  await page.clock.resume();
  await page.getByRole('link', { name: /^Pontos( de coleta)?$/ }).filter({ visible: true }).first().click();
  await expect(page.locator('.busca__contagem')).toHaveText('13 pontos');
});

test('sem material escolhido, o envio é bloqueado com a mensagem junto dos chips', async ({ page }) => {
  await abrirFormulario(page);
  await preencher(page);
  await enviar(page).click();

  await expect(page.locator('#formulario-materiais-erro')).toHaveText('Escolha pelo menos um material.');
  await expect(materiais(page)).toHaveAttribute('aria-describedby', 'formulario-materiais-erro');
  await expect(caixa(page, 'Papel e papelão')).toBeFocused();
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.locator('eco-avisos eco-aviso')).toHaveCount(0);

  await page.keyboard.press(' ');
  await expect(page.locator('#formulario-materiais-erro')).toHaveCount(0);
});

test('enviar vazio mostra os erros de cada campo e leva o foco ao primeiro', async ({ page }) => {
  await abrirFormulario(page);
  await enviar(page).click();

  await expect(page.locator('[data-campo="nome"] .campo__erro')).toHaveText('Informe o nome do ponto.');
  await expect(page.locator('[data-campo="endereco"] .campo__erro')).toHaveText('Informe o endereço.');
  await expect(page.locator('[data-campo="idBairro"] .seletor__erro')).toHaveText('Escolha o bairro.');
  await expect(page.getByLabel('Nome do ponto')).toBeFocused();
  await expect(page.getByLabel('Nome do ponto')).toHaveAttribute('aria-invalid', 'true');
});

test('os chips funcionam com mouse, toque e teclado, e o estado marcado é anunciado', async ({ page }, info) => {
  await abrirFormulario(page);
  const papel = caixa(page, 'Papel e papelão');
  const plastico = caixa(page, 'Plástico');
  const metal = caixa(page, 'Metal');

  await materiais(page).getByText('Papel e papelão', { exact: true }).click();
  await expect(papel).toBeChecked();
  await materiais(page).getByText('Papel e papelão', { exact: true }).click();
  await expect(papel).not.toBeChecked();

  if (!noDesktop(info)) {
    await materiais(page).getByText('Plástico', { exact: true }).tap();
    await expect(plastico).toBeChecked();
  }

  await papel.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(metal).toBeFocused();
  await page.keyboard.press(' ');
  await expect(metal).toBeChecked();
  const contorno = await metal.evaluate((entrada) => getComputedStyle(entrada.nextElementSibling as Element).outlineStyle);
  expect(contorno).not.toBe('none');

  await expect(materiais(page).getByRole('checkbox', { checked: true })).toHaveCount(noDesktop(info) ? 1 : 2);
  const ajuda = await materiais(page).getAttribute('aria-describedby');
  await expect(page.locator(`#${ajuda}`)).toHaveText('Marque todos os materiais que o ponto recebe.');
});

test('o formulário se preenche e se envia só com o teclado', async ({ page }) => {
  await abrirFormulario(page);
  await page.getByLabel('Nome do ponto').focus();
  await page.keyboard.type('Ecoponto Morumbi');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Rua das Flores, 100');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.type('moru');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-campo="idBairro"] [role="combobox"]')).toHaveText('Morumbi');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(caixa(page, 'Papel e papelão')).toBeFocused();
  await page.keyboard.press(' ');
  for (let passo = 0; passo < 12; passo++) {
    await page.keyboard.press('Tab');
    if (await enviar(page).evaluate((botao) => botao === document.activeElement)) {
      break;
    }
  }
  await expect(enviar(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/minhas-sugestoes$/);
  await expect(page.locator('eco-avisos eco-aviso')).toHaveText(AVISO);
});

test('sessão que venceu: o envio leva a Entrar e volta ao formulário depois', async ({ page }) => {
  await abrirFormulario(page);
  await preencher(page);
  await materiais(page).getByText('Metal', { exact: true }).click();
  await page.evaluate(() => sessionStorage.removeItem('ecoponto.simulacao.sessao'));
  await enviar(page).click();

  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsugerir&motivo=sessao$/);
  await expect(page.getByText('Sua sessão terminou. Entre de novo para continuar.')).toBeVisible();
});

test('no desktop, o formulário tem as medidas da D09; no celular e no tablet, o envio tem 44 px', async ({ page }, info) => {
  await abrirFormulario(page);
  await page.evaluate(() => document.fonts.ready);
  const medidas = await page.evaluate(() => {
    const caixa = (seletor: string) => {
      const r = document.querySelector(seletor)?.getBoundingClientRect();
      return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
    };
    return {
      cartao: caixa('.formulario__cartao'),
      nome: caixa('[data-campo="nome"]'),
      bairro: caixa('[data-campo="idBairro"]'),
      horario: caixa('[data-campo="horario"]'),
      contato: caixa('[data-campo="contato"]'),
      materiais: caixa('[data-campo="categorias"]'),
      chip: caixa('eco-chip-material label'),
      acoes: caixa('.formulario__acoes'),
      enviar: caixa('.formulario__enviar'),
    };
  });

  if (noDesktop(info)) {
    expect(medidas.cartao).toEqual([160, 184, 640, 653]);
    expect(medidas.nome).toEqual([185, 209, 590, 66]);
    expect(medidas.bairro).toEqual([185, 381, 590, 66]);
    expect(medidas.horario).toEqual([185, 467, 287, 66]);
    expect(medidas.contato).toEqual([488, 467, 287, 66]);
    expect(medidas.materiais).toEqual([185, 553, 590, 182]);
    expect(medidas.chip?.[3]).toBe(40);
    expect(medidas.acoes?.[1]).toBe(755);
    expect(medidas.enviar?.[3]).toBe(36);
    expect((medidas.enviar?.[0] ?? 0) + (medidas.enviar?.[2] ?? 0)).toBe(775);
  } else {
    expect(medidas.enviar?.[3]).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  }
});
