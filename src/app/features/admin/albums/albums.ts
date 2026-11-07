
import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';

import { Router } from '@angular/router';

import {
  AlbumsService,
  VyntraAlbum,
  AlbumStatus
} from '../../../core/services/album';

import {
  ClientsService,
  VyntraClient
} from '../../../core/services/clients';

@Component({
  selector: 'app-albums',
  standalone: true,
  imports: [],
  templateUrl: './albums.html',
  styleUrl: './albums.scss'
})
export class Albums implements OnInit {

  private albumsService = inject(AlbumsService);
  private clientsService = inject(ClientsService);
  private router = inject(Router);

  albums = signal<VyntraAlbum[]>([]);
  clients = signal<VyntraClient[]>([]);

  loading = signal(true);
  errorMessage = signal('');

  selectedStatus = signal<'all' | AlbumStatus>('all');
  searchTerm = signal('');

  filteredAlbums = computed(() => {
    const status = this.selectedStatus();
    const term = this.searchTerm().trim().toLowerCase();

    return this.albums().filter(album => {
      const matchesStatus =
        status === 'all' || album.status === status;

      const clientName =
        this.getClientName(album.client_id).toLowerCase();

      const matchesSearch =
        !term ||
        album.title.toLowerCase().includes(term) ||
        clientName.includes(term) ||
        this.getEventLabel(album.event_type)
          .toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  });

  totalAlbums = computed(() => this.albums().length);

  publishedAlbums = computed(() =>
    this.albums().filter(
      album => album.status === 'published'
    ).length
  );

  draftAlbums = computed(() =>
    this.albums().filter(
      album => album.status === 'draft'
    ).length
  );

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const [albums, clients] = await Promise.all([
        this.albumsService.getAlbums(),
        this.clientsService.getClients()
      ]);

      this.clients.set(clients);
      this.albums.set(albums);

    } catch (error) {
      console.error('Error cargando álbumes:', error);

      this.errorMessage.set(
        'No fue posible cargar los álbumes.'
      );
      console.error(
  'VYNTRA - Error al cargar álbumes:',
  error
);
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(status: 'all' | AlbumStatus) {
    this.selectedStatus.set(status);
  }

  updateSearch(value: string) {
    this.searchTerm.set(value);
  }

  getClientName(clientId: string): string {
    const client = this.clients().find(
      item => item.id === clientId
    );

    return client?.full_name ?? 'Cliente no disponible';
  }

  getEventLabel(type: string): string {
    const labels: Record<string, string> = {
      wedding: 'Matrimonio',
      birthday: 'Cumpleaños',
      quinceanera: 'Quinceaños',
      graduation: 'Grado',
      baptism: 'Bautizo',
      first_communion: 'Primera comunión',
      corporate: 'Evento corporativo',
      other: 'Otro evento'
    };

    return labels[type] ?? 'Evento';
  }

  getStatusLabel(status: AlbumStatus): string {
    const labels: Record<AlbumStatus, string> = {
      draft: 'Borrador',
      published: 'Publicado',
      archived: 'Archivado'
    };

    return labels[status];
  }

  createAlbum() {
    this.router.navigateByUrl('/admin/albums/new');
  }

  viewAlbum(id: string) {
    this.router.navigate(['/admin/albums', id]);
  }
}
