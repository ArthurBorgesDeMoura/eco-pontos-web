import { EMPTY, Observable, expand, reduce } from 'rxjs';

import { PaginaDeCategorias } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';

export const MAXIMO_DE_PAGINAS_DE_CATEGORIAS = 20;

export function categoriasAte(painel: PainelService, limite: number): Observable<PaginaDeCategorias> {
  return painel.categorias(1).pipe(
    expand((pagina) => {
      const lidas = pagina.pagina * pagina.tamanho;
      const falta = pagina.itens.length > 0 && lidas < Math.min(limite, pagina.total);
      return falta && pagina.pagina < MAXIMO_DE_PAGINAS_DE_CATEGORIAS ? painel.categorias(pagina.pagina + 1) : EMPTY;
    }),
    reduce((junta, pagina) => {
      const vistas = new Set(junta.itens.map((item) => item.idCategoria));
      return { ...junta, itens: [...junta.itens, ...pagina.itens.filter((item) => !vistas.has(item.idCategoria))] };
    }),
  );
}
