import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // BehaviorSubject principal para el estado de loading
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Subjects para manejar las acciones show/hide con debounce
  private showSubject = new Subject<void>();
  private hideSubject = new Subject<void>();

  // Contador de requests activos
  private activeRequests = 0;

  // Flag para evitar emitir el mismo valor consecutivamente
  private currentLoadingState = false;

  constructor() {
    this.setupDebouncedLoading();
  }

  /**
   * Configurar el sistema de debounced loading
   */
  private setupDebouncedLoading(): void {
    // Debounce para SHOW loading (más agresivo para evitar flickering)
    this.showSubject.pipe(
      debounceTime(10), // Muy corto pero suficiente para agrupar llamadas
      distinctUntilChanged()
    ).subscribe(() => {
      this.emitLoadingState(true);
    });

    // Debounce para HIDE loading (un poco más largo para asegurar que terminó)
    this.hideSubject.pipe(
      debounceTime(50), // Esperar un poco más antes de ocultar
      distinctUntilChanged()
    ).subscribe(() => {
      // Verificar nuevamente el contador antes de ocultar
      if (this.activeRequests <= 0) {
        this.emitLoadingState(false);
      }
    });
  }

  /**
   * Emitir el estado de loading solo si cambió
   */
  private emitLoadingState(loading: boolean): void {
    if (this.currentLoadingState !== loading) {
      this.currentLoadingState = loading;
      this.loadingSubject.next(loading);

      // Log para debugging (opcional, remover en producción)
      console.log(`🔄 Loading state changed to: ${loading} (Active requests: ${this.activeRequests})`);
    }
  }

  /**
   * Mostrar loading spinner
   */
  show(): void {
    this.activeRequests++;

    // Solo emitir show si no estamos ya mostrando loading
    if (!this.currentLoadingState) {
      this.showSubject.next();
    }
  }

  /**
   * Ocultar loading spinner
   */
  hide(): void {
    this.activeRequests--;

    // Asegurar que nunca sea negativo
    if (this.activeRequests < 0) {
      this.activeRequests = 0;
    }

    // Solo intentar ocultar si no hay más requests activos
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      this.hideSubject.next();
    }
  }

  /**
   * Forzar ocultar loading (para casos de emergencia)
   */
  forceHide(): void {
    this.activeRequests = 0;
    this.emitLoadingState(false);
    console.warn('⚠️ Loading state force hidden');
  }

  /**
   * Obtener estado actual de loading (síncrono)
   */
  get isLoading(): boolean {
    return this.currentLoadingState;
  }

  /**
   * Obtener número de requests activos (para debugging)
   */
  get activeRequestsCount(): number {
    return this.activeRequests;
  }

  /**
   * Reset completo del servicio (útil para testing)
   */
  reset(): void {
    this.activeRequests = 0;
    this.currentLoadingState = false;
    this.loadingSubject.next(false);
    console.log('🔄 LoadingService reset');
  }
}
