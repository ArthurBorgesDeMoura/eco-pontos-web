import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';

import { DialogoService, PedidoDeConfirmacao } from './dialogo.service';

const LIMITE_DA_SAIDA_MS = 400;

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'eco-dialogos',
  templateUrl: './dialogos.component.html',
  styleUrls: ['./dialogos.component.scss'],
})
export class DialogosComponent implements OnInit, OnDestroy {
  pedido: PedidoDeConfirmacao | null = null;
  saindo = false;

  @ViewChild('janela') private janela?: ElementRef<HTMLElement>;
  @ViewChild('botaoCancelar', { read: ElementRef }) private botaoCancelar?: ElementRef<HTMLButtonElement>;

  private inscricao?: Subscription;
  private origem: HTMLElement | null = null;
  private fimDaSaida?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly dialogos: DialogoService,
    private readonly mudancas: ChangeDetectorRef,
    private readonly elemento: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  ngOnInit(): void {
    this.inscricao = this.dialogos.atual.subscribe((pedido) => (pedido ? this.abrir(pedido) : this.sair()));
  }

  ngOnDestroy(): void {
    this.inscricao?.unsubscribe();
    clearTimeout(this.fimDaSaida);
  }

  responder(confirmado: boolean): void {
    this.dialogos.responder(confirmado);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (!this.pedido || this.saindo) {
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.responder(false);
      return;
    }
    if (evento.key !== 'Tab') {
      return;
    }
    const focaveis = Array.from(this.janela?.nativeElement.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
    if (focaveis.length === 0) {
      return;
    }
    const atual = focaveis.indexOf(this.documento.activeElement as HTMLElement);
    const ultimo = focaveis.length - 1;
    const proximo =
      atual < 0 ? (evento.shiftKey ? ultimo : 0) : (atual + (evento.shiftKey ? ultimo : 1)) % focaveis.length;
    evento.preventDefault();
    focaveis[proximo].focus();
  }

  aoTerminarAnimacao(evento: AnimationEvent): void {
    if (this.saindo && evento.target === evento.currentTarget) {
      this.concluirSaida();
    }
  }

  private abrir(pedido: PedidoDeConfirmacao): void {
    clearTimeout(this.fimDaSaida);
    const ativo = this.documento.activeElement;
    const foraDoDialogo =
      ativo instanceof HTMLElement && ativo !== this.documento.body && !this.elemento.nativeElement.contains(ativo);
    if (foraDoDialogo) {
      this.origem = ativo;
    } else if (!this.pedido) {
      this.origem = null;
    }
    this.pedido = pedido;
    this.saindo = false;
    this.mudancas.detectChanges();
    this.botaoCancelar?.nativeElement.focus();
  }

  private sair(): void {
    if (!this.pedido || this.saindo) {
      return;
    }
    this.saindo = true;
    this.fimDaSaida = setTimeout(() => this.concluirSaida(), LIMITE_DA_SAIDA_MS);
  }

  private concluirSaida(): void {
    clearTimeout(this.fimDaSaida);
    if (!this.saindo) {
      return;
    }
    this.pedido = null;
    this.saindo = false;
    this.mudancas.detectChanges();
    if (this.origem?.isConnected) {
      this.origem.focus();
    }
    this.origem = null;
  }
}
