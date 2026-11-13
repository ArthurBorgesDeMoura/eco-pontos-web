import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, distinctUntilChanged, map, merge, of, switchMap } from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { PaginaDeSugestoes, StatusDoPonto, Sugestao } from '../../api/modelos';
import { SugestoesService } from '../../api/sugestoes.service';
import { Aba } from '../../compartilhado/abas/abas.component';
import { ROTA } from '../../rotas';

export type AbaDasSugestoes = 'todas' | 'pendentes' | 'aprovadas' | 'recusadas';

interface DefinicaoDaAba extends Aba {
  readonly valor: AbaDasSugestoes;
  readonly status: StatusDoPonto | null;
  readonly vazio: string;
}

export const ABAS_DAS_SUGESTOES: readonly DefinicaoDaAba[] = [
  { valor: 'todas', rotulo: 'Todas', status: null, vazio: 'Você ainda não sugeriu nenhum ponto.' },
  { valor: 'pendentes', rotulo: 'Pendentes', status: 'PENDENTE', vazio: 'Nenhuma sugestão pendente.' },
  { valor: 'aprovadas', rotulo: 'Aprovadas', status: 'APROVADO', vazio: 'Nenhuma sugestão aprovada ainda.' },
  { valor: 'recusadas', rotulo: 'Recusadas', status: 'RECUSADO', vazio: 'Nenhuma sugestão recusada.' },
];

export const ROTULO_DA_SITUACAO: Readonly<Record<StatusDoPonto, string>> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovada',
  RECUSADO: 'Recusada',
};

type Resultado = { pagina: PaginaDeSugestoes; erro: null } | { pagina: null; erro: string };

@Component({
  selector: 'eco-pagina-minhas-sugestoes',
  templateUrl: './pagina-minhas-sugestoes.component.html',
  styleUrls: ['./pagina-minhas-sugestoes.component.scss'],
})
export class PaginaMinhasSugestoesComponent implements OnInit, OnDestroy {
  readonly abas = ABAS_DAS_SUGESTOES;
  readonly rotaSugerir = ROTA.sugerir;

  aba: AbaDasSugestoes = 'todas';
  itens: Sugestao[] = [];
  total: number | null = null;
  carregando = true;
  carregandoMais = false;
  erro: string | null = null;
  erroDoMais: string | null = null;
  tentando = false;
  anuncio = '';
  alerta = '';
  private relogioDoAnuncio?: ReturnType<typeof setTimeout>;

  private paginaAtual = 0;
  private readonly tentarDeNovo$ = new Subject<void>();
  private readonly inscricoes = new Subscription();
  private maisInscricao?: Subscription;

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly sugestoes: SugestoesService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
  ) {}

  get definicao(): DefinicaoDaAba {
    return this.abas.find((aba) => aba.valor === this.aba) ?? this.abas[0];
  }

  get resumo(): string {
    const total = this.total ?? 0;
    return `Mostrando ${this.itens.length} de ${total} ${total === 1 ? 'sugestão' : 'sugestões'}`;
  }

  get haMais(): boolean {
    return this.total !== null && this.itens.length < this.total;
  }

  ngOnInit(): void {
    const daUrl$ = this.rota.queryParamMap.pipe(
      map((parametros) => abaDaUrl(parametros.get('aba'))),
      distinctUntilChanged(),
    );
    this.inscricoes.add(
      merge(
        daUrl$.pipe(map((aba) => ({ aba, tentativa: false }))),
        this.tentarDeNovo$.pipe(map(() => ({ aba: this.aba, tentativa: true }))),
      )
        .pipe(
          switchMap(({ aba, tentativa }) => {
            this.maisInscricao?.unsubscribe();
            this.carregandoMais = false;
            this.erroDoMais = null;
            this.aba = aba;
            if (tentativa) {
              this.tentando = true;
            } else {
              this.carregando = true;
              this.erro = null;
            }
            this.anunciar('Carregando suas sugestões…');
            return this.buscar(this.definicao.status, 1).pipe(map((resultado) => ({ resultado, tentativa })));
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

  escolherAba(valor: string): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { aba: valor === 'todas' ? null : valor },
      queryParamsHandling: 'merge',
    });
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.tentarDeNovo$.next();
    }
  }

  mostrarMais(): void {
    if (this.carregandoMais || this.total === null || this.itens.length >= this.total) {
      return;
    }
    this.carregandoMais = true;
    this.erroDoMais = null;
    this.maisInscricao = this.buscar(this.definicao.status, this.paginaAtual + 1).subscribe((resultado) => {
      this.carregandoMais = false;
      if (!resultado.pagina) {
        this.erroDoMais = resultado.erro;
        this.anunciar(resultado.erro, 'alerta');
        return;
      }
      this.paginaAtual = resultado.pagina.pagina;
      this.total = resultado.pagina.total;
      this.itens = [...this.itens, ...resultado.pagina.itens];
      this.focarResumoDoCelular();
    });
  }

  rotuloDe(status: StatusDoPonto): string {
    return ROTULO_DA_SITUACAO[status];
  }

  materiais(sugestao: Sugestao): string {
    return sugestao.materiais.map((material) => material.nome).join(', ');
  }

  porId(_indice: number, item: unknown): number {
    return (item as Sugestao).idPonto;
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

  private focarResumoDoCelular(): void {
    this.mudancas.detectChanges();
    const raiz = this.elemento.nativeElement;
    const celular = raiz.querySelector<HTMLElement>('.minhas__celular');
    const ativo = raiz.ownerDocument.activeElement;
    const perdeuOFoco = !ativo || ativo === raiz.ownerDocument.body;
    if (celular && getComputedStyle(celular).display !== 'none' && !this.haMais && perdeuOFoco) {
      raiz.querySelector<HTMLElement>('.minhas__resumo')?.focus();
    }
  }

  private buscar(status: StatusDoPonto | null, pagina: number): Observable<Resultado> {
    return this.sugestoes.minhas(status, pagina).pipe(
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
    this.paginaAtual = resultado.pagina.pagina;
    this.total = resultado.pagina.total;
    this.itens = resultado.pagina.itens;
    this.anunciar(this.total === 0 ? this.definicao.vazio : this.resumo);
    if (tentativa) {
      this.mudancas.detectChanges();
      this.elemento.nativeElement.querySelector<HTMLElement>('[role="tabpanel"]')?.focus();
    }
  }
}

function abaDaUrl(texto: string | null): AbaDasSugestoes {
  return ABAS_DAS_SUGESTOES.find((aba) => aba.valor === texto && aba.valor !== 'todas')?.valor ?? 'todas';
}
