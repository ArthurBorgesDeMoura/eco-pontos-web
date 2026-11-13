import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { ApiService } from '../api/api.service';
import { Usuario } from '../api/modelos';
import { PROVEDOR_DA_SESSAO_EXPIRADA } from './sessao-expirada.interceptor';
import { SessaoService } from './sessao.service';

const MARIA: Usuario = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

describe('SessaoExpiradaInterceptor', () => {
  let api: ApiService;
  let backend: HttpTestingController;
  let sessao: SessaoService;
  let router: Router;
  let urlAtual: jasmine.Spy<() => string>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [PROVEDOR_DA_SESSAO_EXPIRADA],
    });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    urlAtual = spyOnProperty(router, 'url', 'get').and.returnValue('/sugerir');

    sessao.entrar('maria.souza@example.com', 'senha-segura').subscribe();
    backend.expectOne('/api/auth/login').flush(MARIA);
  });

  afterEach(() => backend.verify());

  it('401 numa chamada comum: limpa a sessão e leva a Entrar com "sessão terminou", voltando à tela de agora', () => {
    let erro: unknown;
    api.post('pontos', { nome: 'Ponto' }).subscribe({ error: (e: unknown) => (erro = e) });
    backend.expectOne('/api/pontos').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(sessao.atual).toBeNull();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/entrar'], {
      queryParams: { voltar: '/sugerir', motivo: 'sessao' },
      replaceUrl: true,
    });
    expect(erro).withContext('o erro segue para quem chamou').toBeDefined();
  });

  it('401 nas rotas de autenticação é a resposta esperada e não mexe na sessão', () => {
    for (const rota of ['auth/login', 'auth/cadastro', 'auth/logout']) {
      api.post(rota, {}).subscribe({ error: () => undefined });
      backend.expectOne(`/api/${rota}`).flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    api.get('auth/eu').subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/eu').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(sessao.atual).toEqual(MARIA);
  });

  it('dois 401 juntos levam a Entrar uma vez só, sem perder o aviso', () => {
    (router.navigate as jasmine.Spy).and.returnValue(new Promise<boolean>(() => undefined));
    api.get('admin/resumo').subscribe({ error: () => undefined });
    api.get('admin/pontos').subscribe({ error: () => undefined });
    backend.expectOne('/api/admin/resumo').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/admin/pontos').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledOnceWith(['/entrar'], {
      queryParams: { voltar: '/sugerir', motivo: 'sessao' },
      replaceUrl: true,
    });
  });

  it('quem já está em Entrar fica lá; o visitante vai a Entrar sem o aviso de sessão', () => {
    urlAtual.and.returnValue('/entrar?voltar=%2Fsugerir');
    api.get('minhas-sugestoes').subscribe({ error: () => undefined });
    backend.expectOne('/api/minhas-sugestoes').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(sessao.atual).toBeNull();

    urlAtual.and.returnValue('/sugerir');
    api.post('pontos', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/pontos').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).toHaveBeenCalledOnceWith(['/entrar'], { queryParams: { voltar: '/sugerir' }, replaceUrl: true });
  });

  it('outros erros (403, 500) não encerram a sessão', () => {
    api.get('admin/resumo').subscribe({ error: () => undefined });
    backend.expectOne('/api/admin/resumo').flush({}, { status: 403, statusText: 'Forbidden' });
    api.get('pontos').subscribe({ error: () => undefined });
    backend.expectOne('/api/pontos').flush({}, { status: 500, statusText: 'Server Error' });

    expect(sessao.atual).toEqual(MARIA);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
