import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, adminGuard, managerGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  // Redirect root
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // Rutas públicas (solo si NO está autenticado)
  {
    path: 'login',
    loadChildren: () => import('./features/autenticacion/autenticacion.routes').then(m => m.AUTENTICACION_ROUTES),
    canActivate: [noAuthGuard]
  },

  // Dashboard (requiere autenticación)
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
    canActivate: [authGuard]
  },

  // Usuarios (solo administradores)
  // {
  //   path: 'usuarios',
  //   loadChildren: () => import('./features/usuarios/usuarios.routes').then(m => m.USUARIOS_ROUTES),
  //   canActivate: [authGuard, adminGuard]
  // },

  // Reportes (gerentes o superior)
  // {
  //   path: 'reportes',
  //   loadChildren: () => import('./features/reportes/reportes.routes').then(m => m.REPORTES_ROUTES),
  //   canActivate: [authGuard, managerGuard]
  // },

  // Productos (usando roleGuard con múltiples roles)
  // {
  //   path: 'productos',
  //   loadChildren: () => import('./features/productos/productos.routes').then(m => m.PRODUCTOS_ROUTES),
  //   canActivate: [authGuard, roleGuard],
  //   data: {
  //     roles: ['ADMIN', 'GERENTE'],
  //     requireAll: false // Al menos uno de los roles
  //   }
  // },

  // Wildcard route
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
