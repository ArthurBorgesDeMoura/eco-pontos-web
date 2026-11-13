import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_DOS_SVGS = path.join(RAIZ, 'icones');
const ARQUIVO_SPRITE = path.join(RAIZ, 'src', 'assets', 'icones.svg');
const ARQUIVO_NOMES = path.join(RAIZ, 'src', 'app', 'compartilhado', 'icone', 'nomes-icones.ts');
const AVISO = 'Gerado por scripts/gerar-icones.mjs a partir de icones/*.svg. Não edite à mão: rode npm run icones.';

const NOME_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ATRIBUTOS_DE_COR = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);
const ATRIBUTOS_HERDADOS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule'];
const CORES_MANTIDAS = /^(?:none|currentcolor|inherit|transparent|url\(#[^)]*\))$/i;

const ELEMENTOS_PERMITIDOS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc',
]);
const ATRIBUTOS_PERMITIDOS = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'id', 'transform',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'offset',
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity',
  'clip-path', 'clip-rule', 'clipPathUnits', 'mask', 'maskUnits', 'stop-color', 'stop-opacity',
  'gradientUnits', 'gradientTransform', 'href', 'xlink:href', 'style',
]);
const ETIQUETA = /<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
const ATRIBUTO = /([^\s=]+)\s*=\s*"([^"]*)"/g;

function conferirConteudo(nome, svg) {
  const recusar = (motivo) => {
    throw new Error(`O ícone "${nome}" tem ${motivo}. Exporte só os vetores.`);
  };
  const semComentarios = svg.replace(/^\s*<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  if (/<!|<\?/.test(semComentarios)) {
    recusar('declaração, DOCTYPE ou CDATA');
  }
  const sobra = semComentarios
    .replace(/<(title|desc)\b[^>]*>[^<]*<\/\1>/g, '')
    .replace(ETIQUETA, (_, fecha, elemento, atributos) => {
      if (!ELEMENTOS_PERMITIDOS.has(elemento)) {
        recusar(`o elemento <${elemento}>, que não é de desenho`);
      }
      for (const [, atributo, valor] of atributos.matchAll(ATRIBUTO)) {
        if (!ATRIBUTOS_PERMITIDOS.has(atributo)) {
          recusar(`o atributo ${atributo}, que não é de desenho`);
        }
        if (/&/.test(valor) && atributo !== 'id') {
          recusar(`entidade no atributo ${atributo}`);
        }
        if ((atributo === 'href' || atributo === 'xlink:href') && !/^#[\w.-]+$/.test(valor)) {
          recusar(`link que não é interno (${atributo}="${valor}")`);
        }
        if (/url\(\s*(?!#)/i.test(valor) || /javascript:|data:/i.test(valor.replace(/\s/g, ''))) {
          recusar(`endereço externo no atributo ${atributo}`);
        }
        if (atributo === 'style' && !/^[\w\s#.%,:;-]*$/.test(valor)) {
          recusar('estilo com função, aspas ou @');
        }
      }
      return '';
    });
  if (sobra.trim() !== '') {
    recusar(`texto ou marcação fora das etiquetas permitidas ("${sobra.trim().slice(0, 40)}")`);
  }
  return semComentarios;
}

export function converterEmSimbolo(nome, svgOriginal) {
  if (!NOME_VALIDO.test(nome)) {
    throw new Error(`Nome de ícone inválido: "${nome}". Use letras minúsculas, números e hífens, como busca.svg.`);
  }
  const svg = conferirConteudo(nome, svgOriginal);
  const encontrado = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i.exec(svg);
  if (!encontrado) {
    throw new Error(`O arquivo do ícone "${nome}" não tem um elemento <svg>.`);
  }
  const [, atributosDaRaiz, interior] = encontrado;
  const viewBox = lerAtributo(atributosDaRaiz, 'viewBox') ?? viewBoxPelasMedidas(atributosDaRaiz);
  if (!viewBox) {
    throw new Error(`O ícone "${nome}" não tem viewBox nem largura e altura.`);
  }

  const herdados = ATRIBUTOS_HERDADOS.flatMap((atributo) => {
    const valor = lerAtributo(atributosDaRaiz, atributo);
    return valor === undefined ? [] : [` ${atributo}="${trocarCor(atributo, valor)}"`];
  }).join('');

  const conteudo = interior
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(title|desc|metadata)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\s([a-z-]+)="([^"]*)"/gi, (original, atributo, valor) =>
      ATRIBUTOS_DE_COR.has(atributo.toLowerCase()) ? ` ${atributo}="${trocarCor(atributo, valor)}"` : original,
    )
    .replace(/\b(fill|stroke)\s*:\s*#[0-9a-f]{3,8}\b/gi, '$1:currentColor')
    .replace(/\sid="([^"]+)"/g, (_, id) => ` id="${nome}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${nome}-${id})`)
    .replace(/\s(xlink:href|href)="#([^"]+)"/g, (_, atributo, id) => ` ${atributo}="#${nome}-${id}"`)
    .replace(/<(path|circle|ellipse|rect|line|polyline|polygon)\b(?![^>]*vector-effect)/g, '<$1 vector-effect="non-scaling-stroke"')
    .replace(/>\s+</g, '><')
    .trim();

  return `<symbol id="${nome}" viewBox="${viewBox}"${herdados}>${conteudo}</symbol>`;
}

export function montarSprite(simbolos) {
  return ['<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">', `<!-- ${AVISO} -->`, ...simbolos, '</svg>', ''].join(
    '\n',
  );
}

export function montarNomes(nomes) {
  const itens = nomes.map((nome) => `  '${nome}',\n`).join('');
  return [
    `// ${AVISO}`,
    `export const NOMES_ICONES = [${itens ? `\n${itens}` : ''}] as const;`,
    '',
    'export type NomeIcone = typeof NOMES_ICONES[number];',
    '',
  ].join('\n');
}

export async function gerar({ origem = PASTA_DOS_SVGS, sprite = ARQUIVO_SPRITE, lista = ARQUIVO_NOMES } = {}) {
  const arquivos = (await readdir(origem)).filter((arquivo) => arquivo.toLowerCase().endsWith('.svg')).sort();
  const nomes = arquivos.map((arquivo) => path.basename(arquivo, path.extname(arquivo)));
  const simbolos = [];
  for (const [i, arquivo] of arquivos.entries()) {
    simbolos.push(converterEmSimbolo(nomes[i], await readFile(path.join(origem, arquivo), 'utf8')));
  }
  await writeFile(sprite, montarSprite(simbolos));
  await writeFile(lista, montarNomes(nomes));
  return nomes;
}

function lerAtributo(atributos, nome) {
  const encontrado = new RegExp(`(?:^|\\s)${nome}="([^"]*)"`).exec(atributos);
  return encontrado ? encontrado[1] : undefined;
}

function viewBoxPelasMedidas(atributos) {
  const largura = parseFloat(lerAtributo(atributos, 'width') ?? '');
  const altura = parseFloat(lerAtributo(atributos, 'height') ?? '');
  return largura > 0 && altura > 0 ? `0 0 ${largura} ${altura}` : undefined;
}

function trocarCor(atributo, valor) {
  return ATRIBUTOS_DE_COR.has(atributo.toLowerCase()) && !CORES_MANTIDAS.test(valor.trim()) ? 'currentColor' : valor;
}

const executadoDireto = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (executadoDireto) {
  gerar().then(
    (nomes) => console.log(`${nomes.length} ícone(s) no sprite${nomes.length ? `: ${nomes.join(', ')}` : '.'}`),
    (erro) => {
      console.error(erro.message);
      process.exitCode = 1;
    },
  );
}
