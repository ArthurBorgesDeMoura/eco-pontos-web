import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PONTOS_POR_PAGINA, PontosService } from './pontos.service';

describe('PontosService', () => {
  let pontos: PontosService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    pontos = TestBed.inject(PontosService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pede GET /api/pontos com 7 por página (DA-6) e os filtros escolhidos', () => {
    pontos.listar({ bairro: 4, categoria: 6 }, 2).subscribe();
    const pedido = backend.expectOne((req) => req.url === '/api/pontos');

    expect(PONTOS_POR_PAGINA).toBe(7);
    expect(pedido.request.params.get('tamanho')).toBe('7');
    expect(pedido.request.params.get('pagina')).toBe('2');
    expect(pedido.request.params.get('bairro')).toBe('4');
    expect(pedido.request.params.get('categoria')).toBe('6');
    pedido.flush({ itens: [], total: 0, pagina: 2, tamanho: 7 });
  });

  it('filtro "todos" não vai para a URL', () => {
    pontos.listar({ bairro: null, categoria: null }).subscribe();
    const pedido = backend.expectOne((req) => req.url === '/api/pontos');

    expect(pedido.request.params.has('bairro')).toBeFalse();
    expect(pedido.request.params.has('categoria')).toBeFalse();
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush({ itens: [], total: 0, pagina: 1, tamanho: 7 });
  });
});
