import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Guard específico para rutas de administrador
 */
export const adminGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👑 AdminGuard: Verificando permisos de administrador para:', state.url);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.log('❌ AdminGuard: Usuario no autenticado');
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }

      if (authService.isAdmin()) {
        console.log('✅ AdminGuard: Usuario es administrador, acceso permitido');
        return true;
      } else {
        console.log('❌ AdminGuard: Usuario no es administrador, acceso denegado');
        router.navigate(['/dashboard'], {
          queryParams: {
            error: 'admin_required',
            message: 'Se requieren permisos de administrador'
          }
        });
        return false;
      }
    })
  );
};
