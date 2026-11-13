import { DadosDaSugestao, MENSAGEM_DA_SUGESTAO, montarSugestao, validarSugestao } from './validacao-da-sugestao';

const VALIDA: DadosDaSugestao = {
  nome: 'Ecoponto Morumbi',
  endereco: 'Rua das Flores, 100',
  idBairro: 13,
  horario: '',
  contato: '',
  categorias: [1, 2],
};

describe('validarSugestao', () => {
  it('aceita uma sugestão completa, com horário e contato vazios', () => {
    expect(validarSugestao(VALIDA)).toEqual({});
  });

  it('nome e endereço são obrigatórios; texto só de espaços vale como vazio', () => {
    expect(validarSugestao({ ...VALIDA, nome: '   ', endereco: '' })).toEqual({
      nome: MENSAGEM_DA_SUGESTAO.nomeVazio,
      endereco: MENSAGEM_DA_SUGESTAO.enderecoVazio,
    });
  });

  it('recusa textos acima do tamanho das colunas, contando sem os espaços das pontas', () => {
    const erros = validarSugestao({
      ...VALIDA,
      nome: 'n'.repeat(121),
      endereco: 'e'.repeat(201),
      horario: 'h'.repeat(101),
      contato: 'c'.repeat(101),
    });
    expect(erros).toEqual({
      nome: 'Use até 120 caracteres.',
      endereco: 'Use até 200 caracteres.',
      horario: 'Use até 100 caracteres.',
      contato: 'Use até 100 caracteres.',
    });
    expect(validarSugestao({ ...VALIDA, nome: `  ${'n'.repeat(120)}  ` })).toEqual({});
  });

  it('pede o bairro e pelo menos um material', () => {
    expect(validarSugestao({ ...VALIDA, idBairro: null, categorias: [] })).toEqual({
      idBairro: MENSAGEM_DA_SUGESTAO.bairroVazio,
      categorias: MENSAGEM_DA_SUGESTAO.categoriasVazias,
    });
  });

  it('com os ids conhecidos (backend e simulação), recusa bairro e materiais que não existem ou se repetem', () => {
    const conhecidos = { bairros: [1, 13], categorias: [1, 2, 3] };
    expect(validarSugestao({ ...VALIDA, idBairro: 99 }, conhecidos).idBairro).toBe(MENSAGEM_DA_SUGESTAO.bairroDesconhecido);
    expect(validarSugestao({ ...VALIDA, categorias: [1, 42] }, conhecidos).categorias).toBe(
      MENSAGEM_DA_SUGESTAO.categoriasDesconhecidas,
    );
    expect(validarSugestao({ ...VALIDA, categorias: [1, 1] }, conhecidos).categorias).toBe(
      MENSAGEM_DA_SUGESTAO.categoriasDesconhecidas,
    );
    expect(validarSugestao(VALIDA, conhecidos)).toEqual({});
  });
});

describe('montarSugestao', () => {
  it('tira os espaços das pontas e manda horário e contato vazios como null', () => {
    expect(montarSugestao({ ...VALIDA, nome: '  Ecoponto Morumbi ', horario: '   ', contato: ' (34) 3000-0000 ' })).toEqual({
      nome: 'Ecoponto Morumbi',
      endereco: 'Rua das Flores, 100',
      idBairro: 13,
      horario: null,
      contato: '(34) 3000-0000',
      categorias: [1, 2],
    });
  });
});
