import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, map, of, startWith, switchMap } from 'rxjs';

import { traduzirErro } from '../../api/erro-api';
import { NovaSugestao, PontoDetalhe } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { PontosService } from '../../api/pontos.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { ROTA, ROTA_DOS_PONTOS_DO_PAINEL } from '../../rotas';
import { DadosDaSugestao } from '../sugerir/validacao-da-sugestao';

export const MENSAGEM_DA_EDICAO = {
  atualizado: 'Ponto atualizado.',
  carregando: 'Carregando o ponto…',
  salvar: 'Salvar alterações',
  salvando: 'Salvando…',
} as const;

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; ponto: PontoDetalhe; inicial: DadosDaSugestao }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'erro'; mensagem: string };

@Component({
  selector: 'eco-pagina-editar-ponto',
  templateUrl: './pagina-editar-ponto.component.html',
  styleUrls: ['../formulario-ponto/pagina-do-formulario.scss', './pagina-editar-ponto.component.scss'],
})
export class PaginaEditarPontoComponent implements OnInit, OnDestroy {
  readonly mensagem = MENSAGEM_DA_EDICAO;
  readonly rotaDoPainel = ROTA.painel;

  estado: Estado = { tipo: 'carregando' };
  tentando = false;

  private idPonto: number | null = null;
  private readonly carregar$ = new Subject<{ tentativa: boolean }>();
  private readonly inscricoes = new Subscription();

  readonly salvar = (corpo: NovaSugestao): Observable<unknown> => this.painel.editar(this.idPonto ?? 0, corpo);

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly pontos: PontosService,
    private readonly painel: PainelService,
    private readonly avisos: AvisoService,
    private readonly historico: HistoricoService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.inscricoes.add(
      this.rota.paramMap
        .pipe(
          map((parametros) => idDaRota(parametros.get('id'))),
          switchMap((id) =>
            this.carregar$.pipe(
              startWith({ tentativa: false }),
              switchMap(({ tentativa }) => {
                this.idPonto = id;
                if (tentativa) {
                  this.tentando = true;
                } else {
                  this.estado = { tipo: 'carregando' };
                }
                return this.buscar(id).pipe(map((estado) => ({ estado, tentativa })));
              }),
            ),
          ),
        )
        .subscribe(({ estado, tentativa }) => this.receber(estado, tentativa)),
    );
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.carregar$.next({ tentativa: true });
    }
  }

  aoSalvar(): void {
    this.avisos.mostrar(MENSAGEM_DA_EDICAO.atualizado);
    this.voltar();
  }

  voltar(): void {
    this.historico.voltar(ROTA_DOS_PONTOS_DO_PAINEL);
  }

  private buscar(id: number | null): Observable<Estado> {
    if (id === null) {
      return of<Estado>({ tipo: 'nao-encontrado' });
    }
    return this.pontos.detalhar(id).pipe(
      map((ponto): Estado => ({ tipo: 'pronto', ponto, inicial: dadosDoPonto(ponto) })),
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
    if (this.router.navigated || tentativa) {
      this.mudancas.detectChanges();
      const alvo = estado.tipo === 'erro' ? '.editar__estado button' : 'h1';
      this.elemento.nativeElement.querySelector<HTMLElement>(alvo)?.focus({ preventScroll: true });
    }
  }
}

function idDaRota(texto: string | null): number | null {
  return texto !== null && /^\d+$/.test(texto) && Number(texto) >= 1 ? Number(texto) : null;
}

export function dadosDoPonto(ponto: PontoDetalhe): DadosDaSugestao {
  return {
    nome: ponto.nome ?? '',
    endereco: ponto.endereco ?? '',
    idBairro: ponto.bairro?.idBairro ?? null,
    horario: ponto.horario ?? '',
    contato: ponto.contato ?? '',
    categorias: (ponto.materiais ?? []).map((material) => material.idCategoria).sort((a, b) => a - b),
  };
}
