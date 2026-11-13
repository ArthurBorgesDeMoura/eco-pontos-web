import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService } from '../api.service';
import { ErroApi } from '../erro-api';
import { Usuario } from '../modelos';
import { CHAVE_DA_SESSAO_SIMULADA, MENSAGEM_DE_LOGIN_ERRADO } from './acesso-simulado';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

describe('Cadastro, login e logout simulados', () => {
  let api: ApiService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);
  });

  beforeEach(() => sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA));
  afterEach(() => {
    backend.verify();
    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
  });

  function chamar<T>(rota: string, corpo: unknown): { resposta?: T; erro?: ErroApi } {
    const resultado: { resposta?: T; erro?: ErroApi } = {};
    api.post<T>(rota, corpo).subscribe({
      next: (resposta) => (resultado.resposta = resposta),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  it('cadastro válido cria sempre um USUARIO, mesmo com perfil no corpo, e não devolve a senha', fakeAsync(() => {
    const { resposta } = chamar<Usuario>('auth/cadastro', {
      nome: ' Ana Lima ',
      email: ' Ana@Example.com ',
      senha: 'senha-segura',
      perfil: 'ADMIN',
    });

    expect(resposta).toEqual({ idUsuario: 4, nome: 'Ana Lima', email: 'ana@example.com', perfil: 'USUARIO' });
    expect(JSON.stringify(resposta)).not.toContain('senha-segura');
  }));

  it('e-mail já cadastrado, sem ligar para maiúsculas, responde 409 no campo e-mail', fakeAsync(() => {
    const { erro } = chamar('auth/cadastro', { nome: 'Outra Maria', email: 'MARIA.SOUZA@example.com', senha: 'senha-segura' });

    expect(erro?.status).toBe(409);
    expect(erro?.campos['email']).toBe('Este e-mail já tem conta. Entre ou use outro e-mail.');
  }));

  it('dados inválidos respondem 400 com o erro de cada campo', fakeAsync(() => {
    const { erro } = chamar('auth/cadastro', { nome: '  ', email: 'ana', senha: '123' });

    expect(erro?.status).toBe(400);
    expect(Object.keys(erro?.campos ?? {}).sort()).toEqual(['email', 'nome', 'senha']);
  }));

  it('a conta criada entra com a senha cadastrada; senha errada dá 401 com a mensagem única', fakeAsync(() => {
    chamar('auth/cadastro', { nome: 'Ana Lima', email: 'ana@example.com', senha: 'senha-segura' });

    expect(chamar<Usuario>('auth/login', { email: 'ANA@example.com ', senha: 'senha-segura' }).resposta?.nome).toBe('Ana Lima');
    const errada = chamar('auth/login', { email: 'ana@example.com', senha: 'outra-senha' }).erro;
    expect(errada?.status).toBe(401);
    expect(errada?.mensagem).toBe(MENSAGEM_DE_LOGIN_ERRADO);
  }));

  it('e-mail que não existe dá o mesmo 401 da senha errada', fakeAsync(() => {
    const erro = chamar('auth/login', { email: 'ninguem@example.com', senha: 'senha-segura' }).erro;

    expect(erro?.status).toBe(401);
    expect(erro?.mensagem).toBe(MENSAGEM_DE_LOGIN_ERRADO);
  }));

  it('as contas do script entram com qualquer senha de 8 ou mais caracteres, com o perfil delas', fakeAsync(() => {
    expect(chamar<Usuario>('auth/login', { email: 'admin@example.com', senha: '12345678' }).resposta?.perfil).toBe('ADMIN');
    expect(chamar('auth/login', { email: 'admin@example.com', senha: '1234567' }).erro?.status).toBe(401);
  }));

  it('GET /auth/eu: 401 sem sessão; depois do login, quem entrou; depois do logout, 401 de novo', fakeAsync(() => {
    const eu = (): { resposta?: Usuario; erro?: ErroApi } => {
      const resultado: { resposta?: Usuario; erro?: ErroApi } = {};
      api.get<Usuario>('auth/eu').subscribe({
        next: (resposta) => (resultado.resposta = resposta),
        error: (erro: ErroApi) => (resultado.erro = erro),
      });
      tick(1000);
      return resultado;
    };

    expect(eu().erro?.status).toBe(401);
    chamar('auth/login', { email: 'maria.souza@example.com', senha: 'senha-segura' });
    expect(eu().resposta?.nome).toBe('Maria Souza');
    chamar('auth/logout', null);
    expect(eu().erro?.status).toBe(401);
  }));

  it('a sessão simulada sobrevive a recarregar (fica na aba) e não guarda a senha', fakeAsync(() => {
    chamar('auth/login', { email: 'admin@example.com', senha: 'senha-segura' });
    const guardado = sessionStorage.getItem(CHAVE_DA_SESSAO_SIMULADA) ?? '';

    expect(JSON.parse(guardado)).toEqual({
      idUsuario: 1,
      nome: 'Administrador EcoPonto',
      email: 'admin@example.com',
      perfil: 'ADMIN',
    });
    expect(guardado).not.toContain('senha');
  }));

  it('logout responde 204', fakeAsync(() => {
    const { resposta, erro } = chamar('auth/logout', null);

    expect(erro).toBeUndefined();
    expect(resposta).toBeNull();
  }));
});
