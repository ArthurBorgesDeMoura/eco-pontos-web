import { ROTA } from '../../rotas';

export function destinoSeguro(pedido: string | null | undefined): string {
  if (!pedido || !pedido.startsWith('/') || pedido.startsWith('//') || /[\\\s]/.test(pedido)) {
    return ROTA.pontos;
  }
  const caminho = pedido.split(/[?#]/)[0].replace(/\/+$/, '');
  if (caminho === ROTA.entrar || caminho === ROTA.criarConta) {
    return ROTA.pontos;
  }
  return pedido;
}
