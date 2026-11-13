import { indiceDaTecla, indicePorBusca, semAcentos } from './teclado';

describe('indiceDaTecla', () => {
  const lista = { orientacao: 'vertical', circular: false } as const;
  const abas = { orientacao: 'horizontal', circular: true } as const;

  it('na lista, as setas de cima e de baixo andam e param nas pontas', () => {
    expect(indiceDaTecla('ArrowDown', 0, 3, lista)).toBe(1);
    expect(indiceDaTecla('ArrowDown', 2, 3, lista)).toBe(2);
    expect(indiceDaTecla('ArrowUp', 0, 3, lista)).toBe(0);
    expect(indiceDaTecla('ArrowUp', 2, 3, lista)).toBe(1);
    expect(indiceDaTecla('ArrowRight', 0, 3, lista)).toBeNull();
  });

  it('nas abas, as setas de lado andam e dão a volta', () => {
    expect(indiceDaTecla('ArrowRight', 2, 3, abas)).toBe(0);
    expect(indiceDaTecla('ArrowLeft', 0, 3, abas)).toBe(2);
    expect(indiceDaTecla('ArrowDown', 0, 3, abas)).toBeNull();
  });

  it('Home e End vão ao primeiro e ao último; sem seleção, a seta começa pela ponta', () => {
    expect(indiceDaTecla('Home', 2, 5, lista)).toBe(0);
    expect(indiceDaTecla('End', 0, 5, lista)).toBe(4);
    expect(indiceDaTecla('ArrowDown', -1, 5, lista)).toBe(0);
    expect(indiceDaTecla('ArrowUp', -1, 5, lista)).toBe(4);
    expect(indiceDaTecla('ArrowDown', 0, 0, lista)).toBeNull();
  });
});

describe('indicePorBusca', () => {
  const bairros = ['Altamira', 'Alto Umuarama', 'Brasil', 'Centro', 'Custódio Pereira', 'Santa Mônica', 'Saraiva'];

  it('acha o próximo rótulo que começa com o termo, sem ligar para acento e maiúscula', () => {
    expect(indicePorBusca(bairros, 'cu', -1)).toBe(4);
    expect(indicePorBusca(bairros, 'santa mo', 0)).toBe(5);
    expect(indicePorBusca(bairros, 'CUSTODIO', 0)).toBe(4);
  });

  it('repetir a letra passa para o próximo que começa com ela, dando a volta', () => {
    expect(indicePorBusca(bairros, 'a', 0)).toBe(1);
    expect(indicePorBusca(bairros, 'a', 1)).toBe(0);
    expect(indicePorBusca(bairros, 's', 6)).toBe(5);
  });

  it('devolve -1 quando nada começa com o termo', () => {
    expect(indicePorBusca(bairros, 'x', 0)).toBe(-1);
    expect(indicePorBusca(bairros, '', 0)).toBe(-1);
    expect(semAcentos('Óleo de Cozinha')).toBe('oleo de cozinha');
  });
});
