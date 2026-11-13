import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ApiService } from '../api.service';
import { ErroApi } from '../erro-api';
import { PontoDetalhe } from '../modelos';
import { PontosService } from '../pontos.service';
import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

describe('GET /pontos/{id} simulado (BE-09)', () => {
  let pontos: PontosService;
  let api: ApiService;

  beforeEach(() => {
    sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
    pontos = TestBed.inject(PontosService);
    api = TestBed.inject(ApiService);
  });

  afterEach(() => sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA));

  function detalhar(caminho: string): { ponto?: PontoDetalhe; erro?: ErroApi } {
    const resultado: { ponto?: PontoDetalhe; erro?: ErroApi } = {};
    api.get<PontoDetalhe>(caminho).subscribe({
      next: (ponto) => (resultado.ponto = ponto),
      error: (erro: ErroApi) => (resultado.erro = erro),
    });
    tick(1000);
    return resultado;
  }

  it('o Ecoponto Luizote de Freitas vem com bairro, horário, materiais com descrição e contato null', fakeAsync(() => {
    let ponto: PontoDetalhe | undefined;
    pontos.detalhar(13).subscribe((resposta) => (ponto = resposta));
    tick(1000);

    expect(ponto?.nome).toBe('Ecoponto Luizote de Freitas');
    expect(ponto?.endereco).toBe('Rua Wilson Gonçalves de Souza, 10');
    expect(ponto?.bairro).toEqual({ idBairro: 11, nome: 'Luizote de Freitas' });
    expect(ponto?.horario).toBe('7h às 19h, todos os dias');
    expect(ponto?.contato).toBeNull();
    expect(ponto?.materiais.map((material) => material.nome)).toEqual([
      'Papel e papelão',
      'Plástico',
      'Metal',
      'Vidro',
      'Entulho e volumosos',
    ]);
    expect(ponto?.materiais.every((material) => typeof material.descricao === 'string' && material.descricao !== '')).toBeTrue();
  }));

  it('campo opcional vazio vem null, nunca texto vazio nem "Não informado"', fakeAsync(() => {
    const { ponto } = detalhar('pontos/2');
    expect(ponto?.horario).toBeNull();
    expect(ponto?.contato).toBeNull();
    expect(detalhar('pontos/9').ponto?.contato).toBe('(34) 3228-7744');
  }));

  it('id inexistente e ponto pendente (para o visitante) dão 404; id com texto dá 400', fakeAsync(() => {
    expect(detalhar('pontos/999').erro?.status).toBe(404);
    expect(detalhar('pontos/14').erro?.status).toBe(404);
    expect(detalhar('pontos/abc').erro?.status).toBe(400);
    expect(detalhar('pontos/0').erro?.status).toBe(400);
  }));

  it('o pendente também dá 404 para USUARIO, e o ADMIN consegue abrir', fakeAsync(() => {
    sessionStorage.setItem(
      CHAVE_DA_SESSAO_SIMULADA,
      JSON.stringify({ idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' }),
    );
    expect(detalhar('pontos/14').erro?.status).toBe(404);

    sessionStorage.setItem(
      CHAVE_DA_SESSAO_SIMULADA,
      JSON.stringify({ idUsuario: 1, nome: 'Administração', email: 'admin@example.com', perfil: 'ADMIN' }),
    );
    expect(detalhar('pontos/14').ponto?.nome).toBe('Ecoponto Daniel Fonseca');
  }));

  it('/pontos/contagem continua sendo a contagem, não um id', fakeAsync(() => {
    let total: number | undefined;
    pontos.contar(null).subscribe((contagem) => (total = contagem.total));
    tick(1000);
    expect(total).toBe(13);
  }));
});
