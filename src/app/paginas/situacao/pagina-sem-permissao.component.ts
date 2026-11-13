import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ROTA } from '../../rotas';

@Component({
  selector: 'eco-pagina-sem-permissao',
  template: `
    <main class="conteudo situacao">
      <h1 class="situacao__titulo">Sem permissão</h1>
      <p class="situacao__texto">Esta tela é só para administradores.</p>
      <a eco-botao class="situacao__acao" tipo="secundario" [routerLink]="busca">Voltar à busca</a>
    </main>
  `,
  styleUrls: ['./situacao.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginaSemPermissaoComponent {
  readonly busca = ROTA.pontos;
}
