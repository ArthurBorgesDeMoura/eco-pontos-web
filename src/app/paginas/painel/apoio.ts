import { PontoResumo } from '../../api/modelos';

export function materiaisDoPonto(ponto: PontoResumo): string {
  return (ponto.materiais ?? []).map((material) => material.nome).join(', ');
}

export function bairroDoPonto(ponto: PontoResumo): string {
  return ponto.bairro?.nome ?? '';
}

export function localDoPonto(ponto: PontoResumo): string {
  return [bairroDoPonto(ponto), ponto.endereco ?? ''].filter((parte) => parte.trim() !== '').join(' · ');
}

export const DURACAO_DA_SAIDA_DA_LINHA_MS = 160;

export function semO(ids: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const copia = new Set(ids);
  copia.delete(id);
  return copia;
}

export function estaVisivel(elemento: HTMLElement): boolean {
  return elemento.getClientRects().length > 0;
}

export function focoPerdido(documento: Document): boolean {
  return !documento.activeElement || documento.activeElement === documento.body;
}
