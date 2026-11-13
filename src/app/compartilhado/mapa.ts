const CIDADE = 'Uberlândia - MG';

export function linkDoMapa(endereco: string, bairro: string): string {
  const partes = [endereco, bairro, CIDADE].map((parte) => parte.trim()).filter((parte) => parte !== '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`;
}
