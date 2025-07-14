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
        loadChildren: () => import('./features/categorias/categorias.routes').then(m => m.CATEGORIAS_ROUTES)
      }
    ]
  },

  // Productos con MainLayout
  {
    path: 'productos',
    loadComponent: () => import('./layouts/main-layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/productos/productos.routes').then(m => m.PRODUCTOS_ROUTES)
      }
    ]
  },

  // Usuarios con MainLayout
  {
    path: 'usuarios',
    loadComponent: () => import('./layouts/main-layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/usuarios/usuarios.routes').then(m => m.USUARIOS_ROUTES)
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
