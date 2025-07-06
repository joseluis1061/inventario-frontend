import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockAlertsComponent } from './stock-alerts.component';

describe('StockAlertsComponent', () => {
  let component: StockAlertsComponent;
  let fixture: ComponentFixture<StockAlertsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockAlertsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockAlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
