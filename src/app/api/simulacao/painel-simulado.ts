import { HttpRequest } from '@angular/common/http';

import {
  MENSAGEM_DA_CATEGORIA,
  mesmoNome,
  montarCategoria,
  temErrosNaCategoria,
  validarCategoria,
} from '../../paginas/painel/validacao-da-categoria';
import { CorpoErroApi } from '../erro-api';
import {
  Categoria,
  CategoriaDoPainel,
  PaginaDeCategorias,
  PaginaDoPainel,
  PontoDoPainel,
  ResumoDoPainel,
  StatusDoPonto,
} from '../modelos';
import { lerSessao } from './acesso-simulado';
import {
  MENSAGEM_DO_STATUS,
  STATUS,
  detalhe,
  inteiroPositivo,
  lerCorpoDoPonto,
  lerPaginacao,
  porBairroNomeEId,
  resumir,
} from './pontos-simulados';
import { PontoDoScript } from './respostas/pontos';
import { RespostaSimulada, RotaSimulada } from './rota-simulada';

export const MENSAGEM_DE_JA_ANALISADO = 'Esta sugestão já foi analisada.';

const DECISAO = /\/admin\/pontos\/([^/?#]+)\/(aprovar|recusar)(?:[?#]|$)/;
const UM_PONTO = /\/admin\/pontos\/([^/?#]+)(?:[?#]|$)/;
const UMA_CATEGORIA = /\/admin\/categorias\/([^/?#]+)(?:[?#]|$)/;

export class PainelSimulado {
  readonly rotas: readonly RotaSimulada[] = [
    { metodo: 'GET', caminho: /^\/admin\/resumo$/, responder: soAdmin(() => this.resumo()) },
    { metodo: 'GET', caminho: /^\/admin\/pontos$/, responder: soAdmin((pedido) => this.listar(pedido)) },
    { metodo: 'POST', caminho: /^\/admin\/pontos\/[^/]+\/(aprovar|recusar)$/, responder: soAdmin((pedido) => this.decidir(pedido)) },
    { metodo: 'PUT', caminho: /^\/admin\/pontos\/[^/]+$/, responder: soAdmin((pedido) => this.editar(pedido)) },
    { metodo: 'DELETE', caminho: /^\/admin\/pontos\/[^/]+$/, responder: soAdmin((pedido) => this.excluir(pedido)) },
    { metodo: 'GET', caminho: /^\/admin\/categorias$/, responder: soAdmin((pedido) => this.listarCategorias(pedido)) },
    { metodo: 'POST', caminho: /^\/admin\/categorias$/, responder: soAdmin((pedido) => this.criarCategoria(pedido)) },
    { metodo: 'PUT', caminho: /^\/admin\/categorias\/[^/]+$/, responder: soAdmin((pedido) => this.editarCategoria(pedido)) },
    ...['GET', 'POST', 'PUT', 'DELETE'].map(
      (metodo): RotaSimulada => ({ metodo, caminho: /^\/admin(\/.*)?$/, responder: soAdmin(semSimulacao) }),
    ),
  ];

  constructor(
    private readonly pontos: PontoDoScript[],
    private readonly categorias: Categoria[],
    private readonly nomeDoUsuario: (idUsuario: number) => string | null,
  ) {}

  private resumo(): RespostaSimulada {
    const corpo: ResumoDoPainel = {
      pendentes: this.pontos.filter((ponto) => ponto.status === 'PENDENTE').length,
      pontos: this.pontos.filter((ponto) => ponto.status === 'APROVADO').length,
      categorias: this.categorias.length,
    };
    return { status: 200, corpo };
  }

  private listar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const parametros = pedido.params;
    const status = parametros.get('status') ?? 'PENDENTE';
    const campos: Record<string, string> = {};
    if (!STATUS.includes(status as StatusDoPonto)) {
      campos['status'] = MENSAGEM_DO_STATUS;
    }
    const { pagina, tamanho } = lerPaginacao(parametros, campos);
    if (Object.keys(campos).length > 0) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os filtros.', campos };
      return { status: 400, corpo };
    }
    const lista = this.pontos.filter((ponto) => ponto.status === status).map((ponto) => this.paraOPainel(ponto));
    lista.sort(status === 'PENDENTE' ? (a, b) => a.idPonto - b.idPonto : porBairroNomeEId);
    const inicio = (pagina - 1) * tamanho;
    const corpo: PaginaDoPainel = {
      itens: lista.slice(inicio, inicio + tamanho),
      total: lista.length,
      pagina,
      tamanho,
    };
    return { status: 200, corpo };
  }

  private decidir(pedido: HttpRequest<unknown>): RespostaSimulada {
    const [, textoDoId, decisao] = DECISAO.exec(pedido.url) ?? [];
    const achado = this.acharPonto(textoDoId);
    if ('erro' in achado) {
      return achado.erro;
    }
    const { ponto } = achado;
    if (ponto.status !== 'PENDENTE') {
      const corpo: CorpoErroApi = { codigo: 'JA_ANALISADO', mensagem: MENSAGEM_DE_JA_ANALISADO };
      return { status: 409, corpo };
    }
    ponto.status = decisao === 'aprovar' ? 'APROVADO' : 'RECUSADO';
    return { status: 200, corpo: this.paraOPainel(ponto) };
  }

  private editar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const achado = this.acharPonto(UM_PONTO.exec(pedido.url)?.[1]);
    if ('erro' in achado) {
      return achado.erro;
    }
    const lido = lerCorpoDoPonto(pedido, this.categorias);
    if ('erro' in lido) {
      return lido.erro;
    }
    Object.assign(achado.ponto, lido.campos);
    return { status: 200, corpo: detalhe(achado.ponto, this.categorias) };
  }

  private excluir(pedido: HttpRequest<unknown>): RespostaSimulada {
    const achado = this.acharPonto(UM_PONTO.exec(pedido.url)?.[1]);
    if ('erro' in achado) {
      return achado.erro;
    }
    this.pontos.splice(this.pontos.indexOf(achado.ponto), 1);
    return { status: 204, corpo: null };
  }

  private listarCategorias(pedido: HttpRequest<unknown>): RespostaSimulada {
    const campos: Record<string, string> = {};
    const { pagina, tamanho } = lerPaginacao(pedido.params, campos);
    if (Object.keys(campos).length > 0) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os filtros.', campos };
      return { status: 400, corpo };
    }
    const lista = [...this.categorias].sort((a, b) => a.idCategoria - b.idCategoria);
    const inicio = (pagina - 1) * tamanho;
    const corpo: PaginaDeCategorias = {
      itens: lista.slice(inicio, inicio + tamanho).map((categoria) => this.paraOPainelACategoria(categoria)),
      total: lista.length,
      pagina,
      tamanho,
    };
    return { status: 200, corpo };
  }

  private criarCategoria(pedido: HttpRequest<unknown>): RespostaSimulada {
    const lido = this.lerCorpoDaCategoria(pedido, null);
    if ('erro' in lido) {
      return lido.erro;
    }
    const nova: Categoria = {
      idCategoria: Math.max(0, ...this.categorias.map((categoria) => categoria.idCategoria)) + 1,
      ...lido.campos,
    };
    this.categorias.push(nova);
    return { status: 201, corpo: this.paraOPainelACategoria(nova) };
  }

  private editarCategoria(pedido: HttpRequest<unknown>): RespostaSimulada {
    const idCategoria = inteiroPositivo(decodeURIComponent(UMA_CATEGORIA.exec(pedido.url)?.[1] ?? ''));
    if (idCategoria === undefined) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Use o id de uma categoria.' };
      return { status: 400, corpo };
    }
    const categoria = this.categorias.find((item) => item.idCategoria === idCategoria);
    if (!categoria) {
      const corpo: CorpoErroApi = { codigo: 'NAO_ENCONTRADO', mensagem: 'Categoria não encontrada.' };
      return { status: 404, corpo };
    }
    const lido = this.lerCorpoDaCategoria(pedido, idCategoria);
    if ('erro' in lido) {
      return lido.erro;
    }
    Object.assign(categoria, lido.campos);
    return { status: 200, corpo: this.paraOPainelACategoria(categoria) };
  }

  private lerCorpoDaCategoria(
    pedido: HttpRequest<unknown>,
    idCategoria: number | null,
  ): { campos: Pick<Categoria, 'nome' | 'descricao'> } | { erro: RespostaSimulada } {
    const corpo = (pedido.body ?? {}) as Record<string, unknown>;
    const dados = {
      nome: typeof corpo['nome'] === 'string' ? corpo['nome'] : '',
      descricao: typeof corpo['descricao'] === 'string' ? corpo['descricao'] : '',
    };
    const erros = validarCategoria(dados);
    if (temErrosNaCategoria(erros)) {
      const resposta: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos destacados.', campos: erros };
      return { erro: { status: 400, corpo: resposta } };
    }
    const campos = montarCategoria(dados);
    if (this.categorias.some((item) => item.idCategoria !== idCategoria && mesmoNome(item.nome, campos.nome))) {
      const resposta: CorpoErroApi = {
        codigo: 'NOME_REPETIDO',
        mensagem: MENSAGEM_DA_CATEGORIA.nomeRepetido,
        campos: { nome: MENSAGEM_DA_CATEGORIA.nomeRepetido },
      };
      return { erro: { status: 409, corpo: resposta } };
    }
    return { campos };
  }

  private paraOPainelACategoria(categoria: Categoria): CategoriaDoPainel {
    const pontos = this.pontos.filter(
      (ponto) => ponto.status === 'APROVADO' && ponto.categorias.includes(categoria.idCategoria),
    ).length;
    return { ...categoria, pontos };
  }

  private acharPonto(textoDoId: string | undefined): { ponto: PontoDoScript } | { erro: RespostaSimulada } {
    const idPonto = inteiroPositivo(decodeURIComponent(textoDoId ?? ''));
    if (idPonto === undefined) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Use o id de um ponto.' };
      return { erro: { status: 400, corpo } };
    }
    const ponto = this.pontos.find((item) => item.idPonto === idPonto);
    if (!ponto) {
      const corpo: CorpoErroApi = { codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' };
      return { erro: { status: 404, corpo } };
    }
    return { ponto };
  }

  private paraOPainel(ponto: PontoDoScript): PontoDoPainel {
    return {
      ...resumir(ponto, this.categorias),
      horario: ponto.horario,
      contato: ponto.contato,
      status: ponto.status,
      sugeridoPor: { idUsuario: ponto.idUsuario, nome: this.nomeDoUsuario(ponto.idUsuario) ?? `Conta ${ponto.idUsuario}` },
    };
  }
}

function soAdmin(responder: (pedido: HttpRequest<unknown>) => RespostaSimulada): (pedido: HttpRequest<unknown>) => RespostaSimulada {
  return (pedido) => {
    const usuario = lerSessao();
    if (!usuario) {
      const corpo: CorpoErroApi = { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' };
      return { status: 401, corpo };
    }
    if (usuario.perfil !== 'ADMIN') {
      const corpo: CorpoErroApi = { codigo: 'SEM_PERMISSAO', mensagem: 'Sua conta não tem permissão para fazer isso.' };
      return { status: 403, corpo };
    }
    return responder(pedido);
  };
}

function semSimulacao(pedido: HttpRequest<unknown>): RespostaSimulada {
  console.warn(`[simulação] ${pedido.method} ${pedido.url} ainda não tem resposta simulada.`);
  const corpo: CorpoErroApi = { codigo: 'SEM_SIMULACAO', mensagem: 'Esta rota ainda não tem resposta simulada.' };
  return { status: 404, corpo };
}
