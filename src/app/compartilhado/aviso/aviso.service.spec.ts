import { Aviso, AvisoService } from './aviso.service';

describe('AvisoService', () => {
  let servico: AvisoService;
  let atual: Aviso | null;

  beforeEach(() => {
    servico = new AvisoService();
    servico.atual.subscribe((aviso) => (atual = aviso));
  });

  it('mostra um aviso por vez: o novo substitui o anterior', () => {
    servico.mostrar('Ponto aprovado.');
    const primeiro = atual;
    servico.mostrar('Ponto recusado.');

    expect(atual?.texto).toBe('Ponto recusado.');
    expect(atual?.id).not.toBe(primeiro?.id);
  });

  it('ignora texto vazio e tira os espaços das pontas', () => {
    servico.mostrar('   ');
    expect(atual).toBeNull();

    servico.mostrar('  Sugestão enviada.  ');
    expect(atual?.texto).toBe('Sugestão enviada.');
  });

  it('fecha só o aviso indicado, para um aviso velho não fechar o novo', () => {
    servico.mostrar('Primeiro');
    const idAntigo = atual?.id ?? 0;
    servico.mostrar('Segundo');

    servico.fechar(idAntigo);
    expect(atual?.texto).toBe('Segundo');

    servico.fechar(atual?.id ?? 0);
    expect(atual).toBeNull();
  });
});
