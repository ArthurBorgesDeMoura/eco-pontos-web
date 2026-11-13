export const ROTA = {
  pontos: '/',
  entrar: '/entrar',
  criarConta: '/criar-conta',
  sugerir: '/sugerir',
  minhasSugestoes: '/minhas-sugestoes',
  painel: '/painel',
} as const;

export const ROTA_DOS_PONTOS_DO_PAINEL = `${ROTA.painel}?aba=pontos`;

export function rotaDaEdicao(idPonto: number): string {
  return `${ROTA.painel}/pontos/${encodeURIComponent(idPonto)}/editar`;
}

export const ROTA_DAS_CATEGORIAS_DO_PAINEL = `${ROTA.painel}?aba=categorias`;

export const ROTA_DA_NOVA_CATEGORIA = `${ROTA.painel}/categorias/nova`;

export function rotaDaCategoria(idCategoria: number): string {
  return `${ROTA.painel}/categorias/${encodeURIComponent(idCategoria)}/editar`;
}
