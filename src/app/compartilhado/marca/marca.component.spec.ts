import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarcaComponent } from './marca.component';

describe('MarcaComponent', () => {
  let fixture: ComponentFixture<MarcaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [MarcaComponent] }).compileComponents();
    fixture = TestBed.createComponent(MarcaComponent);
  });

  it('mostra o símbolo, "EcoPonto" e a cidade', () => {
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#marca');
    expect(elemento.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(elemento.textContent?.replace(/\s+/g, ' ').trim()).toBe('EcoPonto Uberlândia – MG');
  });

  it('sem a cidade, como no cabeçalho do celular', () => {
    fixture.componentInstance.mostrarCidade = false;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('EcoPonto');
  });
});
