import { HttpErrorResponse } from '@angular/common/http';

export interface CorpoErroApi {
  codigo?: string;
  mensagem?: string;
  campos?: Record<string, string>;
  erros?: { campo: string; mensagem: string }[];
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly mensagem: string,
    readonly campos: Readonly<Record<string, string>> = {},
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

interface Padrao {
  codigo: string;
  mensagem: string;
}

const SEM_CONEXAO: Padrao = {
  codigo: 'SEM_CONEXAO',
  mensagem: 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.',
};

const SERVIDOR_INDISPONIVEL: Padrao = {
  codigo: 'SERVIDOR_INDISPONIVEL',
  mensagem: 'O servidor está fora do ar agora. Tente de novo em alguns instantes.',
};

const INESPERADO: Padrao = {
  codigo: 'ERRO_INESPERADO',
  mensagem: 'Algo deu errado. Tente de novo em alguns instantes.',
};

const PADRAO_POR_STATUS: Readonly<Record<number, Padrao>> = {
  0: SEM_CONEXAO,
  400: { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos destacados.' },
  401: { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' },
  403: { codigo: 'SEM_PERMISSAO', mensagem: 'Sua conta não tem permissão para fazer isso.' },
  404: { codigo: 'NAO_ENCONTRADO', mensagem: 'Não encontramos o que você procurou.' },
  409: {
    codigo: 'CONFLITO',
    mensagem: 'Os dados mudaram enquanto você usava a página. Atualize e tente de novo.',
  },
  502: SERVIDOR_INDISPONIVEL,
  503: SERVIDOR_INDISPONIVEL,
  504: SERVIDOR_INDISPONIVEL,
};

export function traduzirErro(erro: unknown): ErroApi {
  if (erro instanceof ErroApi) {
    return erro;
  }
  if (!(erro instanceof HttpErrorResponse)) {
    return new ErroApi(0, INESPERADO.codigo, INESPERADO.mensagem);
  }

  const padrao = PADRAO_POR_STATUS[erro.status] ?? INESPERADO;
  const erroDoCliente = erro.status >= 400 && erro.status < 500;
  const corpo = erroDoCliente ? lerCorpo(erro.error) : { campos: {} };

  return new ErroApi(erro.status, corpo.codigo ?? padrao.codigo, corpo.mensagem ?? padrao.mensagem, corpo.campos);
}

interface CorpoLido {
  codigo?: string;
  mensagem?: string;
  campos: Record<string, string>;
}

function lerCorpo(corpo: unknown): CorpoLido {
  if (!ehObjeto(corpo)) {
    return { campos: {} };
  }
  return {
    codigo: textoPreenchido(corpo['codigo']),
    mensagem: textoPreenchido(corpo['mensagem']),
    campos: { ...lerListaDeErros(corpo['erros']), ...lerCampos(corpo['campos']) },
  };
}

function lerCampos(campos: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  if (ehObjeto(campos)) {
    for (const [campo, mensagem] of Object.entries(campos)) {
      const texto = textoPreenchido(mensagem);
      if (texto) {
        resultado[campo] = texto;
      }
    }
  }
  return resultado;
}

function lerListaDeErros(erros: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  if (Array.isArray(erros)) {
    for (const item of erros) {
      const campo = ehObjeto(item) ? textoPreenchido(item['campo']) : undefined;
      const mensagem = ehObjeto(item) ? textoPreenchido(item['mensagem']) : undefined;
      if (campo && mensagem) {
        resultado[campo] = mensagem;
      }
    }
  }
  return resultado;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoPreenchido(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
}
