import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Guard funcional para rutas que NO deben ser accesibles cuando el usuario está autenticado
 * Útil para páginas de login, registro, etc.
 */
export const noAuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🚫 NoAuthGuard: Verificando para ruta:', state.url);

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        console.log('✅ NoAuthGuard: Usuario no autenticado, acceso permitido');
        return true;
      } else {
        console.log('❌ NoAuthGuard: Usuario ya autenticado, redirigiendo a dashboard');
        router.navigate(['/movimientos']); // dashboard
        return false;
      }
    })
  );
};
