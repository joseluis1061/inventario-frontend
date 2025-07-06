import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Guard funcional para proteger rutas que requieren autenticación
 * Verifica si el usuario está autenticado antes de permitir acceso
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🛡️ AuthGuard: Verificando autenticación para:', state.url);

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        console.log('✅ AuthGuard: Usuario autenticado, acceso permitido');
        return true;
      } else {
        console.log('❌ AuthGuard: Usuario no autenticado, redirigiendo a login');
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }
    })
  );
};
