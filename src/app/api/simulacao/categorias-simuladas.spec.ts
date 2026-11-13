import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService, Parametros } from '../api.service';
import { ErroApi } from '../erro-api';
import { Categoria, CategoriaDoPainel, ContagemDePontos, PaginaDeCategorias, PontoDetalhe, ResumoDoPainel } from '../modelos';
import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

describe('Categorias simuladas (BE-14)', () => {
  let api: ApiService;

  beforeEach(() => {
    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    api = TestBed.inject(ApiService);
  });

  afterEach(() => sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA));

  function entrarComo(usuario: object | null): void {
    if (usuario) {
      sessionStorage.setItem(CHAVE_DA_SESSAO_SIMULADA, JSON.stringify(usuario));
    } else {
      sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    }
  }

  function pedir<T>(
    metodo: 'get' | 'post' | 'put',
    rota: string,
    corpo?: unknown,
    parametros?: Parametros,
  ): { corpo?: T; erro?: ErroApi } {
    const resultado: { corpo?: T; erro?: ErroApi } = {};
    const pedido =
      metodo === 'get' ? api.get<T>(rota, parametros) : metodo === 'post' ? api.post<T>(rota, corpo) : api.put<T>(rota, corpo);
    pedido.subscribe({ next: (resposta) => (resultado.corpo = resposta), error: (erro: ErroApi) => (resultado.erro = erro) });
    tick(1000);
    return resultado;
  }

  function lista(): CategoriaDoPainel[] {
    return pedir<PaginaDeCategorias>('get', 'admin/categorias', undefined, { tamanho: 50 }).corpo?.itens ?? [];
  }

  it('a lista traz as 10 do script, em ordem de id, com os pontos APROVADOS de cada uma (D16)', fakeAsync(() => {
    entrarComo(ADMIN);
    const pagina = pedir<PaginaDeCategorias>('get', 'admin/categorias', undefined, { tamanho: 50 }).corpo;
    expect(pagina?.total).toBe(10);
    expect(pagina?.itens.map((categoria) => [categoria.nome, categoria.pontos])).toEqual([
      ['Papel e papelão', 3],
      ['Plástico', 3],
      ['Metal', 3],
      ['Vidro', 3],
      ['Eletrônicos', 2],
      ['Pilhas e baterias', 6],
      ['Lâmpadas', 3],
      ['Óleo de cozinha usado', 2],
      ['Medicamentos vencidos', 3],
      ['Entulho e volumosos', 1],
    ]);
    expect(pagina?.itens[9].descricao).toBe('Restos de obra de pequenos geradores, madeira, podas, sofás e armários.');
    expect(pedir('get', 'admin/categorias', undefined, { tamanho: 51 }).erro?.status).toBe(400);
  }));

  it('criar uma categoria a põe na lista com 0 pontos, na lista pública, na contagem da busca e no resumo', fakeAsync(() => {
    entrarComo(ADMIN);
    const criada = pedir<CategoriaDoPainel>('post', 'admin/categorias', { nome: '  Isopor ', descricao: '   ' }).corpo;
    expect(criada).toEqual({ idCategoria: 11, nome: 'Isopor', descricao: null, pontos: 0 });
    expect(lista().map((categoria) => categoria.nome)[10]).toBe('Isopor');
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo?.categorias).toBe(11);

    entrarComo(null);
    expect(pedir<Categoria[]>('get', 'categorias').corpo?.map((categoria) => categoria.nome)).toContain('Isopor');
    const contagem = pedir<ContagemDePontos>('get', 'pontos/contagem').corpo;
    expect(contagem?.categorias.find((item) => item.idCategoria === 11)?.quantidade).toBe(0);
  }));

  it('editar muda nome e descrição sem mudar o id nem os pontos ligados', fakeAsync(() => {
    entrarComo(ADMIN);
    const editada = pedir<CategoriaDoPainel>('put', 'admin/categorias/6', {
      nome: 'Pilhas, baterias e carregadores',
      descricao: 'Pilhas, baterias e carregadores sem uso.',
    }).corpo;
    expect(editada).toEqual({
      idCategoria: 6,
      nome: 'Pilhas, baterias e carregadores',
      descricao: 'Pilhas, baterias e carregadores sem uso.',
      pontos: 6,
    });
    entrarComo(null);
    const detalhe = pedir<PontoDetalhe>('get', 'pontos/1').corpo;
    expect(detalhe?.materiais.map((material) => material.nome)).toContain('Pilhas, baterias e carregadores');
    expect(pedir<{ total: number }>('get', 'pontos', undefined, { categoria: 6 }).corpo?.total).toBe(6);
    entrarComo(ADMIN);
    expect(pedir('put', 'admin/categorias/6', { nome: 'pilhas, baterias e carregadores', descricao: null }).erro).toBeUndefined();
  }));

  it('nome repetido (sem diferenciar maiúsculas nem acentos) responde 409 no campo nome; nada muda', fakeAsync(() => {
    entrarComo(ADMIN);
    for (const nome of ['Plástico', 'plástico', 'PLASTICO', '  plastico  ']) {
      const erro = pedir('post', 'admin/categorias', { nome, descricao: null }).erro;
      expect(erro?.status).withContext(nome).toBe(409);
      expect(erro?.campos['nome']).withContext(nome).toBe('Já existe uma categoria com este nome.');
    }
    expect(pedir('put', 'admin/categorias/1', { nome: 'Vidro', descricao: null }).erro?.status).toBe(409);
    expect(lista().length).toBe(10);
    expect(lista()[0].nome).toBe('Papel e papelão');
  }));

  it('nome vazio ou com mais de 60, ou descrição com mais de 255, responde 400 por campo', fakeAsync(() => {
    entrarComo(ADMIN);
    const vazio = pedir('post', 'admin/categorias', { nome: '   ', descricao: 'x'.repeat(256) }).erro;
    expect(vazio?.status).toBe(400);
    expect(vazio?.campos).toEqual({ nome: 'Informe o nome da categoria.', descricao: 'Use até 255 caracteres.' });
    expect(pedir('post', 'admin/categorias', { nome: 'n'.repeat(61) }).erro?.campos['nome']).toBe('Use até 60 caracteres.');
    expect(pedir('post', 'admin/categorias', { nome: 'n'.repeat(60) }).erro).toBeUndefined();
    expect(pedir('put', 'admin/categorias/999', { nome: 'Outra' }).erro?.status).toBe(404);
    expect(pedir('put', 'admin/categorias/abc', { nome: 'Outra' }).erro?.status).toBe(400);
  }));

  it('visitante recebe 401 e usuário comum, 403, nas três rotas; nada muda', fakeAsync(() => {
    const rotas: [metodo: 'get' | 'post' | 'put', rota: string][] = [
      ['get', 'admin/categorias'],
      ['post', 'admin/categorias'],
      ['put', 'admin/categorias/1'],
    ];
    for (const [usuario, status] of [
      [null, 401],
      [MARIA, 403],
    ] as const) {
      entrarComo(usuario);
      for (const [metodo, rota] of rotas) {
        expect(pedir(metodo, rota, { nome: 'Outra' }).erro?.status).withContext(`${status} ${metodo} ${rota}`).toBe(status);
      }
    }
    entrarComo(ADMIN);
    expect(lista().map((categoria) => categoria.nome)).not.toContain('Outra');
  }));
});
