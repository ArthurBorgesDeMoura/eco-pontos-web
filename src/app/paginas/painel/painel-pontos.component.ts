import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, Subscription, catchError, map, of, startWith, switchMap, timer } from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { PaginaDoPainel, PontoDoPainel } from '../../api/modelos';
import { MAIOR_PAGINA_DO_PAINEL, PainelService } from '../../api/painel.service';
import { PONTOS_POR_PAGINA } from '../../api/pontos.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { DialogoService } from '../../compartilhado/dialogo/dialogo.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { rotaDaEdicao } from '../../rotas';
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
import { RetornoDaEdicao, RetornoDaEdicaoService } from './retorno-da-edicao.service';

export const MENSAGEM_DOS_PONTOS = {
  carregando: 'Carregando os pontos…',
  vazio: 'Nenhum ponto publicado',
  excluido: (nome: string) => `${nome} excluído.`,
  jaExcluido: 'Este ponto já tinha sido excluído.',
  tituloDaExclusao: (nome: string) => `Excluir “${nome}”?`,
  textoDaExclusao: 'Ele sai da busca e da lista do painel. Essa ação não pode ser desfeita.',
  confirmarExclusao: 'Excluir ponto',
} as const;

type Resultado = { pagina: PaginaDoPainel; erro: null } | { pagina: null; erro: string };
type Acao = 'editar' | 'excluir';

@Component({
  selector: 'eco-painel-pontos',
  templateUrl: './painel-pontos.component.html',
  styleUrls: ['./painel-lista.scss', './painel-pontos.component.scss'],
})
export class PainelPontosComponent implements OnInit, OnDestroy {
  readonly mensagem = MENSAGEM_DOS_PONTOS;
  readonly materiais = materiaisDoPonto;
  readonly bairro = bairroDoPonto;
  readonly local = localDoPonto;
  readonly rotaDaEdicao = rotaDaEdicao;

  itens: PontoDoPainel[] = [];
  total: number | null = null;
  carregando = true;
  carregandoMais = false;
  erro: string | null = null;
  erroDoMais: string | null = null;
  tentando = false;
  excluindo: ReadonlySet<number> = new Set<number>();
  saindo: readonly PontoDoPainel[] = [];
  anuncio = '';
  alerta = '';

  private retorno: RetornoDaEdicao | null = null;
  private tamanhoInicial = PONTOS_POR_PAGINA;
  private versaoDaLista = 0;
  private dialogoAberto = false;
  private destruido = false;
  private relogioDoAnuncio?: ReturnType<typeof setTimeout>;
  private readonly carregar$ = new Subject<{ tentativa: boolean }>();
  private readonly inscricoes = new Subscription();
  private maisInscricao?: Subscription;

  constructor(
    private readonly painel: PainelService,
    private readonly aviso: AvisoService,
    private readonly dialogos: DialogoService,
    private readonly historico: HistoricoService,
    private readonly retornos: RetornoDaEdicaoService,
    private readonly mudancasDoPainel: MudancasDoPainelService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  get resumo(): string {
    const total = this.total ?? 0;
    return `Mostrando ${this.itens.length} de ${total} ${total === 1 ? 'ponto' : 'pontos'}`;
  }

  get haMais(): boolean {
    return this.total !== null && this.itens.length - this.saindo.length < this.total;
  }

  get maisIndisponivel(): boolean {
    return this.carregandoMais || this.excluindo.size > 0;
  }

  ngOnInit(): void {
    this.retorno = this.retornos.retomar(this.historico.posicao, 'pontos');
    if (this.retorno) {
      this.tamanhoInicial = Math.min(Math.max(this.retorno.carregados, PONTOS_POR_PAGINA), MAIOR_PAGINA_DO_PAINEL);
    }
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
            this.anunciar(MENSAGEM_DOS_PONTOS.carregando);
            return this.buscar(1, this.tamanhoInicial).pipe(map((resultado) => ({ resultado, tentativa })));
          }),
        )
        .subscribe(({ resultado, tentativa }) => this.receber(resultado, tentativa)),
    );
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.inscricoes.unsubscribe();
    this.maisInscricao?.unsubscribe();
    clearTimeout(this.relogioDoAnuncio);
    if (this.dialogoAberto) {
      this.dialogos.responder(false);
    }
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.carregar$.next({ tentativa: true });
    }
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
      this.versaoDaLista++;
      this.total = resultado.pagina.total;
      this.itens = desdeOComeco
        ? resultado.pagina.itens
        : [...this.itens, ...resultado.pagina.itens.filter((item) => !vistos.has(item.idPonto))];
      this.focarResumoDosCartoes();
    });
  }

  lembrar(ponto: PontoDoPainel): void {
    this.retornos.guardar(this.historico.posicao, {
      aba: 'pontos',
      carregados: this.itens.length - this.saindo.length,
      id: ponto.idPonto,
    });
  }

  async excluir(ponto: PontoDoPainel): Promise<void> {
    if (this.excluindo.has(ponto.idPonto) || this.dialogoAberto) {
      return;
    }
    this.dialogoAberto = true;
    const confirmado = await this.dialogos.confirmar({
      titulo: MENSAGEM_DOS_PONTOS.tituloDaExclusao(ponto.nome),
      texto: MENSAGEM_DOS_PONTOS.textoDaExclusao,
      confirmar: MENSAGEM_DOS_PONTOS.confirmarExclusao,
      tipo: 'exclusao',
    });
    this.dialogoAberto = false;
    if (!confirmado || this.destruido || this.excluindo.has(ponto.idPonto)) {
      return;
    }
    const comMais = this.carregandoMais && this.itens.length + PONTOS_POR_PAGINA <= MAIOR_PAGINA_DO_PAINEL;
    if (comMais) {
      this.maisInscricao?.unsubscribe();
      this.carregandoMais = false;
    }
    this.excluindo = new Set(this.excluindo).add(ponto.idPonto);
    this.mudancas.markForCheck();
    this.painel.excluir(ponto.idPonto).subscribe({
      next: () => {
        this.aviso.mostrar(MENSAGEM_DOS_PONTOS.excluido(ponto.nome));
        this.mudancasDoPainel.avisarExclusao();
        this.tirarLinha(ponto, comMais);
      },
      error: (erro: unknown) => {
        const traduzido = traduzirErro(erro);
        if (traduzido.status === 404) {
          this.aviso.mostrar(MENSAGEM_DOS_PONTOS.jaExcluido);
          this.mudancasDoPainel.avisarExclusao();
          this.tirarLinha(ponto, comMais);
          return;
        }
        this.excluindo = semO(this.excluindo, ponto.idPonto);
        if (traduzido.status !== 401) {
          this.aviso.mostrar(traduzido.mensagem);
        }
        if (comMais && !this.destruido) {
          this.mostrarMais();
        }
        this.mudancas.markForCheck();
      },
    });
  }

  porId(_indice: number, item: unknown): number {
    return (item as PontoDoPainel).idPonto;
  }

  private tirarLinha(ponto: PontoDoPainel, comMais = false): void {
    if (this.destruido) {
      return;
    }
    const naLista = this.itens.find((item) => item.idPonto === ponto.idPonto);
    if (naLista) {
      this.saindo = [...this.saindo, naLista];
      if (this.total !== null) {
        this.total = Math.max(0, this.total - 1);
      }
    }
    const tamanho = Math.max(this.itens.length + (comMais ? PONTOS_POR_PAGINA : 0), PONTOS_POR_PAGINA);
    const versao = this.versaoDaLista;
    let recarga: Resultado | null = null;
    let esmaeceu = false;
    this.mudancas.markForCheck();
    if (tamanho <= MAIOR_PAGINA_DO_PAINEL) {
      this.inscricoes.add(
        this.buscar(1, tamanho).subscribe((resultado) => {
          recarga = resultado;
          if (esmaeceu) {
            this.completar(resultado, versao);
          }
        }),
      );
    }
    this.inscricoes.add(
      timer(DURACAO_DA_SAIDA_DA_LINHA_MS).subscribe(() => {
        esmaeceu = true;
        this.concluirSaida(ponto, recarga, versao);
      }),
    );
  }

  private completar(recarga: Resultado, versao: number): void {
    if (!recarga.pagina || this.versaoDaLista !== versao || this.excluindo.size > 0 || this.saindo.length > 0) {
      return;
    }
    this.itens = recarga.pagina.itens;
    this.total = recarga.pagina.total;
    this.versaoDaLista++;
    this.mudancas.detectChanges();
  }

  private concluirSaida(ponto: PontoDoPainel, recarga: Resultado | null, versao: number): void {
    const ativo = this.documento.activeElement;
    const focoNaLinha = ativo?.getAttribute('data-ponto') === String(ponto.idPonto);
    const acaoFocada = (focoNaLinha ? ativo?.getAttribute('data-acao') : null) as Acao | null;
    const focoNoDialogo = !!ativo?.closest('eco-dialogos');
    const indice = this.itens.findIndex((item) => item.idPonto === ponto.idPonto);
    const levarOFoco = indice >= 0 && (focoNaLinha || focoNoDialogo || focoPerdido(this.documento));

    this.saindo = this.saindo.filter((item) => item.idPonto !== ponto.idPonto);
    this.excluindo = semO(this.excluindo, ponto.idPonto);
    if (recarga?.pagina && this.versaoDaLista === versao && this.excluindo.size === 0 && this.saindo.length === 0) {
      this.itens = recarga.pagina.itens;
      this.total = recarga.pagina.total;
      this.versaoDaLista++;
    } else {
      this.itens = this.itens.filter((item) => item.idPonto !== ponto.idPonto);
    }
    this.mudancas.detectChanges();
    if (levarOFoco) {
      this.focarDepoisDaSaida(indice, acaoFocada ?? 'excluir');
    }
  }

  private focarDepoisDaSaida(indice: number, acao: Acao): void {
    const seguinte = this.itens[indice] ?? null;
    if (seguinte && this.focarAcao(seguinte.idPonto, acao)) {
      return;
    }
    const raiz = this.elemento.nativeElement;
    const alvos =
      this.itens.length > 0
        ? raiz.querySelectorAll<HTMLElement>('.tabela__resumo, .painel__resumo')
        : raiz.querySelectorAll<HTMLElement>('.painel__estado-mensagem');
    Array.from(alvos).find(estaVisivel)?.focus();
  }

  private focarAcao(idPonto: number, acao: Acao): boolean {
    const alvos = this.elemento.nativeElement.querySelectorAll<HTMLElement>(
      `[data-ponto="${idPonto}"][data-acao="${acao}"]`,
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

  private focarResumoDosCartoes(): void {
    this.mudancas.detectChanges();
    const raiz = this.elemento.nativeElement;
    const cartoes = raiz.querySelector<HTMLElement>('.painel__compacto');
    if (cartoes && estaVisivel(cartoes) && !this.haMais && focoPerdido(this.documento)) {
      raiz.querySelector<HTMLElement>('.painel__resumo')?.focus();
    }
  }

  private buscar(pagina: number, tamanho = PONTOS_POR_PAGINA): Observable<Resultado> {
    return this.painel.pontos('APROVADO', pagina, tamanho).pipe(
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
      if (this.retorno) {
        this.retorno = null;
        this.mudancas.detectChanges();
        this.elemento.nativeElement.querySelector<HTMLElement>('.painel__estado button')?.focus();
      }
      return;
    }
    this.erro = null;
    this.versaoDaLista++;
    this.total = resultado.pagina.total;
    this.itens = resultado.pagina.itens;
    this.saindo = [];
    this.anunciar(this.total === 0 ? MENSAGEM_DOS_PONTOS.vazio : this.resumo);
    const retorno = this.retorno;
    this.retorno = null;
    if (retorno || tentativa) {
      this.mudancas.detectChanges();
    }
    if (retorno?.id && this.focarAcao(retorno.id, 'editar')) {
      return;
    }
    if (retorno || tentativa) {
      this.elemento.nativeElement.closest<HTMLElement>('[role="tabpanel"]')?.focus();
    }
  }
}
