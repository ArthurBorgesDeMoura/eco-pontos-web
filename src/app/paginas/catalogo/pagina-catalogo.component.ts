import { Component } from '@angular/core';

import { BAIRROS } from '../../api/simulacao/respostas/bairros';
import { CATEGORIAS } from '../../api/simulacao/respostas/categorias';
import { Aba } from '../../compartilhado/abas/abas.component';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { EstadoForcado, TamanhoBotao, TipoBotao } from '../../compartilhado/botao/botao.component';
import { DialogoService } from '../../compartilhado/dialogo/dialogo.service';
import { StatusDoPonto } from '../../compartilhado/etiqueta-status/etiqueta-status.component';
import { PaginaDaBarra, PerfilDaBarra } from '../../compartilhado/navegacao/navegacao';
import { OpcaoDoSeletor } from '../../compartilhado/seletor/seletor.component';

interface VarianteDeBotao {
  nome: string;
  tipo: TipoBotao;
  tamanho: TamanhoBotao;
  estado: EstadoForcado;
}

interface PontoDeExemplo {
  idPonto: number;
  nome: string;
  bairro: string;
  endereco: string;
  materiais: string[];
}

interface VarianteDeBarra {
  nome: string;
  perfil: PerfilDaBarra;
  pagina: PaginaDaBarra | null;
}

const TIPOS: ReadonlyArray<[TipoBotao, string]> = [
  ['primario', 'Primário'],
  ['secundario', 'Secundário'],
  ['texto', 'Texto'],
];
const TAMANHOS: ReadonlyArray<[TamanhoBotao, string]> = [
  ['p', 'P'],
  ['m', 'M'],
  ['g', 'G'],
];
const ESTADOS: ReadonlyArray<[EstadoForcado, string]> = [
  [null, 'Padrão'],
  ['hover', 'Hover'],
  ['pressionado', 'Pressionado'],
];

const NOME_DO_PERFIL: Readonly<Record<PerfilDaBarra, string>> = {
  acesso: 'Acesso',
  visitante: 'Visitante',
  usuario: 'Usuário',
  administrador: 'Administrador',
};

const NOME_NA_BARRA: Readonly<Record<PerfilDaBarra, string>> = {
  acesso: '',
  visitante: '',
  usuario: 'Maria Souza',
  administrador: 'Administrador EcoPonto',
};

const PONTOS_DA_D14: readonly PontoDeExemplo[] = [
  {
    idPonto: 1,
    nome: 'Drogaria São Paulo - DSP Uberlândia III',
    bairro: 'Altamira',
    endereco: 'Av. Nicomedes Alves dos Santos, 2100',
    materiais: ['Pilhas e baterias', 'Medicamentos vencidos'],
  },
  {
    idPonto: 2,
    nome: 'Pão de Açúcar',
    bairro: 'Altamira',
    endereco: 'Av. Nicomedes Alves dos Santos, 2222',
    materiais: ['Óleo de cozinha usado'],
  },
  {
    idPonto: 3,
    nome: 'Drogasil - Uberlândia 14',
    bairro: 'Brasil',
    endereco: 'Av. Brasil, 2456',
    materiais: ['Pilhas e baterias', 'Medicamentos vencidos'],
  },
  { idPonto: 4, nome: 'Bretas - Loja 518', bairro: 'Centro', endereco: 'Av. João Pinheiro, 77', materiais: ['Lâmpadas'] },
  {
    idPonto: 5,
    nome: 'Casas Bahia',
    bairro: 'Centro',
    endereco: 'Av. Afonso Pena, 526',
    materiais: ['Eletrônicos', 'Pilhas e baterias'],
  },
  {
    idPonto: 6,
    nome: 'Drogasil - Uberlândia 11',
    bairro: 'Fundinho',
    endereco: 'Praça Clarimundo Carneiro, 209',
    materiais: ['Pilhas e baterias', 'Medicamentos vencidos'],
  },
  {
    idPonto: 7,
    nome: 'Ecoponto Luizote de Freitas',
    bairro: 'Luizote de Freitas',
    endereco: 'Rua Wilson Gonçalves de Souza, 10',
    materiais: ['Papel e papelão', 'Plástico', 'Metal', 'Vidro', 'Entulho e volumosos'],
  },
];

const CONTAGENS = [3, 3, 3, 3, 2, 6, 3, 2, 3, 1];

@Component({
  selector: 'eco-pagina-catalogo',
  templateUrl: './pagina-catalogo.component.html',
  styleUrls: ['./pagina-catalogo.component.scss'],
})
export class PaginaCatalogoComponent {
  readonly botoes: readonly VarianteDeBotao[][] = TIPOS.map(([tipo, nomeDoTipo]) =>
    TAMANHOS.flatMap(([tamanho, nomeDoTamanho]) =>
      ESTADOS.map(([estado, nomeDoEstado]) => ({
        nome: `Tipo=${nomeDoTipo}, Estado=${nomeDoEstado}, Tamanho=${nomeDoTamanho}`,
        tipo,
        tamanho,
        estado,
      })),
    ),
  );

  readonly botoesForaDoFigma: readonly VarianteDeBotao[] = [
    ...ESTADOS.map(([estado, nomeDoEstado]) => ({
      nome: `Tipo=Exclusão, Estado=${nomeDoEstado}, Tamanho=M`,
      tipo: 'exclusao' as const,
      tamanho: 'm' as const,
      estado,
    })),
    ...TIPOS.map(([tipo, nomeDoTipo]) => ({
      nome: `Tipo=${nomeDoTipo}, Estado=Foco, Tamanho=M`,
      tipo,
      tamanho: 'm' as const,
      estado: 'foco' as const,
    })),
  ];

  readonly tiposParaDesabilitar: ReadonlyArray<[TipoBotao, string]> = [...TIPOS, ['exclusao', 'Exclusão']];

  readonly status: ReadonlyArray<[StatusDoPonto, string]> = [
    ['PENDENTE', 'Pendente'],
    ['APROVADO', 'Aprovado'],
    ['RECUSADO', 'Recusado'],
  ];

  readonly opcoesSemTodos: readonly OpcaoDoSeletor[] = BAIRROS.map((bairro) => ({
    valor: bairro.idBairro,
    rotulo: bairro.nome,
  }));
  readonly opcoesDeBairro: readonly OpcaoDoSeletor[] = [
    { valor: null, rotulo: 'Todos os bairros' },
    ...this.opcoesSemTodos,
  ];
  bairro: number | null = null;
  nomeDoPonto = '';

  readonly materiais = CATEGORIAS.map((categoria, indice) => ({
    idCategoria: categoria.idCategoria,
    nome: categoria.nome,
    contagem: CONTAGENS[indice] ?? 0,
  }));
  material: number | null = null;
  readonly chipsLigados = new Set<number>([2]);

  readonly abasDoPainel: readonly Aba[] = [
    { valor: 'pendentes', rotulo: 'Pendentes' },
    { valor: 'pontos', rotulo: 'Pontos' },
    { valor: 'categorias', rotulo: 'Categorias' },
  ];
  abaDoPainel = 'pontos';

  readonly pontos = PONTOS_DA_D14;
  readonly pontosDaLista = PONTOS_DA_D14.slice(0, 3);
  totalDePontos = 13;

  readonly barrasSuperiores: readonly VarianteDeBarra[] = [
    { nome: 'Perfil=Acesso, Página=Nenhuma', perfil: 'acesso', pagina: null },
    { nome: 'Perfil=Visitante, Página=Pontos', perfil: 'visitante', pagina: 'pontos' },
    { nome: 'Perfil=Usuário, Página=Pontos', perfil: 'usuario', pagina: 'pontos' },
    { nome: 'Perfil=Usuário, Página=Sugerir', perfil: 'usuario', pagina: 'sugerir' },
    { nome: 'Perfil=Usuário, Página=Minhas', perfil: 'usuario', pagina: 'minhas' },
    { nome: 'Perfil=Administrador, Página=Pontos', perfil: 'administrador', pagina: 'pontos' },
    { nome: 'Perfil=Administrador, Página=Painel', perfil: 'administrador', pagina: 'painel' },
  ];

  readonly barrasInferiores: readonly VarianteDeBarra[] = [
    { nome: 'Perfil=Usuário, Ativa=Pontos', perfil: 'usuario', pagina: 'pontos' },
    { nome: 'Perfil=Usuário, Ativa=Sugerir', perfil: 'usuario', pagina: 'sugerir' },
    { nome: 'Perfil=Usuário, Ativa=Minhas', perfil: 'usuario', pagina: 'minhas' },
    { nome: 'Perfil=Administrador, Ativa=Pontos', perfil: 'administrador', pagina: 'pontos' },
    { nome: 'Perfil=Administrador, Ativa=Painel', perfil: 'administrador', pagina: 'painel' },
  ];

  readonly perfis: readonly PerfilDaBarra[] = ['acesso', 'visitante', 'usuario', 'administrador'];
  readonly abasDePerfil: readonly Aba[] = this.perfis.map((perfil) => ({ valor: perfil, rotulo: NOME_DO_PERFIL[perfil] }));
  perfilAoVivo: PerfilDaBarra = 'usuario';

  constructor(
    private readonly avisos: AvisoService,
    private readonly dialogos: DialogoService,
  ) {}

  nomeNaBarra(perfil: PerfilDaBarra): string {
    return NOME_NA_BARRA[perfil];
  }

  trocarPerfil(valor: string): void {
    const perfil = this.perfis.find((item) => item === valor);
    if (perfil) {
      this.perfilAoVivo = perfil;
    }
  }

  sair(): void {
    this.avisos.mostrar('"Sair" encerra a sessão a partir do FE-04.');
  }

  abrirConta(): void {
    this.avisos.mostrar('O menu da conta chega no FE-04.');
  }

  alternarChip(idCategoria: number, ligado: boolean): void {
    if (ligado) {
      this.chipsLigados.add(idCategoria);
    } else {
      this.chipsLigados.delete(idCategoria);
    }
  }

  mostrarAviso(): void {
    this.avisos.mostrar('Sugestão enviada. Ela fica pendente até a análise.');
  }

  async excluir(ponto: PontoDeExemplo): Promise<void> {
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Excluir este ponto?',
      texto: `${ponto.nome} sai da busca e não pode ser recuperado.`,
      confirmar: 'Excluir ponto',
      tipo: 'exclusao',
    });
    if (confirmado) {
      this.avisos.mostrar(`${ponto.nome} excluído.`);
    }
  }

  editar(ponto: PontoDeExemplo): void {
    this.avisos.mostrar(`No painel, "Editar" abre a edição de ${ponto.nome}.`);
  }

  mostrarMais(): void {
    this.avisos.mostrar('As outras páginas chegam pela API (BE-07).');
  }

  porId(_indice: number, ponto: PontoDeExemplo): number {
    return ponto.idPonto;
  }
}
