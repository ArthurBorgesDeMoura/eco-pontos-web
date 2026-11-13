import { HttpParams, HttpRequest } from '@angular/common/http';

import { temErrosNaSugestao, validarSugestao } from '../../paginas/sugerir/validacao-da-sugestao';
import { CorpoErroApi } from '../erro-api';
import {
  Categoria,
  ContagemDePontos,
  PaginaDePontos,
  PaginaDeSugestoes,
  PontoCriado,
  PontoDetalhe,
  PontoResumo,
  StatusDoPonto,
} from '../modelos';
import { lerSessao } from './acesso-simulado';
import { BAIRROS } from './respostas/bairros';
import { CATEGORIAS } from './respostas/categorias';
import { PONTOS_DO_SCRIPT, PontoDoScript } from './respostas/pontos';
import { RespostaSimulada, RotaSimulada } from './rota-simulada';

export const TAMANHO_PADRAO_DA_PAGINA = 7;
export const TAMANHO_MAXIMO_DA_PAGINA = 50;

export class PontosSimulados {
  readonly pontos: PontoDoScript[] = PONTOS_DO_SCRIPT.map((ponto) => ({
    ...ponto,
    categorias: [...ponto.categorias],
  }));

  readonly categorias: Categoria[] = CATEGORIAS.map((categoria) => ({ ...categoria }));

  readonly rotas: readonly RotaSimulada[] = [
    { metodo: 'GET', caminho: /^\/categorias$/, responder: () => ({ status: 200, corpo: this.categorias }) },
    { metodo: 'GET', caminho: /^\/pontos$/, responder: (pedido) => this.listar(pedido) },
    { metodo: 'GET', caminho: /^\/pontos\/contagem$/, responder: (pedido) => this.contar(pedido) },
    { metodo: 'GET', caminho: /^\/pontos\/[^/]+$/, responder: (pedido) => this.detalhar(pedido) },
    { metodo: 'POST', caminho: /^\/pontos$/, responder: (pedido) => this.sugerir(pedido) },
    { metodo: 'GET', caminho: /^\/minhas-sugestoes$/, responder: (pedido) => this.minhasSugestoes(pedido) },
  ];

  private minhasSugestoes(pedido: HttpRequest<unknown>): RespostaSimulada {
    const usuario = lerSessao();
    if (!usuario) {
      const corpo: CorpoErroApi = { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' };
      return { status: 401, corpo };
    }
    const parametros = pedido.params;
    const status = parametros.get('status');
    const campos: Record<string, string> = {};
    if (status !== null && !STATUS.includes(status as StatusDoPonto)) {
      campos['status'] = MENSAGEM_DO_STATUS;
    }
    const { pagina, tamanho } = lerPaginacao(parametros, campos);
    if (Object.keys(campos).length > 0) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os filtros.', campos };
      return { status: 400, corpo };
    }
    const minhas = this.pontos
      .filter((ponto) => ponto.idUsuario === usuario.idUsuario)
      .filter((ponto) => status === null || ponto.status === status)
      .sort((a, b) => b.idPonto - a.idPonto);
    const inicio = (pagina - 1) * tamanho;
    const corpo: PaginaDeSugestoes = {
      itens: minhas.slice(inicio, inicio + tamanho).map((ponto) => ({ ...resumir(ponto, this.categorias), status: ponto.status })),
      total: minhas.length,
      pagina,
      tamanho,
    };
    return { status: 200, corpo };
  }

  private sugerir(pedido: HttpRequest<unknown>): RespostaSimulada {
    const usuario = lerSessao();
    if (!usuario) {
      const corpo: CorpoErroApi = { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' };
      return { status: 401, corpo };
    }
    const lido = lerCorpoDoPonto(pedido, this.categorias);
    if ('erro' in lido) {
      return lido.erro;
    }
    const novo: PontoDoScript = {
      idPonto: Math.max(...this.pontos.map((ponto) => ponto.idPonto)) + 1,
      ...lido.campos,
      status: 'PENDENTE',
      idUsuario: usuario.idUsuario,
    };
    this.pontos.push(novo);
    const criado: PontoCriado = { ...detalhe(novo, this.categorias), status: novo.status };
    return { status: 201, corpo: criado };
  }

  private detalhar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const textoDoId = decodeURIComponent(pedido.url.split(/[?#]/)[0].split('/').pop() ?? '');
    const idPonto = inteiroPositivo(textoDoId);
    if (idPonto === undefined) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Use o id de um ponto.' };
      return { status: 400, corpo };
    }
    const ponto = this.pontos.find((item) => item.idPonto === idPonto);
    if (!ponto || (ponto.status !== 'APROVADO' && lerSessao()?.perfil !== 'ADMIN')) {
      const corpo: CorpoErroApi = { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' };
      return { status: 404, corpo };
    }
    return { status: 200, corpo: detalhe(ponto, this.categorias) };
  }

  private contar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const parametros = pedido.params;
    const bairro = inteiroPositivo(parametros.get('bairro'));
    if (bairro === undefined && parametros.has('bairro')) {
      const corpo: CorpoErroApi = {
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Confira os filtros da busca.',
        campos: { bairro: 'Use o id de um bairro.' },
      };
      return { status: 400, corpo };
    }
    const doBairro = this.pontos.filter(
      (ponto) => ponto.status === 'APROVADO' && (bairro === undefined || ponto.idBairro === bairro),
    );
    const corpo: ContagemDePontos = {
      total: doBairro.length,
      categorias: this.categorias.map((categoria) => ({
        idCategoria: categoria.idCategoria,
        quantidade: doBairro.filter((ponto) => ponto.categorias.includes(categoria.idCategoria)).length,
      })),
    };
    return { status: 200, corpo };
  }

  private listar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const parametros = pedido.params;
    const bairro = inteiroPositivo(parametros.get('bairro'));
    const categoria = inteiroPositivo(parametros.get('categoria'));

    const campos: Record<string, string> = {};
    if (bairro === undefined && parametros.has('bairro')) {
      campos['bairro'] = 'Use o id de um bairro.';
    }
    if (categoria === undefined && parametros.has('categoria')) {
      campos['categoria'] = 'Use o id de uma categoria.';
    }
    const { pagina, tamanho } = lerPaginacao(parametros, campos);
    if (Object.keys(campos).length > 0) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os filtros da busca.', campos };
      return { status: 400, corpo };
    }

    const encontrados = this.pontos
      .filter((ponto) => ponto.status === 'APROVADO')
      .filter((ponto) => bairro === undefined || ponto.idBairro === bairro)
      .filter((ponto) => categoria === undefined || ponto.categorias.includes(categoria))
      .map((ponto) => resumir(ponto, this.categorias))
      .sort(porBairroNomeEId);
    const inicio = (pagina - 1) * tamanho;
    const corpo: PaginaDePontos = {
      itens: encontrados.slice(inicio, inicio + tamanho),
      total: encontrados.length,
      pagina,
      tamanho,
    };
    return { status: 200, corpo };
  }
}

function nomeDoBairro(idBairro: number): string {
  return BAIRROS.find((item) => item.idBairro === idBairro)?.nome ?? '';
}

export type CamposDoPonto = Pick<PontoDoScript, 'nome' | 'endereco' | 'idBairro' | 'horario' | 'contato' | 'categorias'>;

export function lerCorpoDoPonto(
  pedido: HttpRequest<unknown>,
  categorias: readonly Categoria[],
): { campos: CamposDoPonto } | { erro: RespostaSimulada } {
  const corpo = (pedido.body ?? {}) as Record<string, unknown>;
  const dados = {
    nome: texto(corpo['nome']),
    endereco: texto(corpo['endereco']),
    idBairro: typeof corpo['idBairro'] === 'number' ? corpo['idBairro'] : null,
    horario: texto(corpo['horario']),
    contato: texto(corpo['contato']),
    categorias: Array.isArray(corpo['categorias']) ? corpo['categorias'].map((id) => (typeof id === 'number' ? id : NaN)) : [],
  };
  const erros = validarSugestao(dados, {
    bairros: BAIRROS.map((bairro) => bairro.idBairro),
    categorias: categorias.map((categoria) => categoria.idCategoria),
  });
  if (temErrosNaSugestao(erros)) {
    const resposta: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos destacados.', campos: erros };
    return { erro: { status: 400, corpo: resposta } };
  }
  return {
    campos: {
      nome: dados.nome.trim(),
      endereco: dados.endereco.trim(),
      idBairro: dados.idBairro ?? 0,
      horario: dados.horario.trim() || null,
      contato: dados.contato.trim() || null,
      categorias: [...dados.categorias].sort((a, b) => a - b),
    },
  };
}

export function detalhe(ponto: PontoDoScript, categorias: readonly Categoria[]): PontoDetalhe {
  return {
    idPonto: ponto.idPonto,
    nome: ponto.nome,
    endereco: ponto.endereco,
    horario: ponto.horario,
    contato: ponto.contato,
    bairro: { idBairro: ponto.idBairro, nome: nomeDoBairro(ponto.idBairro) },
    materiais: categorias.filter((categoria) => ponto.categorias.includes(categoria.idCategoria)).map((categoria) => ({ ...categoria })),
  };
}

export function resumir(ponto: PontoDoScript, categorias: readonly Categoria[]): PontoResumo {
  return {
    idPonto: ponto.idPonto,
    nome: ponto.nome,
    endereco: ponto.endereco,
    bairro: { idBairro: ponto.idBairro, nome: nomeDoBairro(ponto.idBairro) },
    materiais: [...ponto.categorias]
      .sort((a, b) => a - b)
      .map((id) => ({ idCategoria: id, nome: categorias.find((item) => item.idCategoria === id)?.nome ?? '' })),
  };
}

export const STATUS: readonly StatusDoPonto[] = ['PENDENTE', 'APROVADO', 'RECUSADO'];
export const MENSAGEM_DO_STATUS = 'Use PENDENTE, APROVADO ou RECUSADO.';

const ORDEM = new Intl.Collator('pt-BR');

export function porBairroNomeEId(a: PontoResumo, b: PontoResumo): number {
  return ORDEM.compare(a.bairro.nome, b.bairro.nome) || ORDEM.compare(a.nome, b.nome) || a.idPonto - b.idPonto;
}

export function lerPaginacao(parametros: HttpParams, campos: Record<string, string>): { pagina: number; tamanho: number } {
  const pagina = inteiroPositivo(parametros.get('pagina')) ?? (parametros.has('pagina') ? NaN : 1);
  const tamanho = inteiroPositivo(parametros.get('tamanho')) ?? (parametros.has('tamanho') ? NaN : TAMANHO_PADRAO_DA_PAGINA);
  if (Number.isNaN(pagina)) {
    campos['pagina'] = 'A página começa em 1.';
  }
  if (Number.isNaN(tamanho) || tamanho > TAMANHO_MAXIMO_DA_PAGINA) {
    campos['tamanho'] = `O tamanho vai de 1 a ${TAMANHO_MAXIMO_DA_PAGINA}.`;
  }
  return { pagina, tamanho };
}

export function inteiroPositivo(texto: string | null): number | undefined {
  if (texto === null || !/^\d+$/.test(texto)) {
    return undefined;
  }
  const numero = Number(texto);
  return numero >= 1 ? numero : undefined;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}
