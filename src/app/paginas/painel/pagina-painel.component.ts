import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  of,
  skip,
  startWith,
  switchMap,
} from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { PaginaDoPainel, PontoDoPainel, ResumoDoPainel } from '../../api/modelos';
import { Decisao, MAIOR_PAGINA_DO_PAINEL, PainelService } from '../../api/painel.service';
import { PONTOS_POR_PAGINA } from '../../api/pontos.service';
import { Aba } from '../../compartilhado/abas/abas.component';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { ROTA_DA_NOVA_CATEGORIA } from '../../rotas';
import {
  DURACAO_DA_SAIDA_DA_LINHA_MS,
  bairroDoPonto,
  estaVisivel,
  focoPerdido,
  localDoPonto,
  materiaisDoPonto,
  semO,
} from './apoio';

import { MudancasDoPainelService } from './mudancas-do-painel.service';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

export { DURACAO_DA_SAIDA_DA_LINHA_MS } from './apoio';

export type AbaDoPainel = 'pendentes' | 'pontos' | 'categorias';

interface DefinicaoDaAba extends Aba {
  readonly valor: AbaDoPainel;
  readonly contador: keyof ResumoDoPainel;
}

export const ABAS_DO_PAINEL: readonly DefinicaoDaAba[] = [
  { valor: 'pendentes', rotulo: 'Pendentes', contador: 'pendentes' },
  { valor: 'pontos', rotulo: 'Pontos', contador: 'pontos' },
  { valor: 'categorias', rotulo: 'Categorias', contador: 'categorias' },
];

export const MENSAGEM_DO_PAINEL = {
  aprovado: (nome: string) => `${nome} aprovado e publicado.`,
  recusado: (nome: string) => `${nome} recusado.`,
  jaAnalisada: 'Esta sugestão já foi analisada.',
  naoExiste: 'Esta sugestão não existe mais.',
  vazio: 'Nenhuma sugestão aguardando análise',
  carregando: 'Carregando as sugestões…',
} as const;

const CONSULTA_DO_DESKTOP = '(min-width: 1024px)';

const NAO_INFORMADO = 'não informado';

type Resultado = { pagina: PaginaDoPainel; erro: null } | { pagina: null; erro: string };

@Component({
  selector: 'eco-pagina-painel',
  templateUrl: './pagina-painel.component.html',
  styleUrls: ['./painel-lista.scss', './pagina-painel.component.scss'],
})
export class PaginaPainelComponent implements OnInit, OnDestroy {
  readonly mensagem = MENSAGEM_DO_PAINEL;
  readonly materiais = materiaisDoPonto;
  readonly bairro = bairroDoPonto;
  readonly local = localDoPonto;
  readonly rotaDaNovaCategoria = ROTA_DA_NOVA_CATEGORIA;
  tamanhoDoNovo: 'm' | 'g' = 'g';

  abas: readonly Aba[] = ABAS_DO_PAINEL;
  aba: AbaDoPainel = 'pendentes';
  itens: PontoDoPainel[] = [];
  total: number | null = null;
  carregando = true;
  carregandoMais = false;
  erro: string | null = null;
  erroDoMais: string | null = null;
  tentando = false;
  decidindo: ReadonlySet<number> = new Set<number>();
  saindo: readonly PontoDoPainel[] = [];
  anuncio = '';
  alerta = '';

  private resumoAtual: ResumoDoPainel | null = null;
  private focarAoReceber = false;
  private relogioDoAnuncio?: ReturnType<typeof setTimeout>;
  private readonly relogiosDeSaida = new Set<ReturnType<typeof setTimeout>>();
  private readonly carregar$ = new Subject<{ tentativa: boolean }>();
  private readonly atualizarResumo$ = new Subject<void>();
  private readonly inscricoes = new Subscription();
  private maisInscricao?: Subscription;
  private consultaDoDesktop?: MediaQueryList;
  private readonly aoMudarDeTamanho = (): void => this.medirTamanho();

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly painel: PainelService,
    private readonly aviso: AvisoService,
    private readonly mudancasDoPainel: MudancasDoPainelService,
    private readonly historico: HistoricoService,
    private readonly retornos: RetornoDaEdicaoService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  get resumo(): string {
    const total = this.total ?? 0;
    return `${total} ${total === 1 ? 'sugestão' : 'sugestões'} aguardando análise`;
  }

  get haMais(): boolean {
    return this.total !== null && this.itens.length - this.saindo.length < this.total;
  }

  ngOnInit(): void {
    this.consultaDoDesktop = this.documento.defaultView?.matchMedia(CONSULTA_DO_DESKTOP);
    this.consultaDoDesktop?.addEventListener('change', this.aoMudarDeTamanho);
    this.medirTamanho();
    const daUrl$ = this.rota.queryParamMap.pipe(
      map((parametros) => abaDaUrl(parametros.get('aba'))),
      distinctUntilChanged(),
    );
    this.inscricoes.add(
      merge(
        daUrl$.pipe(map((aba) => ({ aba, tentativa: false }))),
        this.carregar$.pipe(map(({ tentativa }) => ({ aba: this.aba, tentativa }))),
      )
        .pipe(
          switchMap(({ aba, tentativa }) => {
            this.maisInscricao?.unsubscribe();
            this.carregandoMais = false;
            this.erroDoMais = null;
            this.aba = aba;
            if (aba !== 'pendentes') {
              this.carregando = false;
              this.erro = null;
              return of(null);
            }
            if (tentativa) {
              this.tentando = true;
            } else {
              this.carregando = true;
              this.erro = null;
            }
            this.anunciar(MENSAGEM_DO_PAINEL.carregando);
            return this.buscar(1).pipe(map((resultado) => ({ resultado, tentativa })));
          }),
        )
        .subscribe((resposta) => {
          if (resposta) {
            this.receber(resposta.resultado, resposta.tentativa);
          }
        }),
    );
    this.inscricoes.add(
      this.atualizarResumo$
        .pipe(
          startWith(undefined),
          switchMap(() => this.painel.resumo().pipe(catchError(() => of(null)))),
        )
        .subscribe((resumo) => {
          if (!resumo) {
            return;
          }
          this.mostrarContadores(resumo);
          if (this.aba === 'pendentes' && !this.carregando && !this.erro) {
            this.total = resumo.pendentes;
            if (this.itens.length === 0 && resumo.pendentes > 0) {
              this.carregar$.next({ tentativa: false });
            }
          }
        }),
    );
    this.inscricoes.add(daUrl$.pipe(skip(1)).subscribe(() => this.atualizarResumo$.next()));
    this.inscricoes.add(this.mudancasDoPainel.pontoExcluido.subscribe(() => this.aoExcluirPonto()));
  }

  ngOnDestroy(): void {
    this.consultaDoDesktop?.removeEventListener('change', this.aoMudarDeTamanho);
    this.inscricoes.unsubscribe();
    this.maisInscricao?.unsubscribe();
    clearTimeout(this.relogioDoAnuncio);
    this.relogiosDeSaida.forEach((relogio) => clearTimeout(relogio));
  }

  escolherAba(valor: string): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { aba: valor === 'pendentes' ? null : valor },
      queryParamsHandling: 'merge',
    });
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.carregar$.next({ tentativa: true });
    }
  }

  decidir(ponto: PontoDoPainel, decisao: Decisao): void {
    if (this.decidindo.has(ponto.idPonto)) {
      return;
    }
    this.decidindo = new Set(this.decidindo).add(ponto.idPonto);
    this.inscricoes.add(
      this.painel.decidir(ponto.idPonto, decisao).subscribe({
        next: () => {
          this.aviso.mostrar(
            decisao === 'aprovar' ? MENSAGEM_DO_PAINEL.aprovado(ponto.nome) : MENSAGEM_DO_PAINEL.recusado(ponto.nome),
          );
          this.ajustarContadores({ pendentes: -1, pontos: decisao === 'aprovar' ? 1 : 0 });
          this.tirarLinha(ponto);
        },
        error: (erro: unknown) => {
          const traduzido = traduzirErro(erro);
          if (traduzido.status === 409 || traduzido.status === 404) {
            this.aviso.mostrar(traduzido.status === 409 ? MENSAGEM_DO_PAINEL.jaAnalisada : MENSAGEM_DO_PAINEL.naoExiste);
            this.ajustarContadores({ pendentes: -1 });
            this.tirarLinha(ponto);
            return;
          }
          this.decidindo = semO(this.decidindo, ponto.idPonto);
          if (traduzido.status !== 401) {
            this.aviso.mostrar(traduzido.mensagem);
          }
          this.mudancas.markForCheck();
        },
      }),
    );
  }

  get maisIndisponivel(): boolean {
    return this.carregandoMais || this.decidindo.size > 0;
  }

  mostrarMais(): void {
    if (this.maisIndisponivel || !this.haMais) {
      return;
    }
    const tamanho = this.itens.length + PONTOS_POR_PAGINA;
    const desdeOComeco = tamanho <= MAIOR_PAGINA_DO_PAINEL;
    const pedido = desdeOComeco
      ? this.buscar(1, tamanho)
      : this.buscar(Math.floor(this.itens.length / PONTOS_POR_PAGINA) + 1);
    this.carregandoMais = true;
    this.erroDoMais = null;
    this.maisInscricao = pedido.subscribe((resultado) => {
      this.carregandoMais = false;
      if (!resultado.pagina) {
        this.erroDoMais = resultado.erro;
        this.anunciar(resultado.erro, 'alerta');
        return;
      }
      const vistos = new Set(this.itens.map((item) => item.idPonto));
      this.total = resultado.pagina.total;
      this.itens = desdeOComeco
        ? resultado.pagina.itens
        : [...this.itens, ...resultado.pagina.itens.filter((item) => !vistos.has(item.idPonto))];
      this.focarResumoDosCartoes();
    });
  }

  lembrarNovaCategoria(): void {
    this.retornos.guardar(this.historico.posicao, { aba: 'categorias', carregados: 0, id: null });
  }

  aoExcluirPonto(): void {
    this.ajustarContadores({ pontos: -1 });
    this.atualizarResumo$.next();
  }

  dados(ponto: PontoDoPainel): string {
    const horario = ponto.horario?.trim() || NAO_INFORMADO;
    const contato = ponto.contato?.trim() || NAO_INFORMADO;
    return `Horário: ${horario} · Contato: ${contato}`;
  }

  autor(ponto: PontoDoPainel): string {
    return ponto.sugeridoPor?.nome?.trim() || 'Não informado';
  }

  porId(_indice: number, item: unknown): number {
    return (item as PontoDoPainel).idPonto;
  }

  private tirarLinha(ponto: PontoDoPainel): void {
    if (this.itens.some((item) => item.idPonto === ponto.idPonto)) {
      this.saindo = [...this.saindo, ponto];
      if (this.total !== null) {
        this.total = Math.max(0, this.total - 1);
      }
    }
    this.atualizarResumo$.next();
    this.mudancas.markForCheck();

    const relogio = setTimeout(() => {
      this.relogiosDeSaida.delete(relogio);
      const ativo = this.elemento.nativeElement.ownerDocument.activeElement;
      const focoNaLinha = ativo?.getAttribute('data-ponto') === String(ponto.idPonto);
      const decisaoFocada = ativo?.getAttribute('data-decisao');
      const indice = this.itens.findIndex((item) => item.idPonto === ponto.idPonto);
      const levarOFoco = indice >= 0 && (focoNaLinha || focoPerdido(this.elemento.nativeElement.ownerDocument));

      this.itens = this.itens.filter((item) => item.idPonto !== ponto.idPonto);
      this.saindo = this.saindo.filter((item) => item.idPonto !== ponto.idPonto);
      this.decidindo = semO(this.decidindo, ponto.idPonto);
      if (indice >= 0 && this.itens.length === 0 && (this.total ?? 0) > 0) {
        this.focarAoReceber = levarOFoco;
        this.carregar$.next({ tentativa: false });
        this.mudancas.detectChanges();
        return;
      }
      this.mudancas.detectChanges();
      if (levarOFoco) {
        this.focarDepoisDaSaida(indice, decisaoFocada ?? 'aprovar');
      }
    }, DURACAO_DA_SAIDA_DA_LINHA_MS);
    this.relogiosDeSaida.add(relogio);
  }

  private medirTamanho(): void {
    this.tamanhoDoNovo = this.consultaDoDesktop?.matches ? 'm' : 'g';
  }

  private mostrarContadores(resumo: ResumoDoPainel): void {
    this.resumoAtual = resumo;
    this.abas = ABAS_DO_PAINEL.map((aba) => ({ ...aba, contagem: resumo[aba.contador] }));
  }

  private ajustarContadores(diferenca: Partial<ResumoDoPainel>): void {
    const atual = this.resumoAtual;
    if (atual) {
      this.mostrarContadores({
        pendentes: Math.max(0, atual.pendentes + (diferenca.pendentes ?? 0)),
        pontos: Math.max(0, atual.pontos + (diferenca.pontos ?? 0)),
        categorias: Math.max(0, atual.categorias + (diferenca.categorias ?? 0)),
      });
    }
  }

  private focarDepoisDaSaida(indice: number, decisao: string): void {
    const raiz = this.elemento.nativeElement;
    const seguinte = indice >= 0 ? this.itens[indice] : undefined;
    const alvos = seguinte
      ? raiz.querySelectorAll<HTMLElement>(`[data-ponto="${seguinte.idPonto}"][data-decisao="${decisao}"]`)
      : this.itens.length > 0
        ? raiz.querySelectorAll<HTMLElement>('.tabela__resumo, .painel__resumo')
        : raiz.querySelectorAll<HTMLElement>('.painel__estado-mensagem');
    Array.from(alvos).find(estaVisivel)?.focus();
  }

  private anunciar(texto: string, onde: 'anuncio' | 'alerta' = 'anuncio'): void {
    clearTimeout(this.relogioDoAnuncio);
    this.anuncio = '';
    this.alerta = '';
    this.relogioDoAnuncio = setTimeout(() => {
      this[onde] = texto;
      this.mudancas.markForCheck();
    });
  }

  private focarResumoDosCartoes(): void {
    this.mudancas.detectChanges();
    const raiz = this.elemento.nativeElement;
    const cartoes = raiz.querySelector<HTMLElement>('.painel__compacto');
    if (cartoes && estaVisivel(cartoes) && !this.haMais && focoPerdido(raiz.ownerDocument)) {
      raiz.querySelector<HTMLElement>('.painel__resumo')?.focus();
    }
  }

  private buscar(pagina: number, tamanho = PONTOS_POR_PAGINA): Observable<Resultado> {
    return this.painel.pontos('PENDENTE', pagina, tamanho).pipe(
      map((resposta): Resultado => ({ pagina: resposta, erro: null })),
      catchError((erro: unknown) => of<Resultado>({ pagina: null, erro: traduzirErro(erro).mensagem })),
    );
  }

  private receber(resultado: Resultado, tentativa: boolean): void {
    this.carregando = false;
    this.tentando = false;
    if (!resultado.pagina) {
      this.erro = resultado.erro;
      this.itens = [];
      this.total = null;
      this.anunciar(resultado.erro, 'alerta');
      return;
    }
    this.erro = null;
    this.total = resultado.pagina.total;
    this.itens = resultado.pagina.itens;
    this.saindo = [];
    this.anunciar(this.total === 0 ? MENSAGEM_DO_PAINEL.vazio : this.resumo);
    const focar = tentativa || this.focarAoReceber;
    this.focarAoReceber = false;
    if (focar) {
      this.mudancas.detectChanges();
      this.elemento.nativeElement.querySelector<HTMLElement>('[role="tabpanel"]')?.focus();
    }
  }
}

function abaDaUrl(texto: string | null): AbaDoPainel {
  return ABAS_DO_PAINEL.find((aba) => aba.valor === texto)?.valor ?? 'pendentes';
}
