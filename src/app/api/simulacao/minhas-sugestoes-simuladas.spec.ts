import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService, Parametros } from '../api.service';
import { ErroApi } from '../erro-api';
import { PaginaDeSugestoes, PontoCriado } from '../modelos';
import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const JOAO = { idUsuario: 3, nome: 'João Pereira', email: 'joao.pereira@example.com', perfil: 'USUARIO' };
const ADMIN = { idUsuario: 1, nome: 'Administração', email: 'admin@example.com', perfil: 'ADMIN' };

describe('GET /minhas-sugestoes simulado (BE-11)', () => {
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

  function minhas(parametros?: Parametros): { pagina?: PaginaDeSugestoes; erro?: ErroApi } {
    const resultado: { pagina?: PaginaDeSugestoes; erro?: ErroApi } = {};
    api.get<PaginaDeSugestoes>('minhas-sugestoes', parametros).subscribe({
      next: (pagina) => (resultado.pagina = pagina),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  it('cada conta vê só as próprias sugestões, com o status de cada uma', fakeAsync(() => {
    entrarComo(MARIA);
    const daMaria = minhas().pagina;
    expect(daMaria?.itens.map((item) => [item.nome, item.status])).toEqual([
      ['Cooperativa dos Recicladores de Uberlândia (CORU)', 'PENDENTE'],
    ]);
    expect(daMaria?.itens[0].bairro.nome).toBe('Jardim Brasília');

    entrarComo(JOAO);
    expect(minhas().pagina?.itens.map((item) => item.nome)).toEqual(['Ecoponto Daniel Fonseca']);

    entrarComo(ADMIN);
    const daAdministracao = minhas({ tamanho: 50 }).pagina;
    expect(daAdministracao?.total).toBe(13);
    expect(daAdministracao?.itens.every((item) => item.status === 'APROVADO')).toBeTrue();
  }));

  it('o filtro status devolve só o status pedido; sem filtro, todos; valor fora da lista dá 400', fakeAsync(() => {
    entrarComo(MARIA);
    expect(minhas({ status: 'PENDENTE' }).pagina?.total).toBe(1);
    expect(minhas({ status: 'APROVADO' }).pagina?.total).toBe(0);
    expect(minhas({ status: 'RECUSADO' }).pagina?.itens).toEqual([]);
    expect(minhas({ status: 'TUDO' }).erro?.status).toBe(400);
  }));

  it('sem login responde 401', fakeAsync(() => {
    expect(minhas().erro?.status).toBe(401);
  }));

  it('uma sugestão recém-enviada aparece primeiro, como PENDENTE; a lista vai da mais recente para a mais antiga', fakeAsync(() => {
    entrarComo(MARIA);
    let criado: PontoCriado | undefined;
    api
      .post<PontoCriado>('pontos', {
        nome: 'Ecoponto Morumbi',
        endereco: 'Rua das Flores, 100',
        idBairro: 13,
        horario: null,
        contato: null,
        categorias: [1],
      })
      .subscribe((ponto) => (criado = ponto));
    tick(1000);

    const pagina = minhas().pagina;
    expect(pagina?.itens.map((item) => [item.idPonto, item.status])).toEqual([
      [criado?.idPonto ?? -1, 'PENDENTE'],
      [15, 'PENDENTE'],
    ]);
  }));

  it('conta criada depois de recarregar não repete o id de quem já está na sessão', fakeAsync(() => {
    entrarComo({ idUsuario: 4, nome: 'Ana Lima', email: 'ana.lima@example.com', perfil: 'USUARIO' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    api = TestBed.inject(ApiService);
    expect(minhas().pagina?.total).toBe(0);
    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);

    let criada: { idUsuario: number } | undefined;
    api
      .post<{ idUsuario: number }>('auth/cadastro', { nome: 'Bia Souza', email: 'bia.souza@example.com', senha: 'senha-nova-1' })
      .subscribe((usuario) => (criada = usuario));
    tick(1000);
    expect(criada?.idUsuario).toBe(5);
  }));

  it('a administração vê os 13 aprovados em páginas de 7', fakeAsync(() => {
    entrarComo(ADMIN);
    const primeira = minhas({ pagina: 1, tamanho: 7 }).pagina;
    const segunda = minhas({ pagina: 2, tamanho: 7 }).pagina;
    expect(primeira?.itens.length).toBe(7);
    expect(segunda?.itens.length).toBe(6);
    expect(primeira?.itens[0].idPonto).toBe(13);
  }));
});
