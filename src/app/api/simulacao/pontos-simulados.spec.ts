import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService, Parametros } from '../api.service';
import { ErroApi } from '../erro-api';
import { ContagemDePontos, PaginaDePontos } from '../modelos';
import { PontosService } from '../pontos.service';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

const ORDEM_ESPERADA = [
  'Drogaria São Paulo - DSP Uberlândia III',
  'Pão de Açúcar',
  'Drogasil - Uberlândia 14',
  'Bretas - Loja 518',
  'Casas Bahia',
  'Drogasil - Uberlândia 11',
  'Ecoponto Luizote de Freitas',
  'Atacadão',
  'Loja Elétrica',
  'Estação de Reciclagem - Parque do Sabiá',
  'Bahamas Mix',
  'Dmae - Núcleo de Coleta Seletiva',
  'Estação de Reciclagem - Teatro Municipal',
];

describe('GET /pontos simulado e PontosService', () => {
  let api: ApiService;
  let pontos: PontosService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    api = TestBed.inject(ApiService);
    pontos = TestBed.inject(PontosService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function buscar(parametros: Parametros): { pagina?: PaginaDePontos; erro?: ErroApi } {
    const resultado: { pagina?: PaginaDePontos; erro?: ErroApi } = {};
    api.get<PaginaDePontos>('pontos', parametros).subscribe({
      next: (pagina) => (resultado.pagina = pagina),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  it('sem filtro, traz os 13 aprovados em ordem de bairro e nome, e nenhum pendente', fakeAsync(() => {
    const { pagina } = buscar({ tamanho: 50 });

    expect(pagina?.total).toBe(13);
    expect(pagina?.itens.map((ponto) => ponto.nome)).toEqual(ORDEM_ESPERADA);
    expect(pagina?.itens.map((ponto) => ponto.nome)).not.toContain('Ecoponto Daniel Fonseca');
  }));

  it('cada ponto vem com o bairro e os materiais em ordem de id', fakeAsync(() => {
    const luizote = buscar({ tamanho: 50 }).pagina?.itens.find((ponto) => ponto.idPonto === 13);

    expect(luizote).toEqual({
      idPonto: 13,
      nome: 'Ecoponto Luizote de Freitas',
      endereco: 'Rua Wilson Gonçalves de Souza, 10',
      bairro: { idBairro: 11, nome: 'Luizote de Freitas' },
      materiais: [
        { idCategoria: 1, nome: 'Papel e papelão' },
        { idCategoria: 2, nome: 'Plástico' },
        { idCategoria: 3, nome: 'Metal' },
        { idCategoria: 4, nome: 'Vidro' },
        { idCategoria: 10, nome: 'Entulho e volumosos' },
      ],
    });
  }));

  it('as páginas de 7 seguem a mesma ordem, sem repetir nem pular', fakeAsync(() => {
    const primeira = buscar({ pagina: 1, tamanho: 7 }).pagina;
    const segunda = buscar({ pagina: 2, tamanho: 7 }).pagina;

    expect(primeira?.itens.length).toBe(7);
    expect(segunda?.itens.length).toBe(6);
    expect([...(primeira?.itens ?? []), ...(segunda?.itens ?? [])].map((ponto) => ponto.nome)).toEqual(ORDEM_ESPERADA);
  }));

  it('bairro e material juntos dão a interseção; bairro sem pontos dá lista vazia com 200', fakeAsync(() => {
    expect(buscar({ bairro: 4 }).pagina?.itens.map((ponto) => ponto.nome)).toEqual(['Bretas - Loja 518', 'Casas Bahia']);
    expect(buscar({ bairro: 4, categoria: 6 }).pagina?.itens.map((ponto) => ponto.nome)).toEqual(['Casas Bahia']);

    const vazio = buscar({ bairro: 2 });
    expect(vazio.erro).toBeUndefined();
    expect(vazio.pagina?.total).toBe(0);
    expect(vazio.pagina?.itens).toEqual([]);
  }));

  it('parâmetro inválido responde 400, sem quebrar', fakeAsync(() => {
    for (const parametros of [{ bairro: 'abc' }, { categoria: '1 OR 1=1' }, { pagina: 0 }, { tamanho: 51 }]) {
      expect(buscar(parametros).erro?.status).withContext(JSON.stringify(parametros)).toBe(400);
    }
  }));

  function contar(bairro: number | null): { contagem?: ContagemDePontos; erro?: ErroApi } {
    const resultado: { contagem?: ContagemDePontos; erro?: ErroApi } = {};
    pontos.contar(bairro).subscribe({
      next: (contagem) => (resultado.contagem = contagem),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  it('contagem sem bairro: total 13 e, por material, 3, 3, 3, 3, 2, 6, 3, 2, 3 e 1 (só aprovados)', fakeAsync(() => {
    const { contagem } = contar(null);

    expect(contagem?.total).toBe(13);
    expect(contagem?.categorias.map((item) => item.quantidade)).toEqual([3, 3, 3, 3, 2, 6, 3, 2, 3, 1]);
    expect(contagem?.categorias.map((item) => item.idCategoria)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }));

  it('contagem respeita o bairro; Alto Umuarama, sem pontos, dá tudo 0', fakeAsync(() => {
    const centro = contar(4).contagem;
    expect(centro?.total).toBe(2);
    expect(centro?.categorias.find((item) => item.idCategoria === 6)?.quantidade).toBe(1);
    expect(centro?.categorias.find((item) => item.idCategoria === 7)?.quantidade).toBe(1);

    const altoUmuarama = contar(2).contagem;
    expect(altoUmuarama?.total).toBe(0);
    expect(altoUmuarama?.categorias.every((item) => item.quantidade === 0)).toBeTrue();
    expect(altoUmuarama?.categorias.length).toBe(10);
  }));

  it('PontosService pede 7 por página e não manda filtro vazio', fakeAsync(() => {
    let pagina: PaginaDePontos | undefined;
    pontos.listar({ bairro: null, categoria: 6 }, 2).subscribe((resposta) => (pagina = resposta));
    tick(1000);

    expect(pagina?.pagina).toBe(2);
    expect(pagina?.tamanho).toBe(7);
    expect(pagina?.total).toBe(6);
  }));
});
