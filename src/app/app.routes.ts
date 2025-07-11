import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards';
import { CATEGORIAS_ROUTES } from './features/categorias/categorias.routes';

export const routes: Routes = [
  // Redirect root
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // Rutas de autenticación con AuthLayout
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

  // ✅ Rutas principales con MainLayout
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'categorias',
        loadChildren: () => import('./features/categorias/categorias.routes').then(m => m.CATEGORIAS_ROUTES)
      }
    ]
  },

  // Redirect login
  {
    path: 'login',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },

  // Wildcard route
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
