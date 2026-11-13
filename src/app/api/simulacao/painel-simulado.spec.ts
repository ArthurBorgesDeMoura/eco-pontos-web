import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService, Parametros } from '../api.service';
import { ErroApi } from '../erro-api';
import { PaginaDePontos, PaginaDeSugestoes, PaginaDoPainel, PontoDetalhe, PontoDoPainel, ResumoDoPainel } from '../modelos';
import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

const ADMIN = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };
const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const CORU = 'Cooperativa dos Recicladores de Uberlândia (CORU)';

describe('Painel simulado (BE-12 e BE-13)', () => {
  let api: ApiService;

  beforeEach(() => {
    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    api = TestBed.inject(ApiService);
  });

  afterEach(() => sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA));

  function entrarComo(usuario: object): void {
    sessionStorage.setItem(CHAVE_DA_SESSAO_SIMULADA, JSON.stringify(usuario));
  }

  type Metodo = 'get' | 'post' | 'put' | 'delete';

  function pedir<T>(metodo: Metodo, rota: string, parametros?: Parametros, corpo?: unknown): { corpo?: T; erro?: ErroApi; respondeu: boolean } {
    const resultado: { corpo?: T; erro?: ErroApi; respondeu: boolean } = { respondeu: false };
    const pedido =
      metodo === 'get'
        ? api.get<T>(rota, parametros)
        : metodo === 'post'
          ? api.post<T>(rota)
          : metodo === 'put'
            ? api.put<T>(rota, corpo ?? {})
            : api.delete<T>(rota);
    pedido.subscribe({
      next: (resposta) => {
        resultado.corpo = resposta;
        resultado.respondeu = true;
      },
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  function corpoDoBretas(mudancas: object = {}): object {
    return { nome: 'Bretas - Loja 518', endereco: 'Av. João Pinheiro, 77', idBairro: 4, horario: null, contato: null, categorias: [7], ...mudancas };
  }

  function nomesDaBusca(): string[] {
    return pedir<PaginaDePontos>('get', 'pontos', { tamanho: 50 }).corpo?.itens.map((ponto) => ponto.nome) ?? [];
  }

  it('o resumo começa com 2 pendentes, 13 pontos e 10 categorias', fakeAsync(() => {
    entrarComo(ADMIN);
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 2, pontos: 13, categorias: 10 });
  }));

  it('a fila traz os dois pendentes, do mais antigo para o mais novo, com quem sugeriu', fakeAsync(() => {
    entrarComo(ADMIN);
    const fila = pedir<PaginaDoPainel>('get', 'admin/pontos').corpo;
    expect(fila?.total).toBe(2);
    expect(fila?.itens.map((ponto) => [ponto.idPonto, ponto.nome, ponto.status, ponto.sugeridoPor.nome])).toEqual([
      [14, 'Ecoponto Daniel Fonseca', 'PENDENTE', 'João Pereira'],
      [15, CORU, 'PENDENTE', 'Maria Souza'],
    ]);
    const daniel = fila?.itens[0];
    expect(daniel?.horario).toBe('7h às 19h, todos os dias');
    expect(daniel?.contato).toBeNull();
    expect(daniel?.bairro.nome).toBe('Daniel Fonseca');
    expect(daniel?.materiais.map((material) => material.nome)).toEqual([
      'Papel e papelão',
      'Plástico',
      'Metal',
      'Vidro',
      'Entulho e volumosos',
    ]);
    expect(Object.keys(daniel?.sugeridoPor ?? {})).toEqual(['idUsuario', 'nome']);
  }));

  it('a fila aceita status, pagina e tamanho; status fora da lista dá 400', fakeAsync(() => {
    entrarComo(ADMIN);
    expect(pedir<PaginaDoPainel>('get', 'admin/pontos', { status: 'APROVADO', pagina: 2, tamanho: 7 }).corpo?.itens.length).toBe(6);
    expect(pedir<PaginaDoPainel>('get', 'admin/pontos', { status: 'RECUSADO' }).corpo?.total).toBe(0);
    expect(pedir('get', 'admin/pontos', { status: 'TUDO' }).erro?.status).toBe(400);
    expect(pedir('get', 'admin/pontos', { tamanho: 0 }).erro?.status).toBe(400);
  }));

  it('aprovar publica o ponto: sai da fila, aparece na busca e o resumo vai a 1, 14 e 10', fakeAsync(() => {
    entrarComo(ADMIN);
    const aprovado = pedir<PontoDoPainel>('post', 'admin/pontos/14/aprovar').corpo;
    expect(aprovado?.status).toBe('APROVADO');
    expect(aprovado?.nome).toBe('Ecoponto Daniel Fonseca');

    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 1, pontos: 14, categorias: 10 });
    expect(pedir<PaginaDoPainel>('get', 'admin/pontos').corpo?.itens.map((ponto) => ponto.idPonto)).toEqual([15]);
    const busca = pedir<PaginaDePontos>('get', 'pontos', { tamanho: 50 }).corpo;
    expect(busca?.total).toBe(14);
    expect(busca?.itens.some((ponto) => ponto.idPonto === 14)).toBeTrue();
    expect(pedir('get', 'pontos/14').corpo).toBeDefined();
  }));

  it('recusar tira da fila sem publicar, e o autor vê RECUSADO em Minhas sugestões', fakeAsync(() => {
    entrarComo(ADMIN);
    expect(pedir<PontoDoPainel>('post', 'admin/pontos/15/recusar').corpo?.status).toBe('RECUSADO');
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 1, pontos: 13, categorias: 10 });
    expect(pedir<PaginaDePontos>('get', 'pontos', { tamanho: 50 }).corpo?.itens.some((ponto) => ponto.idPonto === 15)).toBeFalse();

    entrarComo(MARIA);
    expect(pedir('get', 'pontos/15').erro?.status).toBe(404);
    const daMaria = pedir<PaginaDeSugestoes>('get', 'minhas-sugestoes', { status: 'RECUSADO' }).corpo;
    expect(daMaria?.itens.map((item) => [item.nome, item.status])).toEqual([[CORU, 'RECUSADO']]);
  }));

  it('decidir de novo um ponto já decidido responde 409; id que não existe, 404; id inválido, 400', fakeAsync(() => {
    entrarComo(ADMIN);
    pedir('post', 'admin/pontos/14/aprovar');
    const deNovo = pedir('post', 'admin/pontos/14/recusar').erro;
    expect(deNovo?.status).toBe(409);
    expect(deNovo?.mensagem).toBe('Esta sugestão já foi analisada.');
    expect(pedir('post', 'admin/pontos/14/aprovar').erro?.status).toBe(409);
    expect(pedir('post', 'admin/pontos/1/recusar').erro?.status).toBe(409);
    expect(pedir('post', 'admin/pontos/999/aprovar').erro?.status).toBe(404);
    expect(pedir('post', 'admin/pontos/abc/aprovar').erro?.status).toBe(400);
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 1, pontos: 14, categorias: 10 });
  }));

  it('os aprovados vêm na ordem padrão (bairro, nome, id), como na D14', fakeAsync(() => {
    entrarComo(ADMIN);
    const aprovados = pedir<PaginaDoPainel>('get', 'admin/pontos', { status: 'APROVADO', tamanho: 8 }).corpo;
    expect(aprovados?.total).toBe(13);
    expect(aprovados?.itens.map((ponto) => ponto.nome)).toEqual([
      'Drogaria São Paulo - DSP Uberlândia III',
      'Pão de Açúcar',
      'Drogasil - Uberlândia 14',
      'Bretas - Loja 518',
      'Casas Bahia',
      'Drogasil - Uberlândia 11',
      'Ecoponto Luizote de Freitas',
      'Atacadão',
    ]);
  }));

  it('editar (BE-13) troca os dados e os materiais, e a busca e o detalhe mostram o novo; status e autor do corpo não contam', fakeAsync(() => {
    entrarComo(ADMIN);
    const editado = pedir<PontoDetalhe>(
      'put',
      'admin/pontos/4',
      undefined,
      corpoDoBretas({ nome: '  Bretas - Centro ', horario: ' 8h às 22h ', contato: '', categorias: [7, 6], status: 'RECUSADO', idUsuario: 2 }),
    ).corpo;
    expect(editado?.nome).toBe('Bretas - Centro');
    expect(editado?.horario).toBe('8h às 22h');
    expect(editado?.contato).toBeNull();
    expect(editado?.materiais.map((material) => material.idCategoria)).toEqual([6, 7]);

    const aprovados = pedir<PaginaDoPainel>('get', 'admin/pontos', { status: 'APROVADO', tamanho: 50 }).corpo;
    const naLista = aprovados?.itens.find((ponto) => ponto.idPonto === 4);
    expect(naLista?.status).toBe('APROVADO');
    expect(naLista?.sugeridoPor.nome).toBe('Administrador EcoPonto');
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 2, pontos: 13, categorias: 10 });

    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    expect(nomesDaBusca()).toContain('Bretas - Centro');
    expect(nomesDaBusca()).not.toContain('Bretas - Loja 518');
    expect(pedir<PontoDetalhe>('get', 'pontos/4').corpo?.nome).toBe('Bretas - Centro');
  }));

  it('editar com dados inválidos responde 400 com o erro de cada campo e não muda nada', fakeAsync(() => {
    entrarComo(ADMIN);
    const erro = pedir('put', 'admin/pontos/4', undefined, corpoDoBretas({ nome: '   ', idBairro: 99, categorias: [] })).erro;
    expect(erro?.status).toBe(400);
    expect(Object.keys(erro?.campos ?? {}).sort()).toEqual(['categorias', 'idBairro', 'nome']);
    expect(pedir<PontoDetalhe>('get', 'pontos/4').corpo?.nome).toBe('Bretas - Loja 518');
    expect(pedir('put', 'admin/pontos/999', undefined, corpoDoBretas()).erro?.status).toBe(404);
    expect(pedir('put', 'admin/pontos/abc', undefined, corpoDoBretas()).erro?.status).toBe(400);
  }));

  it('excluir o Bretas - Loja 518 responde 204 e deixa 12 aprovados; ele some da busca, e excluir de novo dá 404', fakeAsync(() => {
    entrarComo(ADMIN);
    const exclusao = pedir('delete', 'admin/pontos/4');
    expect(exclusao.erro).toBeUndefined();
    expect(exclusao.respondeu).toBeTrue();
    expect(exclusao.corpo).toBeNull();

    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 2, pontos: 12, categorias: 10 });
    expect(pedir<PaginaDoPainel>('get', 'admin/pontos', { status: 'APROVADO' }).corpo?.itens.map((ponto) => ponto.nome)).toEqual([
      'Drogaria São Paulo - DSP Uberlândia III',
      'Pão de Açúcar',
      'Drogasil - Uberlândia 14',
      'Casas Bahia',
      'Drogasil - Uberlândia 11',
      'Ecoponto Luizote de Freitas',
      'Atacadão',
    ]);
    expect(nomesDaBusca()).not.toContain('Bretas - Loja 518');
    expect(nomesDaBusca().length).toBe(12);
    expect(pedir('get', 'pontos/4').erro?.status).toBe(404);
    expect(pedir('delete', 'admin/pontos/4').erro?.status).toBe(404);
    expect(pedir('delete', 'admin/pontos/abc').erro?.status).toBe(400);
  }));

  it('visitante recebe 401 e usuário comum, 403, em todas as rotas do prefixo /admin', fakeAsync(() => {
    const rotas: [metodo: Metodo, rota: string][] = [
      ['get', 'admin/resumo'],
      ['get', 'admin/pontos'],
      ['post', 'admin/pontos/14/aprovar'],
      ['post', 'admin/pontos/15/recusar'],
      ['put', 'admin/pontos/4'],
      ['delete', 'admin/pontos/4'],
      ['get', 'admin/usuarios'],
    ];
    for (const [metodo, rota] of rotas) {
      expect(pedir(metodo, rota, undefined, corpoDoBretas({ nome: 'Outro' })).erro?.status).withContext(`visitante ${metodo} ${rota}`).toBe(401);
    }
    entrarComo(MARIA);
    for (const [metodo, rota] of rotas) {
      expect(pedir(metodo, rota, undefined, corpoDoBretas({ nome: 'Outro' })).erro?.status).withContext(`usuário ${metodo} ${rota}`).toBe(403);
    }
    entrarComo(ADMIN);
    expect(pedir<ResumoDoPainel>('get', 'admin/resumo').corpo).toEqual({ pendentes: 2, pontos: 13, categorias: 10 });
    expect(pedir<PontoDetalhe>('get', 'pontos/4').corpo?.nome).toBe('Bretas - Loja 518');
    spyOn(console, 'warn');
    const semRota = pedir('get', 'admin/usuarios').erro;
    expect(semRota?.status).toBe(404);
    expect(semRota?.codigo).toBe('SEM_SIMULACAO');
  }));

  it('uma sugestão enviada pela tela entra no fim da fila, com o nome de quem sugeriu', fakeAsync(() => {
    entrarComo(MARIA);
    api
      .post('pontos', { nome: 'Ecoponto Morumbi', endereco: 'Rua das Flores, 100', idBairro: 13, horario: null, contato: null, categorias: [4] })
      .subscribe();
    tick(1000);

    entrarComo(ADMIN);
    const fila = pedir<PaginaDoPainel>('get', 'admin/pontos').corpo;
    expect(fila?.itens.map((ponto) => [ponto.nome, ponto.sugeridoPor.nome])).toEqual([
      ['Ecoponto Daniel Fonseca', 'João Pereira'],
      [CORU, 'Maria Souza'],
      ['Ecoponto Morumbi', 'Maria Souza'],
    ]);
  }));
});
