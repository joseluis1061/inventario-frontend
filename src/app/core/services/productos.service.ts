import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  ProductoResponse,
  ProductoCreateRequest,
  ProductoUpdateRequest,
  ProductoBasico,
  ProductoFiltros,
  ProductoPaginacionParams,
  ProductoPaginatedResponse,
  ProductoEstadisticasStock,
  ProductoResumenMovimientos,
  ProductoLoadingStates,
  ProductoPrecioRango,
  ProductoStockVerificacion
} from '../models/producto.interface';
import { AuthService } from './auth-service.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private readonly apiUrl = `${environment.apiUrl}/api/productos`;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  // ===== ESTADOS REACTIVOS =====

  // Lista de productos en memoria
  private productosSubject = new BehaviorSubject<ProductoResponse[]>([]);
  public productos$ = this.productosSubject.asObservable();

  // Estados de loading con signals
  loadingStates = signal<ProductoLoadingStates>({
    listing: false,
    creating: false,
    updating: false,
    deleting: false,
    searching: false,
    loadingById: false,
    checkingStock: false,
    loadingByCategory: false,
    loadingStockBajo: false,
    loadingStockCritico: false,
    loadingByPrecio: false
  });

  // Cache simple para productos
  private productosCache: ProductoResponse[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutos (productos cambian más frecuentemente)

  constructor() {
    console.log('📱 ProductosService inicializado');
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
   * Listar todos los productos
   * GET /api/productos
   */
  obtenerTodos(useCache: boolean = true): Observable<ProductoResponse[]> {
    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid()) {
      console.log('📦 Usando productos desde cache');
      return of(this.productosCache!);
    }

    this.updateLoadingState('listing', true);

    return this.http.get<ProductoResponse[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(productos => {
        console.log(`📋 Productos obtenidos: ${productos.length}`);
        this.updateCache(productos);
        this.productosSubject.next(productos);
      }),
      catchError(error => this.handleError('Error al obtener productos', error)),
      finalize(() => this.updateLoadingState('listing', false)),
      shareReplay(1)
    );
  }

  /**
   * Obtener producto por ID
   * GET /api/productos/{id}
   */
  obtenerPorId(id: number): Observable<ProductoResponse> {
    this.updateLoadingState('loadingById', true);

    return this.http.get<ProductoResponse>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(producto => {
        console.log(`📋 Producto obtenido: ${producto.nombre} (ID: ${id})`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Producto con ID ${id} no encontrado`));
        }
        return this.handleError(`Error al obtener producto ${id}`, error);
      }),
      finalize(() => this.updateLoadingState('loadingById', false))
    );
  }

  /**
   * Buscar producto por nombre exacto
   * GET /api/productos/buscar?nombre={nombre}
   */
  buscarPorNombre(nombre: string): Observable<ProductoResponse> {
    this.updateLoadingState('searching', true);

    const params = new HttpParams().set('nombre', nombre);

    return this.http.get<ProductoResponse>(`${this.apiUrl}/buscar`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(producto => {
        console.log(`🔍 Producto encontrado: ${producto.nombre}`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Producto '${nombre}' no encontrado`));
        }
        return this.handleError(`Error al buscar producto '${nombre}'`, error);
      }),
      finalize(() => this.updateLoadingState('searching', false))
    );
  }

  /**
   * Obtener productos por categoría
   * GET /api/productos/por-categoria/{categoriaId}
   */
  obtenerPorCategoria(categoriaId: number): Observable<ProductoResponse[]> {
    this.updateLoadingState('loadingByCategory', true);

    return this.http.get<ProductoResponse[]>(`${this.apiUrl}/por-categoria/${categoriaId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(productos => {
        console.log(`📂 Productos por categoría ${categoriaId}: ${productos.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener productos de categoría ${categoriaId}`, error)),
      finalize(() => this.updateLoadingState('loadingByCategory', false))
    );
  }

  /**
   * Obtener productos con stock bajo
   * GET /api/productos/stock-bajo
   */
  obtenerStockBajo(): Observable<ProductoResponse[]> {
    this.updateLoadingState('loadingStockBajo', true);

    return this.http.get<ProductoResponse[]>(`${this.apiUrl}/stock-bajo`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(productos => {
        console.log(`⚠️ Productos con stock bajo: ${productos.length}`);
      }),
      catchError(error => this.handleError('Error al obtener productos con stock bajo', error)),
      finalize(() => this.updateLoadingState('loadingStockBajo', false))
    );
  }

  /**
   * Obtener productos con stock crítico
   * GET /api/productos/stock-critico
   */
  obtenerStockCritico(): Observable<ProductoResponse[]> {
    this.updateLoadingState('loadingStockCritico', true);

    return this.http.get<ProductoResponse[]>(`${this.apiUrl}/stock-critico`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(productos => {
        console.log(`🚨 Productos con stock crítico: ${productos.length}`);
      }),
      catchError(error => this.handleError('Error al obtener productos con stock crítico', error)),
      finalize(() => this.updateLoadingState('loadingStockCritico', false))
    );
  }

  /**
   * Obtener productos por rango de precio
   * GET /api/productos/por-precio?min={min}&max={max}
   */
  obtenerPorRangoPrecio(rango: ProductoPrecioRango): Observable<ProductoResponse[]> {
    this.updateLoadingState('loadingByPrecio', true);

    const params = new HttpParams()
      .set('min', rango.min.toString())
      .set('max', rango.max.toString());

    return this.http.get<ProductoResponse[]>(`${this.apiUrl}/por-precio`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(productos => {
        console.log(`💰 Productos en rango $${rango.min}-$${rango.max}: ${productos.length}`);
      }),
      catchError(error => this.handleError(`Error al obtener productos por rango de precio`, error)),
      finalize(() => this.updateLoadingState('loadingByPrecio', false))
    );
  }

  /**
   * Crear nuevo producto
   * POST /api/productos
   */
  crear(producto: ProductoCreateRequest): Observable<ProductoResponse> {
    this.updateLoadingState('creating', true);

    return this.http.post<ProductoResponse>(this.apiUrl, producto, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(nuevoProducto => {
        console.log(`✅ Producto creado: ${nuevoProducto.nombre} (ID: ${nuevoProducto.id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Producto '${nuevoProducto.nombre}' creado exitosamente`,
          'Producto Creado'
        );

        // Agregar a la lista en memoria
        const productosActuales = this.productosSubject.value;
        this.productosSubject.next([...productosActuales, nuevoProducto]);
      }),
      catchError(error => {
        if (error.status === 409) {
          return this.handleError('Ya existe un producto con ese nombre', error);
        }
        if (error.status === 400) {
          return this.handleError('Datos inválidos para crear el producto', error);
        }
        return this.handleError('Error al crear producto', error);
      }),
      finalize(() => this.updateLoadingState('creating', false))
    );
  }

  /**
   * Actualizar producto existente
   * PUT /api/productos/{id}
   */
  actualizar(id: number, producto: ProductoUpdateRequest): Observable<ProductoResponse> {
    this.updateLoadingState('updating', true);

    return this.http.put<ProductoResponse>(`${this.apiUrl}/${id}`, producto, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(productoActualizado => {
        console.log(`✅ Producto actualizado: ${productoActualizado.nombre} (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          `Producto '${productoActualizado.nombre}' actualizado exitosamente`,
          'Producto Actualizado'
        );

        // Actualizar en la lista en memoria
        const productosActuales = this.productosSubject.value;
        const index = productosActuales.findIndex(prod => prod.id === id);
        if (index !== -1) {
          productosActuales[index] = productoActualizado;
          this.productosSubject.next([...productosActuales]);
        }
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Producto no encontrado', error);
        }
        if (error.status === 409) {
          return this.handleError('Ya existe un producto con ese nombre', error);
        }
        if (error.status === 400) {
          return this.handleError('Datos inválidos para actualizar el producto', error);
        }
        return this.handleError('Error al actualizar producto', error);
      }),
      finalize(() => this.updateLoadingState('updating', false))
    );
  }

  /**
   * Eliminar producto
   * DELETE /api/productos/{id}
   */
  eliminar(id: number): Observable<void> {
    this.updateLoadingState('deleting', true);

    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`🗑️ Producto eliminado (ID: ${id})`);
        this.invalidateCache();
        this.notificationService.success(
          'Producto eliminado exitosamente',
          'Producto Eliminado'
        );

        // Remover de la lista en memoria
        const productosActuales = this.productosSubject.value;
        const productosFiltrados = productosActuales.filter(prod => prod.id !== id);
        this.productosSubject.next(productosFiltrados);
      }),
      catchError(error => {
        if (error.status === 404) {
          return this.handleError('Producto no encontrado', error);
        }
        if (error.status === 409) {
          return this.handleError('No se puede eliminar el producto porque tiene movimientos asociados', error);
        }
        return this.handleError('Error al eliminar producto', error);
      }),
      finalize(() => this.updateLoadingState('deleting', false))
    );
  }

  /**
   * Verificar stock disponible
   * GET /api/productos/{id}/stock-disponible?cantidad={cantidad}
   */
  verificarStockDisponible(id: number, cantidad: number): Observable<boolean> {
    this.updateLoadingState('checkingStock', true);

    const params = new HttpParams().set('cantidad', cantidad.toString());

    return this.http.get<boolean>(`${this.apiUrl}/${id}/stock-disponible`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(disponible => {
        console.log(`📦 Stock disponible para producto ${id} (cantidad: ${cantidad}): ${disponible}`);
      }),
      catchError(error => {
        if (error.status === 404) {
          return throwError(() => new Error(`Producto con ID ${id} no encontrado`));
        }
        return this.handleError(`Error al verificar stock del producto ${id}`, error);
      }),
      finalize(() => this.updateLoadingState('checkingStock', false))
    );
  }

  /**
   * Obtener estadísticas de stock
   * GET /api/productos/estadisticas-stock
   */
  obtenerEstadisticasStock(): Observable<ProductoEstadisticasStock> {
    return this.http.get<ProductoEstadisticasStock>(`${this.apiUrl}/estadisticas-stock`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(estadisticas => {
        console.log(`📊 Estadísticas de stock obtenidas: ${estadisticas.totalProductos} productos`);
      }),
      catchError(error => this.handleError('Error al obtener estadísticas de stock', error))
    );
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Obtener productos básicos para selects
   */
  obtenerBasicos(): Observable<ProductoBasico[]> {
    return this.obtenerTodos().pipe(
      map(productos => productos.map(prod => ({
        id: prod.id,
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        stockActual: prod.stockActual,
        nombreCategoria: prod.nombreCategoria
      })))
    );
  }

  /**
   * Filtrar productos por criterios
   */
  filtrar(filtros: ProductoFiltros): Observable<ProductoResponse[]> {
    return this.obtenerTodos().pipe(
      map(productos => {
        return productos.filter(producto => {
          if (filtros.nombre && !producto.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) {
            return false;
          }
          if (filtros.categoriaId && producto.categoria.id !== filtros.categoriaId) {
            return false;
          }
          if (filtros.estadoStock && producto.estadoStock !== filtros.estadoStock) {
            return false;
          }
          if (filtros.precioMin !== undefined && producto.precio < filtros.precioMin) {
            return false;
          }
          if (filtros.precioMax !== undefined && producto.precio > filtros.precioMax) {
            return false;
          }
          if (filtros.conStock !== undefined) {
            const tieneStock = producto.stockActual > 0;
            if (filtros.conStock !== tieneStock) {
              return false;
            }
          }
          if (filtros.stockBajo && producto.estadoStock !== 'BAJO' && producto.estadoStock !== 'CRÍTICO') {
            return false;
          }
          if (filtros.stockCritico && producto.estadoStock !== 'CRÍTICO') {
            return false;
          }
          return true;
        });
      })
    );
  }

  /**
   * Buscar productos por término general
   */
  buscarProductos(termino: string): Observable<ProductoResponse[]> {
    if (!termino.trim()) {
      return this.obtenerTodos();
    }

    return this.obtenerTodos().pipe(
      map(productos => {
        const terminoLower = termino.toLowerCase();
        return productos.filter(producto =>
          producto.nombre.toLowerCase().includes(terminoLower) ||
          producto.descripcion.toLowerCase().includes(terminoLower) ||
          producto.nombreCategoria.toLowerCase().includes(terminoLower) ||
          producto.categoriaPrecio.toLowerCase().includes(terminoLower)
        );
      })
    );
  }

  /**
   * Refrescar cache y datos
   */
  refrescar(): Observable<ProductoResponse[]> {
    this.invalidateCache();
    return this.obtenerTodos(false);
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Actualizar estado de loading específico
   */
  private updateLoadingState(operation: keyof ProductoLoadingStates, loading: boolean): void {
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
    return this.productosCache !== null &&
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Actualizar cache
   */
  private updateCache(productos: ProductoResponse[]): void {
    this.productosCache = productos;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Invalidar cache
   */
  private invalidateCache(): void {
    this.productosCache = null;
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
   * Obtener productos desde el estado actual
   */
  get productosActuales(): ProductoResponse[] {
    return this.productosSubject.value;
  }

  /**
   * Obtener conteo de productos por estado de stock
   */
  get estadosStockConteo(): { critico: number; bajo: number; normal: number; alto: number } {
    const productos = this.productosActuales;
    return {
      critico: productos.filter(p => p.estadoStock === 'CRÍTICO').length,
      bajo: productos.filter(p => p.estadoStock === 'BAJO').length,
      normal: productos.filter(p => p.estadoStock === 'NORMAL').length,
      alto: productos.filter(p => p.estadoStock === 'ALTO').length
    };
  }
}
