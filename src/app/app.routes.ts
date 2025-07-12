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
  // Dashboard con MainLayout
  {
    path: 'dashboard',
    loadComponent: () => import('./layouts/main-layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      }
    ]
  },

  // Categorías con MainLayout
  {
    path: 'categorias',
    loadComponent: () => import('./layouts/main-layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/categorias/pages/categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'crear',
        loadComponent: () => import('./features/categorias/pages/crear-categoria/crear-categoria.component').then(m => m.CrearCategoriaComponent)
      },
      {
        path: 'actualizar/:id',
        loadComponent: () => import('./features/categorias/pages/actualizar-categoria/actualizar-categoria.component').then(m => m.ActualizarCategoriaComponent)
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
