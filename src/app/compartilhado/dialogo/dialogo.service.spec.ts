import { DialogoService, PedidoDeConfirmacao } from './dialogo.service';

describe('DialogoService', () => {
  let servico: DialogoService;
  let atual: PedidoDeConfirmacao | null;

  beforeEach(() => {
    servico = new DialogoService();
    servico.atual.subscribe((pedido) => (atual = pedido));
  });

  it('abre o pedido com os padrões e devolve true quando a pessoa confirma', async () => {
    const resposta = servico.confirmar({ titulo: 'Excluir ponto?', texto: 'Não dá para desfazer.', confirmar: 'Excluir ponto' });

    expect(atual?.cancelar).toBe('Cancelar');
    expect(atual?.tipo).toBe('primario');
    servico.responder(true);

    expect(await resposta).toBeTrue();
    expect(atual).toBeNull();
  });

  it('devolve false quando a pessoa cancela', async () => {
    const resposta = servico.confirmar({ titulo: 'Sair?', texto: '', confirmar: 'Sair', tipo: 'exclusao' });
    expect(atual?.tipo).toBe('exclusao');

    servico.responder(false);
    expect(await resposta).toBeFalse();
  });

  it('abrir outro diálogo cancela o anterior', async () => {
    const primeira = servico.confirmar({ titulo: 'A', texto: '', confirmar: 'A' });
    const segunda = servico.confirmar({ titulo: 'B', texto: '', confirmar: 'B' });

    expect(await primeira).toBeFalse();
    expect(atual?.titulo).toBe('B');
    servico.responder(true);
    expect(await segunda).toBeTrue();
  });

  it('responder sem diálogo aberto não faz nada', () => {
    expect(() => servico.responder(true)).not.toThrow();
    expect(atual).toBeNull();
  });
});
