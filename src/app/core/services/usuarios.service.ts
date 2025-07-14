import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  UsuarioResponse,
  UsuarioCreateRequest,
  UsuarioUpdateRequest,
  UsuarioCambiarPasswordRequest,
  UsuarioCambiarEstadoRequest,
  UsuarioBasico,
  UsuarioFiltros,
  UsuarioPaginacionParams,
  UsuarioPaginatedResponse,
  UsuarioEstadisticas,
  UsuarioLoadingStates,
  UsuarioCreateWithPasswordRequest
} from '../models/usuario.interface';
import { AuthService } from './auth-service.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  private readonly apiUrl = `${environment.apiUrl}/api/usuarios`;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // ===== ESTADOS REACTIVOS =====

  // Lista de usuarios en memoria
  private usuariosSubject = new BehaviorSubject<UsuarioResponse[]>([]);
  public usuarios$ = this.usuariosSubject.asObservable();

  // Estados de loading con signals
  loadingStates = signal<UsuarioLoadingStates>({
    listing: false,
    creating: false,
    updating: false,
    deleting: false,
    searching: false,
    loadingById: false,
    loadingActivos: false,
    loadingByRol: false,
    changingPassword: false,
    changingEstado: false
  });

  // Cache simple para usuarios
  private usuariosCache: UsuarioResponse[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutos (datos de usuarios cambian frecuentemente)

  constructor() {
    console.log('👥 UsuariosService inicializado');
  }

  // ===== MÉTODOS HTTP HEADERS =====

  /**
   * Obtiene los headers con autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Listar todos los usuarios
   * GET /api/usuarios
   */
  obtenerTodos(useCache: boolean = true): Observable<UsuarioResponse[]> {
    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid()) {
      console.log('📦 Usando usuarios desde cache');
      return of(this.usuariosCache!);
    }

    this.updateLoadingState('listing', true);

    return this.http.get<UsuarioResponse[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(usuarios => {
        console.log(`👥 Usuarios obtenidos: ${usuarios.length}`);
        this.updateCache(usuarios);
        this.usuariosSubject.next(usuarios);
      }),
      catchError(error => this.handleError('Error al obtener usuarios', error)),
      finalize(() => this.updateLoadingState('listing', false)),
      shareReplay(1)
    );
  }

  /**
   * Obtener usuarios activos
   * GET /api/usuarios/activos
   */
  obtenerActivos(): Observable<UsuarioResponse[]> {
    this.updateLoadingState('loadingActivos', true);

    return this.http.get<UsuarioResponse[]>(`${this.apiUrl}/activos`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(usuarios => {
        console.log(`✅ Usuarios activos obtenidos: ${usuarios.length}`);
      }),
      catchError(error => this.handleError('Error al obtener usuarios activos', error)),
      finalize(() => this.updateLoadingState('loadingActivos', false))
    );
  }

  /**
   * Obtener usuario por ID
   * GET /api/usuarios/{id}
   */
  obtenerPorId(id: number): Observable<UsuarioResponse> {
    this.updateLoadingState('loadingById', true);

    return this.http.get<UsuarioResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(usuario => {
        console.log(`👤 Usuario obtenido: ${usuario.username} (ID: ${id})`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Usuario con ID ${id} no encontrado`));
        }
        return this.handleError(`Error al obtener usuario ${id}`, error);
      }),
      finalize(() => this.updateLoadingState('loadingById', false))
    );
  }

  /**
   * Buscar usuario por username
   * GET /api/usuarios/buscar?username={username}
   */
  buscarPorUsername(username: string): Observable<UsuarioResponse> {
    this.updateLoadingState('searching', true);

    const params = new HttpParams().set('username', username);

    return this.http.get<UsuarioResponse>(`${this.apiUrl}/buscar`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(usuario => {
        console.log(`🔍 Usuario encontrado: ${usuario.username}`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Usuario '${username}' no encontrado`));
        }
        return this.handleError(`Error al buscar usuario '${username}'`, error);
      }),
      finalize(() => this.updateLoadingState('searching', false))
    );
  }

  /**
   * Obtener usuarios por rol
   * GET /api/usuarios/por-rol/{rolId}
   */
  obtenerPorRol(rolId: number): Observable<UsuarioResponse[]> {
    this.updateLoadingState('loadingByRol', true);

    return this.http.get<UsuarioResponse[]>(`${this.apiUrl}/por-rol/${rolId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(usuarios => {
        console.log(`👥 Usuarios por rol ${rolId}: ${usuarios.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener usuarios por rol ${rolId}`, error)),
      finalize(() => this.updateLoadingState('loadingByRol', false))
    );
  }

  /**
   * Crear nuevo usuario
   * POST /api/usuarios?password={password}
   */
  crear(usuario: UsuarioCreateRequest, password: string): Observable<UsuarioResponse> {
    this.updateLoadingState('creating', true);

    const params = new HttpParams().set('password', password);

    return this.http.post<UsuarioResponse>(this.apiUrl, usuario, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(nuevoUsuario => {
        console.log(`✅ Usuario creado: ${nuevoUsuario.username} (ID: ${nuevoUsuario.id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Usuario '${nuevoUsuario.username}' creado exitosamente`,
          'Usuario Creado'
        );

        // Agregar a la lista en memoria
        const usuariosActuales = this.usuariosSubject.value;
        this.usuariosSubject.next([...usuariosActuales, nuevoUsuario]);
      }),
      catchError(error => {
        if (error.status === 409) {
          return this.handleError('Ya existe un usuario con ese username o email', error);
        }
        if (error.status === 400) {
          return this.handleError('Datos inválidos para crear el usuario', error);
        }
        return this.handleError('Error al crear usuario', error);
      }),
      finalize(() => this.updateLoadingState('creating', false))
    );
  }

  /**
   * Actualizar usuario existente
   * PUT /api/usuarios/{id}
   */
  actualizar(id: number, usuario: UsuarioUpdateRequest): Observable<UsuarioResponse> {
    this.updateLoadingState('updating', true);

    return this.http.put<UsuarioResponse>(`${this.apiUrl}/${id}`, usuario, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(usuarioActualizado => {
        console.log(`✅ Usuario actualizado: ${usuarioActualizado.username} (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Usuario '${usuarioActualizado.username}' actualizado exitosamente`,
          'Usuario Actualizado'
        );

        // Actualizar en la lista en memoria
        const usuariosActuales = this.usuariosSubject.value;
        const index = usuariosActuales.findIndex(user => user.id === id);
        if (index !== -1) {
          usuariosActuales[index] = usuarioActualizado;
          this.usuariosSubject.next([...usuariosActuales]);
        }
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Usuario no encontrado', error);
        }
        if (error.status === 409) {
          return this.handleError('Ya existe un usuario con ese username o email', error);
        }
        if (error.status === 400) {
          return this.handleError('Datos inválidos para actualizar el usuario', error);
        }
        return this.handleError('Error al actualizar usuario', error);
      }),
      finalize(() => this.updateLoadingState('updating', false))
    );
  }

  /**
   * Cambiar contraseña de usuario
   * PUT /api/usuarios/{id}/cambiar-password?passwordActual={passwordActual}&passwordNuevo={passwordNuevo}
   */
  cambiarPassword(id: number, passwordActual: string, passwordNuevo: string): Observable<void> {
    this.updateLoadingState('changingPassword', true);

    const params = new HttpParams()
      .set('passwordActual', passwordActual)
      .set('passwordNuevo', passwordNuevo);

    return this.http.put<void>(`${this.apiUrl}/${id}/cambiar-password`, {}, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(() => {
        console.log(`🔑 Contraseña cambiada para usuario ID: ${id}`);
        this.notificationService.success(
          'Contraseña actualizada exitosamente',
          'Contraseña Cambiada'
        );
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Usuario no encontrado', error);
        }
        if (error.status === 400) {
          return this.handleError('Contraseña actual incorrecta', error);
        }
        return this.handleError('Error al cambiar contraseña', error);
      }),
      finalize(() => this.updateLoadingState('changingPassword', false))
    );
  }

  /**
   * Cambiar estado de usuario (activo/inactivo)
   * PUT /api/usuarios/{id}/cambiar-estado?activo={activo}
   */
  cambiarEstado(id: number, activo: boolean): Observable<UsuarioResponse> {
    this.updateLoadingState('changingEstado', true);

    const params = new HttpParams().set('activo', activo.toString());

    return this.http.put<UsuarioResponse>(`${this.apiUrl}/${id}/cambiar-estado`, {}, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(usuarioActualizado => {
        console.log(`🔄 Estado cambiado para usuario: ${usuarioActualizado.username} - ${activo ? 'Activo' : 'Inactivo'}`);
        this.invalidateCache();
        this.notificationService.success(
          `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`,
          'Estado Actualizado'
        );

        // Actualizar en la lista en memoria
        const usuariosActuales = this.usuariosSubject.value;
        const index = usuariosActuales.findIndex(user => user.id === id);
        if (index !== -1) {
          usuariosActuales[index] = usuarioActualizado;
          this.usuariosSubject.next([...usuariosActuales]);
        }
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Usuario no encontrado', error);
        }
        if (error.status === 403) {
          return this.handleError('No se puede cambiar el estado de este usuario', error);
        }
        return this.handleError('Error al cambiar estado del usuario', error);
      }),
      finalize(() => this.updateLoadingState('changingEstado', false))
    );
  }

  /**
   * Eliminar usuario
   * DELETE /api/usuarios/{id}
   */
  eliminar(id: number): Observable<void> {
    this.updateLoadingState('deleting', true);

    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`🗑️ Usuario eliminado (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          'Usuario eliminado exitosamente',
          'Usuario Eliminado'
        );

        // Remover de la lista en memoria
        const usuariosActuales = this.usuariosSubject.value;
        const usuariosFiltrados = usuariosActuales.filter(user => user.id !== id);
        this.usuariosSubject.next(usuariosFiltrados);
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Usuario no encontrado', error);
        }
        if (error.status === 409) {
          return this.handleError('No se puede eliminar este usuario porque tiene datos asociados', error);
        }
        if (error.status === 403) {
          return this.handleError('No se puede eliminar este usuario', error);
        }
        return this.handleError('Error al eliminar usuario', error);
      }),
      finalize(() => this.updateLoadingState('deleting', false))
    );
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Obtener usuarios básicos para selects
   */
  obtenerBasicos(): Observable<UsuarioBasico[]> {
    return this.obtenerTodos().pipe(
      map(usuarios => usuarios.map(user => ({
        id: user.id,
        username: user.username,
        nombreCompleto: user.nombreCompleto,
        email: user.email,
        activo: user.activo,
        nombreRol: user.nombreRol,
        iniciales: user.iniciales
      })))
    );
  }

  /**
   * Filtrar usuarios por criterios
   */
  filtrar(filtros: UsuarioFiltros): Observable<UsuarioResponse[]> {
    return this.obtenerTodos().pipe(
      map(usuarios => {
        return usuarios.filter(usuario => {
          if (filtros.username && !usuario.username.toLowerCase().includes(filtros.username.toLowerCase())) {
            return false;
          }
          if (filtros.nombreCompleto && !usuario.nombreCompleto.toLowerCase().includes(filtros.nombreCompleto.toLowerCase())) {
            return false;
          }
          if (filtros.email && !usuario.email.toLowerCase().includes(filtros.email.toLowerCase())) {
            return false;
          }
          if (filtros.rolId && usuario.rol.id !== filtros.rolId) {
            return false;
          }
          if (filtros.activo !== undefined && usuario.activo !== filtros.activo) {
            return false;
          }
          if (filtros.esAdminPrincipal !== undefined && usuario.esAdminPrincipal !== filtros.esAdminPrincipal) {
            return false;
          }
          return true;
        });
      })
    );
  }

  /**
   * Buscar usuarios por término general
   */
  buscarUsuarios(termino: string): Observable<UsuarioResponse[]> {
    if (!termino.trim()) {
      return this.obtenerTodos();
    }

    return this.obtenerTodos().pipe(
      map(usuarios => {
        const terminoLower = termino.toLowerCase();
        return usuarios.filter(usuario =>
          usuario.username.toLowerCase().includes(terminoLower) ||
          usuario.nombreCompleto.toLowerCase().includes(terminoLower) ||
          usuario.email.toLowerCase().includes(terminoLower) ||
          usuario.nombreRol.toLowerCase().includes(terminoLower)
        );
      })
    );
  }

  /**
   * Obtener estadísticas de usuarios
   */
  obtenerEstadisticas(): Observable<UsuarioEstadisticas> {
    return this.obtenerTodos().pipe(
      map(usuarios => {
        const totalUsuarios = usuarios.length;
        const usuariosActivos = usuarios.filter(u => u.activo).length;
        const usuariosInactivos = totalUsuarios - usuariosActivos;

        // Contar por rol
        const usuariosPorRol: { [rolNombre: string]: number } = {};
        usuarios.forEach(usuario => {
          usuariosPorRol[usuario.nombreRol] = (usuariosPorRol[usuario.nombreRol] || 0) + 1;
        });

        return {
          totalUsuarios,
          usuariosActivos,
          usuariosInactivos,
          porcentajeActivos: totalUsuarios > 0 ? Math.round((usuariosActivos / totalUsuarios) * 100) : 0,
          usuariosPorRol
        };
      })
    );
  }

  /**
   * Refrescar cache y datos
   */
  refrescar(): Observable<UsuarioResponse[]> {
    this.invalidateCache();
    return this.obtenerTodos(false);
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Actualizar estado de loading específico
   */
  private updateLoadingState(operation: keyof UsuarioLoadingStates, loading: boolean): void {
    const currentStates = this.loadingStates();
    this.loadingStates.set({
      ...currentStates,
      [operation]: loading
    });
  }

  /**
   * Manejo centralizado de errores
   */
  private handleError(userMessage: string, error: any): Observable<never> {
    console.error(`❌ ${userMessage}:`, error);

    let finalMessage = userMessage;

    if (error.status === 401) {
      finalMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 403) {
      finalMessage = 'No tienes permisos para realizar esta acción.';
    } else if (error.status === 0) {
      finalMessage = 'Error de conexión. Verifica tu internet.';
    } else if (error.error?.message) {
      finalMessage = error.error.message;
    }

    this.notificationService.error(finalMessage, 'Error');
    return throwError(() => new Error(finalMessage));
  }

  /**
   * Validar si el cache es válido
   */
  private isCacheValid(): boolean {
    return this.usuariosCache !== null &&
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Actualizar cache
   */
  private updateCache(usuarios: UsuarioResponse[]): void {
    this.usuariosCache = usuarios;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Invalidar cache
   */
  private invalidateCache(): void {
    this.usuariosCache = null;
    this.cacheTimestamp = 0;
  }

  // ===== GETTERS PÚBLICOS =====

  /**
   * Verificar si alguna operación está cargando
   */
  get isAnyLoading(): boolean {
    const states = this.loadingStates();
    return Object.values(states).some(loading => loading);
  }

  /**
   * Obtener usuarios desde el estado actual
   */
  get usuariosActuales(): UsuarioResponse[] {
    return this.usuariosSubject.value;
  }

  /**
   * Obtener conteo de usuarios por estado
   */
  get estadosUsuarioConteo(): { activos: number; inactivos: number; admins: number; empleados: number } {
    const usuarios = this.usuariosActuales;
    return {
      activos: usuarios.filter(u => u.activo).length,
      inactivos: usuarios.filter(u => !u.activo).length,
      admins: usuarios.filter(u => u.nombreRol === 'ADMIN').length,
      empleados: usuarios.filter(u => u.nombreRol === 'EMPLEADO').length
    };
  }
}
