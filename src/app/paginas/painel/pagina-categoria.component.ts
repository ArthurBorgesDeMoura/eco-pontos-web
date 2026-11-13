import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, map, of, startWith, switchMap } from 'rxjs';

import { ErroApi, traduzirErro } from '../../api/erro-api';
import { CategoriaDoPainel } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { ROTA, ROTA_DAS_CATEGORIAS_DO_PAINEL } from '../../rotas';
import { categoriasAte } from './categorias-ate';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';
import {
  CAMPOS_DA_CATEGORIA,
  CampoDaCategoria,
  DadosDaCategoria,
  ErrosDaCategoria,
  MENSAGEM_DA_CATEGORIA,
  montarCategoria,
  temErrosNaCategoria,
  validarCategoria,
} from './validacao-da-categoria';

export const MENSAGEM_DO_FORMULARIO_DE_CATEGORIA = {
  cadastrada: 'Categoria cadastrada.',
  atualizada: 'Categoria atualizada.',
  carregando: 'Carregando a categoria…',
  cadastrar: 'Cadastrar categoria',
  salvar: 'Salvar alterações',
  salvando: 'Salvando…',
  ajudaDaDescricao: 'Aparece na busca, quando alguém escolhe este material.',
} as const;

const CONSULTA_DO_DESKTOP = '(min-width: 1024px)';

const SEM_NOVA_TENTATIVA: readonly number[] = [401, 403, 404];

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto' }
  | { tipo: 'nao-encontrada' }
  | { tipo: 'erro'; mensagem: string };

@Component({
  selector: 'eco-pagina-categoria',
  templateUrl: './pagina-categoria.component.html',
  styleUrls: [
    '../formulario-ponto/pagina-do-formulario.scss',
    '../formulario-ponto/cartao-do-formulario.scss',
    './pagina-categoria.component.scss',
  ],
})
export class PaginaCategoriaComponent implements OnInit, OnDestroy {
  readonly mensagem = MENSAGEM_DO_FORMULARIO_DE_CATEGORIA;
  readonly rotaDoPainel = ROTA.painel;

  readonly formulario = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true }),
  });

  idCategoria: number | null = null;
  estado: Estado = { tipo: 'carregando' };
  tentando = false;

  tentouEnviar = false;
  enviando = false;
  erroGeral: string | null = null;
  podeTentarDeNovo = false;
  tamanhoDosBotoes: 'm' | 'g' = 'g';

  private errosDoServidor: ErrosDaCategoria = {};
  private readonly carregar$ = new Subject<{ tentativa: boolean }>();
  private readonly inscricoes = new Subscription();
  private envio?: Subscription;
  private consultaDoDesktop?: MediaQueryList;
  private readonly aoMudarDeTamanho = (): void => this.medirTamanho();

  constructor(
    private readonly rota: ActivatedRoute,
    private readonly router: Router,
    private readonly painel: PainelService,
    private readonly avisos: AvisoService,
    private readonly historico: HistoricoService,
    private readonly retornos: RetornoDaEdicaoService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  get nova(): boolean {
    return this.idCategoria === null;
  }

  ngOnInit(): void {
    this.inscricoes.add(
      this.rota.paramMap
        .pipe(
          map((parametros) => parametros.get('id')),
          switchMap((texto) =>
            this.carregar$.pipe(
              startWith({ tentativa: false }),
              switchMap(({ tentativa }) => {
                if (texto === null) {
                  this.idCategoria = null;
                  return of({ estado: { tipo: 'pronto' } as Estado, tentativa, categoria: null });
                }
                const id = idDaRota(texto);
                this.idCategoria = id;
                if (tentativa) {
                  this.tentando = true;
                } else {
                  this.estado = { tipo: 'carregando' };
                }
                return this.buscar(id).pipe(map((resposta) => ({ ...resposta, tentativa })));
              }),
            ),
          ),
        )
        .subscribe(({ estado, tentativa, categoria }) => this.receber(estado, categoria, tentativa)),
    );
    for (const campo of CAMPOS_DA_CATEGORIA) {
      this.inscricoes.add(
        this.formulario.controls[campo].valueChanges.subscribe(() => {
          if (this.errosDoServidor[campo]) {
            const resto = { ...this.errosDoServidor };
            delete resto[campo];
            this.errosDoServidor = resto;
          }
        }),
      );
    }
    this.consultaDoDesktop = this.documento.defaultView?.matchMedia(CONSULTA_DO_DESKTOP);
    this.consultaDoDesktop?.addEventListener('change', this.aoMudarDeTamanho);
    this.medirTamanho();
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
    this.envio?.unsubscribe();
    this.consultaDoDesktop?.removeEventListener('change', this.aoMudarDeTamanho);
  }

  erroDo(campo: CampoDaCategoria): string | null {
    return this.errosDoServidor[campo] ?? (this.tentouEnviar ? validarCategoria(this.dados())[campo] : undefined) ?? null;
  }

  tentarDeNovo(): void {
    if (!this.tentando) {
      this.carregar$.next({ tentativa: true });
    }
  }

  tentarEnviarDeNovo(): void {
    this.focar('.formulario__enviar');
    this.enviar();
  }

  enviar(): void {
    if (this.enviando) {
      return;
    }
    this.tentouEnviar = true;
    this.erroGeral = null;
    this.podeTentarDeNovo = false;
    this.errosDoServidor = {};
    if (temErrosNaCategoria(validarCategoria(this.dados()))) {
      this.focarPrimeiroErro();
      return;
    }
    this.enviando = true;
    const enviados = this.dados();
    const corpo = montarCategoria(enviados);
    const pedido =
      this.idCategoria === null ? this.painel.criarCategoria(corpo) : this.painel.editarCategoria(this.idCategoria, corpo);
    this.envio = pedido.subscribe({
      next: (salva) => this.aoSalvar(salva),
      error: (erro: unknown) => this.tratarErro(traduzirErro(erro), enviados),
    });
  }

  voltar(): void {
    this.historico.voltar(ROTA_DAS_CATEGORIAS_DO_PAINEL);
  }

  private dados(): DadosDaCategoria {
    return this.formulario.getRawValue();
  }

  private aoSalvar(salva: CategoriaDoPainel): void {
    if (this.idCategoria === null && typeof salva?.idCategoria === 'number') {
      this.retornos.definirId(salva.idCategoria);
    }
    this.avisos.mostrar(this.idCategoria === null ? MENSAGEM_DO_FORMULARIO_DE_CATEGORIA.cadastrada : MENSAGEM_DO_FORMULARIO_DE_CATEGORIA.atualizada);
    this.voltar();
  }

  private tratarErro(erro: ErroApi, enviados: DadosDaCategoria): void {
    this.enviando = false;
    if (erro.status === 400 || erro.status === 409) {
      const porCampo: ErrosDaCategoria = {};
      const atuais = this.dados();
      for (const [nome, mensagem] of Object.entries(erro.campos)) {
        const campo = CAMPOS_DA_CATEGORIA.find((item) => item === nome);
        if (campo && atuais[campo] === enviados[campo]) {
          porCampo[campo] = mensagem;
        }
      }
      if (erro.status === 409 && !porCampo.nome && atuais.nome === enviados.nome) {
        porCampo.nome = MENSAGEM_DA_CATEGORIA.nomeRepetido;
      }
      this.errosDoServidor = porCampo;
      if (temErrosNaCategoria(porCampo)) {
        this.focarPrimeiroErro();
        return;
      }
      this.erroGeral = erro.mensagem;
      return;
    }
    this.erroGeral = erro.mensagem;
    this.podeTentarDeNovo = !SEM_NOVA_TENTATIVA.includes(erro.status);
  }

  private buscar(id: number | null): Observable<{ estado: Estado; categoria: CategoriaDoPainel | null }> {
    if (id === null) {
      return of({ estado: { tipo: 'nao-encontrada' } as Estado, categoria: null });
    }
    return categoriasAte(this.painel, Infinity).pipe(
      map((pagina) => {
        const categoria = pagina.itens.find((item) => item.idCategoria === id) ?? null;
        return { estado: (categoria ? { tipo: 'pronto' } : { tipo: 'nao-encontrada' }) as Estado, categoria };
      }),
      catchError((erro: unknown) =>
        of({ estado: { tipo: 'erro', mensagem: traduzirErro(erro).mensagem } as Estado, categoria: null }),
      ),
    );
  }

  private receber(estado: Estado, categoria: CategoriaDoPainel | null, tentativa: boolean): void {
    this.estado = estado;
    this.tentando = false;
    if (categoria) {
      this.formulario.reset({ nome: categoria.nome ?? '', descricao: categoria.descricao ?? '' });
    }
    if (this.router.navigated || tentativa) {
      this.mudancas.detectChanges();
      const alvo = estado.tipo === 'erro' ? '.editar__estado button' : 'h1';
      this.elemento.nativeElement.querySelector<HTMLElement>(alvo)?.focus({ preventScroll: true });
    }
  }

  private focarPrimeiroErro(): void {
    this.mudancas.detectChanges();
    const campo = CAMPOS_DA_CATEGORIA.find((item) => this.erroDo(item) !== null);
    if (campo) {
      this.focar(`[data-campo="${campo}"] input`);
    }
  }

  private focar(seletor: string): void {
    this.mudancas.detectChanges();
    this.elemento.nativeElement.querySelector<HTMLElement>(seletor)?.focus();
  }

  private medirTamanho(): void {
    this.tamanhoDosBotoes = this.consultaDoDesktop?.matches ? 'm' : 'g';
  }
}

function idDaRota(texto: string): number | null {
  return /^\d+$/.test(texto) && Number(texto) >= 1 ? Number(texto) : null;
}
