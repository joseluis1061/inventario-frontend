import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { CategoriasService } from '../../../../core/services/categorias.service';
import { CategoriaResponse } from '../../../../core/models/categoria.interface';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.scss'
})
export class CategoriasComponent implements OnInit, OnDestroy {
  private readonly categoriasService = inject(CategoriasService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  categorias = signal<CategoriaResponse[]>([]);
  searchTerm = signal<string>('');
  showDeleteConfirm = signal<number | null>(null);

  // Estados reactivos del servicio
  loadingStates = this.categoriasService.loadingStates;

  ngOnInit(): void {
    this.cargarCategorias();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todas las categorías
   */
  cargarCategorias(): void {
    this.categoriasService.obtenerTodas()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar categorías:', error);
          return of([]);
        })
      )
      .subscribe(categorias => {
        this.categorias.set(categorias);
      });
  }

  /**
   * Filtrar categorías por término de búsqueda
   */
  get categoriasFiltradas(): CategoriaResponse[] {
    const search = this.searchTerm().toLowerCase();
    if (!search) {
      return this.categorias();
    }

    return this.categorias().filter(categoria =>
      categoria.nombre.toLowerCase().includes(search) ||
      categoria.descripcion.toLowerCase().includes(search)
    );
  }

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  /**
   * Limpiar búsqueda
   */
  limpiarBusqueda(): void {
    this.searchTerm.set('');
  }

  /**
   * Refrescar lista de categorías
   */
  refrescar(): void {
    this.categoriasService.refrescar()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al refrescar categorías:', error);
          return of([]);
        })
      )
      .subscribe(categorias => {
        this.categorias.set(categorias);
      });
  }

  /**
   * Navegar a crear nueva categoría
   */
  crearCategoria(): void {
    this.router.navigate(['/categorias/crear']);
  }

  /**
   * Editar categoría (placeholder)
   */
  editarCategoria(categoria: CategoriaResponse): void {
    console.log('Editar categoría:', categoria);
    this.router.navigate(['/categorias/actualizar', categoria.id]);
  }

  /**
   * Mostrar confirmación de eliminación
   */
  confirmarEliminar(categoriaId: number): void {
    this.showDeleteConfirm.set(categoriaId);
  }

  /**
   * Cancelar eliminación
   */
  cancelarEliminar(): void {
    this.showDeleteConfirm.set(null);
  }

  /**
   * Eliminar categoría
   */
  eliminarCategoria(categoriaId: number): void {
    this.categoriasService.eliminar(categoriaId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al eliminar categoría:', error);
          return of(null);
        })
      )
      .subscribe(() => {
        // Actualizar lista local removiendo la categoría eliminada
        const categoriasActuales = this.categorias();
        this.categorias.set(categoriasActuales.filter(cat => cat.id !== categoriaId));
        this.showDeleteConfirm.set(null);
      });
  }

  /**
   * TrackBy function para optimizar renderizado
   */
  trackByCategoria(index: number, categoria: CategoriaResponse): number {
    return categoria.id;
  }

  /**
   * Obtener clase CSS para el estado de stock
   */
  getEstadoStockClass(categoria: CategoriaResponse): string {
    if (categoria.porcentajeStockBajo > 50) return 'estado-critico';
    if (categoria.porcentajeStockBajo > 20) return 'estado-bajo';
    return 'estado-normal';
  }

  /**
   * Formatear fecha de creación
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
