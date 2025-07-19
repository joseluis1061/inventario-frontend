import { Routes } from "@angular/router";

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/roles/roles.component').then(m => m.RolesComponent)
  },
  {
    path: 'crear',
    loadComponent: () => import('./pages/crear-roles/crear-roles.component').then(m => m.CrearRolesComponent)
  },
  {
    path: 'actualizar/:id',
    loadComponent: () => import('./pages/actualizar-roles/actualizar-roles.component').then(m => m.ActualizarRolesComponent)
  }
]
