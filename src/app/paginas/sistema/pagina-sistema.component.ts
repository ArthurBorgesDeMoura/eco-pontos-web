import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiService } from '../../api/api.service';
import { ErroApi, traduzirErro } from '../../api/erro-api';
import { Bairro, Categoria } from '../../api/modelos';
import { NOMES_ICONES } from '../../compartilhado/icone/nomes-icones';

interface TokenDescrito {
  token: string;
  rotulo: string;
}

interface GrupoDeCores {
  titulo: string;
  cores: readonly TokenDescrito[];
}

type Etapa = 'fechado' | 'aberto' | 'saindo';
type EstadoApi = 'carregando' | 'pronto' | 'erro';

export const GRUPOS_DE_CORES: readonly GrupoDeCores[] = [
  {
    titulo: 'Fundo',
    cores: [
      { token: 'fundo-base', rotulo: 'fundo/base' },
      { token: 'fundo-superficie', rotulo: 'fundo/superfície' },
      { token: 'fundo-rebaixado', rotulo: 'fundo/rebaixado' },
      { token: 'fundo-ativo', rotulo: 'fundo/ativo' },
    ],
  },
  {
    titulo: 'Borda',
    cores: [
      { token: 'borda-cartao', rotulo: 'borda/cartão' },
      { token: 'borda-linha', rotulo: 'borda/linha' },
      { token: 'borda-controle', rotulo: 'borda/controle' },
    ],
  },
  {
    titulo: 'Texto',
    cores: [
      { token: 'texto-principal', rotulo: 'texto/principal' },
      { token: 'texto-secundario', rotulo: 'texto/secundário' },
      { token: 'texto-terciario', rotulo: 'texto/terciário' },
      { token: 'texto-inverso', rotulo: 'texto/inverso' },
    ],
  },
  {
    titulo: 'Ação',
    cores: [
      { token: 'acao-primaria', rotulo: 'ação/primária' },
      { token: 'acao-primaria-hover', rotulo: 'ação/primária-hover' },
      { token: 'acao-primaria-pressionada', rotulo: 'ação/primária-pressionada' },
    ],
  },
  {
    titulo: 'Marca e status',
    cores: [
      { token: 'marca-verde', rotulo: 'marca/verde' },
      { token: 'marca-verde-fundo', rotulo: 'marca/verde-fundo' },
      { token: 'marca-verde-texto', rotulo: 'marca/verde-texto' },
      { token: 'status-pendente-fundo', rotulo: 'status/pendente-fundo' },
      { token: 'status-pendente-texto', rotulo: 'status/pendente-texto' },
      { token: 'status-pendente-borda', rotulo: 'status/pendente-borda' },
      { token: 'status-recusado-fundo', rotulo: 'status/recusado-fundo' },
      { token: 'status-recusado-texto', rotulo: 'status/recusado-texto' },
      { token: 'status-perigo', rotulo: 'status/perigo' },
    ],
  },
  {
    titulo: 'Derivados, fora do Figma',
    cores: [
      { token: 'foco', rotulo: 'Contorno de foco' },
      { token: 'sobreposicao', rotulo: 'Fundo atrás do diálogo' },
    ],
  },
];

export const ESTILOS_TEXTO: readonly TokenDescrito[] = [
  { token: 'numero-28', rotulo: 'Número/28' },
  { token: 'titulo-24', rotulo: 'Título/24' },
  { token: 'titulo-22-celular', rotulo: 'Título/22 celular' },
  { token: 'marca-18', rotulo: 'Marca/18' },
  { token: 'secao-16', rotulo: 'Seção/16' },
  { token: 'corpo-14', rotulo: 'Corpo/14' },
  { token: 'corpo-14-forte', rotulo: 'Corpo/14 forte' },
  { token: 'corpo-14-medio', rotulo: 'Corpo/14 médio' },
  { token: 'apoio-13', rotulo: 'Apoio/13' },
  { token: 'apoio-13-forte', rotulo: 'Apoio/13 forte' },
  { token: 'apoio-13-medio', rotulo: 'Apoio/13 médio' },
  { token: 'meta-12', rotulo: 'Meta/12' },
  { token: 'meta-12-medio', rotulo: 'Meta/12 médio' },
  { token: 'rotulo-11', rotulo: 'Rótulo/11' },
];

export const ESPACOS: readonly number[] = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

export const RAIOS: readonly TokenDescrito[] = [
  { token: 'raio-tag', rotulo: 'raio/tag' },
  { token: 'raio-controle', rotulo: 'raio/controle' },
  { token: 'raio-cartao', rotulo: 'raio/cartão' },
];

export const ALTURAS: readonly TokenDescrito[] = [
  { token: 'controle-altura-m', rotulo: 'controle/altura-m' },
  { token: 'controle-altura-g', rotulo: 'controle/altura-g e alvo de toque' },
];

export const MOVIMENTOS: readonly TokenDescrito[] = [
  { token: 'duracao-hover', rotulo: 'Hover' },
  { token: 'escala-pressionar', rotulo: 'Escala ao pressionar' },
  { token: 'duracao-dialogo', rotulo: 'Diálogo' },
  { token: 'duracao-empurrar', rotulo: 'Empurrar tela no celular' },
  { token: 'duracao-esmaecer', rotulo: 'Esmaecer, com reduzir movimento' },
];

const LIMITE_DA_SAIDA_MS = 400;

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function formatarValor(valor: string | undefined): string {
  if (!valor) {
    return '—';
  }
  return valor.replace(/(\d)(px|ms|s)\b/g, '$1 $2').replace(/^(\d+)\.(\d+)$/, '$1,$2');
}

export function descreverEstiloDeTexto(valor: string | undefined): string {
  const partes = /^(\d{3})\s+([\d.]+)px\s*\/\s*([\d.]+)px/.exec(valor ?? '');
  return partes ? `${partes[2]} px / ${partes[3]} px · peso ${partes[1]}` : '—';
}

@Component({
  selector: 'eco-pagina-sistema',
  templateUrl: './pagina-sistema.component.html',
  styleUrls: ['./pagina-sistema.component.scss'],
})
export class PaginaSistemaComponent implements OnInit, OnDestroy {
  readonly gruposDeCores = GRUPOS_DE_CORES;
  readonly estilosTexto = ESTILOS_TEXTO;
  readonly espacos = ESPACOS;
  readonly raios = RAIOS;
  readonly alturas = ALTURAS;
  readonly movimentos = MOVIMENTOS;
  readonly icones = NOMES_ICONES;
  readonly modoSimulado = environment.usarSimulacao;
  readonly enderecoApi = environment.enderecoApi;
  readonly formatar = formatarValor;
  readonly descreverEstilo = descreverEstiloDeTexto;

  valores: Record<string, string> = {};
  layout = { janela: 0, margem: 0, coluna: 0 };
  reduzirMovimento = false;

  dialogo: Etapa = 'fechado';
  detalhes: Etapa = 'fechado';

  estadoApi: EstadoApi = 'carregando';
  bairros: Bairro[] = [];
  categorias: Categoria[] = [];
  erroApi: ErroApi | null = null;

  @ViewChild('conteudo', { static: true }) private conteudo!: ElementRef<HTMLElement>;
  @ViewChild('botaoDialogo', { static: true }) private botaoDialogo!: ElementRef<HTMLButtonElement>;
  @ViewChild('botaoDetalhes', { static: true }) private botaoDetalhes!: ElementRef<HTMLButtonElement>;
  @ViewChild('janelaDialogo') private janelaDialogo?: ElementRef<HTMLElement>;
  @ViewChild('botaoVoltar') private botaoVoltar?: ElementRef<HTMLButtonElement>;

  private consultaMovimento?: MediaQueryList;
  private observadorDeTamanho?: ResizeObserver;
  private chamadaApi?: Subscription;
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();
  private readonly aoMudarMovimento = (evento: MediaQueryListEvent): void => {
    this.reduzirMovimento = evento.matches;
  };

  constructor(
    private readonly api: ApiService,
    private readonly mudancas: ChangeDetectorRef,
    private readonly zona: NgZone,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  ngOnInit(): void {
    this.lerTokens();
    this.medirLayout();
    this.observadorDeTamanho = new ResizeObserver(() => this.zona.run(() => this.medirLayout()));
    this.observadorDeTamanho.observe(this.conteudo.nativeElement);

    this.consultaMovimento = this.documento.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduzirMovimento = this.consultaMovimento?.matches ?? false;
    this.consultaMovimento?.addEventListener('change', this.aoMudarMovimento);

    this.carregarDadosDaApi();
  }

  ngOnDestroy(): void {
    this.chamadaApi?.unsubscribe();
    this.observadorDeTamanho?.disconnect();
    this.consultaMovimento?.removeEventListener('change', this.aoMudarMovimento);
    this.temporizadores.forEach((temporizador) => clearTimeout(temporizador));
  }

  @HostListener('window:resize')
  medirLayout(): void {
    const caixa = this.conteudo.nativeElement.getBoundingClientRect();
    this.layout = {
      janela: this.documento.documentElement.clientWidth,
      margem: Math.round(caixa.left),
      coluna: Math.round(caixa.width),
    };
  }

  carregarDadosDaApi(): void {
    this.chamadaApi?.unsubscribe();
    this.estadoApi = 'carregando';
    this.erroApi = null;
    this.chamadaApi = forkJoin({
      bairros: this.api.get<Bairro[]>('bairros'),
      categorias: this.api.get<Categoria[]>('categorias'),
    }).subscribe({
      next: ({ bairros, categorias }) => {
        this.bairros = bairros;
        this.categorias = categorias;
        this.estadoApi = 'pronto';
      },
      error: (erro: unknown) => {
        this.erroApi = traduzirErro(erro);
        this.estadoApi = 'erro';
      },
    });
  }

  abrirDialogo(): void {
    this.dialogo = 'aberto';
    this.mudancas.detectChanges();
    this.focaveisDoDialogo()[0]?.focus();
  }

  fecharDialogo(): void {
    if (this.dialogo !== 'aberto') {
      return;
    }
    this.dialogo = 'saindo';
    this.agendar(() => this.concluirFechamentoDoDialogo());
  }

  aoTerminarAnimacaoDoDialogo(evento: AnimationEvent): void {
    if (evento.target === evento.currentTarget) {
      this.concluirFechamentoDoDialogo();
    }
  }

  teclaNoDialogo(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.fecharDialogo();
      return;
    }
    if (evento.key !== 'Tab') {
      return;
    }
    const focaveis = this.focaveisDoDialogo();
    const atual = focaveis.indexOf(this.documento.activeElement as HTMLElement);
    const proximo = (atual + (evento.shiftKey ? -1 : 1) + focaveis.length) % focaveis.length;
    evento.preventDefault();
    focaveis[proximo]?.focus();
  }

  abrirDetalhes(): void {
    this.detalhes = 'aberto';
    this.mudancas.detectChanges();
    this.botaoVoltar?.nativeElement.focus();
  }

  voltar(): void {
    if (this.detalhes !== 'aberto') {
      return;
    }
    this.detalhes = 'saindo';
    this.agendar(() => this.concluirVolta());
  }

  aoTerminarAnimacaoDosDetalhes(evento: AnimationEvent): void {
    if (evento.target === evento.currentTarget) {
      this.concluirVolta();
    }
  }

  private concluirFechamentoDoDialogo(): void {
    if (this.dialogo !== 'saindo') {
      return;
    }
    this.dialogo = 'fechado';
    this.mudancas.detectChanges();
    this.botaoDialogo.nativeElement.focus();
  }

  private concluirVolta(): void {
    if (this.detalhes !== 'saindo') {
      return;
    }
    this.detalhes = 'fechado';
    this.mudancas.detectChanges();
    this.botaoDetalhes.nativeElement.focus();
  }

  private focaveisDoDialogo(): HTMLElement[] {
    return Array.from(this.janelaDialogo?.nativeElement.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
  }

  private agendar(acao: () => void): void {
    const temporizador = setTimeout(() => {
      this.temporizadores.delete(temporizador);
      acao();
    }, LIMITE_DA_SAIDA_MS);
    this.temporizadores.add(temporizador);
  }

  private lerTokens(): void {
    const estilo = getComputedStyle(this.documento.documentElement);
    const nomes = [
      ...this.gruposDeCores.flatMap((grupo) => grupo.cores.map((cor) => `cor-${cor.token}`)),
      ...this.estilosTexto.map((estiloDeTexto) => `texto-${estiloDeTexto.token}`),
      ...this.espacos.map((espaco) => `espaco-${espaco}`),
      ...this.raios.map((raio) => raio.token),
      ...this.alturas.map((altura) => altura.token),
      ...this.movimentos.map((movimento) => movimento.token),
      'coluna-conteudo',
      'margem-celular',
      'margem-tablet',
    ];
    for (const nome of nomes) {
      this.valores[nome] = estilo.getPropertyValue(`--${nome}`).trim();
    }
  }
}
