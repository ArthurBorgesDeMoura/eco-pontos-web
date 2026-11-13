import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { Aviso, AvisoService, DURACAO_DO_AVISO_MS } from './aviso.service';

type MotivoDePausa = 'ponteiro' | 'foco' | 'aba';

const LIMITE_DA_SAIDA_MS = 400;

@Component({
  selector: 'eco-avisos',
  templateUrl: './avisos.component.html',
  styleUrls: ['./avisos.component.scss'],
})
export class AvisosComponent implements OnInit, OnDestroy {
  aviso: Aviso | null = null;
  visiveis: readonly Aviso[] = [];
  saindo = false;

  private inscricao?: Subscription;
  private relogio?: ReturnType<typeof setTimeout>;
  private fimDaSaida?: ReturnType<typeof setTimeout>;
  private restanteMs = DURACAO_DO_AVISO_MS;
  private inicioDoRelogio = 0;
  private readonly pausas = new Set<MotivoDePausa>();
  private readonly aoMudarVisibilidade = (): void => {
    if (this.documento.hidden) {
      this.pausar('aba');
    } else {
      this.retomar('aba');
    }
  };

  constructor(
    private readonly avisos: AvisoService,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  ngOnInit(): void {
    this.inscricao = this.avisos.atual.subscribe((aviso) => this.trocar(aviso));
    this.documento.addEventListener('visibilitychange', this.aoMudarVisibilidade);
  }

  ngOnDestroy(): void {
    this.inscricao?.unsubscribe();
    this.documento.removeEventListener('visibilitychange', this.aoMudarVisibilidade);
    this.pararRelogio();
    clearTimeout(this.fimDaSaida);
  }

  pausar(motivo: MotivoDePausa): void {
    this.pausas.add(motivo);
    this.pararRelogio();
  }

  aoEntrarPonteiro(evento: PointerEvent): void {
    if (evento.pointerType === 'mouse') {
      this.pausar('ponteiro');
    }
  }

  retomar(motivo: MotivoDePausa): void {
    this.pausas.delete(motivo);
    this.ligarRelogio();
  }

  aoTerminarAnimacao(evento: AnimationEvent): void {
    if (this.saindo && evento.target === evento.currentTarget) {
      this.concluirSaida();
    }
  }

  porId(_indice: number, aviso: Aviso): number {
    return aviso.id;
  }

  private trocar(aviso: Aviso | null): void {
    this.pararRelogio();
    if (!aviso) {
      this.sair();
      return;
    }
    clearTimeout(this.fimDaSaida);
    this.aviso = aviso;
    this.visiveis = [aviso];
    this.saindo = false;
    this.restanteMs = DURACAO_DO_AVISO_MS;
    this.pausas.clear();
    if (this.documento.hidden) {
      this.pausas.add('aba');
    }
    this.ligarRelogio();
  }

  private ligarRelogio(): void {
    const aviso = this.aviso;
    if (!aviso || this.saindo || this.relogio || this.pausas.size > 0) {
      return;
    }
    this.inicioDoRelogio = Date.now();
    this.relogio = setTimeout(() => {
      this.relogio = undefined;
      this.avisos.fechar(aviso.id);
    }, this.restanteMs);
  }

  private pararRelogio(): void {
    if (this.relogio) {
      clearTimeout(this.relogio);
      this.relogio = undefined;
      this.restanteMs = Math.max(0, this.restanteMs - (Date.now() - this.inicioDoRelogio));
    }
  }

  private sair(): void {
    if (!this.aviso || this.saindo) {
      return;
    }
    this.saindo = true;
    this.fimDaSaida = setTimeout(() => this.concluirSaida(), LIMITE_DA_SAIDA_MS);
  }

  private concluirSaida(): void {
    clearTimeout(this.fimDaSaida);
    if (this.saindo) {
      this.aviso = null;
      this.visiveis = [];
      this.saindo = false;
      this.mudancas.markForCheck();
    }
  }
}
