import { Pagina } from './modelos';

export function comoPagina<T>(resposta: Pagina<T> | T[], pagina: number): Pagina<T> {
  if (Array.isArray(resposta)) {
    return { itens: resposta, total: resposta.length, pagina: 1, tamanho: resposta.length };
  }
  return { ...resposta, pagina: resposta.pagina ?? pagina };
}
