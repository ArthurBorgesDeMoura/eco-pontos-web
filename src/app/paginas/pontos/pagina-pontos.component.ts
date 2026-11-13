import { DOCUMENT } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, NavigationStart, ParamMap, Router } from '@angular/router';
import { Subject, Subscription, catchError, distinctUntilChanged, map, merge, of, skip, switchMap } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { traduzirErro } from '../../api/erro-api';
import { Bairro, Categoria, ContagemDePontos, PaginaDePontos, PontoResumo } from '../../api/modelos';
import { FiltrosDaBusca, PONTOS_POR_PAGINA, PontosService } from '../../api/pontos.service';
import { OpcaoDoSeletor } from '../../compartilhado/seletor/seletor.component';
import { HistoricoService } from '../../compartilhado/historico.service';
import { ROTA } from '../../rotas';
import { EstadoDaBuscaService, FotoDaBusca } from './estado-da-busca.service';

type Resultado = { pagina: PaginaDePontos; erro: null } | { pagina: null; erro: string };

@Component({
  selector: 'eco-pagina-pontos',
  templateUrl: './pagina-pontos.component.html',
  styleUrls: ['./pagina-pontos.component.scss'],
})
export class PaginaPontosComponent implements OnInit, AfterViewInit, OnDestroy {
  filtros: FiltrosDaBusca = { bairro: null, categoria: null };
  pontos: PontoResumo[] = [];
  total: number | null = null;
  carregando = true;
  carregandoMais = false;
  erro: string | null = null;
  erroDoMais: string | null = null;

  readonly rotaSugerir = ROTA.sugerir;
  readonly linhasDoEsqueleto = Array.from({ length: PONTOS_POR_PAGINA }, (_, indice) => indice);

  bairros: Bairro[] = [];
  opcoesDeBairro: OpcaoDoSeletor[] = [{ valor: null, rotulo: 'Todos os bairros' }];
  opcoesDeMaterial: OpcaoDoSeletor[] = [{ valor: null, rotulo: 'Todos os materiais' }];
  categorias: Categoria[] = [];
  contagens: ContagemDePontos | null = null;

  private paginaAtual = 0;
  private readonly inscricoes = new Subscription();
  private maisInscricao?: Subscription;
  private readonly tentarDeNovo$ = new Subject<void>();
  private focarResultadoDepois = false;
  private bairrosConhecidos: number[] | null = null;
  private categoriasConhecidas: number[] | null = null;
  private bairrosFalharam = false;
  private categoriasFalharam = false;
  private contagemFalhou = false;
  private readonly recontar$ = new Subject<number | null>();
  private readonly filtrosDoHistorico: FiltrosDaBusca | null;
  private rolagemParaRetomar: number | null = null;
  private rolagemAoSair = 0;
  private pontoAoSair: number | null = null;
  private pontoParaFocar: number | null = null;
  private posicao = 0;

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly pontosService: PontosService,
    private readonly api: ApiService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    private readonly estadoDaBusca: EstadoDaBuscaService,
    private readonly historico: HistoricoService,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {
    const navegacao = router.getCurrentNavigation();
    this.filtrosDoHistorico = navegacao?.trigger === 'popstate' ? lerFiltros(navegacao.extractedUrl.queryParamMap) : null;
  }

  get materialEscolhido(): Categoria | null {
    return this.categorias.find((categoria) => categoria.idCategoria === this.filtros.categoria) ?? null;
  }

  get bairroEscolhido(): Bairro | null {
    return this.bairros.find((bairro) => bairro.idBairro === this.filtros.bairro) ?? null;
  }

  get totalConhecido(): boolean {
    return !this.carregando && this.total !== null;
  }

  get contagem(): string {
    const total = this.totalConhecido ? String(this.total) : '–';
    const singular = this.totalConhecido && this.total === 1;
    const material = this.nomeDoMaterial;
    if (material) {
      return `${total} ${singular ? 'ponto aceita' : 'pontos aceitam'} ${material}${this.trechoDoBairro}`;
    }
    return `${total} ${singular ? 'ponto' : 'pontos'}${this.trechoDoBairro}`;
  }

  get mensagemDoVazio(): string {
    const material = this.nomeDoMaterial;
    return material
      ? `Nenhum ponto aceita ${material}${this.trechoDoBairro} ainda.`
      : `Nenhum ponto de coleta${this.trechoDoBairro} ainda.`;
  }

  get contagemSemTotal(): string {
    return this.carregando ? 'Buscando pontos…' : 'Não foi possível buscar os pontos.';
  }

  private get nomeDoMaterial(): string | null {
    if (this.filtros.categoria === null) {
      return null;
    }
    return this.materialEscolhido?.nome ?? 'o material escolhido';
  }

  private get trechoDoBairro(): string {
    if (this.filtros.bairro === null) {
      return '';
    }
    const bairro = this.bairroEscolhido;
    return bairro ? ` em ${bairro.nome}` : ' no bairro escolhido';
  }

  get marcadorDoBairro(): string {
    return this.bairrosFalharam ? 'Bairros indisponíveis' : 'Carregando bairros…';
  }

  get marcadorDoMaterial(): string {
    return this.categoriasFalharam ? 'Materiais indisponíveis' : 'Carregando materiais…';
  }

  get resumo(): string {
    return `Mostrando ${this.pontos.length} de ${this.total ?? 0} ${this.total === 1 ? 'ponto' : 'pontos'}`;
  }

  get haMais(): boolean {
    return this.total !== null && this.pontos.length < this.total;
  }

  ngOnInit(): void {
    this.posicao = this.historico.posicao;
    const foto = this.filtrosDoHistorico ? this.estadoDaBusca.retomar(this.posicao, this.filtrosDoHistorico) : null;
    if (foto) {
      this.retomar(foto);
    } else {
      this.carregarBairros();
      this.carregarCategorias();
    }
    this.inscricoes.add(
      this.router.events.subscribe((evento) => {
        if (evento instanceof NavigationStart) {
          this.rolagemAoSair = this.documento.defaultView?.scrollY ?? 0;
          this.pontoAoSair = idDoDetalhe(evento.url);
        } else if (evento instanceof NavigationEnd) {
          this.posicao = this.historico.posicao;
        }
      }),
    );
    const pular = foto ? 1 : 0;
    const daUrl$ = this.rota.queryParamMap.pipe(
      map(lerFiltros),
      distinctUntilChanged((a, b) => a.bairro === b.bairro && a.categoria === b.categoria),
    );
    this.inscricoes.add(
      merge(
        daUrl$.pipe(
          map((filtros) => filtros.bairro),
          distinctUntilChanged(),
          skip(pular),
        ),
        this.recontar$,
      )
        .pipe(
          switchMap((bairro) => {
            this.contagemFalhou = false;
            this.contagens = null;
            this.montarOpcoesDeMaterial();
            return this.pontosService.contar(bairro).pipe(
              catchError(() => {
                this.contagemFalhou = true;
                return of(null);
              }),
            );
          }),
        )
        .subscribe((contagens) => {
          this.contagens = contagens;
          this.montarOpcoesDeMaterial();
        }),
    );
    this.inscricoes.add(
      merge(
        daUrl$.pipe(
          skip(pular),
          map((filtros) => ({ filtros, tentativa: false })),
        ),
        this.tentarDeNovo$.pipe(map(() => ({ filtros: this.filtros, tentativa: true }))),
      )
        .pipe(
          switchMap(({ filtros, tentativa }) => {
            this.focarResultadoDepois = tentativa;
            this.maisInscricao?.unsubscribe();
            this.carregandoMais = false;
            this.filtros = filtros;
            this.carregando = true;
            this.erro = null;
            this.erroDoMais = null;
            this.descartarFiltrosDesconhecidos();
            this.pedirDeNovoOQueFalhou();
            return this.buscar(filtros, 1);
          }),
        )
        .subscribe((resultado) => this.receberPrimeira(resultado)),
    );
    if (foto && !foto.contagens) {
      this.recontar$.next(this.filtros.bairro);
    }
  }

  ngAfterViewInit(): void {
    const rolagem = this.rolagemParaRetomar;
    const janela = this.documento.defaultView;
    if (rolagem === null || !janela) {
      return;
    }
    this.rolagemParaRetomar = null;
    janela.requestAnimationFrame(() => {
      janela.scrollTo(0, rolagem);
      const aberto = this.pontoParaFocar;
      this.pontoParaFocar = null;
      if (aberto !== null) {
        this.elemento.nativeElement
          .querySelector<HTMLElement>(`.busca__lista a.linha__nome[href="/pontos/${aberto}"]`)
          ?.focus({ preventScroll: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.guardarFoto();
    this.inscricoes.unsubscribe();
    this.maisInscricao?.unsubscribe();
  }

  escolherBairro(valor: unknown): void {
    this.trocarFiltro({ bairro: typeof valor === 'number' ? valor : null });
  }

  escolherMaterial(valor: unknown): void {
    this.trocarFiltro({ material: typeof valor === 'number' ? valor : null });
  }

  tentarDeNovo(): void {
    this.elemento.nativeElement.querySelector<HTMLElement>('.busca__contagem')?.focus();
    this.tentarDeNovo$.next();
  }

  mostrarMais(): void {
    if (this.carregandoMais || !this.haMais) {
      return;
    }
    this.carregandoMais = true;
    this.erroDoMais = null;
    const primeiraNova = this.pontos.length;
    this.maisInscricao = this.buscar(this.filtros, this.paginaAtual + 1).subscribe((resultado) => {
      this.carregandoMais = false;
      if (!resultado.pagina) {
        this.erroDoMais = resultado.erro;
        return;
      }
      this.erroDoMais = null;
      this.paginaAtual = resultado.pagina.pagina;
      this.total = resultado.pagina.total;
      this.pontos = [...this.pontos, ...resultado.pagina.itens];
      this.mudancas.detectChanges();
      this.focarDepoisDeMostrarMais(primeiraNova);
    });
  }

  quantidadeDe(idCategoria: number): number | null {
    if (!this.contagens) {
      return null;
    }
    return this.contagens.categorias.find((item) => item.idCategoria === idCategoria)?.quantidade ?? 0;
  }

  porId(_indice: number, ponto: PontoResumo): number {
    return ponto.idPonto;
  }

  nomesDosMateriais(ponto: PontoResumo): string[] {
    return ponto.materiais.map((material) => material.nome);
  }

  private carregarBairros(): void {
    this.bairrosFalharam = false;
    this.inscricoes.add(
      this.api.get<Bairro[]>('bairros').subscribe({
        next: (bairros) => {
          this.receberBairros(bairros);
          this.descartarFiltrosDesconhecidos();
        },
        error: () => (this.bairrosFalharam = true),
      }),
    );
  }

  private carregarCategorias(): void {
    this.categoriasFalharam = false;
    this.inscricoes.add(
      this.api.get<Categoria[]>('categorias').subscribe({
        next: (categorias) => {
          this.receberCategorias(categorias);
          this.descartarFiltrosDesconhecidos();
        },
        error: () => (this.categoriasFalharam = true),
      }),
    );
  }

  private receberBairros(bairros: Bairro[]): void {
    this.bairros = bairros;
    this.opcoesDeBairro = [this.opcoesDeBairro[0], ...bairros.map((b) => ({ valor: b.idBairro, rotulo: b.nome }))];
    this.bairrosConhecidos = bairros.map((b) => b.idBairro);
  }

  private receberCategorias(categorias: Categoria[]): void {
    this.categorias = categorias;
    this.categoriasConhecidas = categorias.map((c) => c.idCategoria);
    this.montarOpcoesDeMaterial();
  }

  private guardarFoto(): void {
    if (this.carregando || this.erro || this.total === null || this.bairros.length === 0 || this.categorias.length === 0) {
      return;
    }
    this.estadoDaBusca.guardar(this.posicao, {
      filtros: this.filtros,
      pontos: this.pontos,
      total: this.total,
      paginaAtual: this.paginaAtual,
      bairros: this.bairros,
      categorias: this.categorias,
      contagens: this.contagens,
      rolagem: this.rolagemAoSair,
      pontoAberto: this.pontoAoSair,
    });
  }

  private retomar(foto: FotoDaBusca): void {
    this.filtros = foto.filtros;
    this.pontos = foto.pontos;
    this.total = foto.total;
    this.paginaAtual = foto.paginaAtual;
    this.carregando = false;
    this.contagens = foto.contagens;
    this.contagemFalhou = foto.contagens === null;
    this.receberBairros(foto.bairros);
    this.receberCategorias(foto.categorias);
    this.rolagemParaRetomar = foto.rolagem;
    this.pontoParaFocar = foto.pontoAberto;
  }

  private pedirDeNovoOQueFalhou(): void {
    if (this.bairrosFalharam) {
      this.carregarBairros();
    }
    if (this.categoriasFalharam) {
      this.carregarCategorias();
    }
    if (this.contagemFalhou) {
      this.recontar$.next(this.filtros.bairro);
    }
  }

  private montarOpcoesDeMaterial(): void {
    const comContagem = (rotulo: string, quantidade: number | null) =>
      quantidade === null ? rotulo : `${rotulo} (${quantidade})`;
    this.opcoesDeMaterial = [
      { valor: null, rotulo: comContagem('Todos os materiais', this.contagens?.total ?? null) },
      ...this.categorias.map((c) => ({ valor: c.idCategoria, rotulo: comContagem(c.nome, this.quantidadeDe(c.idCategoria)) })),
    ];
  }

  private trocarFiltro(mudanca: { bairro?: number | null; material?: number | null }, substituir = false): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: mudanca,
      queryParamsHandling: 'merge',
      replaceUrl: substituir,
    });
  }

  private descartarFiltrosDesconhecidos(): void {
    const mudanca: { bairro?: null; material?: null } = {};
    if (this.filtros.bairro !== null && this.bairrosConhecidos && !this.bairrosConhecidos.includes(this.filtros.bairro)) {
      mudanca.bairro = null;
    }
    if (
      this.filtros.categoria !== null &&
      this.categoriasConhecidas &&
      !this.categoriasConhecidas.includes(this.filtros.categoria)
    ) {
      mudanca.material = null;
    }
    if (Object.keys(mudanca).length > 0) {
      this.trocarFiltro(mudanca, true);
    }
  }

  private buscar(filtros: FiltrosDaBusca, pagina: number) {
    return this.pontosService.listar(filtros, pagina).pipe(
      map((resposta): Resultado => ({ pagina: resposta, erro: null })),
      catchError((erro: unknown) => of<Resultado>({ pagina: null, erro: traduzirErro(erro).mensagem })),
    );
  }

  private receberPrimeira(resultado: Resultado): void {
    this.carregando = false;
    const focar = this.focarResultadoDepois;
    this.focarResultadoDepois = false;
    if (!resultado.pagina) {
      this.erro = resultado.erro;
      this.pontos = [];
      this.total = null;
      this.focarDepois(focar, '.busca__estado[role="alert"] button');
      return;
    }
    this.paginaAtual = resultado.pagina.pagina;
    this.total = resultado.pagina.total;
    this.pontos = resultado.pagina.itens;
    this.focarDepois(focar, '.busca__contagem');
  }

  private focarDepois(focar: boolean, seletor: string): void {
    if (!focar) {
      return;
    }
    this.mudancas.detectChanges();
    this.elemento.nativeElement.querySelector<HTMLElement>(seletor)?.focus();
  }

  private focarDepoisDeMostrarMais(primeiraNova: number): void {
    const raiz = this.elemento.nativeElement;
    const linha = raiz.querySelectorAll<HTMLElement>('.busca__lista > li')[primeiraNova];
    const alvo = linha?.querySelector<HTMLElement>('a') ?? raiz.querySelector<HTMLElement>('.busca__resumo');
    alvo?.focus();
  }
}

function lerFiltros(parametros: ParamMap): FiltrosDaBusca {
  return { bairro: idDaUrl(parametros.get('bairro')), categoria: idDaUrl(parametros.get('material')) };
}

function idDoDetalhe(url: string): number | null {
  const achado = /^\/pontos\/([1-9]\d{0,8})(?:[?#]|$)/.exec(url);
  return achado ? Number(achado[1]) : null;
}

function idDaUrl(texto: string | null): number | null {
  return texto !== null && /^[1-9]\d{0,8}$/.test(texto) ? Number(texto) : null;
}
