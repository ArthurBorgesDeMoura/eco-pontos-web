import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

export type StatusDoPonto = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

const ROTULOS: Readonly<Record<StatusDoPonto, string>> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
};

@Component({
  selector: 'eco-etiqueta-status',
  template: '{{ rotulo || rotulos[status] }}',
  styleUrls: ['./etiqueta-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtiquetaStatusComponent {
  @Input() status: StatusDoPonto = 'PENDENTE';
  @Input() rotulo?: string;

  readonly rotulos = ROTULOS;

  @HostBinding('class') get classe(): string {
    return `etiqueta--${this.status.toLowerCase()}`;
  }
}
