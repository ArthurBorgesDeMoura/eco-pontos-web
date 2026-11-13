import { HttpRequest } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService, Parametros } from '../api.service';
import { ErroApi } from '../erro-api';
import { PaginaDePontos, PontoCriado, PontoDetalhe } from '../modelos';
import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { PontosSimulados } from './pontos-simulados';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

const MARIA = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const ADMIN = { idUsuario: 1, nome: 'Administração', email: 'admin@example.com', perfil: 'ADMIN' };

const CORPO = {
  nome: '  Ecoponto Morumbi ',
  endereco: 'Rua das Flores, 100',
  idBairro: 13,
  horario: null,
  contato: '(34) 3000-0000',
  categorias: [2, 1],
};

describe('POST /pontos simulado (BE-10)', () => {
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

  function enviar(corpo: unknown): { ponto?: PontoCriado; erro?: ErroApi } {
    const resultado: { ponto?: PontoCriado; erro?: ErroApi } = {};
    api.post<PontoCriado>('pontos', corpo).subscribe({
      next: (ponto) => (resultado.ponto = ponto),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  function get<T>(rota: string, parametros?: Parametros): { corpo?: T; erro?: ErroApi } {
    const resultado: { corpo?: T; erro?: ErroApi } = {};
    api.get<T>(rota, parametros).subscribe({ next: (corpo) => (resultado.corpo = corpo), error: (erro: ErroApi) => (resultado.erro = erro) });
    tick(1000);
    return resultado;
  }

  it('uma sugestão válida cria um ponto PENDENTE, com os textos limpos e os materiais em ordem', fakeAsync(() => {
    entrarComo(MARIA);
    const { ponto } = enviar(CORPO);

    expect(ponto?.idPonto).toBe(16);
    expect(ponto?.status).toBe('PENDENTE');
    expect(ponto?.nome).toBe('Ecoponto Morumbi');
    expect(ponto?.bairro).toEqual({ idBairro: 13, nome: 'Morumbi' });
    expect(ponto?.horario).toBeNull();
    expect(ponto?.contato).toBe('(34) 3000-0000');
    expect(ponto?.materiais.map((material) => material.nome)).toEqual(['Papel e papelão', 'Plástico']);
  }));

  it('sem login responde 401', fakeAsync(() => {
    expect(enviar(CORPO).erro?.status).toBe(401);
  }));

  it('sem materiais, com bairro inexistente ou com texto acima do limite responde 400, com o erro de cada campo', fakeAsync(() => {
    entrarComo(MARIA);
    const { erro } = enviar({ ...CORPO, nome: 'n'.repeat(121), idBairro: 99, categorias: [] });

    expect(erro?.status).toBe(400);
    expect(Object.keys(erro?.campos ?? {}).sort()).toEqual(['categorias', 'idBairro', 'nome']);
    expect(enviar({ ...CORPO, categorias: [1, 1] }).erro?.campos['categorias']).toBeDefined();
    expect(enviar({ ...CORPO, endereco: '   ' }).erro?.campos['endereco']).toBe('Informe o endereço.');
  }));

  it('mandar status APROVADO ou outro autor no corpo não aprova nem muda o autor', fakeAsync(() => {
    entrarComo(MARIA);
    const { ponto } = enviar({ ...CORPO, status: 'APROVADO', idUsuario: 1 });
    expect(ponto?.status).toBe('PENDENTE');

    const simulados = new PontosSimulados();
    const criar = simulados.rotas.find((rota) => rota.metodo === 'POST');
    criar?.responder(new HttpRequest('POST', '/api/pontos', { ...CORPO, idUsuario: 1, status: 'APROVADO' }));
    const gravado = simulados['pontos'].find((item) => item.idPonto === 16);
    expect(gravado?.idUsuario).toBe(2);
    expect(gravado?.status).toBe('PENDENTE');
  }));

  it('material que não é número é recusado com 400, como no BE-10', fakeAsync(() => {
    entrarComo(MARIA);
    expect(enviar({ ...CORPO, categorias: [1, 'x'] }).erro?.campos['categorias']).toBeDefined();
    expect(enviar({ ...CORPO, categorias: 'tudo' }).erro?.campos['categorias']).toBe('Escolha pelo menos um material.');
  }));

  it('o ponto novo não aparece na busca nem no detalhe público; o ADMIN consegue abrir', fakeAsync(() => {
    entrarComo(MARIA);
    const { ponto } = enviar(CORPO);
    expect(get<PaginaDePontos>('pontos', { tamanho: 50 }).corpo?.itens.some((item) => item.idPonto === ponto?.idPonto)).toBeFalse();
    expect(get<PontoDetalhe>(`pontos/${ponto?.idPonto}`).erro?.status).toBe(404);

    entrarComo(ADMIN);
    expect(get<PontoDetalhe>(`pontos/${ponto?.idPonto}`).corpo?.nome).toBe('Ecoponto Morumbi');
  }));
});
