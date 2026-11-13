import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, Subscription, catchError, map, of, startWith, switchMap } from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { CategoriaDoPainel, PaginaDeCategorias } from '../../api/modelos';
import { MAIOR_PAGINA_DO_PAINEL, PainelService } from '../../api/painel.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { rotaDaCategoria } from '../../rotas';
import { estaVisivel, focoPerdido } from './apoio';
import { categoriasAte } from './categorias-ate';
import { RetornoDaEdicao, RetornoDaEdicaoService } from './retorno-da-edicao.service';

export const MENSAGEM_DAS_CATEGORIAS = {
  carregando: 'Carregando as categorias…',
  vazio: 'Nenhuma categoria cadastrada',
  semDescricao: 'Sem descrição',
  resumo: (total: number) => `${total} ${total === 1 ? 'categoria' : 'categorias'}`,
  pontos: (quantidade: number) => `${quantidade} ${quantidade === 1 ? 'ponto' : 'pontos'}`,
} as const;

type Resultado = { pagina: PaginaDeCategorias; erro: null } | { pagina: null; erro: string };

@Component({
  selector: 'eco-painel-categorias',
  templateUrl: './painel-categorias.component.html',
  styleUrls: ['./painel-lista.scss', './painel-categorias.component.scss'],
})
export class PainelCategoriasComponent implements OnInit, OnDestroy {
  readonly mensagem = MENSAGEM_DAS_CATEGORIAS;
  readonly rotaDaCategoria = rotaDaCategoria;

  itens: CategoriaDoPainel[] = [];
  total: number | null = null;
  carregando = true;
  carregandoMais = false;
  erro: string | null = null;
  erroDoMais: string | null = null;
  tentando = false;
  anuncio = '';
  alerta = '';

  private retorno: RetornoDaEdicao | null = null;
  private relogioDoAnuncio?: ReturnType<typeof setTimeout>;
  private readonly carregar$ = new Subject<{ tentativa: boolean }>();
  private readonly inscricoes = new Subscription();
  private maisInscricao?: Subscription;

  constructor(
    private readonly painel: PainelService,
    private readonly historico: HistoricoService,
    private readonly retornos: RetornoDaEdicaoService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  get resumo(): string {
    return MENSAGEM_DAS_CATEGORIAS.resumo(this.total ?? 0);
  }

  get haMais(): boolean {
    return this.total !== null && this.itens.length < this.total;
  }

  ngOnInit(): void {
    this.retorno = this.retornos.retomar(this.historico.posicao, 'categorias');
    this.inscricoes.add(
      this.carregar$
        .pipe(
          startWith({ tentativa: false }),
          switchMap(({ tentativa }) => {
            this.maisInscricao?.unsubscribe();
            this.carregandoMais = false;
            this.erroDoMais = null;
            if (tentativa) {
              this.tentando = true;
            } else {
              this.carregando = true;
              this.erro = null;
            }
            this.anunciar(MENSAGEM_DAS_CATEGORIAS.carregando);
            const pedido = categoriasAte(this.painel, this.retorno?.carregados ?? 0);
            return this.comoResultado(pedido).pipe(map((resultado) => ({ resultado, tentativa })));
          }),
        )
        .subscribe(({ resultado, tentativa }) => this.receber(resultado, tentativa)),
    );
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
    this.maisInscricao?.unsubscribe();
    clearTimeout(this.relogioDoAnuncio);
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.carregar$.next({ tentativa: true });
    }
  }

  mostrarMais(): void {
    if (this.carregandoMais || !this.haMais) {
      return;
    }
    const pagina = Math.floor(this.itens.length / MAIOR_PAGINA_DO_PAINEL) + 1;
    this.carregandoMais = true;
    this.erroDoMais = null;
    this.maisInscricao = this.buscar(pagina).subscribe((resultado) => {
      this.carregandoMais = false;
      if (!resultado.pagina) {
        this.erroDoMais = resultado.erro;
        this.anunciar(resultado.erro, 'alerta');
        return;
      }
      const vistas = new Set(this.itens.map((item) => item.idCategoria));
      this.total = resultado.pagina.total;
      this.itens = [...this.itens, ...resultado.pagina.itens.filter((item) => !vistas.has(item.idCategoria))];
      this.mudancas.detectChanges();
      const cartoes = this.elemento.nativeElement.querySelector<HTMLElement>('.painel__compacto');
      if (cartoes && estaVisivel(cartoes) && !this.haMais && focoPerdido(this.documento)) {
        this.elemento.nativeElement.querySelector<HTMLElement>('.painel__resumo')?.focus();
      }
    });
  }

  lembrar(categoria: CategoriaDoPainel): void {
    this.retornos.guardar(this.historico.posicao, {
      aba: 'categorias',
      carregados: this.itens.length,
      id: categoria.idCategoria,
    });
  }

  descricao(categoria: CategoriaDoPainel): string {
    return categoria.descricao?.trim() || MENSAGEM_DAS_CATEGORIAS.semDescricao;
  }

  porId(_indice: number, item: unknown): number {
    return (item as CategoriaDoPainel).idCategoria;
  }

  private buscar(pagina: number): Observable<Resultado> {
    return this.comoResultado(this.painel.categorias(pagina));
  }

  private comoResultado(pedido: Observable<PaginaDeCategorias>): Observable<Resultado> {
    return pedido.pipe(
      map((resposta): Resultado => ({ pagina: resposta, erro: null })),
      catchError((erro: unknown) => of<Resultado>({ pagina: null, erro: traduzirErro(erro).mensagem })),
    );
  }

  private receber(resultado: Resultado, tentativa: boolean): void {
    this.carregando = false;
    this.tentando = false;
    const retorno = this.retorno;
    this.retorno = null;
    if (!resultado.pagina) {
      this.erro = resultado.erro;
      this.itens = [];
      this.total = null;
      this.anunciar(resultado.erro, 'alerta');
      if (retorno) {
        this.mudancas.detectChanges();
        this.elemento.nativeElement.querySelector<HTMLElement>('.painel__estado button')?.focus();
      }
      return;
    }
    this.erro = null;
    this.total = resultado.pagina.total;
    this.itens = resultado.pagina.itens;
    this.anunciar(this.total === 0 ? MENSAGEM_DAS_CATEGORIAS.vazio : this.resumo);
    if (!retorno && !tentativa) {
      return;
    }
    this.mudancas.detectChanges();
    if (retorno?.id && this.focarEditar(retorno.id)) {
      return;
    }
    const raiz = this.elemento.nativeElement;
    const nova = retorno && !retorno.id ? raiz.closest('main')?.querySelector<HTMLElement>('[data-acao="nova-categoria"]') : null;
    (nova ?? raiz.closest<HTMLElement>('[role="tabpanel"]'))?.focus();
  }

  private focarEditar(idCategoria: number): boolean {
    const alvos = this.elemento.nativeElement.querySelectorAll<HTMLElement>(
      `[data-categoria="${idCategoria}"][data-acao="editar"]`,
    );
    const alvo = Array.from(alvos).find(estaVisivel);
    alvo?.focus();
    return !!alvo;
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
}
