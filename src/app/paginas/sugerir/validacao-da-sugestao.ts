import { NovaSugestao } from '../../api/modelos';

export type CampoDaSugestao = 'nome' | 'endereco' | 'idBairro' | 'horario' | 'contato' | 'categorias';
export type ErrosDaSugestao = Partial<Record<CampoDaSugestao, string>>;

export const CAMPOS_DA_SUGESTAO: readonly CampoDaSugestao[] = ['nome', 'endereco', 'idBairro', 'horario', 'contato', 'categorias'];

export const LIMITE_DA_SUGESTAO = { nome: 120, endereco: 200, horario: 100, contato: 100 } as const;

export const MENSAGEM_DA_SUGESTAO = {
  nomeVazio: 'Informe o nome do ponto.',
  enderecoVazio: 'Informe o endereço.',
  bairroVazio: 'Escolha o bairro.',
  bairroDesconhecido: 'Escolha um bairro da lista.',
  categoriasVazias: 'Escolha pelo menos um material.',
  categoriasDesconhecidas: 'Escolha só materiais da lista, sem repetir.',
  longo: (limite: number) => `Use até ${limite} caracteres.`,
} as const;

export interface DadosDaSugestao {
  nome: string;
  endereco: string;
  idBairro: number | null;
  horario: string;
  contato: string;
  categorias: readonly number[];
}

export interface IdsConhecidos {
  bairros: readonly number[];
  categorias: readonly number[];
}

export function validarSugestao(dados: DadosDaSugestao, conhecidos?: IdsConhecidos): ErrosDaSugestao {
  const erros: ErrosDaSugestao = {
    nome: erroDoObrigatorio(dados.nome, LIMITE_DA_SUGESTAO.nome, MENSAGEM_DA_SUGESTAO.nomeVazio),
    endereco: erroDoObrigatorio(dados.endereco, LIMITE_DA_SUGESTAO.endereco, MENSAGEM_DA_SUGESTAO.enderecoVazio),
    idBairro: erroDoBairro(dados.idBairro, conhecidos),
    horario: erroDoOpcional(dados.horario, LIMITE_DA_SUGESTAO.horario),
    contato: erroDoOpcional(dados.contato, LIMITE_DA_SUGESTAO.contato),
    categorias: erroDasCategorias(dados.categorias, conhecidos),
  };
  return Object.fromEntries(Object.entries(erros).filter(([, mensagem]) => mensagem !== undefined)) as ErrosDaSugestao;
}

export function temErrosNaSugestao(erros: ErrosDaSugestao): boolean {
  return Object.keys(erros).length > 0;
}

export function montarSugestao(dados: DadosDaSugestao): NovaSugestao {
  return {
    nome: dados.nome.trim(),
    endereco: dados.endereco.trim(),
    idBairro: dados.idBairro ?? 0,
    horario: dados.horario.trim() || null,
    contato: dados.contato.trim() || null,
    categorias: [...dados.categorias],
  };
}

function erroDoObrigatorio(texto: string, limite: number, vazio: string): string | undefined {
  const limpo = texto.trim();
  if (limpo === '') {
    return vazio;
  }
  return limpo.length > limite ? MENSAGEM_DA_SUGESTAO.longo(limite) : undefined;
}

function erroDoOpcional(texto: string, limite: number): string | undefined {
  return texto.trim().length > limite ? MENSAGEM_DA_SUGESTAO.longo(limite) : undefined;
}

function erroDoBairro(idBairro: number | null, conhecidos?: IdsConhecidos): string | undefined {
  if (idBairro === null) {
    return MENSAGEM_DA_SUGESTAO.bairroVazio;
  }
  return conhecidos && !conhecidos.bairros.includes(idBairro) ? MENSAGEM_DA_SUGESTAO.bairroDesconhecido : undefined;
}

function erroDasCategorias(categorias: readonly number[], conhecidos?: IdsConhecidos): string | undefined {
  if (categorias.length === 0) {
    return MENSAGEM_DA_SUGESTAO.categoriasVazias;
  }
  const repetida = new Set(categorias).size !== categorias.length;
  const desconhecida = conhecidos ? categorias.some((id) => !conhecidos.categorias.includes(id)) : false;
  return repetida || desconhecida ? MENSAGEM_DA_SUGESTAO.categoriasDesconhecidas : undefined;
}
