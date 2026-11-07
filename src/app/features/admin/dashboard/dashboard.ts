
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  Router,
  RouterLink
} from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase';

interface DashboardStat {
  title: string;
  value: string;
  icon: string;
  color: string;
}

interface RecentAlbum {
  id: string;
  name: string;
  type: string;
  date: string;
  photos: number;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {

  private supabase = inject(SupabaseService);
  private router = inject(Router);

  loading = signal(true);
  errorMessage = signal('');
  loggingOut = signal(false);
  logoutError = signal('');

  stats = signal<DashboardStat[]>([
    {
      title: 'Álbumes creados',
      value: '—',
      icon: '▧',
      color: 'bg-purple-50 text-purple-700'
    },
    {
      title: 'Clientes registrados',
      value: '—',
      icon: '♙',
      color: 'bg-pink-50 text-pink-700'
    },
    {
      title: 'Selecciones pendientes',
      value: '—',
      icon: '♡',
      color: 'bg-orange-50 text-orange-700'
    },
    {
      title: 'Fotografías almacenadas',
      value: '—',
      icon: '▣',
      color: 'bg-blue-50 text-blue-700'
    }
  ]);

  albums = signal<RecentAlbum[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const db = this.supabase.client;

      const [
        albumsResult,
        clientsResult,
        photosResult,
        controlsResult,
        recentResult
      ] = await Promise.all([
        db.from('albums')
          .select('id', { count: 'exact', head: true }),

        db.from('clients')
          .select('id', { count: 'exact', head: true }),

        db.from('photos')
          .select('id', { count: 'exact', head: true }),

        db.from('album_selection_control')
          .select('album_id, selection_status'),

        db.from('albums')
          .select('id, title, event_type, event_date, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (albumsResult.error) throw albumsResult.error;
      if (clientsResult.error) throw clientsResult.error;
      if (photosResult.error) throw photosResult.error;
      if (controlsResult.error) throw controlsResult.error;
      if (recentResult.error) throw recentResult.error;

      const controls = controlsResult.data ?? [];
      const recentAlbums = recentResult.data ?? [];

      // Selecciones abiertas que todavía no han sido cerradas.
      const pendingSelections = controls.filter(
        item => item.selection_status === 'open'
      ).length;

      const formatNumber = (value: number): string =>
        new Intl.NumberFormat('es-CO').format(value);

      this.stats.set([
        {
          title: 'Álbumes creados',
          value: formatNumber(albumsResult.count ?? 0),
          icon: '▧',
          color: 'bg-purple-50 text-purple-700'
        },
        {
          title: 'Clientes registrados',
          value: formatNumber(clientsResult.count ?? 0),
          icon: '♙',
          color: 'bg-pink-50 text-pink-700'
        },
        {
          title: 'Selecciones pendientes',
          value: formatNumber(pendingSelections),
          icon: '♡',
          color: 'bg-orange-50 text-orange-700'
        },
        {
          title: 'Fotografías almacenadas',
          value: formatNumber(photosResult.count ?? 0),
          icon: '▣',
          color: 'bg-blue-50 text-blue-700'
        }
      ]);

      // Consultar fotografías de cada álbum reciente.
      const photoCounts = await Promise.all(
        recentAlbums.map(async album => {
          const { count, error } = await db
            .from('photos')
            .select('id', { count: 'exact', head: true })
            .eq('album_id', album.id);

          if (error) throw error;

          return {
            albumId: album.id,
            count: count ?? 0
          };
        })
      );

      this.albums.set(
        recentAlbums.map(album => {
          const control = controls.find(
            item => item.album_id === album.id
          );

          const photoCount = photoCounts.find(
            item => item.albumId === album.id
          );

          let status = 'Sin control de selección';

          if (control?.selection_status === 'open') {
            status = 'Selección abierta';
          }

          if (control?.selection_status === 'closed') {
            status = 'Selección completada';
          }

          return {
            id: album.id,
            name: album.title ?? 'Álbum sin título',
            type: this.getEventLabel(album.event_type),
            date: this.formatDate(album.event_date),
            photos: photoCount?.count ?? 0,
            status
          };
        })
      );

    } catch (error) {
      console.error('Error cargando Dashboard:', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No fue posible cargar las estadísticas.'
      );

    } finally {
      this.loading.set(false);
    }
  }

  getEventLabel(type: string | null): string {
    const labels: Record<string, string> = {
      wedding: 'Matrimonio',
      birthday: 'Cumpleaños',
      quinceanera: 'Quinceañera',
      graduation: 'Grado',
      baptism: 'Bautizo',
      first_communion: 'Primera comunión',
      corporate: 'Evento corporativo',
      other: 'Otro evento'
    };

    return labels[type ?? ''] ?? 'Evento';
  }

  formatDate(date: string | null): string {
    if (!date) return 'Sin fecha';

    const [year, month, day] = date.slice(0, 10).split('-');

    if (!year || !month || !day) return date;

    return `${day}/${month}/${year}`;
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;

    this.loggingOut.set(true);
    this.logoutError.set('');

    try {
      const { error } = await this.supabase.client.auth.signOut();

      if (error) throw error;

      await this.router.navigateByUrl('/login', {
        replaceUrl: true
      });

    } catch (error) {
      console.error('Error cerrando sesión:', error);

      this.logoutError.set(
        'No fue posible cerrar la sesión. Inténtalo nuevamente.'
      );

    } finally {
      this.loggingOut.set(false);
    }
  }
}
