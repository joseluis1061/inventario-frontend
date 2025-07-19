import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResumenStockComponent } from './resumen-stock.component';

describe('ResumenStockComponent', () => {
  let component: ResumenStockComponent;
  let fixture: ComponentFixture<ResumenStockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumenStockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResumenStockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
