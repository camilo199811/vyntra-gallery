
import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';

import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import {
  AlbumsService,
  VyntraAlbum
} from '../../../core/services/album';

import {
  SelectionService,
  PhotoSelection,
  AlbumSelectionControl
} from '../../../core/services/selection';

interface EventTheme {
  background: string;
  surface: string;
  accent: string;
  text: string;
}

const EVENT_THEMES: Record<string, EventTheme> = {
  wedding: {
    background: '#F8F9F5',
    surface: '#FFFFFF',
    accent: '#78947C',
    text: '#344B3B'
  },

  quinceanera: {
    background: '#FAF7FC',
    surface: '#FFFFFF',
    accent: '#A47DB8',
    text: '#503C5A'
  },

  birthday: {
    background: '#FCF8F4',
    surface: '#FFFFFF',
    accent: '#C58A62',
    text: '#604737'
  },

  baptism: {
    background: '#F5FAFB',
    surface: '#FFFFFF',
    accent: '#719FAE',
    text: '#36545E'
  },

  first_communion: {
    background: '#FCFAF5',
    surface: '#FFFFFF',
    accent: '#A9915F',
    text: '#5C513D'
  },

  graduation: {
    background: '#F9F9F5',
    surface: '#FFFFFF',
    accent: '#9B875A',
    text: '#424C3C'
  },

  corporate: {
    background: '#F6F9FC',
    surface: '#FFFFFF',
    accent: '#718EAD',
    text: '#354A60'
  },

  other: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    accent: '#A98C65',
    text: '#53483C'
  }
};

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './event-details.html',
  styleUrl: './event-details.scss'
})
export class EventDetails implements OnInit {

  private route = inject(ActivatedRoute);
  private albumsService = inject(AlbumsService);
  private selectionService = inject(SelectionService);

  album = signal<VyntraAlbum | null>(null);
  selections = signal<PhotoSelection[]>([]);

  selectionControl =
    signal<AlbumSelectionControl | null>(null);

  loading = signal(true);
  errorMessage = signal('');

  selectedCount = computed(() =>
    this.selections().length
  );

  extraCount = computed(() =>
    Math.max(
      0,
      this.selectedCount() -
      (this.album()?.included_photos ?? 0)
    )
  );

  extraTotal = computed(() =>
    this.extraCount() *
    (this.album()?.extra_photo_price ?? 0)
  );

  selectionClosed = computed(() =>
    this.selectionControl()?.selection_status === 'closed'
  );

  theme = computed<EventTheme>(() => {
    const type = this.album()?.event_type ?? 'other';

    return EVENT_THEMES[type] ?? EVENT_THEMES['other'];
  });

  async ngOnInit(): Promise<void> {
    const albumId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('slug') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('slug');

    if (!albumId) {
      this.errorMessage.set('No se encontró el evento.');
      this.loading.set(false);
      return;
    }

    try {
      const currentAlbum =
        await this.albumsService.getAlbumById(albumId);

      if (!currentAlbum) {
        this.errorMessage.set(
          'La información de este evento no está disponible.'
        );
        return;
      }

      this.album.set(currentAlbum);

      const [selections, control] = await Promise.all([
        this.selectionService.getPhotoSelections(
          currentAlbum.id
        ),
        this.selectionService.getSelectionControl(
          currentAlbum.id
        )
      ]);

      this.selections.set(selections);
      this.selectionControl.set(control);

    } catch (error) {
      console.error('Error cargando detalles:', error);

      this.errorMessage.set(
        'No fue posible cargar los detalles del evento.'
      );

    } finally {
      this.loading.set(false);
    }
  }

  getEventLabel(type: string): string {
    const labels: Record<string, string> = {
      wedding: 'Matrimonio',
      quinceanera: 'Quinceaños',
      birthday: 'Cumpleaños',
      baptism: 'Bautizo',
      first_communion: 'Primera comunión',
      graduation: 'Grado',
      corporate: 'Evento corporativo',
      other: 'Otro evento'
    };

    return labels[type] ?? 'Evento';
  }
}
