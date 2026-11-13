import { mesmoNome, montarCategoria, temErrosNaCategoria, validarCategoria } from './validacao-da-categoria';

describe('validação da categoria', () => {
  it('nome obrigatório (só espaços vale como vazio) e até 60; descrição opcional, até 255', () => {
    expect(validarCategoria({ nome: '   ', descricao: '' })).toEqual({ nome: 'Informe o nome da categoria.' });
    expect(validarCategoria({ nome: 'n'.repeat(61), descricao: 'd'.repeat(256) })).toEqual({
      nome: 'Use até 60 caracteres.',
      descricao: 'Use até 255 caracteres.',
    });
    const certo = validarCategoria({ nome: `  ${'n'.repeat(60)}  `, descricao: ` ${'d'.repeat(255)} ` });
    expect(temErrosNaCategoria(certo)).toBeFalse();
  });

  it('o corpo vai sem os espaços das pontas, e a descrição vazia vai como null', () => {
    expect(montarCategoria({ nome: '  Isopor ', descricao: '   ' })).toEqual({ nome: 'Isopor', descricao: null });
    expect(montarCategoria({ nome: 'Isopor', descricao: ' Bandejas limpas. ' })).toEqual({
      nome: 'Isopor',
      descricao: 'Bandejas limpas.',
    });
  });

  it('o mesmo nome não diferencia maiúsculas nem acentos, como a coluna UNIQUE do MariaDB', () => {
    expect(mesmoNome('Plástico', ' plastico ')).toBeTrue();
    expect(mesmoNome('Óleo de cozinha usado', 'OLEO DE COZINHA USADO')).toBeTrue();
    expect(mesmoNome('Plástico', 'Plásticos')).toBeFalse();
  });
});
