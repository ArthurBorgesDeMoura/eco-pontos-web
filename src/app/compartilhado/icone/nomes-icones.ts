export const NOMES_ICONES = [
  'busca',
  'check',
  'chevron-baixo',
  'chevron-direita',
  'escudo',
  'fechar',
  'lapis',
  'lixeira',
  'mais',
  'marca',
  'menu',
  'pino',
  'prancheta',
  'sair',
  'seta-diagonal',
  'seta-esquerda',
  'usuario',
] as const;

export type NomeIcone = typeof NOMES_ICONES[number];
