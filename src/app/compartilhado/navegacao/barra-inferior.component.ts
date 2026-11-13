import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

import { DestinoDaBarra, PaginaDaBarra, PerfilDaBarra, destinosDoPerfil } from './navegacao';

@Component({
  selector: 'eco-barra-inferior',
  templateUrl: './barra-inferior.component.html',
  styleUrls: ['./barra-inferior.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraInferiorComponent {
  @Input() perfil: PerfilDaBarra = 'usuario';
  @Input() pagina: PaginaDaBarra | null = null;

  get destinos(): readonly DestinoDaBarra[] {
    return destinosDoPerfil(this.perfil);
  }

  @HostBinding('hidden') get escondida(): boolean {
    return this.perfil !== 'usuario' && this.perfil !== 'administrador';
  }
}
