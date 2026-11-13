import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';
import { ErroApi } from './erro-api';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chama a rota com o prefixo do ambiente', () => {
    let resposta: unknown;
    api.get('bairros').subscribe((corpo) => (resposta = corpo));

    const pedido = http.expectOne('/api/bairros');
    expect(pedido.request.method).toBe('GET');
    pedido.flush([{ idBairro: 1, nome: 'Altamira' }]);

    expect(resposta).toEqual([{ idBairro: 1, nome: 'Altamira' }]);
  });

  it('não leva parâmetros vazios para a URL e converte números em texto', () => {
    api.get('pontos', { bairro: 4, categoria: '', pagina: undefined, tamanho: 7 }).subscribe();
    api.get('pontos/contagem', { bairro: null }).subscribe();

    const lista = http.expectOne((req) => req.url === '/api/pontos');
    expect(lista.request.params.keys()).toEqual(['bairro', 'tamanho']);
    expect(lista.request.params.get('bairro')).toBe('4');
    expect(lista.request.params.get('tamanho')).toBe('7');
    const contagem = http.expectOne((req) => req.url === '/api/pontos/contagem');
    expect(contagem.request.params.keys()).toEqual([]);
    lista.flush({});
    contagem.flush({});
  });

  it('envia o corpo no POST e no PUT, e usa DELETE sem corpo', () => {
    api.post('pontos', { nome: 'Ecoponto Tibery' }).subscribe();
    api.put('admin/pontos/3', { nome: 'Drogasil' }).subscribe();
    api.delete('admin/pontos/3').subscribe();

    const post = http.expectOne((req) => req.method === 'POST');
    expect(post.request.withCredentials).toBeTrue();
    const put = http.expectOne((req) => req.method === 'PUT');
    const remover = http.expectOne((req) => req.method === 'DELETE');
    expect(post.request.url).toBe('/api/pontos');
    expect(post.request.body).toEqual({ nome: 'Ecoponto Tibery' });
    expect(put.request.url).toBe('/api/admin/pontos/3');
    expect(remover.request.body).toBeNull();
    post.flush({});
    put.flush({});
    remover.flush(null);
  });

  it('entrega as falhas já traduzidas em ErroApi', () => {
    let recebido: unknown;
    api.get('categorias').subscribe({ error: (erro) => (recebido = erro) });

    http
      .expectOne('/api/categorias')
      .flush({ codigo: 'NAO_AUTENTICADO', mensagem: 'Entre para continuar.' }, { status: 401, statusText: 'Unauthorized' });

    expect(recebido).toEqual(jasmine.any(ErroApi));
    expect((recebido as ErroApi).mensagem).toBe('Entre para continuar.');
  });
});
