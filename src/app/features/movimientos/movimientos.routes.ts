import { Routes } from "@angular/router";

export const MOVIMIENTOS_ROUTES: Routes = [
  // Lista principal
  { path: '', loadComponent: () => import('./pages/movimientos-list/movimientos-list.component').then(m => m.MovimientosListComponent)},
  // Crear nuevo
  { path: 'crear', loadComponent: () => import('./pages/crear-movimiento/crear-movimiento.component').then(m => m.CrearMovimientoComponent)},
  // Historial avanzado
  { path: 'historial', loadComponent: () => import('./pages/movimientos-historial/movimientos-historial.component').then(m => m.MovimientosHistorialComponent)},
  // Dashboard recientes
  { path: 'recientes', loadComponent: () => import('./pages/movimientos-recientes/movimientos-recientes.component').then(m => m.MovimientosRecientesComponent)},
  // Por producto
  { path: 'por-producto', loadComponent: () => import('./pages/movimientos-por-producto/movimientos-por-producto.component').then(m => m.MovimientosPorProductoComponent)},
  // Analytics
  { path: 'estadisticas', loadComponent: () => import('./pages/movimientos-estadisticas/movimientos-estadisticas.component').then(m => m.MovimientosEstadisticasComponent)},
  // Estado de stock
  { path: 'resumen-stock', loadComponent: () => import('./pages/resumen-stock/resumen-stock.component').then(m => m.ResumenStockComponent)},
  // Reportes
  { path: 'reportes', loadComponent: () => import('./pages/movimientos-reportes/movimientos-reportes.component').then(m => m.MovimientosReportesComponent)},
  // Detalle específico
  { path: ':id', loadComponent: () => import('./pages/movimiento-detail/movimiento-detail.component').then(m => m.MovimientoDetailComponent)}
]
