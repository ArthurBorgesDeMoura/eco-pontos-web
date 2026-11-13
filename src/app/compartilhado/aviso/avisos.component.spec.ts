import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { AvisoService } from './aviso.service';
import { AvisosComponent } from './avisos.component';

const SAIDA_MS = 400;

describe('AvisosComponent', () => {
  let fixture: ComponentFixture<AvisosComponent>;
  let avisos: AvisoService;
  let elemento: HTMLElement;

  function aviso(): HTMLElement | null {
    return elemento.querySelector('eco-aviso');
  }

  function passar(ms: number): void {
    tick(ms);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CompartilhadoModule] }).compileComponents();
    fixture = TestBed.createComponent(AvisosComponent);
    avisos = TestBed.inject(AvisoService);
    elemento = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    delete (document as { hidden?: boolean }).hidden;
  });

  it('anuncia o aviso numa região viva educada', () => {
    fixture.detectChanges();
    const regiao = elemento.querySelector('.avisos') as HTMLElement;

    expect(regiao.getAttribute('role')).toBe('status');
    expect(regiao.getAttribute('aria-live')).toBe('polite');
  });

  it('mostra o texto e some sozinho depois de 4 s', fakeAsync(() => {
    fixture.detectChanges();
    avisos.mostrar('Pão de Açúcar aprovado e publicado.');
    fixture.detectChanges();
    expect(aviso()?.textContent?.trim()).toBe('Pão de Açúcar aprovado e publicado.');

    passar(3999);
    expect(aviso()).not.toBeNull();
    expect(aviso()?.classList).not.toContain('avisos__aviso--saindo');

    passar(1);
    expect(aviso()?.classList).toContain('avisos__aviso--saindo');

    passar(SAIDA_MS);
    expect(aviso()).toBeNull();
  }));

  it('o relógio para com o mouse em cima e volta de onde parou', fakeAsync(() => {
    fixture.detectChanges();
    avisos.mostrar('Sugestão enviada. Ela fica pendente até a análise.');
    fixture.detectChanges();

    passar(1000);
    aviso()?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    passar(10_000);
    expect(aviso()?.classList).not.toContain('avisos__aviso--saindo');

    aviso()?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    passar(2999);
    expect(aviso()?.classList).not.toContain('avisos__aviso--saindo');
    passar(1);
    expect(aviso()?.classList).toContain('avisos__aviso--saindo');
    passar(SAIDA_MS);
    expect(aviso()).toBeNull();
  }));

  it('um toque no aviso não para o relógio: no celular, ele some em 4 s do mesmo jeito', fakeAsync(() => {
    fixture.detectChanges();
    avisos.mostrar('Sugestão enviada. Ela fica pendente até a análise.');
    fixture.detectChanges();

    passar(1000);
    aviso()?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    passar(3000);
    expect(aviso()?.classList).toContain('avisos__aviso--saindo');
    passar(SAIDA_MS);
    expect(aviso()).toBeNull();
  }));

  it('o relógio para enquanto a aba do navegador está escondida', fakeAsync(() => {
    fixture.detectChanges();
    avisos.mostrar('Ponto excluído.');
    fixture.detectChanges();

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    passar(10_000);
    expect(aviso()?.classList).not.toContain('avisos__aviso--saindo');

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    passar(4000);
    expect(aviso()?.classList).toContain('avisos__aviso--saindo');
    passar(SAIDA_MS);
    expect(aviso()).toBeNull();
  }));

  it('um aviso novo troca o anterior e recomeça os 4 s', fakeAsync(() => {
    fixture.detectChanges();
    avisos.mostrar('Primeiro.');
    fixture.detectChanges();
    passar(3000);

    avisos.mostrar('Segundo.');
    fixture.detectChanges();
    expect(elemento.querySelectorAll('eco-aviso').length).toBe(1);
    expect(aviso()?.textContent?.trim()).toBe('Segundo.');

    passar(3999);
    expect(aviso()?.classList).not.toContain('avisos__aviso--saindo');
    passar(1 + SAIDA_MS);
    expect(aviso()).toBeNull();
  }));
});
