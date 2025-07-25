// ===== INTERFACES PARA PRODUCTOS =====

/**
 * Información básica de categoría dentro del producto
 */
export interface ProductoCategoriaInfo {
  id: number;
  nombre: string;
  descripcion: string;
  colorSugerido: string;
  iconoSugerido: string;
}

/**
 * Respuesta completa de producto del backend
 */
export interface ProductoResponse {
  id: number;
  nombre: string;
  descripcion: string;
  imagenPlaceholder: string;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  categoria: ProductoCategoriaInfo;
  estadoStock: 'CRÍTICO' | 'BAJO' | 'NORMAL' | 'ALTO';
  valorInventario: number;
  eliminable: boolean;
  categoriaPrecio: 'Básico' | 'Estándar' | 'Premium' | 'Lujo';
  porcentajeStockMinimo: number;
  unidadesFaltantesMinimo: number;
  nombreCategoria: string;
  imagenDisplay: string;
  resumenEstado: string;
}

/**
 * Request para crear un nuevo producto
 */
export interface ProductoCreateRequest {
  nombre: string;
  descripcion: string;
  imagenPlaceholder?: string;
  precio: number;
  stockMinimo: number;
  categoriaId: number;
}

/**
 * Request para actualizar un producto existente
 */
export interface ProductoUpdateRequest {
  nombre: string;
  descripcion: string;
  imagenPlaceholder?: string;
  precio: number;
  stockMinimo: number;
  categoriaId: number;
}

/**
 * Información básica de producto (para selects y listas simples)
 */
export interface ProductoBasico {
  id: number;
  nombre: string;
  descripcion?: string;
  imagenDisplay?: string;
  precio: number;
  stockActual: number;
  nombreCategoria: string;
}

/**
 * Filtros para búsqueda de productos
 */
export interface ProductoFiltros {
  nombre?: string;
  categoriaId?: number;
  estadoStock?: 'CRÍTICO' | 'BAJO' | 'NORMAL' | 'ALTO';
  precioMin?: number;
  precioMax?: number;
  conStock?: boolean;
  stockBajo?: boolean;
  stockCritico?: boolean;
}

/**
 * Parámetros para paginación de productos
 */
export interface ProductoPaginacionParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filtros?: ProductoFiltros;
}

/**
 * Respuesta paginada de productos
 */
export interface ProductoPaginatedResponse {
  content: ProductoResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

/**
 * Estadísticas de stock de productos
 */
export interface ProductoEstadisticasStock {
  totalProductos: number;
  productosStockBajo: number;
  productosSinStock: number;
  porcentajeStockBajo: number;
  porcentajeSinStock: number;
}

/**
 * Resumen de movimientos de un producto
 */
export interface ProductoResumenMovimientos {
  productoId: number;
  nombreProducto: string;
  totalEntradas: number;
  totalSalidas: number;
  ultimoMovimiento: string;
  stockActual: number;
  stockMinimo: number;
  valorActualInventario: number;
}

/**
 * Estados de loading para diferentes operaciones
 */
export interface ProductoLoadingStates {
  listing: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  searching: boolean;
  loadingById: boolean;
  checkingStock: boolean;
  loadingByCategory: boolean;
  loadingStockBajo: boolean;
  loadingStockCritico: boolean;
  loadingByPrecio: boolean;
}

/**
 * Opciones de configuración del servicio
 */
export interface ProductoServiceConfig {
  cacheEnabled?: boolean;
  retryAttempts?: number;
  timeout?: number;
  autoRefreshStock?: boolean;
}

/**
 * Parámetros para búsqueda por rango de precio
 */
export interface ProductoPrecioRango {
  min: number;
  max: number;
}

/**
 * Respuesta de verificación de stock
 */
export interface ProductoStockVerificacion {
  disponible: boolean;
  stockActual: number;
  stockSolicitado: number;
  mensaje: string;
}

/**
 * Interface para manejo de imágenes de productos
 */
export interface ProductoImagen {
  id?: number;
  url: string;
  esPrincipal: boolean;
  alt: string;
  orden?: number;
}

/**
 * Configuración para generación de imágenes placeholder
 */
export interface ProductoImagenPlaceholderConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  text?: string;
  fontSize?: number;
}

/**
 * Estados de carga específicos para imágenes
 */
export interface ProductoImagenLoadingStates {
  uploading: boolean;
  deleting: boolean;
  generating: boolean;
}

/**
 * Validación de imágenes
 */
export interface ProductoImagenValidation {
  maxSize: number; // en bytes
  allowedFormats: string[];
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
}
