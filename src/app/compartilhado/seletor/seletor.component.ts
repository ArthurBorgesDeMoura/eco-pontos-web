import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { indiceDaTecla, indicePorBusca } from '../teclado';

export interface OpcaoDoSeletor {
  valor: unknown;
  rotulo: string;
}

let proximoId = 1;

const PAUSA_DA_BUSCA_MS = 500;

@Component({
  selector: 'eco-seletor',
  templateUrl: './seletor.component.html',
  styleUrls: ['./seletor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SeletorComponent), multi: true }],
})
export class SeletorComponent implements ControlValueAccessor, OnDestroy {
  @Input() rotulo = '';
  @Input() opcoes: readonly OpcaoDoSeletor[] = [];
  @Input() marcador = 'Selecione';
  @Input() erro?: string | null;
  @Input() obrigatorio = false;
  @Input() estadoForcado: 'foco' | 'aberto' | null = null;

  @ViewChild('caixa') private caixa?: ElementRef<HTMLElement>;
  @ViewChild('lista') private lista?: ElementRef<HTMLElement>;

  readonly id = `seletor-${proximoId++}`;
  valor: unknown = null;
  aberto = false;
  ativo = -1;
  desativado = false;

  private busca = '';
  private relogioDaBusca?: ReturnType<typeof setTimeout>;
  private aoMudar: (valor: unknown) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  constructor(private readonly mudancas: ChangeDetectorRef) {}

  get menuAberto(): boolean {
    return this.aberto || this.estadoForcado === 'aberto';
  }

  get indiceSelecionado(): number {
    return this.opcoes.findIndex((opcao) => opcao.valor === this.valor);
  }

  get rotuloSelecionado(): string | null {
    return this.opcoes[this.indiceSelecionado]?.rotulo ?? null;
  }

  ngOnDestroy(): void {
    clearTimeout(this.relogioDaBusca);
  }

  writeValue(valor: unknown): void {
    this.valor = valor ?? null;
    this.mudancas.markForCheck();
  }

  registerOnChange(funcao: (valor: unknown) => void): void {
    this.aoMudar = funcao;
  }

  registerOnTouched(funcao: () => void): void {
    this.aoTocar = funcao;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desativado = desabilitado;
    if (desabilitado) {
      this.aberto = false;
    }
    this.mudancas.markForCheck();
  }

  alternar(): void {
    if (this.aberto) {
      this.fechar();
    } else {
      this.abrir();
    }
  }

  abrir(indice = Math.max(this.indiceSelecionado, 0)): void {
    if (this.desativado || this.opcoes.length === 0) {
      return;
    }
    this.aberto = true;
    this.ativo = indice;
    this.mudancas.detectChanges();
    this.mostrarAtivo();
  }

  fechar(): void {
    this.aberto = false;
  }

  escolher(indice: number): void {
    const opcao = this.opcoes[indice];
    if (!opcao) {
      return;
    }
    this.valor = opcao.valor;
    this.aoMudar(opcao.valor);
    this.fechar();
    this.caixa?.nativeElement.focus();
  }

  aoSair(): void {
    this.fechar();
    this.aoTocar();
  }

  aoTeclar(evento: KeyboardEvent): void {
    const tecla = evento.key;
    if (this.desativado) {
      return;
    }
    const letra = ehLetra(tecla) && !evento.ctrlKey && !evento.altKey && !evento.metaKey;
    if (!this.aberto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(tecla)) {
        evento.preventDefault();
        const ultimo = this.opcoes.length - 1;
        this.abrir(tecla === 'Home' ? 0 : tecla === 'End' || (tecla === 'ArrowUp' && this.indiceSelecionado < 0) ? ultimo : undefined);
      } else if (letra) {
        this.buscar(tecla);
      }
      return;
    }
    if (tecla === 'Escape') {
      evento.preventDefault();
      this.fechar();
      return;
    }
    if (tecla === 'Enter' || tecla === ' ') {
      evento.preventDefault();
      this.escolher(this.ativo);
      return;
    }
    if (tecla === 'Tab') {
      if (this.ativo >= 0 && this.ativo !== this.indiceSelecionado) {
        this.valor = this.opcoes[this.ativo].valor;
        this.aoMudar(this.valor);
      }
      this.fechar();
      return;
    }
    const proximo = indiceDaTecla(tecla, this.ativo, this.opcoes.length, { orientacao: 'vertical', circular: false });
    if (proximo !== null) {
      evento.preventDefault();
      this.ativo = proximo;
      this.mostrarAtivo();
    } else if (letra) {
      this.buscar(tecla);
    }
  }

  private buscar(letra: string): void {
    clearTimeout(this.relogioDaBusca);
    this.busca += letra;
    this.relogioDaBusca = setTimeout(() => (this.busca = ''), PAUSA_DA_BUSCA_MS);
    const repetida = [...this.busca].every((letra) => letra === this.busca[0]);
    const termo = repetida ? this.busca[0] : this.busca;
    const partida = !repetida ? this.ativo - 1 : this.aberto ? this.ativo : this.indiceSelecionado;
    const indice = indicePorBusca(
      this.opcoes.map((opcao) => opcao.rotulo),
      termo,
      partida,
    );
    if (indice < 0) {
      return;
    }
    if (this.aberto) {
      this.ativo = indice;
      this.mostrarAtivo();
    } else {
      this.abrir(indice);
    }
  }

  private mostrarAtivo(): void {
    const opcao = this.lista?.nativeElement.querySelector<HTMLElement>(`#${this.id}-opcao-${this.ativo}`);
    opcao?.scrollIntoView({ block: 'nearest' });
  }
}

function ehLetra(tecla: string): boolean {
  return tecla.length === 1 && tecla.trim() !== '';
}
