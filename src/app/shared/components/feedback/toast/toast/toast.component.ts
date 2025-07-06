import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, Notification } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly destroy$ = new Subject<void>();

  notifications: Notification[] = [];
  showDebugInfo = false; // Cambiar a true para ver debug info

  ngOnInit(): void {
    // Suscribirse a las notificaciones del servicio
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Remover notificación específica
   */
  removeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }

  /**
   * Formatear timestamp para mostrar
   */
  formatTime(timestamp: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Ahora';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Hace ${minutes}m`;
    } else {
      return timestamp.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Calcular progreso de la barra para notificaciones temporales
   */
  getProgressWidth(notification: Notification): number {
    if (!notification.duration || notification.persistent) {
      return 100;
    }

    const elapsed = Date.now() - notification.timestamp.getTime();
    const progress = Math.max(0, 100 - (elapsed / notification.duration) * 100);

    return progress;
  }

  /**
   * Obtener clase CSS para el tipo de notificación
   */
  getNotificationClass(type: Notification['type']): string {
    const baseClasses = 'bg-white border rounded-lg shadow-lg p-4 animate-slide-in transform transition-all duration-300 hover:scale-105';

    const typeClasses = {
      success: 'border-l-4 border-l-status-success-500',
      error: 'border-l-4 border-l-status-error-500',
      warning: 'border-l-4 border-l-status-warning-500',
      info: 'border-l-4 border-l-status-info-500'
    };

    return `${baseClasses} ${typeClasses[type]}`;
  }
}
