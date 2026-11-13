const fs = require('node:fs');
const path = require('node:path');

const PORTA_PADRAO = 8080;
const RAIZ_DO_REPOSITORIO = path.resolve(__dirname, '..', '..');

function portaNoArquivo(arquivo) {
  let texto;
  try {
    texto = fs.readFileSync(arquivo, 'utf8');
  } catch {
    return null;
  }
  let porta = null;
  for (const linha of texto.split(/\r?\n/)) {
    const achou = /^\s*ECOPONTO_API_PORTA\s*[=:]\s*(.*?)\s*$/.exec(linha);
    if (achou) {
      porta = achou[1];
    }
  }
  return porta;
}

function destinoDaApi({ ambiente = process.env, raiz = RAIZ_DO_REPOSITORIO } = {}) {
  if (ambiente['ECOPONTO_API_URL']) {
    return { url: ambiente['ECOPONTO_API_URL'], origem: 'variável ECOPONTO_API_URL' };
  }
  const fontes = [
    ['variável de ambiente ECOPONTO_API_PORTA', () => ambiente['ECOPONTO_API_PORTA']],
    ['backend/.env', () => portaNoArquivo(path.join(raiz, 'backend', '.env'))],
    ['.env da raiz', () => portaNoArquivo(path.join(raiz, '.env'))],
  ];
  for (const [origem, ler] of fontes) {
    const valor = ler();
    if (valor === undefined || valor === null) {
      continue;
    }
    const texto = String(valor).trim();
    if (texto === '') {
      return { url: `http://localhost:${PORTA_PADRAO}`, origem: `${origem}, sem valor` };
    }
    const porta = Number(texto);
    if (!/^\d+$/.test(texto) || porta < 1 || porta > 65535) {
      throw new Error(`ECOPONTO_API_PORTA inválida em ${origem}: use um número de 1 a 65535, o mesmo da API.`);
    }
    return { url: `http://localhost:${porta}`, origem };
  }
  return { url: `http://localhost:${PORTA_PADRAO}`, origem: 'porta padrão da API' };
}

module.exports = { destinoDaApi, PORTA_PADRAO };
