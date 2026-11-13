import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ROTA } from '../../rotas';
import { DestinoDaBarra, PaginaDaBarra, PerfilDaBarra, destinosDoPerfil, estaLogado } from './navegacao';

@Component({
  selector: 'eco-barra-superior',
  templateUrl: './barra-superior.component.html',
  styleUrls: ['./barra-superior.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraSuperiorComponent {
  @Input() perfil: PerfilDaBarra = 'visitante';
  @Input() pagina: PaginaDaBarra | null = null;
  @Input() nome = '';
  @Output() readonly sair = new EventEmitter<void>();

  readonly rota = ROTA;

  get destinos(): readonly DestinoDaBarra[] {
    return destinosDoPerfil(this.perfil);
  }

  get logado(): boolean {
    return estaLogado(this.perfil);
  }
}
