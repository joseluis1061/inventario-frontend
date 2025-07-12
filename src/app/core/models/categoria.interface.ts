// ===== INTERFACES PARA CATEGORÍAS =====

/**
 * Respuesta completa de categoría del backend
 */
export interface CategoriaResponse {
  id: number;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  eliminable: boolean;
  esCategoriaComun: boolean;
  colorSugerido: string;
  iconoSugerido: string;
  porcentajeStockBajo: number;
  porcentajeConStock: number;
  estadoTexto: string;
  cantidadProductos?: number;
  valorInventario?: number;
}

/**
 * Request para crear una nueva categoría
 */
export interface CategoriaCreateRequest {
  nombre: string;
  descripcion: string;
}

/**
 * Request para actualizar una categoría existente
 */
export interface CategoriaUpdateRequest {
  nombre: string;
  descripcion: string;
}

/**
 * Información básica de categoría (para selects y listas simples)
 */
export interface CategoriaBasica {
  id: number;
  nombre: string;
  descripcion?: string;
}

/**
 * Filtros para búsqueda de categorías
 */
export interface CategoriaFiltros {
  nombre?: string;
  conProductos?: boolean;
  eliminables?: boolean;
}

/**
 * Parámetros para paginación de categorías
 */
export interface CategoriaPaginacionParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filtros?: CategoriaFiltros;
}

/**
 * Respuesta paginada de categorías
 */
export interface CategoriaPaginatedResponse {
  content: CategoriaResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

/**
 * Estadísticas de una categoría
 */
export interface CategoriaEstadisticas {
  id: number;
  nombre: string;
  totalProductos: number;
  productosConStock: number;
  productosStockBajo: number;
  valorTotalInventario: number;
  porcentajeStockBajo: number;
  porcentajeConStock: number;
  estadoGeneral: 'CRITICO' | 'BAJO' | 'NORMAL' | 'SIN_INFORMACION';
}

/**
 * Opciones de configuración del servicio
 */
export interface CategoriaServiceConfig {
  cacheEnabled?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * Estados de loading para diferentes operaciones
 */
export interface CategoriaLoadingStates {
  listing: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  searching: boolean;
  loadingById: boolean;
}
