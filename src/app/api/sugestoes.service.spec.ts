import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PaginaDeSugestoes } from './modelos';
import { SugestoesService } from './sugestoes.service';

describe('SugestoesService', () => {
  let servico: SugestoesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    servico = TestBed.inject(SugestoesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pede o status da aba e 7 por página; sem status, não manda o parâmetro', () => {
    servico.minhas('RECUSADO', 2).subscribe();
    const pedido = backend.expectOne((req) => req.url === '/api/minhas-sugestoes');
    expect(pedido.request.params.get('status')).toBe('RECUSADO');
    expect(pedido.request.params.get('pagina')).toBe('2');
    expect(pedido.request.params.get('tamanho')).toBe('7');
    pedido.flush({ itens: [], total: 0, pagina: 2, tamanho: 7 });

    servico.minhas(null).subscribe();
    const todas = backend.expectOne((req) => req.url === '/api/minhas-sugestoes');
    expect(todas.request.params.has('status')).toBeFalse();
    todas.flush({ itens: [], total: 0, pagina: 1, tamanho: 7 });
  });

  it('se o backend devolver só a lista, ela vira uma página única, e a aba não fica em branco', () => {
    let pagina: PaginaDeSugestoes | undefined;
    servico.minhas(null).subscribe((resposta) => (pagina = resposta));
    backend.expectOne((req) => req.url === '/api/minhas-sugestoes').flush([{ idPonto: 15 }, { idPonto: 16 }]);
    expect(pagina?.total).toBe(2);
    expect(pagina?.pagina).toBe(1);
    expect(pagina?.itens.length).toBe(2);
  });
});
