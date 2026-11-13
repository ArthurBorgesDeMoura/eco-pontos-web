import { NovaCategoria } from '../../api/modelos';

export type CampoDaCategoria = 'nome' | 'descricao';
export type ErrosDaCategoria = Partial<Record<CampoDaCategoria, string>>;

export const CAMPOS_DA_CATEGORIA: readonly CampoDaCategoria[] = ['nome', 'descricao'];

export const LIMITE_DA_CATEGORIA = { nome: 60, descricao: 255 } as const;

export const MENSAGEM_DA_CATEGORIA = {
  nomeVazio: 'Informe o nome da categoria.',
  nomeRepetido: 'Já existe uma categoria com este nome.',
  longo: (limite: number) => `Use até ${limite} caracteres.`,
} as const;

export interface DadosDaCategoria {
  nome: string;
  descricao: string;
}

export function validarCategoria(dados: DadosDaCategoria): ErrosDaCategoria {
  const erros: ErrosDaCategoria = {};
  const nome = dados.nome.trim();
  if (nome === '') {
    erros.nome = MENSAGEM_DA_CATEGORIA.nomeVazio;
  } else if (nome.length > LIMITE_DA_CATEGORIA.nome) {
    erros.nome = MENSAGEM_DA_CATEGORIA.longo(LIMITE_DA_CATEGORIA.nome);
  }
  if (dados.descricao.trim().length > LIMITE_DA_CATEGORIA.descricao) {
    erros.descricao = MENSAGEM_DA_CATEGORIA.longo(LIMITE_DA_CATEGORIA.descricao);
  }
  return erros;
}

export function temErrosNaCategoria(erros: ErrosDaCategoria): boolean {
  return Object.keys(erros).length > 0;
}

export function montarCategoria(dados: DadosDaCategoria): NovaCategoria {
  return { nome: dados.nome.trim(), descricao: dados.descricao.trim() || null };
}

const COMPARAR_NOMES = new Intl.Collator('pt-BR', { sensitivity: 'base' });

export function mesmoNome(a: string, b: string): boolean {
  return COMPARAR_NOMES.compare(a.trim(), b.trim()) === 0;
}
