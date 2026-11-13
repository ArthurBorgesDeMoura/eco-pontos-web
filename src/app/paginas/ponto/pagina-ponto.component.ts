import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationCancel, NavigationError, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, filter, map, merge, of, switchMap } from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { PontoDetalhe } from '../../api/modelos';
import { PontosService } from '../../api/pontos.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { linkDoMapa } from '../../compartilhado/mapa';
import { ROTA } from '../../rotas';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; ponto: PontoDetalhe }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'erro'; mensagem: string };

const LIMITE_DA_SAIDA_MS = 400;

const CLASSE_DA_ENTRADA = 'ponto--entrar';
const CLASSE_DA_SAIDA = 'ponto--sair';

export const NAO_INFORMADO = 'Não informado';

@Component({
  selector: 'eco-pagina-ponto',
  templateUrl: './pagina-ponto.component.html',
  styleUrls: ['./pagina-ponto.component.scss'],
})
export class PaginaPontoComponent implements OnInit, AfterViewInit, OnDestroy {
  estado: Estado = { tipo: 'carregando' };
  readonly busca = ROTA.pontos;
  readonly naoInformado = NAO_INFORMADO;
  readonly camposDoEsqueleto = [0, 1, 2, 3];
  readonly materiaisDoEsqueleto = [0, 1, 2];

  @HostBinding('class.ponto--entrar') readonly entrar: boolean;
  tentando = false;
  anuncio = '';

  private readonly tentarDeNovo$ = new Subject<void>();
  private readonly inscricoes = new Subscription();
  private textoDoId: string | null = null;

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly pontos: PontosService,
    private readonly titulo: Title,
    private readonly historico: HistoricoService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
  ) {
    this.entrar = router.navigated;
  }

  get ponto(): PontoDetalhe | null {
    return this.estado.tipo === 'pronto' ? this.estado.ponto : null;
  }

  get mensagemDeErro(): string | null {
    return this.estado.tipo === 'erro' ? this.estado.mensagem : null;
  }

  get mapa(): string {
    const ponto = this.ponto;
    return ponto ? linkDoMapa(ponto.endereco, ponto.bairro.nome) : '';
  }

  ngOnInit(): void {
    this.inscricoes.add(
      merge(
        this.rota.paramMap.pipe(map((parametros) => ({ texto: parametros.get('id'), tentativa: false }))),
        this.tentarDeNovo$.pipe(map(() => ({ texto: this.textoDoId, tentativa: true }))),
      )
        .pipe(
          switchMap(({ texto, tentativa }) => {
            this.textoDoId = texto;
            if (tentativa && this.estado.tipo === 'erro') {
              this.tentando = true;
            } else {
              this.estado = { tipo: 'carregando' };
            }
            return this.buscar(texto).pipe(map((estado) => ({ estado, tentativa })));
          }),
        )
        .subscribe(({ estado, tentativa }) => this.receber(estado, tentativa)),
    );
    this.inscricoes.add(
      this.router.events
        .pipe(filter((evento) => evento instanceof NavigationCancel || evento instanceof NavigationError))
        .subscribe(() => this.elemento.nativeElement.classList.remove(CLASSE_DA_SAIDA)),
    );
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.estado.tipo === 'carregando') {
        this.anuncio = 'Carregando o ponto…';
        this.mudancas.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.tentarDeNovo$.next();
    }
  }

  voltar(evento: MouseEvent): void {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) {
      return;
    }
    evento.preventDefault();
    this.historico.voltar(this.busca);
  }

  sair(destino: string): boolean | Promise<boolean> {
    if (!this.vaiParaABusca(destino)) {
      return true;
    }
    const tela = this.elemento.nativeElement;
    tela.classList.remove(CLASSE_DA_ENTRADA);
    tela.classList.add(CLASSE_DA_SAIDA);
    if (getComputedStyle(tela).animationName === 'none') {
      return true;
    }
    return new Promise((resolver) => {
      const terminar = (evento?: Event): void => {
        if (evento && evento.target !== tela) {
          return;
        }
        clearTimeout(limite);
        tela.removeEventListener('animationend', terminar);
        resolver(true);
      };
      tela.addEventListener('animationend', terminar);
      const limite = setTimeout(terminar, LIMITE_DA_SAIDA_MS);
    });
  }

  private buscar(texto: string | null): Observable<Estado> {
    const idPonto = idDaRota(texto);
    if (idPonto === null) {
      return of({ tipo: 'nao-encontrado' });
    }
    return this.pontos.detalhar(idPonto).pipe(
      map((ponto): Estado => ({ tipo: 'pronto', ponto })),
      catchError((erro: unknown) => {
        const traduzido = traduzirErro(erro);
        const naoExiste = traduzido.status === 404 || traduzido.status === 400;
        return of<Estado>(naoExiste ? { tipo: 'nao-encontrado' } : { tipo: 'erro', mensagem: traduzido.mensagem });
      }),
    );
  }

  private receber(estado: Estado, tentativa: boolean): void {
    this.estado = estado;
    this.tentando = false;
    this.anuncio = '';
    if (estado.tipo === 'pronto') {
      this.titulo.setTitle(`${estado.ponto.nome} · EcoPonto`);
    } else if (estado.tipo === 'nao-encontrado') {
      this.titulo.setTitle('Ponto não encontrado · EcoPonto');
    }
    if (this.entrar || tentativa) {
      this.mudancas.detectChanges();
      const alvo = estado.tipo === 'erro' ? '.ponto__estado button' : 'h1';
      this.elemento.nativeElement.querySelector<HTMLElement>(alvo)?.focus({ preventScroll: true });
    }
  }

  private vaiParaABusca(destino: string): boolean {
    return (this.router.parseUrl(destino).root.children['primary']?.toString() ?? '') === '';
  }
}

function idDaRota(texto: string | null): number | null {
  return texto !== null && /^[1-9]\d{0,8}$/.test(texto) ? Number(texto) : null;
}
