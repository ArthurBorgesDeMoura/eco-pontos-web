import { ROTA } from '../../rotas';
import { NomeIcone } from '../icone/nomes-icones';

export type PerfilDaBarra = 'acesso' | 'visitante' | 'usuario' | 'administrador';

export type PaginaDaBarra = 'pontos' | 'sugerir' | 'minhas' | 'painel';

export interface DestinoDaBarra {
  readonly pagina: PaginaDaBarra;
  readonly rota: string;
  readonly rotulo: string;
  readonly rotuloCurto: string;
  readonly icone: NomeIcone;
}

const PONTOS: DestinoDaBarra = {
  pagina: 'pontos',
  rota: ROTA.pontos,
  rotulo: 'Pontos de coleta',
  rotuloCurto: 'Pontos',
  icone: 'pino',
};
const SUGERIR: DestinoDaBarra = {
  pagina: 'sugerir',
  rota: ROTA.sugerir,
  rotulo: 'Sugerir ponto',
  rotuloCurto: 'Sugerir',
  icone: 'mais',
};
const MINHAS: DestinoDaBarra = {
  pagina: 'minhas',
  rota: ROTA.minhasSugestoes,
  rotulo: 'Minhas sugestões',
  rotuloCurto: 'Minhas',
  icone: 'prancheta',
};
const PAINEL: DestinoDaBarra = {
  pagina: 'painel',
  rota: ROTA.painel,
  rotulo: 'Painel',
  rotuloCurto: 'Painel',
  icone: 'escudo',
};

const DESTINOS: Readonly<Record<PerfilDaBarra, readonly DestinoDaBarra[]>> = {
  acesso: [],
  visitante: [PONTOS],
  usuario: [PONTOS, SUGERIR, MINHAS],
  administrador: [PONTOS, SUGERIR, MINHAS, PAINEL],
};

export function destinosDoPerfil(perfil: PerfilDaBarra): readonly DestinoDaBarra[] {
  return DESTINOS[perfil];
}

export function estaLogado(perfil: PerfilDaBarra): boolean {
  return perfil === 'usuario' || perfil === 'administrador';
}
