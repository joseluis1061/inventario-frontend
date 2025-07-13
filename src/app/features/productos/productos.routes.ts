import { Routes } from "@angular/router";

export const PRODUCTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/productos/productos.component').then(m => m.ProductosComponent)
  },
  {
    path: 'crear',
    loadComponent: () => import('./pages/crear-productos/crear-productos.component').then(m => m.CrearProductosComponent)
  },
  {
    path: 'actualizar/:id',
    loadComponent: () => import('./pages/actualizar-productos/actualizar-productos.component').then(m => m.ActualizarProductosComponent)
  }
];
