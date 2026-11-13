import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { converterEmSimbolo, gerar, montarNomes } from '../scripts/gerar-icones.mjs';

const EXPORTADO_DO_FIGMA = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_12_34)">
<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="#161B17" stroke-width="1.5" stroke-linecap="round"/>
<path d="m21 21-4.35-4.35" stroke="#161B17" stroke-width="1.5" style="fill:#161B17"/>
</g>
<defs><clipPath id="clip0_12_34"><rect width="24" height="24" fill="white"/></clipPath></defs>
</svg>`;

test('converte o SVG exportado do Figma em símbolo do sprite', () => {
  const simbolo = converterEmSimbolo('busca', EXPORTADO_DO_FIGMA);

  assert.match(simbolo, /^<symbol id="busca" viewBox="0 0 24 24" fill="none">/);
  assert.match(simbolo, /<\/symbol>$/);
  assert.doesNotMatch(simbolo, /#161B17|"white"|xmlns/);
  assert.match(simbolo, /stroke="currentColor"/);
  assert.match(simbolo, /style="fill:currentColor"/);
  assert.match(simbolo, /<clipPath id="busca-clip0_12_34">/);
  assert.match(simbolo, /clip-path="url\(#busca-clip0_12_34\)"/);
  assert.equal(simbolo.match(/<path vector-effect="non-scaling-stroke"/g)?.length, 2);
});

test('sem viewBox, usa a largura e a altura do SVG', () => {
  const simbolo = converterEmSimbolo('mapa', '<svg width="20" height="20"><path d="M0 0h20v20H0z"/></svg>');

  assert.match(simbolo, /^<symbol id="mapa" viewBox="0 0 20 20">/);
});

test('recusa nome fora do padrão e SVG sem o elemento svg', () => {
  assert.throws(() => converterEmSimbolo('Busca', EXPORTADO_DO_FIGMA), /Nome de ícone inválido/);
  assert.throws(() => converterEmSimbolo('busca_2', EXPORTADO_DO_FIGMA), /Nome de ícone inválido/);
  assert.throws(() => converterEmSimbolo('x', '<path d="M0 0"/>'), /não tem um elemento <svg>/);
});

test('aceita só desenho: recusa script, evento, imagem, estilo, animação e links externos', () => {
  const dentroDeUmSvg = (conteudo) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${conteudo}</svg>`;
  const proibidos = {
    script: '<script>alert(1)</script>',
    'script com prefixo': '<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>',
    evento: '<path d="M0 0" onclick="x()"/>',
    imagem: '<image href="a.png"/>',
    'link com entidade': '<a href="&#x6A;avascript:alert(1)"><path d="M0 0"/></a>',
    'use externo': '<use href="https://exemplo.com/a.svg#x"/>',
    'estilo com @import': '<style>@import url(https://exemplo.com/a.css)</style>',
    animação: '<animate attributeName="href" values="&#106;avascript:alert(1)"/>',
    'url externa': '<path d="M0 0" fill="url(https://exemplo.com/a.svg#g)"/>',
    'estilo com função': '<path d="M0 0" style="fill:url(https://exemplo.com)"/>',
    'atributo sem aspas duplas': "<path d='M0 0'/>",
    doctype: '<!DOCTYPE svg [<!ENTITY x "y">]><path d="M0 0"/>',
  };
  for (const [caso, conteudo] of Object.entries(proibidos)) {
    assert.throws(() => converterEmSimbolo('x', dentroDeUmSvg(conteudo)), /Exporte só os vetores/, caso);
  }
  assert.doesNotThrow(() => converterEmSimbolo('x', dentroDeUmSvg('<g transform="translate(-1 -1)"><path d="M1 1h2"/></g>')));
});

test('a lista de nomes vira um tipo; vazia, nenhum nome é aceito', () => {
  assert.match(montarNomes(['busca', 'mapa']), /NOMES_ICONES = \[\n {2}'busca',\n {2}'mapa',\n\] as const;/);
  assert.match(montarNomes([]), /NOMES_ICONES = \[\] as const;/);
});

test('gerar() lê a pasta em ordem alfabética e grava o sprite e a lista', async () => {
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'icones-'));
  try {
    await writeFile(path.join(pasta, 'mapa.svg'), '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>');
    await writeFile(path.join(pasta, 'busca.svg'), EXPORTADO_DO_FIGMA);
    await writeFile(path.join(pasta, 'LEIA-ME.md'), 'ignorado');
    const sprite = path.join(pasta, 'sprite.svg');
    const lista = path.join(pasta, 'nomes.ts');

    const nomes = await gerar({ origem: pasta, sprite, lista });

    assert.deepEqual(nomes, ['busca', 'mapa']);
    const textoSprite = await readFile(sprite, 'utf8');
    assert.ok(textoSprite.indexOf('id="busca"') < textoSprite.indexOf('id="mapa"'));
    assert.match(textoSprite, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" aria-hidden="true">/);
    assert.match(await readFile(lista, 'utf8'), /'busca',\n {2}'mapa',/);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
