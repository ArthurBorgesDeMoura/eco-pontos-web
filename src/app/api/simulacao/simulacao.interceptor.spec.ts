import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService } from '../api.service';
import { ErroApi } from '../erro-api';
import { Bairro, Categoria } from '../modelos';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

describe('SimulacaoInterceptor', () => {
  let api: ApiService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PROVEDOR_DA_SIMULACAO],
    });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('responde GET /api/bairros com os 20 bairros do script, de A a Z', fakeAsync(() => {
    let bairros: Bairro[] = [];
    api.get<Bairro[]>('bairros').subscribe((corpo) => (bairros = corpo));
    tick();

    const nomes = bairros.map((b) => b.nome);
    expect(bairros.length).toBe(20);
    expect(bairros[0]).toEqual({ idBairro: 1, nome: 'Altamira' });
    expect(nomes).toContain('Santa Mônica');
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  }));

  it('responde GET /api/categorias com as 10 categorias do script', fakeAsync(() => {
    let categorias: Categoria[] = [];
    api.get<Categoria[]>('categorias').subscribe((corpo) => (categorias = corpo));
    tick();

    expect(categorias.length).toBe(10);
    expect(categorias.find((c) => c.idCategoria === 8)?.nome).toBe('Óleo de cozinha usado');
  }));

  it('entrega cópias: alterar a resposta não muda a próxima', fakeAsync(() => {
    api.get<Bairro[]>('bairros').subscribe((corpo) => (corpo[0].nome = 'Alterado'));
    tick();

    let segunda: Bairro[] = [];
    api.get<Bairro[]>('bairros').subscribe((corpo) => (segunda = corpo));
    tick();

    expect(segunda[0].nome).toBe('Altamira');
  }));

  it('rota sem simulação devolve 404 no formato de erro e avisa no console', fakeAsync(() => {
    spyOn(console, 'warn');
    let erro: ErroApi | undefined;
    api.get('saude').subscribe({ error: (e: ErroApi) => (erro = e) });
    tick();

    expect(erro?.status).toBe(404);
    expect(erro?.codigo).toBe('SEM_SIMULACAO');
    expect(erro?.mensagem).toBe('Esta rota ainda não tem resposta simulada.');
    expect(console.warn).toHaveBeenCalled();
  }));

  it('deixa passar o que não é chamada da API', () => {
    let sprite = '';
    TestBed.inject(HttpClient)
      .get('/assets/icones.svg', { responseType: 'text' })
      .subscribe((texto) => (sprite = texto));
    TestBed.inject(HttpClient).get('/apiario').subscribe();

    backend.expectOne('/assets/icones.svg').flush('<svg></svg>');
    expect(sprite).toBe('<svg></svg>');
    expect(backend.match('/apiario').length).toBe(1);
  });
});
