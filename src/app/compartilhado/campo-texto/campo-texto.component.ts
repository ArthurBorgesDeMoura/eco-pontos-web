import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let proximoId = 1;

@Component({
  selector: 'eco-campo-texto',
  templateUrl: './campo-texto.component.html',
  styleUrls: ['./campo-texto.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoTextoComponent), multi: true }],
})
export class CampoTextoComponent implements ControlValueAccessor {
  @Input() rotulo = '';
  @Input() ajuda?: string | null;
  @Input() erro?: string | null;
  @Input() tipo: 'text' | 'email' | 'password' | 'tel' = 'text';
  @Input() marcador = '';
  @Input() autocomplete?: string;
  @Input() nome?: string;
  @Input() maximo?: number;
  @Input() obrigatorio = false;
  @Input() estadoForcado: 'foco' | null = null;
  @Input() set desabilitado(valor: boolean) {
    this.desativado = valor;
  }

  readonly id = `campo-texto-${proximoId++}`;
  valor = '';
  desativado = false;

  private aoMudar: (valor: string) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  constructor(private readonly mudancas: ChangeDetectorRef) {}

  get descricao(): string | null {
    if (this.erro) {
      return `${this.id}-erro`;
    }
    return this.ajuda ? `${this.id}-ajuda` : null;
  }

  writeValue(valor: string | null): void {
    this.valor = valor ?? '';
    this.mudancas.markForCheck();
  }

  registerOnChange(funcao: (valor: string) => void): void {
    this.aoMudar = funcao;
  }

  registerOnTouched(funcao: () => void): void {
    this.aoTocar = funcao;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desativado = desabilitado;
    this.mudancas.markForCheck();
  }

  aoDigitar(evento: Event): void {
    this.valor = (evento.target as HTMLInputElement).value;
    this.aoMudar(this.valor);
  }

  aoSair(): void {
    this.aoTocar();
  }
}
