import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  CategoriaResponse,
  CategoriaCreateRequest,
  CategoriaUpdateRequest,
  CategoriaBasica,
  CategoriaFiltros,
  CategoriaPaginacionParams,
  CategoriaPaginatedResponse,
  CategoriaEstadisticas,
  CategoriaLoadingStates
} from '../models/categoria';
import { AuthService } from './auth-service.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class CategoriasService {
  private readonly apiUrl = `${environment.apiUrl}/api/categorias`;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // ===== ESTADOS REACTIVOS =====

  // Lista de categorías en memoria
  private categoriasSubject = new BehaviorSubject<CategoriaResponse[]>([]);
  public categorias$ = this.categoriasSubject.asObservable();

  // Estados de loading con signals
  loadingStates = signal<CategoriaLoadingStates>({
    listing: false,
    creating: false,
    updating: false,
    deleting: false,
    searching: false,
    loadingById: false
  });

  // Cache simple para categorías
  private categoriasCache: CategoriaResponse[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor() {
    console.log('🏷️ CategoriasService inicializado');
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
   * Listar todas las categorías
   * GET /api/categorias
   */
  obtenerTodas(useCache: boolean = true): Observable<CategoriaResponse[]> {
    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid()) {
      console.log('📦 Usando categorías desde cache');
      return of(this.categoriasCache!);
    }

    this.updateLoadingState('listing', true);

    return this.http.get<CategoriaResponse[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(categorias => {
        console.log(`📋 Categorías obtenidas: ${categorias.length}`);
        this.updateCache(categorias);
        this.categoriasSubject.next(categorias);
      }),
      catchError(error => this.handleError('Error al obtener categorías', error)),
      finalize(() => this.updateLoadingState('listing', false)),
      shareReplay(1)
    );
  }

  /**
   * Obtener categoría por ID
   * GET /api/categorias/{id}
   */
  obtenerPorId(id: number): Observable<CategoriaResponse> {
    this.updateLoadingState('loadingById', true);

    return this.http.get<CategoriaResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(categoria => {
        console.log(`📋 Categoría obtenida: ${categoria.nombre} (ID: ${id})`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Categoría con ID ${id} no encontrada`));
        }
        return this.handleError(`Error al obtener categoría ${id}`, error);
      }),
      finalize(() => this.updateLoadingState('loadingById', false))
    );
  }

  /**
   * Buscar categoría por nombre exacto
   * GET /api/categorias/buscar?nombre={nombre}
   */
  buscarPorNombre(nombre: string): Observable<CategoriaResponse> {
    this.updateLoadingState('searching', true);

    const params = new HttpParams().set('nombre', nombre);

    return this.http.get<CategoriaResponse>(`${this.apiUrl}/buscar`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(categoria => {
        console.log(`🔍 Categoría encontrada: ${categoria.nombre}`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Categoría '${nombre}' no encontrada`));
        }
        return this.handleError(`Error al buscar categoría '${nombre}'`, error);
      }),
      finalize(() => this.updateLoadingState('searching', false))
    );
  }

  /**
   * Crear nueva categoría
   * POST /api/categorias
   */
  crear(categoria: CategoriaCreateRequest): Observable<CategoriaResponse> {
    this.updateLoadingState('creating', true);

    return this.http.post<CategoriaResponse>(this.apiUrl, categoria, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(nuevaCategoria => {
        console.log(`✅ Categoría creada: ${nuevaCategoria.nombre} (ID: ${nuevaCategoria.id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Categoría '${nuevaCategoria.nombre}' creada exitosamente`,
          'Categoría Creada'
        );

        // Agregar a la lista en memoria
        const categoriasActuales = this.categoriasSubject.value;
        this.categoriasSubject.next([...categoriasActuales, nuevaCategoria]);
      }),
      catchError(error => {
        if (error.status === 409) {
          return this.handleError('Ya existe una categoría con ese nombre', error);
        }
        return this.handleError('Error al crear categoría', error);
      }),
      finalize(() => this.updateLoadingState('creating', false))
    );
  }

  /**
   * Actualizar categoría existente
   * PUT /api/categorias/{id}
   */
  actualizar(id: number, categoria: CategoriaUpdateRequest): Observable<CategoriaResponse> {
    this.updateLoadingState('updating', true);

    return this.http.put<CategoriaResponse>(`${this.apiUrl}/${id}`, categoria, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(categoriaActualizada => {
        console.log(`✅ Categoría actualizada: ${categoriaActualizada.nombre} (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Categoría '${categoriaActualizada.nombre}' actualizada exitosamente`,
          'Categoría Actualizada'
        );

        // Actualizar en la lista en memoria
        const categoriasActuales = this.categoriasSubject.value;
        const index = categoriasActuales.findIndex(cat => cat.id === id);
        if (index !== -1) {
          categoriasActuales[index] = categoriaActualizada;
          this.categoriasSubject.next([...categoriasActuales]);
        }
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Categoría no encontrada', error);
        }
        if (error.status === 409) {
          return this.handleError('Ya existe una categoría con ese nombre', error);
        }
        return this.handleError('Error al actualizar categoría', error);
      }),
      finalize(() => this.updateLoadingState('updating', false))
    );
  }

  /**
   * Eliminar categoría
   * DELETE /api/categorias/{id}
   */
  eliminar(id: number): Observable<void> {
    this.updateLoadingState('deleting', true);

    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`🗑️ Categoría eliminada (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          'Categoría eliminada exitosamente',
          'Categoría Eliminada'
        );

        // Remover de la lista en memoria
        const categoriasActuales = this.categoriasSubject.value;
        const categoriasFiltradas = categoriasActuales.filter(cat => cat.id !== id);
        this.categoriasSubject.next(categoriasFiltradas);
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Categoría no encontrada', error);
        }
        if (error.status === 409) {
          return this.handleError('No se puede eliminar la categoría porque tiene productos asociados', error);
        }
        return this.handleError('Error al eliminar categoría', error);
      }),
      finalize(() => this.updateLoadingState('deleting', false))
    );
  }

  /**
   * Verificar si categoría existe por nombre
   * GET /api/categorias/existe?nombre={nombre}
   */
  existe(nombre: string): Observable<boolean> {
    const params = new HttpParams().set('nombre', nombre);

    return this.http.get<boolean>(`${this.apiUrl}/existe`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(existe => {
        console.log(`🔍 Categoría '${nombre}' ${existe ? 'existe' : 'no existe'}`);
      }),
      catchError(error => this.handleError(`Error al verificar existencia de '${nombre}'`, error))
    );
  }

  /**
   * Contar productos por categoría
   * GET /api/categorias/{id}/productos/contar
   */
  contarProductos(id: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${id}/productos/contar`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(cantidad => {
        console.log(`📊 Categoría ${id} tiene ${cantidad} productos`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Categoría con ID ${id} no encontrada`));
        }
        return this.handleError(`Error al contar productos de categoría ${id}`, error);
      })
    );
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Obtener categorías básicas para selects
   */
  obtenerBasicas(): Observable<CategoriaBasica[]> {
    return this.obtenerTodas().pipe(
      map(categorias => categorias.map(cat => ({
        id: cat.id,
        nombre: cat.nombre,
        descripcion: cat.descripcion
      })))
    );
  }

  /**
   * Filtrar categorías por criterios
   */
  filtrar(filtros: CategoriaFiltros): Observable<CategoriaResponse[]> {
    return this.obtenerTodas().pipe(
      map(categorias => {
        return categorias.filter(categoria => {
          if (filtros.nombre && !categoria.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) {
            return false;
          }
          if (filtros.eliminables !== undefined && categoria.eliminable !== filtros.eliminables) {
            return false;
          }
          return true;
        });
      })
    );
  }

  /**
   * Refrescar cache y datos
   */
  refrescar(): Observable<CategoriaResponse[]> {
    this.invalidateCache();
    return this.obtenerTodas(false);
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Actualizar estado de loading específico
   */
  private updateLoadingState(operation: keyof CategoriaLoadingStates, loading: boolean): void {
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
    return this.categoriasCache !== null &&
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Actualizar cache
   */
  private updateCache(categorias: CategoriaResponse[]): void {
    this.categoriasCache = categorias;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Invalidar cache
   */
  private invalidateCache(): void {
    this.categoriasCache = null;
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
   * Obtener categorías desde el estado actual
   */
  get categoriasActuales(): CategoriaResponse[] {
    return this.categoriasSubject.value;
  }
}
