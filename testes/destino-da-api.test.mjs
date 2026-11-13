import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

const require = createRequire(import.meta.url);
const { destinoDaApi } = require('../scripts/destino-da-api.cjs');

const SENHA = 'senha-que-nao-pode-vazar';
let raiz;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), 'ecoponto-destino-'));
  await mkdir(path.join(raiz, 'backend'));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

async function envDaRaiz(texto) {
  await writeFile(path.join(raiz, '.env'), texto);
}

async function envDoBackend(texto) {
  await writeFile(path.join(raiz, 'backend', '.env'), texto);
}

test('sem .env nem variável, vale a porta padrão da API (8080)', () => {
  assert.deepEqual(destinoDaApi({ ambiente: {}, raiz }), { url: 'http://localhost:8080', origem: 'porta padrão da API' });
});

test('segue a ECOPONTO_API_PORTA do .env da raiz, o mesmo que a API lê, e só ela', async () => {
  await envDaRaiz(`ECOPONTO_DB_HOST=localhost\nECOPONTO_DB_SENHA=${SENHA}\n# Porta\nECOPONTO_API_PORTA=9090\n`);
  const destino = destinoDaApi({ ambiente: {}, raiz });
  assert.deepEqual(destino, { url: 'http://localhost:9090', origem: '.env da raiz' });
  assert.ok(!JSON.stringify(destino).includes(SENHA), 'nada além da porta sai do .env');
});

test('lê o .env como a API lê (properties): fim de linha do Windows, espaços, ":" e a última linha vale', async () => {
  await envDaRaiz('# ECOPONTO_API_PORTA=1111\r\nECOPONTO_API_PORTA = 8081\r\n  ECOPONTO_API_PORTA: 8082  \r\n');
  assert.equal(destinoDaApi({ ambiente: {}, raiz }).url, 'http://localhost:8082');
});

test('o backend/.env vence o da raiz, como no spring.config.import do perfil dev', async () => {
  await envDaRaiz('ECOPONTO_API_PORTA=9090\n');
  await envDoBackend('ECOPONTO_API_PORTA=9191\n');
  assert.deepEqual(destinoDaApi({ ambiente: {}, raiz }), { url: 'http://localhost:9191', origem: 'backend/.env' });
});

test('um .env sem a chave não conta: vale o seguinte', async () => {
  await envDoBackend('ECOPONTO_DB_HOST=localhost\n');
  await envDaRaiz('ECOPONTO_API_PORTA=9090\n');
  assert.equal(destinoDaApi({ ambiente: {}, raiz }).url, 'http://localhost:9090');
});

test('a variável de ambiente ECOPONTO_API_PORTA vence os arquivos, como na API', async () => {
  await envDaRaiz('ECOPONTO_API_PORTA=9090\n');
  await envDoBackend('ECOPONTO_API_PORTA=9191\n');
  assert.deepEqual(destinoDaApi({ ambiente: { ECOPONTO_API_PORTA: '8085' }, raiz }), {
    url: 'http://localhost:8085',
    origem: 'variável de ambiente ECOPONTO_API_PORTA',
  });
});

test('a ECOPONTO_API_URL vence tudo (os testes de ponta a ponta apontam para uma porta sem serviço)', async () => {
  await envDaRaiz('ECOPONTO_API_PORTA=9090\n');
  const ambiente = { ECOPONTO_API_URL: 'http://127.0.0.1:9', ECOPONTO_API_PORTA: '8085' };
  assert.deepEqual(destinoDaApi({ ambiente, raiz }), { url: 'http://127.0.0.1:9', origem: 'variável ECOPONTO_API_URL' });
});

test('a chave sem valor faz a API subir na porta padrão, e o proxy vai junto', async () => {
  await envDaRaiz('ECOPONTO_API_PORTA=\n');
  assert.equal(destinoDaApi({ ambiente: {}, raiz }).url, 'http://localhost:8080');
});

test('porta inválida para o npm start com uma mensagem clara, sem repetir o valor', async () => {
  for (const valor of ['80a', '0', '70000', SENHA]) {
    await envDaRaiz(`ECOPONTO_API_PORTA=${valor}\n`);
    assert.throws(
      () => destinoDaApi({ ambiente: {}, raiz }),
      (erro) => erro.message.startsWith('ECOPONTO_API_PORTA inválida em .env da raiz') && !erro.message.includes(valor),
      valor,
    );
  }
});

test('o proxy.conf.js encaminha /api para o destino calculado', () => {
  const antes = process.env['ECOPONTO_API_URL'];
  const log = console.log;
  process.env['ECOPONTO_API_URL'] = 'http://127.0.0.1:9';
  console.log = () => undefined;
  try {
    const caminho = require.resolve('../proxy.conf.js');
    delete require.cache[caminho];
    const proxy = require(caminho);
    assert.equal(proxy['/api'].target, 'http://127.0.0.1:9');
    assert.equal(proxy['/api'].changeOrigin, false);
  } finally {
    console.log = log;
    if (antes === undefined) {
      delete process.env['ECOPONTO_API_URL'];
    } else {
      process.env['ECOPONTO_API_URL'] = antes;
    }
  }
});
