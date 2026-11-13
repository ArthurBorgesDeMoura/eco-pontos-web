import { Page, expect, test } from '@playwright/test';

interface Quadro {
  x: number;
  y: number;
  largura: number;
  altura: number;
  opacidade: number;
}

interface Filmagem {
  quadros: Quadro[];
  propriedades: string[];
}

interface Alvo {
  seletor: string;
  texto?: string;
}

async function filmar(page: Page, alvo: Alvo, acao: () => Promise<void>, duracaoMs = 500): Promise<Filmagem> {
  await page.evaluate(
    ({ alvo }) => {
      const registro = {
        quadros: [] as Quadro[],
        propriedades: [] as string[],
        terminou: false,
        parar: Number.POSITIVE_INFINITY,
      };
      (window as unknown as { filmagem: typeof registro }).filmagem = registro;
      const ignoradas = ['offset', 'computedOffset', 'easing', 'composite'];
      const limite = performance.now() + 15_000;
      const quadro = (): void => {
        const elemento = Array.from(document.querySelectorAll(alvo.seletor)).find(
          (candidato) => !alvo.texto || candidato.textContent?.trim() === alvo.texto,
        );
        if (elemento) {
          const caixa = elemento.getBoundingClientRect();
          registro.quadros.push({
            x: caixa.x,
            y: caixa.y,
            largura: caixa.width,
            altura: caixa.height,
            opacidade: Number(getComputedStyle(elemento).opacity),
          });
        }
        for (const animacao of document.getAnimations()) {
          if (animacao instanceof CSSTransition) {
            registro.propriedades.push(animacao.transitionProperty);
          } else {
            for (const chave of (animacao.effect as KeyframeEffect).getKeyframes()) {
              registro.propriedades.push(...Object.keys(chave).filter((p) => !ignoradas.includes(p)));
            }
          }
        }
        const agora = performance.now();
        if (agora < registro.parar && agora < limite) {
          requestAnimationFrame(quadro);
        } else {
          registro.terminou = true;
        }
      };
      requestAnimationFrame(quadro);
    },
    { alvo },
  );
  await acao();
  await page.evaluate((duracaoMs) => {
    const registro = (window as unknown as { filmagem: { parar: number } }).filmagem;
    registro.parar = performance.now() + duracaoMs;
  }, duracaoMs);
  await page.waitForFunction(() => (window as unknown as { filmagem: { terminou: boolean } }).filmagem.terminou);
  return page.evaluate(() => {
    const { quadros, propriedades } = (window as unknown as { filmagem: Filmagem }).filmagem;
    return { quadros, propriedades: [...new Set(propriedades)] };
  });
}

function seMoveu({ quadros }: Filmagem): boolean {
  const [primeiro, ...demais] = quadros;
  return demais.some(
    (q) =>
      Math.abs(q.x - primeiro.x) > 0.5 ||
      Math.abs(q.y - primeiro.y) > 0.5 ||
      Math.abs(q.largura - primeiro.largura) > 0.5 ||
      Math.abs(q.altura - primeiro.altura) > 0.5,
  );
}

function esmaeceu({ quadros }: Filmagem): boolean {
  return quadros.some((q) => q.opacidade < 1);
}

async function filmarDemonstracoes(page: Page): Promise<Record<string, Filmagem>> {
  await page.goto('/sistema');
  await expect(page.getByRole('heading', { level: 1, name: 'Sistema' })).toBeVisible();

  const botaoPressionar = page.getByRole('button', { name: 'Pressione e segure' });
  await botaoPressionar.scrollIntoViewIfNeeded();
  const caixa = await botaoPressionar.boundingBox();
  const pressionar = await filmar(page, { seletor: 'button', texto: 'Pressione e segure' }, async () => {
    await page.mouse.move((caixa?.x ?? 0) + 20, (caixa?.y ?? 0) + 20);
    await page.mouse.down();
  });
  await page.mouse.up();

  const dialogo = { seletor: '[role="dialog"]' };
  const abrirDialogo = await filmar(page, dialogo, () => page.getByRole('button', { name: 'Abrir diálogo' }).click());
  const fecharDialogo = await filmar(page, dialogo, () => page.keyboard.press('Escape'));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const detalhes = { seletor: '[aria-label="Tela de detalhes"]' };
  const empurrar = await filmar(page, detalhes, () => page.getByRole('button', { name: 'Abrir detalhes' }).click());
  const voltar = await filmar(page, detalhes, () => page.getByRole('button', { name: 'Voltar' }).click());

  return { pressionar, abrirDialogo, fecharDialogo, empurrar, voltar };
}

test.describe('com "reduzir movimento" ativado no sistema', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nada se move além de esmaecer', async ({ page }) => {
    const filmagens = await filmarDemonstracoes(page);

    await expect(page.getByText(/Reduzir movimento está\s+ativado/)).toBeVisible();
    for (const [nome, filmagem] of Object.entries(filmagens)) {
      expect(filmagem.quadros.length, `${nome}: filmou quadros`).toBeGreaterThanOrEqual(3);
      expect(seMoveu(filmagem), `${nome}: não pode mudar de lugar nem de tamanho`).toBe(false);
      expect(
        filmagem.propriedades.filter((p) => p !== 'opacity'),
        `${nome}: só a opacidade pode animar`,
      ).toEqual([]);
    }
    expect(esmaeceu(filmagens['abrirDialogo']), 'o diálogo esmaece ao abrir').toBe(true);
    expect(esmaeceu(filmagens['fecharDialogo']), 'o diálogo esmaece ao fechar').toBe(true);
    expect(esmaeceu(filmagens['empurrar']), 'a tela esmaece no lugar de entrar pela direita').toBe(true);
  });
});

test.describe('sem preferência de movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('as demonstrações se movem, o que prova que a filmagem mede algo', async ({ page }) => {
    const filmagens = await filmarDemonstracoes(page);

    for (const nome of ['pressionar', 'abrirDialogo', 'empurrar', 'voltar']) {
      expect(seMoveu(filmagens[nome]), `${nome}: deveria se mover`).toBe(true);
      expect(filmagens[nome].propriedades, `${nome}: anima transform`).toContain('transform');
    }
  });
});
