import { Routes } from "@angular/router";

export const MOVIMIENTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/movimientos-list/movimientos-list.component').then(m => m.MovimientosListComponent)
  }
]
