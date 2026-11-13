import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { NovaSugestao } from '../../api/modelos';
import { PontosService } from '../../api/pontos.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { ROTA } from '../../rotas';
import { FormularioDoPontoComponent } from '../formulario-ponto/formulario-ponto.component';

export const AVISO_DE_SUGESTAO_ENVIADA = 'Sugestão enviada. Ela fica pendente até a análise.';

@Component({
  selector: 'eco-pagina-sugerir',
  templateUrl: './pagina-sugerir.component.html',
  styleUrls: ['../formulario-ponto/pagina-do-formulario.scss'],
})
export class PaginaSugerirComponent {
  @ViewChild(FormularioDoPontoComponent) private formulario?: FormularioDoPontoComponent;

  readonly sugerir = (corpo: NovaSugestao): Observable<unknown> => this.pontos.sugerir(corpo);

  constructor(
    private readonly pontos: PontosService,
    private readonly avisos: AvisoService,
    private readonly historico: HistoricoService,
    private readonly router: Router,
  ) {}

  irParaMinhasSugestoes(): void {
    this.avisos.mostrar(AVISO_DE_SUGESTAO_ENVIADA);
    this.router.navigateByUrl(ROTA.minhasSugestoes).then(
      (navegou) => {
        if (!navegou) {
          this.formulario?.liberar();
        }
      },
      () => this.formulario?.liberar(),
    );
  }

  cancelar(): void {
    this.historico.voltar(ROTA.pontos);
  }
}
