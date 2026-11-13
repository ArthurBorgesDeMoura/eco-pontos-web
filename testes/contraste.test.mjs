import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORES = path.join(RAIZ, 'src', 'styles', 'tokens', '_cores.scss');

async function lerTokens() {
  const scss = await readFile(CORES, 'utf8');
  const tokens = {};
  for (const [, nome, valor] of scss.matchAll(/--cor-([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    tokens[nome] = valor;
  }
  return tokens;
}

function luminancia(hex) {
  let cor = hex.replace('#', '');
  if (cor.length === 3) {
    cor = [...cor].map((letra) => letra + letra).join('');
  }
  const [r, g, b] = [0, 2, 4].map((inicio) => {
    const canal = parseInt(cor.slice(inicio, inicio + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (escura + 0.05);
}

const FUNDOS = ['fundo-base', 'fundo-superficie', 'fundo-rebaixado', 'fundo-ativo'];

const PARES = [
  ...['texto-principal', 'texto-secundario', 'texto-terciario'].flatMap((texto) => FUNDOS.map((fundo) => [texto, fundo, 4.5])),
  ...['marca-verde', 'status-perigo', 'status-recusado-texto', 'status-pendente-texto'].flatMap((texto) =>
    FUNDOS.map((fundo) => [texto, fundo, 4.5]),
  ),
  ['texto-inverso', 'acao-primaria', 4.5],
  ['texto-inverso', 'acao-primaria-hover', 4.5],
  ['texto-inverso', 'acao-primaria-pressionada', 4.5],
  ['texto-inverso', 'status-perigo', 4.5],
  ['marca-verde-texto', 'marca-verde-fundo', 4.5],
  ['status-pendente-texto', 'status-pendente-fundo', 4.5],
  ['status-recusado-texto', 'status-recusado-fundo', 4.5],
  ...['fundo-base', 'fundo-superficie', 'fundo-rebaixado'].map((fundo) => ['borda-controle', fundo, 3]),
  ...FUNDOS.map((fundo) => ['marca-verde', fundo, 3]),
];

test('todos os tokens dos pares conferidos existem em _cores.scss', async () => {
  const tokens = await lerTokens();
  const faltando = [...new Set(PARES.flatMap(([a, b]) => [a, b]))].filter((nome) => !tokens[nome]);
  assert.deepEqual(faltando, [], `tokens sem valor em hexadecimal: ${faltando.join(', ')}`);
});

test('texto tem 4,5:1 e borda de controle e foco têm 3:1 sobre os fundos em que aparecem', async () => {
  const tokens = await lerTokens();
  const reprovados = PARES.map(([frente, fundo, minimo]) => ({ frente, fundo, minimo, razao: contraste(tokens[frente], tokens[fundo]) }))
    .filter((par) => par.razao < par.minimo)
    .map((par) => `${par.frente} sobre ${par.fundo}: ${par.razao.toFixed(2)}:1 (mínimo ${par.minimo}:1)`);
  assert.deepEqual(reprovados, []);
});

test('a fórmula confere com os valores de referência da WCAG', () => {
  assert.equal(contraste('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contraste('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(contraste('#808A7C', '#FFFFFF').toFixed(2), '3.59');
});
