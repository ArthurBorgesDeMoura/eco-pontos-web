import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ErroApi } from '../api/erro-api';
import { Usuario } from '../api/modelos';
import { SessaoService, TEMPO_LIMITE_DA_SESSAO_MS, perfilDaBarra } from './sessao.service';

const MARIA: Usuario = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

describe('SessaoService', () => {
  let sessao: SessaoService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    sessao = TestBed.inject(SessaoService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('entrar envia o e-mail sem espaços nas pontas e a senha como foi digitada, e guarda quem entrou', () => {
    let vistos: (Usuario | null)[] = [];
    sessao.usuario.subscribe((usuario) => (vistos = [...vistos, usuario]));

    sessao.entrar(' maria.souza@example.com ', ' senha com espaço ').subscribe();
    const pedido = backend.expectOne('/api/auth/login');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ email: 'maria.souza@example.com', senha: ' senha com espaço ' });
    pedido.flush(MARIA);

    expect(sessao.atual).toEqual(MARIA);
    expect(vistos).toEqual([null, MARIA]);
  });

  it('login errado não muda a sessão e chega como ErroApi com a mensagem do backend', () => {
    let erro: ErroApi | undefined;
    sessao.entrar('maria.souza@example.com', 'errada').subscribe({ error: (e: ErroApi) => (erro = e) });
    backend
      .expectOne('/api/auth/login')
      .flush({ codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha incorretos.' }, { status: 401, statusText: 'Unauthorized' });

    expect(sessao.atual).toBeNull();
    expect(erro?.status).toBe(401);
    expect(erro?.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it('cadastrar envia nome, e-mail e senha e não entra sozinho (o cadastro não cria sessão)', () => {
    sessao.cadastrar('  Ana Lima ', ' ana@example.com', 'senha-segura').subscribe();
    const pedido = backend.expectOne('/api/auth/cadastro');
    expect(pedido.request.body).toEqual({ nome: 'Ana Lima', email: 'ana@example.com', senha: 'senha-segura' });
    expect(pedido.request.body).not.toEqual(jasmine.objectContaining({ perfil: jasmine.anything() }));
    pedido.flush({ idUsuario: 4, nome: 'Ana Lima', email: 'ana@example.com', perfil: 'USUARIO' }, { status: 201, statusText: 'Created' });

    expect(sessao.atual).toBeNull();
  });

  it('sair encerra a sessão no servidor e só então limpa o estado', () => {
    sessao.entrar('maria.souza@example.com', 'senha-segura').subscribe();
    backend.expectOne('/api/auth/login').flush(MARIA);

    sessao.sair().subscribe();
    expect(sessao.atual).toEqual(MARIA);
    backend.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    expect(sessao.atual).toBeNull();
  });

  it('começa carregando; GET /api/auth/eu com 200 guarda quem está logado e libera os guardas', () => {
    let confirmado: Usuario | null | undefined;
    sessao.confirmada().subscribe((usuario) => (confirmado = usuario));
    expect(sessao.estaCarregando).toBeTrue();

    sessao.carregar().subscribe();
    expect(confirmado).withContext('espera a resposta').toBeUndefined();
    const pedido = backend.expectOne('/api/auth/eu');
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.withCredentials).toBeTrue();
    pedido.flush(MARIA);

    expect(sessao.estaCarregando).toBeFalse();
    expect(sessao.atual).toEqual(MARIA);
    expect(confirmado).toEqual(MARIA);
  });

  it('GET /api/auth/eu com 401 é o visitante; sem conexão também segue como visitante', () => {
    sessao.carregar().subscribe();
    backend.expectOne('/api/auth/eu').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(sessao.estaCarregando).toBeFalse();
    expect(sessao.atual).toBeNull();

    sessao.carregar().subscribe();
    backend.expectOne('/api/auth/eu').error(new ProgressEvent('error'));
    expect(sessao.atual).toBeNull();
  });

  it('sem resposta do GET /api/auth/eu em 10 s, segue como visitante e libera as telas', fakeAsync(() => {
    let confirmado: Usuario | null | undefined;
    sessao.confirmada().subscribe((usuario) => (confirmado = usuario));
    sessao.carregar().subscribe();
    const pedido = backend.expectOne('/api/auth/eu');

    tick(TEMPO_LIMITE_DA_SESSAO_MS - 1);
    expect(sessao.estaCarregando).toBeTrue();
    tick(1);
    expect(sessao.estaCarregando).toBeFalse();
    expect(confirmado).toBeNull();
    expect(pedido.cancelled).toBeTrue();
  }));

  it('logout com 401 quer dizer sessão já encerrada: limpa o estado do mesmo jeito', () => {
    sessao.entrar('maria.souza@example.com', 'senha-segura').subscribe();
    backend.expectOne('/api/auth/login').flush(MARIA);

    let terminou = false;
    sessao.sair().subscribe({ next: () => (terminou = true) });
    backend.expectOne('/api/auth/logout').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(terminou).toBeTrue();
    expect(sessao.atual).toBeNull();
  });

  it('logout que falha por outro motivo mantém a sessão e repassa o erro', () => {
    sessao.entrar('maria.souza@example.com', 'senha-segura').subscribe();
    backend.expectOne('/api/auth/login').flush(MARIA);

    let erro: ErroApi | undefined;
    sessao.sair().subscribe({ error: (e: ErroApi) => (erro = e) });
    backend.expectOne('/api/auth/logout').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(erro?.status).toBe(503);
    expect(sessao.atual).toEqual(MARIA);
  });

  it('o perfil escolhe a variante das barras', () => {
    expect(perfilDaBarra(null)).toBe('visitante');
    expect(perfilDaBarra(MARIA)).toBe('usuario');
    expect(perfilDaBarra({ ...MARIA, perfil: 'ADMIN' })).toBe('administrador');
  });
});
