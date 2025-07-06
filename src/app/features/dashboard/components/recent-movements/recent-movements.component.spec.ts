import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentMovementsComponent } from './recent-movements.component';

describe('RecentMovementsComponent', () => {
  let component: RecentMovementsComponent;
  let fixture: ComponentFixture<RecentMovementsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentMovementsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentMovementsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
