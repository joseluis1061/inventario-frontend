import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, adminGuard, managerGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  // Redirect root
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // ✅ Rutas de autenticación con AuthLayout
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    canActivate: [noAuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      },
      {
        path: 'login',
        loadComponent: () => import('./features/autenticacion/pages/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/autenticacion/pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      }
    ]
  },

  // ✅ Ruta de login directa (redirect a auth/login)
  {
    path: 'login',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },

  // Dashboard (requiere autenticación)
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
    canActivate: [authGuard]
  },

  // Wildcard route
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
