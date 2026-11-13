export interface OpcoesDeNavegacao {
  orientacao: 'vertical' | 'horizontal';
  circular: boolean;
}

export function indiceDaTecla(tecla: string, atual: number, total: number, opcoes: OpcoesDeNavegacao): number | null {
  if (total <= 0) {
    return null;
  }
  const [anterior, proxima] = opcoes.orientacao === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  const ultimo = total - 1;
  switch (tecla) {
    case 'Home':
      return 0;
    case 'End':
      return ultimo;
    case proxima:
      if (atual < 0) {
        return 0;
      }
      return atual >= ultimo ? (opcoes.circular ? 0 : ultimo) : atual + 1;
    case anterior:
      if (atual < 0) {
        return ultimo;
      }
      return atual <= 0 ? (opcoes.circular ? ultimo : 0) : atual - 1;
    default:
      return null;
  }
}

export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function indicePorBusca(rotulos: readonly string[], termo: string, atual: number): number {
  const procurado = semAcentos(termo);
  if (procurado === '') {
    return -1;
  }
  for (let passo = 1; passo <= rotulos.length; passo++) {
    const indice = (Math.max(atual, -1) + passo) % rotulos.length;
    if (semAcentos(rotulos[indice]).startsWith(procurado)) {
      return indice;
    }
  }
  return -1;
}
