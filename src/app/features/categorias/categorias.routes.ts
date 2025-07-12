import { Routes } from "@angular/router";

export const CATEGORIAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/categorias/categorias.component').then(m => m.CategoriasComponent),
  },
  {
    path: 'crear',
    loadComponent: () => import('./pages/crear-categoria/crear-categoria.component').then(m => m.CrearCategoriaComponent)
  },
  {
    path: 'actualizar/:id',
    loadComponent: () => import('./pages/actualizar-categoria/actualizar-categoria.component').then(m => m.ActualizarCategoriaComponent)
  }
];
