import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  RolResponse,
  RolCreateRequest,
  RolUpdateRequest,
  RolBasico,
  RolFiltros,
  RolPaginacionParams,
  RolPaginatedResponse,
  RolEstadisticas,
  RolLoadingStates,
  RolConUsuarios
} from '../models/rol.interface';
import { AuthService } from './auth-service.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private readonly apiUrl = `${environment.apiUrl}/api/roles`;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // ===== ESTADOS REACTIVOS =====

  // Lista de roles en memoria
  private rolesSubject = new BehaviorSubject<RolResponse[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  // Estados de loading con signals
  loadingStates = signal<RolLoadingStates>({
    listing: false,
    creating: false,
    updating: false,
    deleting: false,
    searching: false,
    loadingById: false,
    loadingUsuariosPorRol: false
  });

  // Cache simple para roles
  private rolesCache: RolResponse[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutos (roles cambian poco)

  constructor() {
    console.log('🛡️ RolesService inicializado');
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

  // ===== MÉTODOS DE CACHE =====

  /**
   * Verifica si el cache es válido
   */
  private isCacheValid(): boolean {
    return this.rolesCache !== null &&
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Limpia el cache
   */
  private clearCache(): void {
    this.rolesCache = null;
    this.cacheTimestamp = 0;
    console.log('🗑️ Cache de roles limpiado');
  }

  /**
   * Actualiza el cache
   */
  private updateCache(roles: RolResponse[]): void {
    this.rolesCache = [...roles];
    this.cacheTimestamp = Date.now();
    console.log(`📦 Cache de roles actualizado con ${roles.length} elementos`);
  }

  // ===== MÉTODOS DE ESTADO =====

  /**
   * Actualiza un estado de loading específico
   */
  private updateLoadingState(key: keyof RolLoadingStates, value: boolean): void {
    this.loadingStates.update(current => ({
      ...current,
      [key]: value
    }));
  }

  /**
   * Actualiza la lista reactiva de roles
   */
  private updateRolesSubject(roles: RolResponse[]): void {
    this.rolesSubject.next(roles);
    this.updateCache(roles);
  }

  // ===== MÉTODOS DE MANEJO DE ERRORES =====

  /**
   * Maneja errores HTTP
   */
  private handleError(operation: string) {
    return (error: any): Observable<never> => {
      console.error(`❌ Error en ${operation}:`, error);

      // Mostrar notificación de error
      const message = this.getErrorMessage(error);
      this.notificationService.error(`Error ${operation}: ${message}`);

      return throwError(() => error);
    };
  }

  /**
   * Extrae mensaje de error legible
   */
  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    if (error?.status === 0) {
      return 'Sin conexión al servidor';
    }
    if (error?.status === 401) {
      return 'No autorizado';
    }
    if (error?.status === 403) {
      return 'Sin permisos suficientes';
    }
    if (error?.status === 404) {
      return 'Rol no encontrado';
    }
    return 'Error desconocido';
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Listar todos los roles
   * GET /api/roles
   */
  obtenerTodos(useCache: boolean = true): Observable<RolResponse[]> {
    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid()) {
      console.log('📦 Usando roles desde cache');
      return of(this.rolesCache!);
    }

    console.log('🔄 Obteniendo todos los roles...');
    this.updateLoadingState('listing', true);

    return this.http.get<RolResponse[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(roles => {
        console.log(`✅ ${roles.length} roles obtenidos exitosamente`);
        this.updateRolesSubject(roles);
      }),
      catchError(this.handleError('listar roles')),
      finalize(() => this.updateLoadingState('listing', false))
    );
  }

  /**
   * Obtener rol por ID
   * GET /api/roles/{id}
   */
  obtenerPorId(id: number): Observable<RolResponse> {
    console.log(`🔍 Obteniendo rol con ID: ${id}`);
    this.updateLoadingState('loadingById', true);

    return this.http.get<RolResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(rol => console.log(`✅ Rol ${rol.nombre} obtenido exitosamente`)),
      catchError(this.handleError(`obtener rol ${id}`)),
      finalize(() => this.updateLoadingState('loadingById', false))
    );
  }

  /**
   * Buscar rol por nombre
   * GET /api/roles/buscar?nombre={nombre}
   */
  buscarPorNombre(nombre: string): Observable<RolResponse> {
    console.log(`🔍 Buscando rol por nombre: ${nombre}`);
    this.updateLoadingState('searching', true);

    const params = new HttpParams().set('nombre', nombre.trim());

    return this.http.get<RolResponse>(`${this.apiUrl}/buscar`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(rol => console.log(`✅ Rol "${rol.nombre}" encontrado`)),
      catchError(this.handleError(`buscar rol "${nombre}"`)),
      finalize(() => this.updateLoadingState('searching', false))
    );
  }

  /**
   * Crear nuevo rol
   * POST /api/roles
   */
  crear(rolData: RolCreateRequest): Observable<RolResponse> {
    console.log('➕ Creando nuevo rol:', rolData);
    this.updateLoadingState('creating', true);

    return this.http.post<RolResponse>(this.apiUrl, rolData, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(rolCreado => {
        console.log(`✅ Rol "${rolCreado.nombre}" creado exitosamente con ID: ${rolCreado.id}`);
        this.clearCache(); // Limpiar cache para refrescar la lista
        this.notificationService.success(`Rol "${rolCreado.nombre}" creado exitosamente`);
      }),
      catchError(this.handleError('crear rol')),
      finalize(() => this.updateLoadingState('creating', false))
    );
  }

  /**
   * Actualizar rol existente
   * PUT /api/roles/{id}
   */
  actualizar(id: number, rolData: RolUpdateRequest): Observable<RolResponse> {
    console.log(`📝 Actualizando rol ID ${id}:`, rolData);
    this.updateLoadingState('updating', true);

    return this.http.put<RolResponse>(`${this.apiUrl}/${id}`, rolData, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(rolActualizado => {
        console.log(`✅ Rol "${rolActualizado.nombre}" actualizado exitosamente`);
        this.clearCache(); // Limpiar cache para refrescar la lista
        this.notificationService.success(`Rol "${rolActualizado.nombre}" actualizado exitosamente`);
      }),
      catchError(this.handleError(`actualizar rol ${id}`)),
      finalize(() => this.updateLoadingState('updating', false))
    );
  }

  /**
   * Eliminar rol
   * DELETE /api/roles/{id}
   */
  eliminar(id: number): Observable<void> {
    console.log(`🗑️ Eliminando rol ID: ${id}`);
    this.updateLoadingState('deleting', true);

    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`✅ Rol ID ${id} eliminado exitosamente`);
        this.clearCache(); // Limpiar cache para refrescar la lista
        this.notificationService.success('Rol eliminado exitosamente');
      }),
      catchError(this.handleError(`eliminar rol ${id}`)),
      finalize(() => this.updateLoadingState('deleting', false))
    );
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Obtener roles básicos para selects
   */
  obtenerRolesBasicos(): Observable<RolBasico[]> {
    return this.obtenerTodos().pipe(
      map(roles => roles.map(rol => ({
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        esRolSistema: rol.esRolSistema
      })))
    );
  }

  /**
   * Obtener solo roles del sistema
   */
  obtenerRolesSistema(): Observable<RolResponse[]> {
    return this.obtenerTodos().pipe(
      map(roles => roles.filter(rol => rol.esRolSistema))
    );
  }

  /**
   * Obtener solo roles personalizados
   */
  obtenerRolesPersonalizados(): Observable<RolResponse[]> {
    return this.obtenerTodos().pipe(
      map(roles => roles.filter(rol => !rol.esRolSistema))
    );
  }

  /**
   * Verificar si un nombre de rol ya existe
   */
  verificarNombreExiste(nombre: string, idExcluir?: number): Observable<boolean> {
    return this.obtenerTodos().pipe(
      map(roles => {
        const existe = roles.some(rol =>
          rol.nombre.toLowerCase() === nombre.toLowerCase() &&
          (!idExcluir || rol.id !== idExcluir)
        );
        return existe;
      })
    );
  }

  /**
   * Recargar datos (limpiar cache y recargar)
   */
  recargar(): Observable<RolResponse[]> {
    console.log('🔄 Recargando datos de roles...');
    this.clearCache();
    return this.obtenerTodos(false);
  }

  /**
   * Obtener estadísticas de roles
   */
  obtenerEstadisticas(): Observable<RolEstadisticas> {
    return this.obtenerTodos().pipe(
      map(roles => {
        const totalRoles = roles.length;
        const rolesSistema = roles.filter(r => r.esRolSistema).length;
        const rolesPersonalizados = totalRoles - rolesSistema;

        return {
          totalRoles,
          rolesSistema,
          rolesPersonalizados,
          porcentajeRolesSistema: totalRoles > 0 ? (rolesSistema / totalRoles) * 100 : 0,
          usuariosPorRol: {} // Se puede implementar más adelante si se necesita
        };
      })
    );
  }

  // ===== GETTERS PARA ESTADOS =====

  /**
   * Obtiene el estado actual de loading
   */
  get isLoading(): boolean {
    const states = this.loadingStates();
    return Object.values(states).some(state => state);
  }

  /**
   * Obtiene si está listando
   */
  get isListing(): boolean {
    return this.loadingStates().listing;
  }

  /**
   * Obtiene si está creando
   */
  get isCreating(): boolean {
    return this.loadingStates().creating;
  }

  /**
   * Obtiene si está actualizando
   */
  get isUpdating(): boolean {
    return this.loadingStates().updating;
  }

  /**
   * Obtiene si está eliminando
   */
  get isDeleting(): boolean {
    return this.loadingStates().deleting;
  }
}
