import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosPorProductoComponent } from './movimientos-por-producto.component';

describe('MovimientosPorProductoComponent', () => {
  let component: MovimientosPorProductoComponent;
  let fixture: ComponentFixture<MovimientosPorProductoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosPorProductoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosPorProductoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
