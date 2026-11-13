import { TestBed } from '@angular/core/testing';

import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

describe('RetornoDaEdicaoService', () => {
  let retornos: RetornoDaEdicaoService;

  beforeEach(() => {
    retornos = TestBed.inject(RetornoDaEdicaoService);
  });

  it('devolve a lista como estava, na mesma posição do histórico e na mesma aba, uma vez só', () => {
    retornos.guardar(3, { aba: 'pontos', carregados: 14, id: 8 });
    expect(retornos.retomar(3, 'pontos')).toEqual({ aba: 'pontos', carregados: 14, id: 8 });
    expect(retornos.retomar(3, 'pontos')).toBeNull();
  });

  it('em outra posição do histórico (o painel aberto por outro caminho), começa do zero', () => {
    retornos.guardar(3, { aba: 'pontos', carregados: 14, id: 8 });
    expect(retornos.retomar(5, 'pontos')).toBeNull();
    expect(retornos.retomar(3, 'pontos')).toBeNull();
  });

  it('o retorno de uma aba não vale para a outra', () => {
    retornos.guardar(3, { aba: 'categorias', carregados: 0, id: null });
    expect(retornos.retomar(3, 'pontos')).toBeNull();
  });

  it('a categoria nova, salva, passa a ser o foco da volta', () => {
    retornos.guardar(3, { aba: 'categorias', carregados: 0, id: null });
    retornos.definirId(11);
    expect(retornos.retomar(3, 'categorias')).toEqual({ aba: 'categorias', carregados: 0, id: 11 });
    retornos.definirId(12);
    expect(retornos.retomar(3, 'categorias')).toBeNull();
  });
});
