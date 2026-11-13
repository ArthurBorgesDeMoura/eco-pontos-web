import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { CHAVE_DA_SESSAO_SIMULADA } from './acesso-simulado';
import { CONTAS_DO_SCRIPT } from './respostas/contas';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

interface PedidoDoContrato {
  metodo: string;
  caminho: string;
  sessao: string | null;
  corpo?: unknown;
}

interface CasoDoContrato {
  descricao: string;
  naSimulacao?: boolean;
  pedidos: PedidoDoContrato[];
  resposta: { status: number; corpo: unknown };
}

interface Recebido {
  status: number;
  corpo: unknown;
}

declare const require: {
  context(
    caminho: string,
    subpastas: boolean,
    filtro: RegExp,
  ): {
    keys(): string[];
    (chave: string): unknown;
  };
};

const EXEMPLOS = require.context('../../../../../docs/api/exemplos', false, /\.json$/);

const CASOS = EXEMPLOS.keys().map((chave) => ({
  arquivo: chave.replace(/^\.\//, ''),
  caso: EXEMPLOS(chave) as CasoDoContrato,
}));

describe('A simulação segue o contrato (docs/api/exemplos)', () => {
  afterEach(() => sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA));

  it('acha os casos do contrato', () => {
    expect(CASOS.length).toBeGreaterThan(40);
    expect(CASOS.filter(({ caso }) => caso.naSimulacao === false).map(({ arquivo }) => arquivo)).toEqual([
      'login-bloqueado.json',
      'saude-banco-desligado.json',
      'saude-ok.json',
    ]);
  });

  CASOS.filter(({ caso }) => caso.naSimulacao !== false).forEach(({ arquivo, caso }) => {
    caso.pedidos.forEach((pedido, indice) => {
      it(`${arquivo} (${indice + 1}): ${pedido.metodo} ${pedido.caminho}`, fakeAsync(() => {
        const recebido = responder(pedido);

        expect(recebido.status).toBe(caso.resposta.status);
        expect(recebido.corpo).toEqual(caso.resposta.corpo);
      }));
    });
  });
});

function responder(pedido: PedidoDoContrato): Recebido {
  sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
  if (pedido.sessao) {
    const conta = CONTAS_DO_SCRIPT.find((item) => item.email === pedido.sessao);
    if (!conta) {
      throw new Error(`A conta ${pedido.sessao} não é do script.`);
    }
    sessionStorage.setItem(CHAVE_DA_SESSAO_SIMULADA, JSON.stringify(conta));
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PROVEDOR_DA_SIMULACAO] });
  const http = TestBed.inject(HttpClient);

  const [url, consulta = ''] = pedido.caminho.split('?');
  let recebido: Recebido | undefined;
  http
    .request(pedido.metodo, url, {
      body: pedido.corpo ?? null,
      params: new HttpParams({ fromString: consulta }),
      observe: 'response',
    })
    .subscribe({
      next: (resposta) => (recebido = { status: resposta.status, corpo: resposta.body }),
      error: (erro: HttpErrorResponse) => (recebido = { status: erro.status, corpo: erro.error }),
    });
  tick(1000);

  if (!recebido) {
    throw new Error(`${pedido.metodo} ${pedido.caminho} não respondeu.`);
  }
  return recebido;
}
