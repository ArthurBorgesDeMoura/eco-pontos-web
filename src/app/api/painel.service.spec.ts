import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErroApi } from './erro-api';
import { PaginaDoPainel } from './modelos';
import { PainelService } from './painel.service';
import { VersaoDosDadosService } from './versao-dos-dados.service';

describe('PainelService', () => {
  let servico: PainelService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    servico = TestBed.inject(PainelService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pede o resumo, com as credenciais da sessão', () => {
    servico.resumo().subscribe();
    const pedido = backend.expectOne('/api/admin/resumo');
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.withCredentials).toBeTrue();
    pedido.flush({ pendentes: 2, pontos: 13, categorias: 10 });
  });

  it('pede a fila PENDENTE, 7 por página', () => {
    servico.pontos('PENDENTE', 2).subscribe();
    const pedido = backend.expectOne((req) => req.url === '/api/admin/pontos');
    expect(pedido.request.params.get('status')).toBe('PENDENTE');
    expect(pedido.request.params.get('pagina')).toBe('2');
    expect(pedido.request.params.get('tamanho')).toBe('7');
    pedido.flush({ itens: [], total: 0, pagina: 2, tamanho: 7 });

    servico.pontos('PENDENTE', 1, 14).subscribe();
    const maior = backend.expectOne((req) => req.url === '/api/admin/pontos');
    expect(maior.request.params.get('tamanho')).toBe('14');
    maior.flush({ itens: [], total: 0, pagina: 1, tamanho: 14 });
  });

  it('se o backend devolver só a lista, ela vira uma página única', () => {
    let pagina: PaginaDoPainel | undefined;
    servico.pontos().subscribe((resposta) => (pagina = resposta));
    backend.expectOne((req) => req.url === '/api/admin/pontos').flush([{ idPonto: 14 }, { idPonto: 15 }]);
    expect(pagina?.total).toBe(2);
    expect(pagina?.itens.length).toBe(2);
  });

  it('aprova e recusa por POST, sem corpo (a recusa não leva motivo)', () => {
    servico.decidir(14, 'aprovar').subscribe();
    const aprovar = backend.expectOne('/api/admin/pontos/14/aprovar');
    expect(aprovar.request.method).toBe('POST');
    expect(aprovar.request.body).toBeNull();
    aprovar.flush({});

    servico.decidir(15, 'recusar').subscribe();
    const recusar = backend.expectOne('/api/admin/pontos/15/recusar');
    expect(recusar.request.method).toBe('POST');
    expect(recusar.request.body).toBeNull();
    recusar.flush({});
  });

  it('edita por PUT, com o corpo da sugestão e as credenciais da sessão', () => {
    const corpo = { nome: 'Bretas - Centro', endereco: 'Av. João Pinheiro, 77', idBairro: 4, horario: null, contato: null, categorias: [7] };
    servico.editar(4, corpo).subscribe();
    const pedido = backend.expectOne('/api/admin/pontos/4');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual(corpo);
    expect(pedido.request.withCredentials).toBeTrue();
    pedido.flush({});
  });

  it('exclui por DELETE; o 204 chega sem corpo, e o 404 chega traduzido', () => {
    let terminou = false;
    servico.excluir(4).subscribe({ complete: () => (terminou = true) });
    const pedido = backend.expectOne('/api/admin/pontos/4');
    expect(pedido.request.method).toBe('DELETE');
    expect(pedido.request.withCredentials).toBeTrue();
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    expect(terminou).toBeTrue();

    let erro: ErroApi | undefined;
    servico.excluir(4).subscribe({ error: (e: ErroApi) => (erro = e) });
    backend
      .expectOne('/api/admin/pontos/4')
      .flush({ codigo: 'NAO_ENCONTRADO', mensagem: 'Ponto não encontrado.' }, { status: 404, statusText: 'Not Found' });
    expect(erro?.status).toBe(404);
  });

  it('pede as categorias de uma vez (tamanho 50), com as credenciais; a lista solta vira uma página', () => {
    let total: number | undefined;
    servico.categorias().subscribe((pagina) => (total = pagina.total));
    const pedido = backend.expectOne((req) => req.url === '/api/admin/categorias');
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.withCredentials).toBeTrue();
    expect(pedido.request.params.get('pagina')).toBe('1');
    expect(pedido.request.params.get('tamanho')).toBe('50');
    pedido.flush([{ idCategoria: 1, nome: 'Papel e papelão', descricao: null, pontos: 3 }]);
    expect(total).toBe(1);
  });

  it('cria por POST e edita por PUT, com o nome e a descrição; o 409 do nome chega com o campo', () => {
    const corpo = { nome: 'Isopor', descricao: null };
    servico.criarCategoria(corpo).subscribe();
    const criar = backend.expectOne('/api/admin/categorias');
    expect(criar.request.method).toBe('POST');
    expect(criar.request.body).toEqual(corpo);
    criar.flush({ idCategoria: 11, ...corpo, pontos: 0 });

    let erro: ErroApi | undefined;
    servico.editarCategoria(6, corpo).subscribe({ error: (e: ErroApi) => (erro = e) });
    const editar = backend.expectOne('/api/admin/categorias/6');
    expect(editar.request.method).toBe('PUT');
    expect(editar.request.body).toEqual(corpo);
    editar.flush(
      { codigo: 'NOME_REPETIDO', mensagem: 'Já existe uma categoria com este nome.', campos: { nome: 'Já existe uma categoria com este nome.' } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(erro?.status).toBe(409);
    expect(erro?.campos['nome']).toBe('Já existe uma categoria com este nome.');
  });

  it('cada mudança, e o 404 ou o 409 de quem já mudou, muda a versão dos dados (a foto da busca deixa de valer)', () => {
    const versao = TestBed.inject(VersaoDosDadosService);
    const inicial = versao.versao;
    servico.criarCategoria({ nome: 'Isopor', descricao: null }).subscribe();
    backend.expectOne('/api/admin/categorias').flush({});
    expect(versao.versao).toBe(inicial + 1);

    servico.excluir(4).subscribe({ error: () => undefined });
    backend.expectOne('/api/admin/pontos/4').flush({ codigo: 'NAO_ENCONTRADO', mensagem: 'x' }, { status: 404, statusText: 'Not Found' });
    expect(versao.versao).toBe(inicial + 2);

    servico.decidir(14, 'aprovar').subscribe({ error: () => undefined });
    backend.expectOne('/api/admin/pontos/14/aprovar').error(new ProgressEvent('error'), { status: 0 });
    servico.categorias().subscribe();
    backend.expectOne((req) => req.url === '/api/admin/categorias').flush([]);
    expect(versao.versao).toBe(inicial + 2);
  });

  it('o 409 chega traduzido, com o status', () => {
    let erro: ErroApi | undefined;
    servico.decidir(14, 'aprovar').subscribe({ error: (e: ErroApi) => (erro = e) });
    backend
      .expectOne('/api/admin/pontos/14/aprovar')
      .flush({ codigo: 'JA_ANALISADO', mensagem: 'Esta sugestão já foi analisada.' }, { status: 409, statusText: 'Conflict' });
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro?.status).toBe(409);
  });
});
