import { HttpErrorResponse } from '@angular/common/http';

import { ErroApi, traduzirErro } from './erro-api';

function respostaDeErro(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: '/api/teste' });
}

describe('traduzirErro', () => {
  it('sem resposta do servidor, avisa que não houve conexão', () => {
    const erro = traduzirErro(respostaDeErro(0, new ProgressEvent('error')));

    expect(erro).toEqual(jasmine.any(ErroApi));
    expect(erro.status).toBe(0);
    expect(erro.codigo).toBe('SEM_CONEXAO');
    expect(erro.mensagem).toBe('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.');
  });

  it('com o backend desligado atrás do proxy (504 com texto), diz que o servidor está fora do ar', () => {
    const erro = traduzirErro(respostaDeErro(504, 'Error occurred while trying to proxy: localhost:4200/api/bairros'));

    expect(erro.codigo).toBe('SERVIDOR_INDISPONIVEL');
    expect(erro.mensagem).toBe('O servidor está fora do ar agora. Tente de novo em alguns instantes.');
  });

  it('usa o código, a mensagem e o erro de cada campo que vêm no corpo de um 400', () => {
    const erro = traduzirErro(
      respostaDeErro(400, {
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'O nome passa de 120 caracteres.',
        campos: { nome: 'Use até 120 caracteres.', endereco: '   ' },
      }),
    );

    expect(erro.codigo).toBe('DADOS_INVALIDOS');
    expect(erro.mensagem).toBe('O nome passa de 120 caracteres.');
    expect(erro.campos).toEqual({ nome: 'Use até 120 caracteres.' });
  });

  it('aceita os erros de campo também no formato de lista', () => {
    const erro = traduzirErro(
      respostaDeErro(400, { erros: [{ campo: 'email', mensagem: 'Informe um e-mail válido.' }, { campo: 'senha' }] }),
    );

    expect(erro.campos).toEqual({ email: 'Informe um e-mail válido.' });
    expect(erro.mensagem).toBe('Confira os campos destacados.');
  });

  it('sem corpo, usa a mensagem padrão de cada status do contrato', () => {
    expect(traduzirErro(respostaDeErro(401)).mensagem).toBe('Entre na sua conta para continuar.');
    expect(traduzirErro(respostaDeErro(403)).mensagem).toBe('Sua conta não tem permissão para fazer isso.');
    expect(traduzirErro(respostaDeErro(404)).mensagem).toBe('Não encontramos o que você procurou.');
    expect(traduzirErro(respostaDeErro(409)).codigo).toBe('CONFLITO');
  });

  it('em erro 5xx, não mostra o texto do servidor, que pode ter detalhes internos', () => {
    const erro = traduzirErro(respostaDeErro(500, { mensagem: 'NullPointerException em PontoDao.java:42', campos: { x: 'y' } }));

    expect(erro.codigo).toBe('ERRO_INESPERADO');
    expect(erro.mensagem).toBe('Algo deu errado. Tente de novo em alguns instantes.');
    expect(erro.campos).toEqual({});
  });

  it('ignora mensagem vazia ou que não é texto e cai no padrão', () => {
    expect(traduzirErro(respostaDeErro(404, { mensagem: '   ' })).mensagem).toBe('Não encontramos o que você procurou.');
    expect(traduzirErro(respostaDeErro(404, { mensagem: 42 })).mensagem).toBe('Não encontramos o que você procurou.');
  });

  it('devolve o mesmo ErroApi se ele já foi traduzido e trata falhas que não são HTTP', () => {
    const jaTraduzido = new ErroApi(409, 'CONFLITO', 'Já decidido.');

    expect(traduzirErro(jaTraduzido)).toBe(jaTraduzido);
    expect(traduzirErro(new TypeError('falhou')).codigo).toBe('ERRO_INESPERADO');
  });
});
