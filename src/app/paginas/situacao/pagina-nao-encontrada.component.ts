import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ROTA } from '../../rotas';

@Component({
  selector: 'eco-pagina-nao-encontrada',
  template: `
    <main class="conteudo situacao">
      <h1 class="situacao__titulo">Página não encontrada</h1>
      <p class="situacao__texto">O endereço pode estar errado, ou a página mudou de lugar.</p>
      <a eco-botao class="situacao__acao" tipo="secundario" [routerLink]="busca">Ir para a busca</a>
    </main>
  `,
  styleUrls: ['./situacao.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginaNaoEncontradaComponent {
  readonly busca = ROTA.pontos;
}
