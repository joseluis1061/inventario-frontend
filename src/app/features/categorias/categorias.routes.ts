import { Routes } from "@angular/router";

export const CATEGORIAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/categorias/categorias.component').then(m => m.CategoriasComponent),
    children: []
  }
];
