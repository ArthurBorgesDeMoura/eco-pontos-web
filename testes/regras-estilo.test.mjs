import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import stylelint from 'stylelint';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UMA_TELA = path.join(RAIZ, 'src', 'app', 'paginas', 'sistema', 'exemplo-de-teste.component.scss');
const UM_TOKEN = path.join(RAIZ, 'src', 'styles', 'tokens', '_exemplo-de-teste.scss');

async function regrasVioladas(codigo, arquivo) {
  const { results } = await stylelint.lint({ code: codigo, codeFilename: arquivo });
  return results[0].warnings.map((aviso) => aviso.rule);
}

test('a tela que escreve cor, espaço, raio, texto ou movimento direto é recusada', async () => {
  const casos = {
    'color-no-hex': '.a { color: #161B17; }',
    'color-named': '.a { background-color: white; }',
    'function-disallowed-list': '.a { border-color: rgb(0 0 0 / 10%); }',
    'declaration-property-unit-disallowed-list': '.a { border-radius: 6px; }',
    'declaration-property-value-allowed-list': '.a { margin: 16px; }',
    'property-disallowed-list': '.a { animation: eco-empurrar-entrar var(--duracao-empurrar) var(--curva-empurrar) both; }',
  };
  for (const [regra, codigo] of Object.entries(casos)) {
    assert.ok((await regrasVioladas(codigo, UMA_TELA)).includes(regra), `${regra} deveria recusar: ${codigo}`);
  }

  const escritosDireto = [
    '.a { padding: 1rem 24px; }',
    '.a { gap: 8px; }',
    '.a { inset-inline-start: 12px; }',
    '.a { margin: 2ch; }',
    '.a { padding: 1vw; }',
    '.a { scroll-margin-top: 16px; }',
    '.a { gap: calc(var(--espaco-8) + 2px); }',
    '.a { border-radius: 6px; }',
    '.a { font-size: 14px; }',
    '.a { line-height: 20px; }',
    '.a { transition: transform 150ms ease; }',
    '.a { animation-duration: 0.2s; }',
  ];
  for (const codigo of escritosDireto) {
    assert.notDeepEqual(await regrasVioladas(codigo, UMA_TELA), [], `deveria recusar: ${codigo}`);
  }

  const foraDoPadrao = [
    '.a { font: 600 24px/32px sans-serif; }',
    '.a { font-family: Arial, sans-serif; }',
    '.a { font-weight: 700; }',
    '.a { transition: all var(--duracao-hover); }',
    '.a { transition: background-color var(--duracao-hover) var(--curva-hover); }',
    '.a { transition: transform var(--duracao-pressionar) var(--curva-entrada); }',
    '.a { transition-property: transform; }',
    '.a { animation: girar var(--duracao-dialogo); }',
    '.a { animation-name: eco-dialogo-entrar; }',
    '@keyframes eco-novo { to { opacity: 0; } }',
    '@media (min-width: 768px) { .a { color: var(--cor-texto-principal); } }',
  ];
  for (const codigo of foraDoPadrao) {
    assert.notDeepEqual(await regrasVioladas(codigo, UMA_TELA), [], `deveria recusar: ${codigo}`);
  }
});

test('a tela que usa só tokens e os mixins passa', async () => {
  const codigo = `@use 'abstratos' as *;

.cartao {
  padding: var(--espaco-16) var(--espaco-24);
  border: var(--espessura-linha) solid var(--cor-borda-cartao);
  border-radius: var(--raio-cartao);
  background-color: var(--cor-fundo-superficie);
  color: var(--cor-texto-principal);

  @include texto(corpo-14);
  @include pressionavel;

  @include a-partir-de(tablet) {
    padding: var(--espaco-24);
  }
}

.dialogo {
  transition: opacity var(--duracao-hover) var(--curva-hover);

  @include animar-entrada(eco-dialogo-entrar, var(--duracao-dialogo));
}
`;
  assert.deepEqual(await regrasVioladas(codigo, UMA_TELA), []);
});

test('os arquivos de tokens podem escrever os valores', async () => {
  const codigo = `:root {
  --cor-fundo-base: #F3F4EE;
  --espaco-16: 16px;
}

@keyframes eco-exemplo {
  to {
    opacity: 0;
  }
}
`;
  assert.deepEqual(await regrasVioladas(codigo, UM_TOKEN), []);
});

test('o projeto inteiro passa no stylelint', async () => {
  const resultado = await stylelint.lint({ files: path.join(RAIZ, 'src', '**', '*.scss').replaceAll('\\', '/') });
  const problemas = resultado.results.flatMap((r) =>
    r.warnings.map((aviso) => `${path.relative(RAIZ, r.source)}:${aviso.line} ${aviso.text}`),
  );

  assert.ok(resultado.results.length > 5, 'o stylelint precisa encontrar os arquivos SCSS');
  assert.deepEqual(problemas, []);
});

const ESTILO_EM_TEMPLATE = /\sstyle\s*=|\[style[.\]]|\[attr\.style\]|\[ngStyle\]/i;
const ESTILO_EM_CODIGO =
  /\bstyles\s*:|@HostBinding\(\s*['"`](?:style|attr\.style)\b|['"`]\[(?:style|attr\.style)[.\]]|\bsetStyle\s*\(|\.style\.[A-Za-z]+\s*=(?!=)|\.style\.(?:setProperty|cssText)\b/;

test('o detector de estilo inline encontra os casos proibidos', () => {
  assert.match('<p style="color: red">', ESTILO_EM_TEMPLATE);
  assert.match('<p [style.margin.px]="8">', ESTILO_EM_TEMPLATE);
  assert.match('<p [style]="estilos">', ESTILO_EM_TEMPLATE);
  assert.match('<p [attr.style]="estilos">', ESTILO_EM_TEMPLATE);
  assert.match('<p [ngStyle]="{ color: cor }">', ESTILO_EM_TEMPLATE);
  assert.match("@Component({ styles: ['p { color: red }'] })", ESTILO_EM_CODIGO);
  assert.match("@HostBinding('style.color') cor = 'red';", ESTILO_EM_CODIGO);
  assert.match("@Component({ host: { '[style.width.px]': 'largura' } })", ESTILO_EM_CODIGO);
  assert.match("this.renderer.setStyle(el, 'color', 'red');", ESTILO_EM_CODIGO);
  assert.match("elemento.style.color = 'red';", ESTILO_EM_CODIGO);
  assert.match("elemento.style.setProperty('--x', '1px');", ESTILO_EM_CODIGO);
  assert.doesNotMatch('<p class="texto-corpo-14">', ESTILO_EM_TEMPLATE);
  assert.doesNotMatch("@Component({ styleUrls: ['./a.component.scss'] })", ESTILO_EM_CODIGO);
  assert.doesNotMatch('const estilo = getComputedStyle(raiz);', ESTILO_EM_CODIGO);
});

test('nenhum template ou código de src/app traz estilo inline', async () => {
  const pastaApp = path.join(RAIZ, 'src', 'app');
  const arquivos = (await readdir(pastaApp, { recursive: true })).map((relativo) => path.join(pastaApp, relativo));
  const problemas = [];
  for (const arquivo of arquivos) {
    const ehTemplate = arquivo.endsWith('.html');
    const ehCodigo = arquivo.endsWith('.ts') && !arquivo.endsWith('.spec.ts');
    if (!ehTemplate && !ehCodigo) {
      continue;
    }
    const texto = await readFile(arquivo, 'utf8');
    if ((ehTemplate && ESTILO_EM_TEMPLATE.test(texto)) || (ehCodigo && ESTILO_EM_CODIGO.test(texto))) {
      problemas.push(path.relative(RAIZ, arquivo));
    }
  }

  assert.ok(arquivos.some((arquivo) => arquivo.endsWith('.html')), 'a varredura precisa achar os templates');
  assert.deepEqual(problemas, []);
});
