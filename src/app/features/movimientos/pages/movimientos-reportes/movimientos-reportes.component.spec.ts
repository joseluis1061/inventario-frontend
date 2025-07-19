import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosReportesComponent } from './movimientos-reportes.component';

describe('MovimientosReportesComponent', () => {
  let component: MovimientosReportesComponent;
  let fixture: ComponentFixture<MovimientosReportesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosReportesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosReportesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
