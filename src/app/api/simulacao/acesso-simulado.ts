import { HttpRequest } from '@angular/common/http';

import {
  MENSAGEM,
  TAMANHO_MINIMO_DA_SENHA,
  temErros,
  validarCadastro,
} from '../../paginas/acesso/validacao-de-acesso';
import { CorpoErroApi } from '../erro-api';
import { Usuario } from '../modelos';
import { CONTAS_DO_SCRIPT } from './respostas/contas';
import { RespostaSimulada, RotaSimulada } from './rota-simulada';

export const CHAVE_DA_SESSAO_SIMULADA = 'ecoponto.simulacao.sessao';

export const MENSAGEM_DE_LOGIN_ERRADO = 'E-mail ou senha incorretos.';

interface ContaCriada {
  usuario: Usuario;
  senha: string;
}

export class AcessoSimulado {
  private readonly criadas = new Map<string, ContaCriada>();
  private proximoId = Math.max(CONTAS_DO_SCRIPT.length, lerSessao()?.idUsuario ?? 0) + 1;

  readonly rotas: readonly RotaSimulada[] = [
    { metodo: 'POST', caminho: /^\/auth\/cadastro$/, responder: (pedido) => this.cadastrar(pedido) },
    { metodo: 'POST', caminho: /^\/auth\/login$/, responder: (pedido) => this.entrar(pedido) },
    { metodo: 'GET', caminho: /^\/auth\/eu$/, responder: () => this.quemSouEu() },
    { metodo: 'POST', caminho: /^\/auth\/logout$/, responder: () => this.sair() },
  ];

  nomeDoUsuario(idUsuario: number): string | null {
    const doScript = CONTAS_DO_SCRIPT.find((conta) => conta.idUsuario === idUsuario);
    const criada = [...this.criadas.values()].find((conta) => conta.usuario.idUsuario === idUsuario);
    return doScript?.nome ?? criada?.usuario.nome ?? null;
  }

  private cadastrar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const nome = texto(pedido.body, 'nome');
    const email = texto(pedido.body, 'email');
    const senha = texto(pedido.body, 'senha');

    const erros = validarCadastro({ nome, email, senha });
    if (temErros(erros)) {
      const corpo: CorpoErroApi = { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos destacados.', campos: erros };
      return { status: 400, corpo };
    }
    const chave = normalizar(email);
    if (this.existe(chave)) {
      const corpo: CorpoErroApi = {
        codigo: 'EMAIL_JA_CADASTRADO',
        mensagem: MENSAGEM.emailRepetido,
        campos: { email: MENSAGEM.emailRepetido },
      };
      return { status: 409, corpo };
    }
    const usuario: Usuario = { idUsuario: this.proximoId++, nome: nome.trim(), email: chave, perfil: 'USUARIO' };
    this.criadas.set(chave, { usuario, senha });
    return { status: 201, corpo: usuario };
  }

  private entrar(pedido: HttpRequest<unknown>): RespostaSimulada {
    const chave = normalizar(texto(pedido.body, 'email'));
    const senha = texto(pedido.body, 'senha');

    const criada = this.criadas.get(chave);
    if (criada && criada.senha === senha) {
      return this.abrirSessao(criada.usuario);
    }
    const doScript = CONTAS_DO_SCRIPT.find((conta) => conta.email === chave);
    if (!criada && doScript && senha.length >= TAMANHO_MINIMO_DA_SENHA) {
      return this.abrirSessao(doScript);
    }
    const corpo: CorpoErroApi = { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: MENSAGEM_DE_LOGIN_ERRADO };
    return { status: 401, corpo };
  }

  private existe(chave: string): boolean {
    return this.criadas.has(chave) || CONTAS_DO_SCRIPT.some((conta) => conta.email === chave);
  }

  private quemSouEu(): RespostaSimulada {
    const usuario = lerSessao();
    if (usuario) {
      return { status: 200, corpo: usuario };
    }
    const corpo: CorpoErroApi = { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' };
    return { status: 401, corpo };
  }

  private abrirSessao(usuario: Usuario): RespostaSimulada {
    gravarSessao(usuario);
    return { status: 200, corpo: usuario };
  }

  private sair(): RespostaSimulada {
    gravarSessao(null);
    return { status: 204, corpo: null };
  }
}

export function lerSessao(): Usuario | null {
  try {
    const guardado: unknown = JSON.parse(sessionStorage.getItem(CHAVE_DA_SESSAO_SIMULADA) ?? 'null');
    return ehUsuario(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

function gravarSessao(usuario: Usuario | null): void {
  try {
    if (usuario) {
      sessionStorage.setItem(CHAVE_DA_SESSAO_SIMULADA, JSON.stringify(usuario));
    } else {
      sessionStorage.removeItem(CHAVE_DA_SESSAO_SIMULADA);
    }
  } catch {
  }
}

function ehUsuario(valor: unknown): valor is Usuario {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const { idUsuario, nome, email, perfil } = valor as Record<string, unknown>;
  return (
    typeof idUsuario === 'number' &&
    typeof nome === 'string' &&
    typeof email === 'string' &&
    (perfil === 'USUARIO' || perfil === 'ADMIN')
  );
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

function texto(corpo: unknown, campo: string): string {
  if (typeof corpo !== 'object' || corpo === null) {
    return '';
  }
  const valor = (corpo as Record<string, unknown>)[campo];
  return typeof valor === 'string' ? valor : '';
}
