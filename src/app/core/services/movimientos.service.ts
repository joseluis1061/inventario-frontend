import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  MovimientoResponse,
  MovimientoCreateRequest,
  MovimientoEntradaRequest,
  MovimientoSalidaRequest,
  MovimientoHistorialResponse,
  MovimientoHistorialParams,
  MovimientosRecientesParams,
  MovimientoResumenProducto,
  MovimientoEstadisticas,
  MovimientoEstadisticasParams,
  MovimientoFiltros,
  MovimientoPaginacionParams,
  MovimientoLoadingStates,
  MovimientoBasico,
  TipoMovimiento
} from '../models/movimiento.interface';
import { AuthService } from './auth-service.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class MovimientosService {
  private readonly apiUrl = `${environment.apiUrl}/api/movimientos`;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // ===== ESTADOS REACTIVOS =====

  // Lista de movimientos en memoria
  private movimientosSubject = new BehaviorSubject<MovimientoResponse[]>([]);
  public movimientos$ = this.movimientosSubject.asObservable();

  // Estados de loading con signals
  loadingStates = signal<MovimientoLoadingStates>({
    listing: false,
    creating: false,
    creating_entrada: false,
    creating_salida: false,
    loadingById: false,
    loadingByProduct: false,
    loadingByUser: false,
    loadingByType: false,
    loadingRecent: false,
    loadingHistorial: false,
    loadingResumenProducto: false,
    loadingEstadisticas: false
  });

  // Cache simple para movimientos
  private movimientosCache: MovimientoResponse[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 1 * 60 * 1000; // 1 minuto (datos de movimientos cambian frecuentemente)

  constructor() {
    console.log('📦 MovimientosService inicializado');
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
    return this.movimientosCache !== null &&
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Invalida el cache
   */
  private invalidateCache(): void {
    this.movimientosCache = null;
    this.cacheTimestamp = 0;
    console.log('🗑️ Cache de movimientos invalidado');
  }

  /**
   * Actualiza estado de loading
   */
  private updateLoadingState(state: keyof MovimientoLoadingStates, value: boolean): void {
    this.loadingStates.update(current => ({
      ...current,
      [state]: value
    }));
  }

  /**
   * Manejo de errores
   */
  private handleError(message: string, error: any): Observable<never> {
    console.error(`❌ ${message}:`, error);

    let errorMessage = message;
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    this.notificationService.error(errorMessage, 'Error en Movimientos');
    return throwError(() => new Error(errorMessage));
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Crear entrada de mercancía
   * POST /api/movimientos/entrada
   */
  crearEntrada(entrada: MovimientoEntradaRequest): Observable<MovimientoResponse> {
    this.updateLoadingState('creating_entrada', true);

    return this.http.post<MovimientoResponse>(`${this.apiUrl}/entrada`, entrada, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimiento => {
        console.log(`✅ Entrada creada: ${movimiento.cantidad} unidades del producto ID ${entrada.productoId}`);
        this.invalidateCache();
        this.notificationService.success(
          `Entrada registrada: ${movimiento.cantidad} unidades`,
          'Entrada Creada'
        );

        // Agregar al inicio de la lista local
        const movimientosActuales = this.movimientosSubject.value;
        this.movimientosSubject.next([movimiento, ...movimientosActuales]);
      }),
      catchError(error => this.handleError('Error al crear entrada', error)),
      finalize(() => this.updateLoadingState('creating_entrada', false))
    );
  }

  /**
   * Crear salida de mercancía
   * POST /api/movimientos/salida
   */
  crearSalida(salida: MovimientoSalidaRequest): Observable<MovimientoResponse> {
    this.updateLoadingState('creating_salida', true);

    return this.http.post<MovimientoResponse>(`${this.apiUrl}/salida`, salida, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimiento => {
        console.log(`✅ Salida creada: ${movimiento.cantidad} unidades del producto ID ${salida.productoId}`);
        this.invalidateCache();
        this.notificationService.success(
          `Salida registrada: ${movimiento.cantidad} unidades`,
          'Salida Creada'
        );

        // Agregar al inicio de la lista local
        const movimientosActuales = this.movimientosSubject.value;
        this.movimientosSubject.next([movimiento, ...movimientosActuales]);
      }),
      catchError(error => this.handleError('Error al crear salida', error)),
      finalize(() => this.updateLoadingState('creating_salida', false))
    );
  }

  /**
   * Crear movimiento genérico
   * POST /api/movimientos
   */
  crearMovimiento(movimiento: MovimientoCreateRequest): Observable<MovimientoResponse> {
    this.updateLoadingState('creating', true);

    return this.http.post<MovimientoResponse>(this.apiUrl, movimiento, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(nuevoMovimiento => {
        console.log(`✅ Movimiento creado: ${nuevoMovimiento.tipoMovimiento} de ${nuevoMovimiento.cantidad} unidades`);
        this.invalidateCache();
        this.notificationService.success(
          `${nuevoMovimiento.tipoMovimiento} registrada: ${nuevoMovimiento.cantidad} unidades`,
          'Movimiento Creado'
        );

        // Agregar al inicio de la lista local
        const movimientosActuales = this.movimientosSubject.value;
        this.movimientosSubject.next([nuevoMovimiento, ...movimientosActuales]);
      }),
      catchError(error => this.handleError('Error al crear movimiento', error)),
      finalize(() => this.updateLoadingState('creating', false))
    );
  }

  /**
   * Listar todos los movimientos
   * GET /api/movimientos
   */
  obtenerTodos(useCache: boolean = true): Observable<MovimientoResponse[]> {
    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid()) {
      console.log('📦 Usando movimientos desde cache');
      return of(this.movimientosCache!);
    }

    this.updateLoadingState('listing', true);

    return this.http.get<MovimientoResponse[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimientos => {
        console.log(`📦 Movimientos obtenidos: ${movimientos.length}`);

        // Actualizar cache
        this.movimientosCache = movimientos;
        this.cacheTimestamp = Date.now();

        // Actualizar BehaviorSubject
        this.movimientosSubject.next(movimientos);
      }),
      catchError(error => this.handleError('Error al obtener movimientos', error)),
      finalize(() => this.updateLoadingState('listing', false)),
      shareReplay(1)
    );
  }

  /**
   * Obtener historial paginado
   * GET /api/movimientos/historial?pagina=0&tamaño=10
   */
  obtenerHistorial(params: MovimientoHistorialParams = {}): Observable<MovimientoHistorialResponse> {
    this.updateLoadingState('loadingHistorial', true);

    let httpParams = new HttpParams();
    if (params.pagina !== undefined) httpParams = httpParams.set('pagina', params.pagina.toString());
    if (params.tamaño !== undefined) httpParams = httpParams.set('tamaño', params.tamaño.toString());

    return this.http.get<MovimientoHistorialResponse>(`${this.apiUrl}/historial`, {
      headers: this.getAuthHeaders(),
      params: httpParams
    }).pipe(
      tap(response => {
        console.log(`📄 Historial obtenido: página ${response.number + 1} de ${response.totalPages}, ${response.totalElements} elementos`);
      }),
      catchError(error => this.handleError('Error al obtener historial', error)),
      finalize(() => this.updateLoadingState('loadingHistorial', false))
    );
  }

  /**
   * Obtener movimiento por ID
   * GET /api/movimientos/{id}
   */
  obtenerPorId(id: number): Observable<MovimientoResponse> {
    this.updateLoadingState('loadingById', true);

    return this.http.get<MovimientoResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimiento => {
        console.log(`🔍 Movimiento obtenido: ID ${movimiento.id} - ${movimiento.tipoMovimiento}`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Movimiento con ID ${id} no encontrado`));
        }
        return this.handleError(`Error al obtener movimiento ID ${id}`, error);
      }),
      finalize(() => this.updateLoadingState('loadingById', false))
    );
  }

  /**
   * Obtener movimientos por producto
   * GET /api/movimientos/por-producto/{productoId}
   */
  obtenerPorProducto(productoId: number): Observable<MovimientoResponse[]> {
    this.updateLoadingState('loadingByProduct', true);

    return this.http.get<MovimientoResponse[]>(`${this.apiUrl}/por-producto/${productoId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimientos => {
        console.log(`📦 Movimientos por producto ${productoId}: ${movimientos.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener movimientos del producto ${productoId}`, error)),
      finalize(() => this.updateLoadingState('loadingByProduct', false))
    );
  }

  /**
   * Obtener movimientos por usuario
   * GET /api/movimientos/por-usuario/{usuarioId}
   */
  obtenerPorUsuario(usuarioId: number): Observable<MovimientoResponse[]> {
    this.updateLoadingState('loadingByUser', true);

    return this.http.get<MovimientoResponse[]>(`${this.apiUrl}/por-usuario/${usuarioId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimientos => {
        console.log(`👤 Movimientos por usuario ${usuarioId}: ${movimientos.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener movimientos del usuario ${usuarioId}`, error)),
      finalize(() => this.updateLoadingState('loadingByUser', false))
    );
  }

  /**
   * Obtener movimientos por tipo
   * GET /api/movimientos/por-tipo/{tipo}
   */
  obtenerPorTipo(tipo: TipoMovimiento): Observable<MovimientoResponse[]> {
    this.updateLoadingState('loadingByType', true);

    return this.http.get<MovimientoResponse[]>(`${this.apiUrl}/por-tipo/${tipo}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(movimientos => {
        console.log(`🔄 Movimientos por tipo ${tipo}: ${movimientos.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener movimientos del tipo ${tipo}`, error)),
      finalize(() => this.updateLoadingState('loadingByType', false))
    );
  }

  /**
   * Obtener movimientos recientes
   * GET /api/movimientos/recientes?dias=7
   */
  obtenerRecientes(params: MovimientosRecientesParams = { dias: 7 }): Observable<MovimientoResponse[]> {
    this.updateLoadingState('loadingRecent', true);

    let httpParams = new HttpParams();
    if (params.dias !== undefined) httpParams = httpParams.set('dias', params.dias.toString());

    return this.http.get<MovimientoResponse[]>(`${this.apiUrl}/recientes`, {
      headers: this.getAuthHeaders(),
      params: httpParams
    }).pipe(
      tap(movimientos => {
        console.log(`🕒 Movimientos recientes (${params.dias} días): ${movimientos.length}`);
      }),
      catchError(error => this.handleError('Error al obtener movimientos recientes', error)),
      finalize(() => this.updateLoadingState('loadingRecent', false))
    );
  }

  /**
   * Obtener resumen por producto
   * GET /api/movimientos/resumen-producto/{productoId}
   */
  obtenerResumenProducto(productoId: number): Observable<MovimientoResumenProducto> {
    this.updateLoadingState('loadingResumenProducto', true);

    return this.http.get<MovimientoResumenProducto>(`${this.apiUrl}/resumen-producto/${productoId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(resumen => {
        console.log(`📊 Resumen del producto ${productoId}: Stock actual ${resumen.stockActual}, Estado: ${resumen.estadoStock}`);
      }),
      catchError(error => this.handleError(`Error al obtener resumen del producto ${productoId}`, error)),
      finalize(() => this.updateLoadingState('loadingResumenProducto', false))
    );
  }

  /**
   * Obtener estadísticas por periodo
   * GET /api/movimientos/estadisticas?inicio=2025-01-01 00:00:00&fin=2025-12-31 23:59:59
   */
  obtenerEstadisticas(params: MovimientoEstadisticasParams): Observable<MovimientoEstadisticas> {
    this.updateLoadingState('loadingEstadisticas', true);

    let httpParams = new HttpParams()
      .set('inicio', params.inicio)
      .set('fin', params.fin);

    return this.http.get<MovimientoEstadisticas>(`${this.apiUrl}/estadisticas`, {
      headers: this.getAuthHeaders(),
      params: httpParams
    }).pipe(
      tap(estadisticas => {
        console.log(`📈 Estadísticas obtenidas: ${estadisticas.totalMovimientos} movimientos entre ${params.inicio} y ${params.fin}`);
      }),
      catchError(error => this.handleError('Error al obtener estadísticas', error)),
      finalize(() => this.updateLoadingState('loadingEstadisticas', false))
    );
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Obtener movimientos básicos (información reducida)
   */
  obtenerBasicos(): Observable<MovimientoBasico[]> {
    return this.obtenerTodos().pipe(
      map(movimientos => movimientos.map(m => ({
        id: m.id,
        tipoMovimiento: m.tipoMovimiento,
        cantidad: m.cantidad,
        motivo: m.motivo,
        fecha: m.fecha,
        nombreProducto: m.producto.nombre,
        nombreUsuario: m.usuario.nombreCompleto,
        valorMovimiento: m.valorMovimiento
      })))
    );
  }

  /**
   * Invalidar manualmente el cache
   */
  limpiarCache(): void {
    this.invalidateCache();
  }

  /**
   * Obtener conteo de movimientos por tipo
   */
  obtenerConteosPorTipo(): Observable<{ entradas: number; salidas: number }> {
    return this.obtenerTodos().pipe(
      map(movimientos => ({
        entradas: movimientos.filter(m => m.tipoMovimiento === 'ENTRADA').length,
        salidas: movimientos.filter(m => m.tipoMovimiento === 'SALIDA').length
      }))
    );
  }

  /**
   * Filtrar movimientos por criterios
   */
  filtrarMovimientos(filtros: MovimientoFiltros): Observable<MovimientoResponse[]> {
    return this.obtenerTodos().pipe(
      map(movimientos => {
        return movimientos.filter(movimiento => {
          if (filtros.tipoMovimiento && movimiento.tipoMovimiento !== filtros.tipoMovimiento) {
            return false;
          }
          if (filtros.productoId && movimiento.producto.id !== filtros.productoId) {
            return false;
          }
          if (filtros.usuarioId && movimiento.usuario.id !== filtros.usuarioId) {
            return false;
          }
          if (filtros.motivo && !movimiento.motivo.toLowerCase().includes(filtros.motivo.toLowerCase())) {
            return false;
          }
          // Filtros de fecha se pueden implementar aquí si es necesario
          return true;
        });
      })
    );
  }
}
