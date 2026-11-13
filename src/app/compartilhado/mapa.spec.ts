import { linkDoMapa } from './mapa';

describe('linkDoMapa', () => {
  it('busca endereço, bairro e cidade no Google Maps, com a consulta codificada', () => {
    expect(linkDoMapa('Av. Rondon Pacheco, 6400', 'Tibery')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Rondon%20Pacheco%2C%206400%2C%20Tibery%2C%20Uberl%C3%A2ndia%20-%20MG',
    );
  });

  it('codifica caracteres que quebrariam a URL', () => {
    const link = new URL(linkDoMapa('Rua A & B, 10 #2', 'Santa Mônica'));

    expect(link.searchParams.get('api')).toBe('1');
    expect(link.searchParams.get('query')).toBe('Rua A & B, 10 #2, Santa Mônica, Uberlândia - MG');
  });

  it('ignora partes vazias ou só com espaços', () => {
    expect(new URL(linkDoMapa('  Praça Clarimundo Carneiro, 209 ', '   ')).searchParams.get('query')).toBe(
      'Praça Clarimundo Carneiro, 209, Uberlândia - MG',
    );
  });
});
