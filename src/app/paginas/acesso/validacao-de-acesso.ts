export type CampoDeAcesso = 'nome' | 'email' | 'senha';
export type ErrosDeAcesso = Partial<Record<CampoDeAcesso, string>>;

export const TAMANHO_MINIMO_DA_SENHA = 8;
export const TAMANHO_MAXIMO_DO_NOME = 100;
export const TAMANHO_MAXIMO_DO_EMAIL = 150;

const FORMATO_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAGEM = {
  nomeVazio: 'Informe seu nome.',
  nomeLongo: `Use até ${TAMANHO_MAXIMO_DO_NOME} caracteres.`,
  emailVazio: 'Informe seu e-mail.',
  emailLongo: `Use até ${TAMANHO_MAXIMO_DO_EMAIL} caracteres.`,
  emailInvalido: 'Digite um e-mail válido, como nome@exemplo.com.',
  senhaVazia: 'Informe sua senha.',
  senhaCurta: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`,
  emailRepetido: 'Este e-mail já tem conta. Entre ou use outro e-mail.',
} as const;

export interface DadosDeEntrada {
  email: string;
  senha: string;
}

export interface DadosDeCadastro extends DadosDeEntrada {
  nome: string;
}

export function validarEntrada(dados: DadosDeEntrada): ErrosDeAcesso {
  return limpar({
    email: erroDoEmail(dados.email),
    senha: dados.senha === '' ? MENSAGEM.senhaVazia : undefined,
  });
}

export function validarCadastro(dados: DadosDeCadastro): ErrosDeAcesso {
  return limpar({
    nome: erroDoNome(dados.nome),
    email: erroDoEmail(dados.email),
    senha: erroDaSenhaNova(dados.senha),
  });
}

export function temErros(erros: ErrosDeAcesso): boolean {
  return Object.keys(erros).length > 0;
}

function erroDoNome(nome: string): string | undefined {
  const limpo = nome.trim();
  if (limpo === '') {
    return MENSAGEM.nomeVazio;
  }
  return limpo.length > TAMANHO_MAXIMO_DO_NOME ? MENSAGEM.nomeLongo : undefined;
}

function erroDoEmail(email: string): string | undefined {
  const limpo = email.trim();
  if (limpo === '') {
    return MENSAGEM.emailVazio;
  }
  if (limpo.length > TAMANHO_MAXIMO_DO_EMAIL) {
    return MENSAGEM.emailLongo;
  }
  return FORMATO_DE_EMAIL.test(limpo) ? undefined : MENSAGEM.emailInvalido;
}

function erroDaSenhaNova(senha: string): string | undefined {
  if (senha.trim() === '') {
    return MENSAGEM.senhaVazia;
  }
  return senha.length < TAMANHO_MINIMO_DA_SENHA ? MENSAGEM.senhaCurta : undefined;
}

function limpar(erros: ErrosDeAcesso): ErrosDeAcesso {
  const resultado: ErrosDeAcesso = {};
  for (const [campo, mensagem] of Object.entries(erros) as [CampoDeAcesso, string | undefined][]) {
    if (mensagem) {
      resultado[campo] = mensagem;
    }
  }
  return resultado;
}
