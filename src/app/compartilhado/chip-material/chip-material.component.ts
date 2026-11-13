import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

let proximoId = 1;

@Component({
  selector: 'eco-chip-material',
  templateUrl: './chip-material.component.html',
  styleUrls: ['./chip-material.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipMaterialComponent {
  @Input() rotulo = '';
  @Input() ligado = false;
  @Input() variante: 'filtro' | 'formulario' = 'filtro';
  @Input() desabilitado = false;
  @Output() readonly ligadoChange = new EventEmitter<boolean>();

  readonly id = `chip-material-${proximoId++}`;

  alternar(): void {
    if (!this.desabilitado) {
      this.ligado = !this.ligado;
      this.ligadoChange.emit(this.ligado);
    }
  }
}
