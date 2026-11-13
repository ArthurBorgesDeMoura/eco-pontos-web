import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subscription, filter, finalize, map } from 'rxjs';

import { traduzirErro } from './api/erro-api';
import { AvisoService } from './compartilhado/aviso/aviso.service';
import { DialogoService } from './compartilhado/dialogo/dialogo.service';
import { HistoricoService } from './compartilhado/historico.service';
import { PaginaDaBarra, PerfilDaBarra } from './compartilhado/navegacao/navegacao';
import { TrocaDeTelaService } from './compartilhado/troca-de-tela.service';
import { DadosDaRota, dadosDaRotaAtual } from './dados-da-rota';
import { ROTA } from './rotas';
import { SessaoService, perfilDaBarra } from './sessao/sessao.service';

interface Barras {
  perfil: PerfilDaBarra;
  pagina: PaginaDaBarra | null;
  nome: string;
  cabecalhoInterno: string | null;
  voltarPara: string;
}

const LIMITE_DO_ESMAECER_MS = 400;

@Component({
  selector: 'eco-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly dialogoAberto$: Observable<boolean>;
  barras: Barras | null = null;
  esmaecendo = false;

  private saindoDaConta = false;
  private dados: DadosDaRota | null = null;
  private caminhoAnterior: string | null = null;
  private readonly inscricoes = new Subscription();
  private fimDoEsmaecer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly dialogos: DialogoService,
    private readonly sessao: SessaoService,
    private readonly router: Router,
    private readonly troca: TrocaDeTelaService,
    private readonly avisos: AvisoService,
    @Inject(DOCUMENT) private readonly documento: Document,
    historico: HistoricoService,
  ) {
    void historico;
    this.dialogoAberto$ = dialogos.atual.pipe(map((pedido) => pedido !== null));
  }

  get temBarraInferior(): boolean {
    return this.barras?.perfil === 'usuario' || this.barras?.perfil === 'administrador';
  }

  ngOnInit(): void {
    const historico = this.documento.defaultView?.history;
    if (historico && 'scrollRestoration' in historico) {
      historico.scrollRestoration = 'manual';
    }
    this.inscricoes.add(
      this.router.events
        .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
        .subscribe((evento) => {
          if (this.rolarAoTopoSeMudouDeTela(evento.urlAfterRedirects)) {
            this.focarTelaNova();
          }
          this.dados = dadosDaRotaAtual(this.router.routerState.snapshot.root);
          this.atualizarBarras();
          if (this.troca.consumir()) {
            this.esmaecer();
          }
        }),
    );
    this.inscricoes.add(this.sessao.usuario.subscribe(() => this.atualizarBarras()));
    this.inscricoes.add(this.sessao.carregar().subscribe());
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
    clearTimeout(this.fimDoEsmaecer);
  }

  sair(): void {
    if (this.saindoDaConta) {
      return;
    }
    this.saindoDaConta = true;
    this.sessao
      .sair()
      .pipe(finalize(() => (this.saindoDaConta = false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(ROTA.pontos),
        error: (erro: unknown) => this.avisos.mostrar(traduzirErro(erro).mensagem),
      });
  }

  async abrirConta(): Promise<void> {
    const nome = this.sessao.atual?.nome ?? '';
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Sair da conta?',
      texto: `Você entrou como ${nome}. Ao sair, volta a ver o EcoPonto como visitante.`,
      confirmar: 'Sair',
    });
    if (confirmado) {
      this.sair();
    }
  }

  private atualizarBarras(): void {
    if (!this.dados || this.dados.barras === 'nenhuma') {
      this.barras = null;
      return;
    }
    const usuario = this.sessao.atual;
    this.barras = {
      perfil: this.dados.barras === 'acesso' || this.sessao.estaCarregando ? 'acesso' : perfilDaBarra(usuario),
      pagina: this.dados.pagina ?? null,
      nome: usuario?.nome ?? '',
      cabecalhoInterno: this.dados.cabecalhoInterno ?? null,
      voltarPara: this.dados.voltarPara ?? ROTA.pontos,
    };
  }

  private rolarAoTopoSeMudouDeTela(url: string): boolean {
    const caminho = this.router.parseUrl(url).root.children['primary']?.toString() ?? '';
    const mudou = this.caminhoAnterior !== null && caminho !== this.caminhoAnterior;
    if (mudou) {
      this.documento.defaultView?.scrollTo(0, 0);
    }
    this.caminhoAnterior = caminho;
    return mudou;
  }

  private focarTelaNova(): void {
    setTimeout(() => {
      const ativo = this.documento.activeElement;
      if (ativo && ativo !== this.documento.body && ativo.isConnected) {
        return;
      }
      const titulo = this.documento.querySelector<HTMLElement>('.tela h1');
      if (!titulo) {
        return;
      }
      if (!titulo.hasAttribute('tabindex')) {
        titulo.setAttribute('tabindex', '-1');
      }
      titulo.focus({ preventScroll: true });
    });
  }

  private esmaecer(): void {
    clearTimeout(this.fimDoEsmaecer);
    this.esmaecendo = true;
    this.fimDoEsmaecer = setTimeout(() => (this.esmaecendo = false), LIMITE_DO_ESMAECER_MS);
  }
}
