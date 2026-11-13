import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';

import { HistoricoService } from '../historico.service';
import { ROTA } from '../../rotas';
import { PerfilDaBarra, estaLogado } from './navegacao';

@Component({
  selector: 'eco-cabecalho-celular',
  templateUrl: './cabecalho-celular.component.html',
  styleUrls: ['./cabecalho-celular.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoCelularComponent {
  @Input() tipo: 'principal' | 'interna' = 'principal';
  @Input() perfil: PerfilDaBarra = 'visitante';
  @Input() nome = '';
  @Input() titulo = '';
  @Input() rotaVoltar: string = ROTA.pontos;
  @Output() readonly voltar = new EventEmitter<void>();
  @Output() readonly conta = new EventEmitter<void>();

  readonly rota = ROTA;

  constructor(private readonly historico: HistoricoService) {}

  @HostBinding('class.cabecalho--interna') get interna(): boolean {
    return this.tipo === 'interna';
  }

  get logado(): boolean {
    return estaLogado(this.perfil);
  }

  aoVoltar(): void {
    if (this.voltar.observed) {
      this.voltar.emit();
      return;
    }
    this.historico.voltar(this.rotaVoltar);
  }
}
