import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

const REGRAS_DO_AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function auditarTela(page: Page): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const medidas = await page.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none';
    };
    const deProposito = (el: Element) => !!el.closest('.so-leitor-de-tela, [aria-hidden="true"]');
    const rolaParaOLado = (el: Element) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX);
    const dentroDeRolagem = (el: Element) => {
      for (let pai = el.parentElement; pai; pai = pai.parentElement) {
        if (rolaParaOLado(pai)) {
          return true;
        }
      }
      return false;
    };
    const descrever = (el: Element) => {
      const classe = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      const texto = (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${classe} "${texto}"`;
    };
    const caixasDeToque = (el: Element) => {
      const caixas: { largura: number; altura: number }[] = [];
      const somar = (alvo: Element | null) => {
        if (!alvo) {
          return;
        }
        const r = alvo.getBoundingClientRect();
        caixas.push({ largura: r.width, altura: r.height });
        for (const pseudo of ['::before', '::after']) {
          const estilo = getComputedStyle(alvo, pseudo);
          if (estilo.position === 'absolute' && estilo.content !== 'none') {
            caixas.push({ largura: parseFloat(estilo.width) || 0, altura: parseFloat(estilo.height) || 0 });
          }
        }
      };
      somar(el);
      somar(el.querySelector(':scope > .botao__alvo'));
      somar(el.closest('.campo__caixa, .seletor__caixa'));
      return caixas;
    };

    const foraDaJanela: string[] = [];
    const rolagensInternas: string[] = [];
    const cortados: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visivel(el) || deProposito(el)) {
        continue;
      }
      const estilo = getComputedStyle(el);
      if (rolaParaOLado(el) && el.scrollWidth > el.clientWidth + 1) {
        rolagensInternas.push(`${descrever(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      }
      const esconde = ['hidden', 'clip'].includes(estilo.overflowX) || estilo.textOverflow === 'ellipsis';
      const raizDaTela = el.classList.contains('tela');
      if (esconde && !raizDaTela && el.scrollWidth > el.clientWidth + 1 && (el.textContent ?? '').trim() !== '') {
        cortados.push(`${descrever(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      }
      if (!dentroDeRolagem(el)) {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1) {
          foraDaJanela.push(`${descrever(el)} (${Math.round(r.left)} a ${Math.round(r.right)}, janela de ${innerWidth})`);
        }
      }
    }
    const pequenos: string[] = [];
    if (innerWidth < 1024) {
      const alvos = document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="combobox"], [role="option"]',
      );
      for (const original of Array.from(alvos)) {
        let el: Element | null = original;
        if (el.tagName === 'INPUT' && el.classList.contains('so-leitor-de-tela')) {
          el = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
        }
        if (!el || !visivel(el) || deProposito(el)) {
          continue;
        }
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li')) {
          continue;
        }
        const caixas = caixasDeToque(el);
        if (!caixas.some((caixa) => caixa.largura >= 43.5 && caixa.altura >= 43.5)) {
          const maior = caixas.reduce((a, b) => (b.largura * b.altura > a.largura * a.altura ? b : a));
          pequenos.push(`${descrever(el)} (${Math.round(maior.largura)} × ${Math.round(maior.altura)})`);
        }
      }
    }
    return { foraDaJanela, rolagensInternas, cortados, pequenos };
  });

  const axe = await new AxeBuilder({ page }).withTags(REGRAS_DO_AXE).analyze();

  return [
    ...medidas.foraDaJanela.map((item) => `passa da janela: ${item}`),
    ...medidas.rolagensInternas.map((item) => `rola para o lado por dentro: ${item}`),
    ...medidas.cortados.map((item) => `texto cortado: ${item}`),
    ...medidas.pequenos.map((item) => `alvo de toque pequeno: ${item}`),
    ...axe.violations.map(
      (violacao) =>
        `axe ${violacao.impact ?? 'sem grau'} ${violacao.id}: ${violacao.nodes
          .slice(0, 3)
          .map((no) => no.target.join(' '))
          .join(' | ')}`,
    ),
  ];
}

export async function focoEstaVisivel(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const ativo = document.activeElement as HTMLElement | null;
    if (!ativo || ativo === document.body) {
      return false;
    }
    const contorno = (el: Element | null, pseudo?: string) => {
      if (!el) {
        return false;
      }
      const estilo = getComputedStyle(el, pseudo);
      return estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
    };
    const caixa = ativo.closest('.seletor__caixa, .campo__caixa');
    const rotulo = ativo.id ? document.querySelector(`label[for="${CSS.escape(ativo.id)}"]`) : null;
    return (
      contorno(ativo) || contorno(ativo, '::after') || (!!caixa && getComputedStyle(caixa).boxShadow !== 'none') || contorno(rotulo)
    );
  });
}

export async function percorrerComTab(page: Page): Promise<string[]> {
  const esperadas = await page.evaluate(() => {
    const SELETOR =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
    const chaves: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(SELETOR))) {
      const indice = el.getAttribute('tabindex');
      if (indice !== null && Number(indice) < 0) {
        continue;
      }
      if (el.closest('[inert]') || el.getClientRects().length === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      el.dataset['paradaDoTab'] = String(chaves.length);
      const texto = (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      chaves.push(`${el.tagName.toLowerCase()} "${texto}"`);
    }
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute('tabindex');
    return chaves;
  });

  const problemas: string[] = [];
  const paradas: string[] = [];
  for (let passo = 1; passo <= esperadas.length + 1; passo++) {
    await page.keyboard.press('Tab');
    const parada = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      if (!ativo || ativo === document.body) {
        return null;
      }
      const texto = (ativo.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
      return ativo.dataset['paradaDoTab'] ?? `fora da lista: ${ativo.tagName.toLowerCase()} "${texto}"`;
    });
    if (parada === null || parada === paradas[0] || parada === paradas[paradas.length - 1]) {
      break;
    }
    paradas.push(parada);
    if (!(await focoEstaVisivel(page))) {
      problemas.push(`foco invisível na parada ${passo}: ${esperadas[Number(parada)] ?? parada}`);
    }
  }
  const nomeDa = (parada: string | undefined) =>
    parada === undefined ? 'o fim (o foco saiu da página)' : esperadas[Number(parada)] ?? parada;
  const esperadasPorNumero = esperadas.map((_, indice) => String(indice));
  if (paradas.join(',') !== esperadasPorNumero.join(',')) {
    const diferenca = esperadasPorNumero.findIndex((chave, indice) => paradas[indice] !== chave);
    const onde = diferenca < 0 ? paradas.length - 1 : diferenca;
    problemas.push(
      `ordem do Tab diferente da tela: na parada ${onde + 1}, esperava ${esperadas[onde] ?? 'o fim'} e veio ${nomeDa(paradas[onde])} (${paradas.length} de ${esperadas.length} paradas)`,
    );
  }
  await page.evaluate(() =>
    document.querySelectorAll<HTMLElement>('[data-parada-do-tab]').forEach((el) => delete el.dataset['paradaDoTab']),
  );
  return problemas;
}
