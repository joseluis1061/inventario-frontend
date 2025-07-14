import { Routes } from "@angular/router";

export const USUARIOS_ROUTES: Routes =[
  {
    path: '',
    loadComponent: () => import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent)
  },
  {
    path: 'crear',
    loadComponent: () => import('./pages/crear-usuarios/crear-usuarios.component').then(m => m.CrearUsuariosComponent)
  },
  {
    path: 'actualizar/:id',
    loadComponent: () => import('./pages/actualizar-usuarios/actualizar-usuarios.component').then(m => m.ActualizarUsuariosComponent)
  }

]
