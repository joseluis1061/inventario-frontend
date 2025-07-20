import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Guard funcional para proteger rutas basadas en roles
 * Verifica si el usuario tiene el rol necesario para acceder
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Obtener roles requeridos desde los datos de la ruta
  const requiredRoles: string[] = route.data['roles'] || [];
  const requireAll: boolean = route.data['requireAll'] || false; // true = requiere TODOS los roles, false = requiere AL MENOS UNO

  console.log('🔐 RoleGuard: Verificando roles para:', state.url);
  console.log('🎭 Roles requeridos:', requiredRoles);

  if (requiredRoles.length === 0) {
    console.log('⚠️ RoleGuard: No se especificaron roles requeridos, acceso permitido');
    return true;
  }

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.log('❌ RoleGuard: Usuario no autenticado, redirigiendo a login');
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }

      const userRole = user.role;
      console.log('👤 Usuario actual con rol:', userRole);

      const hasAccess = checkRoleAccess(userRole, requiredRoles, requireAll);

      if (hasAccess) {
        console.log('✅ RoleGuard: Acceso permitido');
        return true;
      } else {
        console.log('❌ RoleGuard: Sin permisos suficientes, redirigiendo');
        router.navigate(['/movimientos'], { //dashboard
          queryParams: {
            error: 'insufficient_permissions',
            requiredRole: requiredRoles.join(',')
          }
        });
        return false;
      }
    })
  );
};

/**
 * Verificar si el usuario tiene acceso basado en roles
 */
function checkRoleAccess(userRole: string, requiredRoles: string[], requireAll: boolean): boolean {
  if (requireAll) {
    // Requiere TODOS los roles especificados
    return requiredRoles.every(role => hasRoleAccess(userRole, role));
  } else {
    // Requiere AL MENOS UNO de los roles especificados
    return requiredRoles.some(role => hasRoleAccess(userRole, role));
  }
}

/**
 * Verificar si un rol de usuario tiene acceso a un rol requerido
 * Implementa jerarquía de roles: ADMIN > GERENTE > EMPLEADO
 */
function hasRoleAccess(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: { [key: string]: number } = {
    'ADMIN': 3,
    'GERENTE': 2,
    'EMPLEADO': 1
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  // El usuario tiene acceso si su nivel es mayor o igual al requerido
  return userLevel >= requiredLevel;
}
