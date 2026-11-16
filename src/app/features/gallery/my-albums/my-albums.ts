
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { Router } from '@angular/router';

import {
  AlbumsService,
  VyntraAlbum
} from '../../../core/services/album';

import {
  SupabaseService
} from '../../../core/services/supabase';

@Component({
  selector: 'app-my-albums',
  standalone: true,
  imports: [],
  templateUrl: './my-albums.html',
  styleUrl: './my-albums.scss'
})
export class MyAlbums implements OnInit {

  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private albumsService = inject(AlbumsService);

  loading = signal(true);
  errorMessage = signal('');

  albums = signal<VyntraAlbum[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadAlbums();
  }

  async loadAlbums(): Promise<void> {

    this.loading.set(true);
    this.errorMessage.set('');

    try {

      // Identificar al usuario autenticado.
      const { data, error } =
        await this.supabase.client.auth.getUser();

      if (error || !data.user) {
        await this.router.navigateByUrl('/login');
        return;
      }

      // Buscar el cliente vinculado a esta cuenta.
      const { data: access, error: accessError } =
        await this.supabase.client
          .from('client_access')
          .select('client_id')
          .eq('auth_user_id', data.user.id)
          .eq('is_active', true)
          .maybeSingle();

      if (accessError) {
        throw accessError;
      }

      if (!access) {
        this.errorMessage.set(
          'Tu cuenta no tiene acceso activo a una galería.'
        );
        return;
      }

      // Consultar los álbumes del cliente.
      const clientAlbums =
        await this.albumsService.getAlbumsByClient(
          access.client_id
        );

      // Mostrar únicamente los publicados.
      const publishedAlbums = clientAlbums.filter(
        album => album.status === 'published'
      );

      this.albums.set(publishedAlbums);

    } catch (error) {

      console.error(
        'Error cargando los álbumes del cliente:',
        error
      );

      this.errorMessage.set(
        'No fue posible cargar tus álbumes. Intenta nuevamente.'
      );

    } finally {

      this.loading.set(false);

    }
  }

  // Abrir un álbum específico.
  async openAlbum(album: VyntraAlbum): Promise<void> {

    await this.router.navigate([
      '/gallery',
      album.id,
      'album'
    ]);
  }

  // Nombre del tipo de evento.
  getEventLabel(eventType: string): string {

    const labels: Record<string, string> = {
      wedding: 'Matrimonio',
      birthday: 'Cumpleaños',
      quinceanera: 'Quinceañera',
      graduation: 'Grado',
      baptism: 'Bautizo',
      first_communion: 'Primera comunión',
      corporate: 'Evento empresarial',
      other: 'Evento especial'
    };

    return labels[eventType] ?? 'Evento especial';
  }


getAlbumEventLabel(album: VyntraAlbum): string {

  if (album.event_type === 'other') {
    return album.custom_event_name?.trim()
      || 'Evento especial';
  }

  return this.getEventLabel(album.event_type);
}


  // Fecha del evento en formato colombiano.
  formatDate(date: string | null): string {

    if (!date) {
      return 'Una fecha para recordar';
    }

    const parsed = new Date(date + 'T12:00:00');

    if (Number.isNaN(parsed.getTime())) {
      return 'Una fecha para recordar';
    }

    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(parsed);
  }


  getEventImage(eventType: string): string {

    const images: Record<string, string> = {
      wedding: '/images/portada-boda.webp',
      birthday: '/images/portada-cumpleanos.webp',
      quinceanera: '/images/portada-quinceanos.webp',
      graduation: '/images/portada-grado.webp',
      baptism: '/images/portada-bautizo.webp',
      first_communion: '/images/portada-comunion.webp',
      corporate: '/images/portada-corporativo.webp',
      other: '/images/portada-otros.webp'
    };

    return images[eventType] ?? '/images/portada-otros.webp';
  }

}
