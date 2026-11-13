import { destinoSeguro } from './destino';
import { MENSAGEM, temErros, validarCadastro, validarEntrada } from './validacao-de-acesso';

describe('Validação de Entrar e Criar conta', () => {
  it('Entrar: campos vazios e e-mail inválido têm a mensagem de cada um', () => {
    expect(validarEntrada({ email: '', senha: '' })).toEqual({ email: MENSAGEM.emailVazio, senha: MENSAGEM.senhaVazia });
    expect(validarEntrada({ email: '   ', senha: 'x' })).toEqual({ email: MENSAGEM.emailVazio });
    expect(validarEntrada({ email: 'maria.souza', senha: 'x' })).toEqual({ email: MENSAGEM.emailInvalido });
    expect(validarEntrada({ email: 'maria@example', senha: 'x' })).toEqual({ email: MENSAGEM.emailInvalido });
  });

  it('Entrar: não confere o tamanho da senha, para nenhuma conta ficar presa no navegador', () => {
    expect(temErros(validarEntrada({ email: ' maria.souza@example.com ', senha: 'curta' }))).toBeFalse();
  });

  it('Criar conta: nome, e-mail e senha de pelo menos 8 caracteres (DA-3)', () => {
    expect(validarCadastro({ nome: '', email: '', senha: '' })).toEqual({
      nome: MENSAGEM.nomeVazio,
      email: MENSAGEM.emailVazio,
      senha: MENSAGEM.senhaVazia,
    });
    expect(validarCadastro({ nome: '  ', email: 'ana@example.com', senha: '1234567' })).toEqual({
      nome: MENSAGEM.nomeVazio,
      senha: MENSAGEM.senhaCurta,
    });
    expect(validarCadastro({ nome: 'Ana', email: 'ana@example.com', senha: '        ' })).toEqual({
      senha: MENSAGEM.senhaVazia,
    });
    expect(temErros(validarCadastro({ nome: 'Ana Lima', email: 'ana@example.com', senha: '12345678' }))).toBeFalse();
  });

  it('Criar conta: recusa o que passa do tamanho das colunas do banco', () => {
    const erros = validarCadastro({
      nome: 'a'.repeat(101),
      email: `${'a'.repeat(140)}@example.com`,
      senha: 'senha-segura',
    });

    expect(erros).toEqual({ nome: MENSAGEM.nomeLongo, email: MENSAGEM.emailLongo });
  });
});

describe('destinoSeguro', () => {
  it('leva à tela pedida, se for um caminho do próprio sistema', () => {
    expect(destinoSeguro('/sugerir')).toBe('/sugerir');
    expect(destinoSeguro('/minhas-sugestoes?status=PENDENTE')).toBe('/minhas-sugestoes?status=PENDENTE');
  });

  it('sem pedido, ou com um caminho para fora, leva à busca', () => {
    for (const pedido of [null, undefined, '', 'sugerir', '//outro-site.com', '/\\outro-site.com', 'https://outro-site.com', '/ /x']) {
      expect(destinoSeguro(pedido)).withContext(String(pedido)).toBe('/');
    }
  });

  it('não volta para Entrar nem para Criar conta', () => {
    expect(destinoSeguro('/entrar')).toBe('/');
    expect(destinoSeguro('/criar-conta/')).toBe('/');
    expect(destinoSeguro('/entrar?voltar=/sugerir')).toBe('/');
  });
});
