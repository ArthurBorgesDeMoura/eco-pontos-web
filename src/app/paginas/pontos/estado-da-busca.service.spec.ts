import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { VersaoDosDadosService } from '../../api/versao-dos-dados.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { EstadoDaBuscaService, FotoDaBusca } from './estado-da-busca.service';

function foto(bairro: number | null, rolagem: number): FotoDaBusca {
  return {
    filtros: { bairro, categoria: null },
    pontos: [],
    total: 0,
    paginaAtual: 1,
    bairros: [],
    categorias: [],
    contagens: null,
    rolagem,
    pontoAberto: null,
  };
}

describe('EstadoDaBuscaService', () => {
  let estado: EstadoDaBuscaService;
  let eventos: Subject<unknown>;
  let posicao: number;

  beforeEach(() => {
    posicao = 0;
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: HistoricoService, useValue: { get posicao() { return posicao; } } }],
    });
    eventos = TestBed.inject(Router).events as unknown as Subject<unknown>;
    estado = TestBed.inject(EstadoDaBuscaService);
  });

  it('cada busca do histórico tem a sua foto, pela posição', () => {
    estado.guardar(0, foto(4, 400));
    estado.guardar(2, foto(null, 120));

    expect(estado.retomar(2, { bairro: null, categoria: null })?.rolagem).toBe(120);
    expect(estado.retomar(0, { bairro: 4, categoria: null })?.rolagem).toBe(400);
  });

  it('a foto é retomada uma vez só, e só com os mesmos filtros', () => {
    estado.guardar(1, foto(4, 400));
    expect(estado.retomar(1, { bairro: 4, categoria: 6 })).toBeNull();

    estado.guardar(1, foto(4, 400));
    expect(estado.retomar(1, { bairro: 4, categoria: null })).not.toBeNull();
    expect(estado.retomar(1, { bairro: 4, categoria: null })).toBeNull();
  });

  it('se o administrador mudou os dados depois da foto (uma categoria nova, um ponto editado), ela não vale mais', () => {
    estado.guardar(1, foto(4, 400));
    TestBed.inject(VersaoDosDadosService).mudou();
    expect(estado.retomar(1, { bairro: 4, categoria: null })).toBeNull();

    estado.guardar(1, foto(4, 400));
    expect(estado.retomar(1, { bairro: 4, categoria: null })?.rolagem).toBe(400);
  });

  it('uma página nova empilhada descarta as fotos dali para a frente; a volta, não', () => {
    estado.guardar(0, foto(4, 400));
    estado.guardar(2, foto(null, 120));

    posicao = 1;
    eventos.next(new NavigationStart(7, '/pontos/13', 'popstate'));
    eventos.next(new NavigationEnd(7, '/pontos/13', '/pontos/13'));
    posicao = 2;
    eventos.next(new NavigationStart(8, '/entrar', 'imperative'));
    eventos.next(new NavigationEnd(8, '/entrar', '/entrar'));

    expect(estado.retomar(2, { bairro: null, categoria: null })).toBeNull();
    expect(estado.retomar(0, { bairro: 4, categoria: null })?.rolagem).toBe(400);
  });
});
