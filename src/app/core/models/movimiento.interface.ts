// ===== INTERFACES PARA MOVIMIENTOS =====

/**
 * Información del producto dentro del movimiento
 */
export interface MovimientoProductoInfo {
  id: number;
  nombre: string;
  precio: number;
  nombreCategoria: string;
  colorCategoria: string;
  iconoCategoria: string;
}

/**
 * Información del usuario dentro del movimiento
 */
export interface MovimientoUsuarioInfo {
  id: number;
  username: string;
  nombreCompleto: string;
  nombreRol: string;
  iniciales: string;
}

/**
 * Respuesta completa de movimiento del backend
 */
export interface MovimientoResponse {
  id: number;
  tipoMovimiento: 'ENTRADA' | 'SALIDA';
  descripcionTipo: string;
  cantidad: number;
  motivo: string;
  fecha: string;
  producto: MovimientoProductoInfo;
  usuario: MovimientoUsuarioInfo;
  valorMovimiento: number;
  nivelImpacto: string;
  tiempoTranscurrido: string;
  esMovimientoMasivo: boolean;
  categoriaMotivo: string;
  iconoTipo: string;
  colorTipo: string;
  varianteTipo: string;
  resumenMovimiento: string;
  impactoStockTexto: string;
}

/**
 * Request para crear un nuevo movimiento
 */
export interface MovimientoCreateRequest {
  productoId: number;
  usuarioId: number;
  tipoMovimiento: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  motivo: string;
}

/**
 * Request para crear entrada específica
 */
export interface MovimientoEntradaRequest {
  productoId: number;
  usuarioId: number;
  tipoMovimiento: 'ENTRADA';
  cantidad: number;
  motivo: string;
}

/**
 * Request para crear salida específica
 */
export interface MovimientoSalidaRequest {
  productoId: number;
  usuarioId: number;
  tipoMovimiento: 'SALIDA';
  cantidad: number;
  motivo: string;
}

/**
 * Respuesta de historial paginado
 */
export interface MovimientoHistorialResponse {
  content: MovimientoResponse[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

/**
 * Parámetros para historial paginado
 */
export interface MovimientoHistorialParams {
  pagina?: number;
  tamaño?: number;
}

/**
 * Parámetros para movimientos recientes
 */
export interface MovimientosRecientesParams {
  dias?: number;
}

/**
 * Resumen por producto
 */
export interface MovimientoResumenProducto {
  productoId: number;
  nombreProducto: string;
  stockActual: number;
  stockMinimo: number;
  totalEntradas: number;
  totalSalidas: number;
  stockCalculado: number;
  estadoStock: 'NORMAL' | 'BAJO' | 'CRITICO';
  stockConsistente: boolean;
}

/**
 * Estadísticas por periodo
 */
export interface MovimientoEstadisticas {
  fechaInicio: string;
  fechaFin: string;
  totalMovimientos: number;
  cantidadEntradas: number;
  cantidadSalidas: number;
  unidadesEntradas: number;
  unidadesSalidas: number;
  diferenciaNeta: number;
  porcentajeSalidas: number;
  porcentajeEntradas: number;
}

/**
 * Parámetros para estadísticas
 */
export interface MovimientoEstadisticasParams {
  inicio: string;
  fin: string;
}

/**
 * Filtros para búsqueda de movimientos
 */
export interface MovimientoFiltros {
  tipoMovimiento?: 'ENTRADA' | 'SALIDA';
  productoId?: number;
  usuarioId?: number;
  fechaInicio?: string;
  fechaFin?: string;
  motivo?: string;
}

/**
 * Parámetros para paginación de movimientos
 */
export interface MovimientoPaginacionParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filtros?: MovimientoFiltros;
}

/**
 * Estados de loading para diferentes operaciones
 */
export interface MovimientoLoadingStates {
  listing: boolean;
  creating: boolean;
  creating_entrada: boolean;
  creating_salida: boolean;
  loadingById: boolean;
  loadingByProduct: boolean;
  loadingByUser: boolean;
  loadingByType: boolean;
  loadingRecent: boolean;
  loadingHistorial: boolean;
  loadingResumenProducto: boolean;
  loadingEstadisticas: boolean;
}

/**
 * Información básica de movimiento (para listas simples)
 */
export interface MovimientoBasico {
  id: number;
  tipoMovimiento: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  motivo: string;
  fecha: string;
  nombreProducto: string;
  nombreUsuario: string;
  valorMovimiento: number;
}

/**
 * Opciones de configuración del servicio
 */
export interface MovimientoServiceConfig {
  cacheEnabled?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * Tipo de movimiento
 */
export type TipoMovimiento = 'ENTRADA' | 'SALIDA';

/**
 * Estados de stock
 */
export type EstadoStock = 'NORMAL' | 'BAJO' | 'CRITICO';

/**
 * Niveles de impacto
 */
export type NivelImpacto = 'Bajo' | 'Medio' | 'Alto';
