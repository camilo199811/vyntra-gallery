
import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';

import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import {
  AlbumsService,
  VyntraAlbum
} from '../../../core/services/album';

import {
  PhotosService,
  VyntraPhoto
} from '../../../core/services/photos';

import {
  SelectionService,
  AlbumSelectionControl
} from '../../../core/services/selection';

interface GalleryPhoto extends VyntraPhoto {
  previewUrl: string | null;
}

interface GalleryTheme {
  name: string;
  headline: string;
  subtitle: string;
  selectionHeadline: string;
  selectionDescription: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  cover: string;
}

const THEMES: Record<string, GalleryTheme> = {
  wedding: {
    name: 'wedding',
    headline: 'Su gran día,\nen imágenes.',
    subtitle:
      'Revivan cada emoción y vuelvan a sentir la magia de un día que siempre llevarán en el corazón.',
    selectionHeadline:
      'Los momentos que llevarán siempre consigo',
    selectionDescription:
      'Elijan las fotografías que más les emocionen. Nosotros nos encargaremos de darles el toque final.',
    accent: '#78947C',
    background: '#F8F9F5',
    surface: '#FFFFFF',
    text: '#344B3B',
    cover: '/images/portada-boda.webp'
  },

  quinceanera: {
    name: 'quinceanera',
    headline: 'Quince años,\ninfinitos recuerdos.',
    subtitle:
      'Un día de sueños, sonrisas y momentos que merecen quedarse para siempre.',
    selectionHeadline:
      'Tus momentos más bonitos, para siempre',
    selectionDescription:
      'Elige las fotografías que más te hagan sonreír. Nosotros cuidaremos cada detalle.',
    accent: '#A47DB8',
    background: '#FAF7FC',
    surface: '#FFFFFF',
    text: '#503C5A',
    cover: '/images/portada-quinceanos.webp'
  },

  birthday: {
    name: 'birthday',
    headline: 'La vida merece\ncelebrarse.',
    subtitle:
      'Risas, abrazos y momentos especiales que hacen inolvidable cada cumpleaños.',
    selectionHeadline:
      'Lo mejor de este día, en tus manos',
    selectionDescription:
      'Quédate con las fotografías que te hagan revivir la alegría de esta celebración.',
    accent: '#C58A62',
    background: '#FCF8F4',
    surface: '#FFFFFF',
    text: '#604737',
    cover: '/images/portada-cumpleanos.webp'
  },

  baptism: {
    name: 'baptism',
    headline: 'Un comienzo\nlleno de amor.',
    subtitle:
      'La ternura de un día especial, guardada en recuerdos que acompañarán toda una vida.',
    selectionHeadline:
      'Pequeños instantes, grandes recuerdos',
    selectionDescription:
      'Elijan con cariño las fotografías que desean conservar de este día tan especial.',
    accent: '#719FAE',
    background: '#F5FAFB',
    surface: '#FFFFFF',
    text: '#36545E',
    cover: '/images/portada-bautizo.webp'
  },

  first_communion: {
    name: 'first_communion',
    headline: 'Un día de fe,\namor y alegría.',
    subtitle:
      'Una celebración llena de luz, ilusión y recuerdos que permanecerán en familia.',
    selectionHeadline:
      'Los recuerdos de un día muy especial',
    selectionDescription:
      'Elijan las imágenes que mejor cuenten la belleza de esta celebración.',
    accent: '#A9915F',
    background: '#FCFAF5',
    surface: '#FFFFFF',
    text: '#5C513D',
    cover: '/images/portada-comunion.webp'
  },

  graduation: {
    name: 'graduation',
    headline: 'El comienzo de\nuna nueva historia.',
    subtitle:
      'Cada esfuerzo, cada sueño y cada logro merecen un recuerdo a su altura.',
    selectionHeadline:
      'Un logro que merece recordarse',
    selectionDescription:
      'Elige las fotografías que mejor representen todo lo que has conseguido.',
    accent: '#9B875A',
    background: '#F9F9F5',
    surface: '#FFFFFF',
    text: '#424C3C',
    cover: '/images/portada-grado.webp'
  },

  corporate: {
    name: 'corporate',
    headline: 'Grandes momentos.\nGrandes historias.',
    subtitle:
      'Los encuentros, las ideas y los logros que hicieron especial este evento.',
    selectionHeadline:
      'Los momentos que cuentan nuestra historia',
    selectionDescription:
      'Seleccionen las fotografías que mejor representen la esencia de su evento.',
    accent: '#718EAD',
    background: '#F6F9FC',
    surface: '#FFFFFF',
    text: '#354A60',
    cover: '/images/portada-corporativo.webp'
  },

  other: {
    name: 'other',
    headline: 'Momentos que\npermanecen.',
    subtitle:
      'Hay historias que merecen ser contadas una y otra vez.',
    selectionHeadline:
      'Los recuerdos que más importan',
    selectionDescription:
      'Elige las fotografías que quieras conservar de este momento especial.',
    accent: '#A98C65',
    background: '#FAF8F5',
    surface: '#FFFFFF',
    text: '#53483C',
    cover: '/images/portada-otros.webp'
  }
};

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './album.html',
  styleUrl: './album.scss'
})
export class Album implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private albumsService = inject(AlbumsService);
  private photosService = inject(PhotosService);
  private selectionService = inject(SelectionService);

  album = signal<VyntraAlbum | null>(null);
  photos = signal<GalleryPhoto[]>([]);

  loading = signal(true);
  errorMessage = signal('');
  actionMessage = signal('');
  actionError = signal('');

  selectedPhoto = signal<GalleryPhoto | null>(null);
  activeFilter = signal('all');

  selectedIds = signal<Set<string>>(new Set());
  pendingIds = signal<Set<string>>(new Set());

  selectionControl =
    signal<AlbumSelectionControl | null>(null);

  selectionReady = signal(false);
  confirming = signal(false);
  showConfirmDialog = signal(false);
  isAdminPreview = signal(false);

  theme = computed(() => {
    const type = this.album()?.event_type ?? 'other';
    return THEMES[type] ?? THEMES['other'];
  });

  heroBackground = computed(() => this.theme().cover);

  photoCount = computed(() => this.photos().length);

  favoriteCount = computed(() => this.selectedIds().size);

  includedCount = computed(() =>
    Math.max(0, this.album()?.included_photos ?? 0)
  );

  remainingPhotos = computed(() =>
    Math.max(0, this.includedCount() - this.favoriteCount())
  );

  extraCount = computed(() =>
    Math.max(0, this.favoriteCount() - this.includedCount())
  );

  extraTotal = computed(() =>
    this.extraCount() *
    (this.album()?.extra_photo_price ?? 0)
  );

  selectionClosed = computed(() =>
    this.selectionControl()?.selection_status === 'closed'
  );

  canEditSelection = computed(() =>
    !this.isAdminPreview() &&
    this.selectionReady() &&
    this.selectionControl()?.selection_status === 'open' &&
    !this.confirming()
  );

  categories = computed(() => [
    { id: 'all', label: 'Todas las fotografías' },
    { id: 'favorites', label: 'Mis favoritas' }
  ]);

  visiblePhotos = computed(() => {
    if (this.activeFilter() === 'favorites') {
      return this.photos().filter(
        photo => this.selectedIds().has(photo.id)
      );
    }

    return this.photos();
  });

  async ngOnInit(): Promise<void> {
    const albumId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('slug') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('slug');

    this.isAdminPreview.set(
      this.router.url.startsWith('/admin-preview/')
    );

    if (!albumId) {
      this.errorMessage.set(
        'No encontramos el identificador de esta galería.'
      );
      this.loading.set(false);
      return;
    }

    try {
      const currentAlbum =
        await this.albumsService.getAlbumById(albumId);

      if (!currentAlbum) {
        this.errorMessage.set(
          'Esta galería no está disponible.'
        );
        return;
      }

      this.album.set(currentAlbum);

      const records =
        await this.photosService.getPhotos(currentAlbum.id);

      const gallery = await Promise.all(
        records.map(async photo => {
          let previewUrl: string | null = null;

          if (photo.preview_path) {
            try {
              previewUrl =
                await this.photosService.getPreviewUrl(
                  photo.preview_path
                );
            } catch (error) {
              console.error(
                'Error cargando vista previa:',
                error
              );
            }
          }

          return { ...photo, previewUrl };
        })
      );

      this.photos.set(gallery);

      if (!this.isAdminPreview()) {
        try {
          await this.refreshSelection();
          this.selectionReady.set(true);
        } catch (error) {
          console.error(
            'Error consultando selección:',
            error
          );
          this.actionError.set(
            'No pudimos cargar tus favoritas. Actualiza la página para intentarlo nuevamente.'
          );
        }
      }

    } catch (error) {
      console.error('Error cargando galería:', error);
      this.errorMessage.set(
        'No fue posible cargar esta galería.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async refreshSelection(): Promise<void> {
    const currentAlbum = this.album();

    if (!currentAlbum || this.isAdminPreview()) {
      return;
    }

    const [control, selections] = await Promise.all([
      this.selectionService.getSelectionControl(
        currentAlbum.id
      ),
      this.selectionService.getPhotoSelections(
        currentAlbum.id
      )
    ]);

    this.selectionControl.set(control);

    this.selectedIds.set(
      new Set(selections.map(item => item.photo_id))
    );
  }

  isFavorite(photoId: string): boolean {
    return this.selectedIds().has(photoId);
  }

  isPending(photoId: string): boolean {
    return this.pendingIds().has(photoId);
  }

  async toggleFavorite(photo: GalleryPhoto): Promise<void> {
    const currentAlbum = this.album();

    if (
      !currentAlbum ||
      !this.canEditSelection() ||
      this.isPending(photo.id)
    ) {
      return;
    }

    const wasSelected = this.isFavorite(photo.id);

    if (
      !wasSelected &&
      !currentAlbum.allow_extra_photos &&
      this.favoriteCount() >= this.includedCount()
    ) {
      this.actionError.set(
        'Ya elegiste todas las fotografías incluidas en tu paquete.'
      );
      return;
    }

    this.actionError.set('');
    this.actionMessage.set('');

    this.pendingIds.update(ids => {
      const next = new Set(ids);
      next.add(photo.id);
      return next;
    });

    try {
      if (wasSelected) {
        await this.selectionService.unselectPhoto(
          currentAlbum.id,
          photo.id
        );
      } else {
        await this.selectionService.selectPhoto(
          currentAlbum.id,
          photo.id
        );
      }

      await this.refreshSelection();

    } catch (error) {
      console.error('Error guardando favorito:', error);

      this.actionError.set(
        'No pudimos guardar este cambio. Inténtalo nuevamente.'
      );

      try {
        await this.refreshSelection();
      } catch (refreshError) {
        console.error(refreshError);
        this.selectionReady.set(false);
      }

    } finally {
      this.pendingIds.update(ids => {
        const next = new Set(ids);
        next.delete(photo.id);
        return next;
      });
    }
  }

  requestConfirmation(): void {
    if (
      !this.canEditSelection() ||
      this.pendingIds().size > 0
    ) {
      return;
    }

    if (this.favoriteCount() === 0) {
      this.actionError.set(
        'Elige al menos una fotografía antes de continuar.'
      );
      return;
    }

    this.actionError.set('');
    this.showConfirmDialog.set(true);
  }

  cancelConfirmation(): void {
    if (!this.confirming()) {
      this.showConfirmDialog.set(false);
    }
  }

  async confirmSelection(): Promise<void> {
    const currentAlbum = this.album();

    if (
      !currentAlbum ||
      !this.canEditSelection() ||
      this.pendingIds().size > 0 ||
      this.favoriteCount() === 0
    ) {
      return;
    }

    this.confirming.set(true);
    this.actionError.set('');

    try {
      await this.selectionService.confirmSelection(
        currentAlbum.id
      );

      await this.refreshSelection();

      this.showConfirmDialog.set(false);

      this.actionMessage.set(
        '¡Listo! Recibimos tu selección. Gracias por confiar tus recuerdos en Vyntra.'
      );

    } catch (error) {
      console.error(
        'Error confirmando selección:',
        error
      );

      this.actionError.set(
        'No pudimos confirmar tu selección. Inténtalo nuevamente.'
      );

      try {
        await this.refreshSelection();
      } catch (refreshError) {
        console.error(refreshError);
        this.selectionReady.set(false);
      }

    } finally {
      this.confirming.set(false);
    }
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  openPhoto(photo: GalleryPhoto): void {
    if (!photo.previewUrl) return;
    this.selectedPhoto.set(photo);
  }

  closePhoto(): void {
    this.selectedPhoto.set(null);
  }

  getEventLabel(type: string): string {
    const labels: Record<string, string> = {
      wedding: 'Nuestra boda',
      quinceanera: 'Mis quince años',
      birthday: 'Nuestro cumpleaños',
      baptism: 'Nuestro bautizo',
      first_communion: 'Nuestra primera comunión',
      graduation: 'Nuestra graduación',
      corporate: 'Nuestro evento',
      other: 'Nuestro evento'
    };

    return labels[type] ?? 'Nuestro evento';
  }
}
