export interface Bairro {
  idBairro: number;
  nome: string;
}

export interface Categoria {
  idCategoria: number;
  nome: string;
  descricao: string | null;
}

export type PerfilDoUsuario = 'USUARIO' | 'ADMIN';

export interface Usuario {
  idUsuario: number;
  nome: string;
  email: string;
  perfil: PerfilDoUsuario;
}

export interface PontoResumo {
  idPonto: number;
  nome: string;
  endereco: string;
  bairro: Bairro;
  materiais: Pick<Categoria, 'idCategoria' | 'nome'>[];
}

export interface PontoDetalhe {
  idPonto: number;
  nome: string;
  endereco: string;
  horario: string | null;
  contato: string | null;
  bairro: Bairro;
  materiais: Categoria[];
}

export type StatusDoPonto = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

export interface NovaSugestao {
  nome: string;
  endereco: string;
  idBairro: number;
  horario: string | null;
  contato: string | null;
  categorias: number[];
}

export interface PontoCriado extends PontoDetalhe {
  status: StatusDoPonto;
}

export interface Sugestao extends PontoResumo {
  status: StatusDoPonto;
}

export interface PaginaDeSugestoes {
  itens: Sugestao[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface PaginaDePontos {
  itens: PontoResumo[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface ContagemDePontos {
  total: number;
  categorias: { idCategoria: number; quantidade: number }[];
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface ResumoDoPainel {
  pendentes: number;
  pontos: number;
  categorias: number;
}

export interface PontoDoPainel extends PontoResumo {
  horario: string | null;
  contato: string | null;
  status: StatusDoPonto;
  sugeridoPor: { idUsuario: number; nome: string };
}

export type PaginaDoPainel = Pagina<PontoDoPainel>;

export interface CategoriaDoPainel extends Categoria {
  pontos: number;
}

export type PaginaDeCategorias = Pagina<CategoriaDoPainel>;

export interface NovaCategoria {
  nome: string;
  descricao: string | null;
}
