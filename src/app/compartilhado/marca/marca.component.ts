import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { CAMINHO_SPRITE } from '../icone/icone.component';

@Component({
  selector: 'eco-marca',
  templateUrl: './marca.component.html',
  styleUrls: ['./marca.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarcaComponent {
  @Input() mostrarCidade = true;

  readonly simbolo = `${CAMINHO_SPRITE}#marca`;
}
