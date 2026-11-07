
import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';

import { DecimalPipe } from '@angular/common';
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
  PhotoSelection,
  AlbumSelectionControl
} from '../../../core/services/selection';

interface SelectedGalleryPhoto extends VyntraPhoto {
  previewUrl: string | null;
}

@Component({
  selector: 'app-selection',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './selection.html',
  styleUrl: './selection.scss'
})
export class Selection implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private albumsService = inject(AlbumsService);
  private photosService = inject(PhotosService);
  private selectionService = inject(SelectionService);

  album = signal<VyntraAlbum | null>(null);
  selections = signal<PhotoSelection[]>([]);
  selectedPhotos = signal<SelectedGalleryPhoto[]>([]);

  selectionControl =
    signal<AlbumSelectionControl | null>(null);

  selectedPhoto = signal<SelectedGalleryPhoto | null>(null);

  loading = signal(true);
  errorMessage = signal('');

  isAdminPreview = signal(false);

  selectedCount = computed(() => this.selections().length);

  includedCount = computed(() =>
    Math.max(0, this.album()?.included_photos ?? 0)
  );

  extraCount = computed(() =>
    Math.max(0, this.selectedCount() - this.includedCount())
  );

  extraTotal = computed(() =>
    this.extraCount() *
    (this.album()?.extra_photo_price ?? 0)
  );

  selectionClosed = computed(() =>
    this.selectionControl()?.selection_status === 'closed'
  );

  
eventTheme = computed(() => {
  const themes: Record<string, {
    background: string;
    surface: string;
    accent: string;
    text: string;
  }> = {
    wedding: {
      background: '#f7f3ee',
      surface: '#ffffff',
      accent: '#a78359',
      text: '#342a25'
    },
    quinceanera: {
      background: '#faf7fc',
      surface: '#ffffff',
      accent: '#a66bc5',
      text: '#563b61'
    },
    birthday: {
      background: '#fff8f2',
      surface: '#ffffff',
      accent: '#cb855c',
      text: '#583c31'
    },
    baptism: {
      background: '#f4fafc',
      surface: '#ffffff',
      accent: '#78aebd',
      text: '#365661'
    },
    first_communion: {
      background: '#faf9f3',
      surface: '#ffffff',
      accent: '#b49a65',
      text: '#554c39'
    },
    graduation: {
      background: '#f6f8f5',
      surface: '#ffffff',
      accent: '#82966d',
      text: '#354438'
    },
    corporate: {
      background: '#f5f7fa',
      surface: '#ffffff',
      accent: '#6e86a6',
      text: '#293b50'
    }
  };

  return themes[this.album()?.event_type ?? ''] ?? {
    background: '#f7f3ee',
    surface: '#ffffff',
    accent: '#a78359',
    text: '#342a25'
  };
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
      this.errorMessage.set('No se encontró el álbum.');
      this.loading.set(false);
      return;
    }

    try {
      const currentAlbum =
        await this.albumsService.getAlbumById(albumId);

      if (!currentAlbum) {
        this.errorMessage.set('Este álbum no está disponible.');
        return;
      }

      this.album.set(currentAlbum);

      const [selections, photos] = await Promise.all([
        this.selectionService.getPhotoSelections(currentAlbum.id),
        this.photosService.getPhotos(currentAlbum.id)
      ]);

      this.selections.set(selections);

      try {
        const control =
          await this.selectionService.getSelectionControl(
            currentAlbum.id
          );

        this.selectionControl.set(control);
      } catch (error) {
        console.error('Error consultando estado:', error);
      }

      const selectedIds = new Set(
        selections.map(selection => selection.photo_id)
      );

      const matchingPhotos = photos.filter(
        photo => selectedIds.has(photo.id)
      );

      const photosWithPreviews = await Promise.all(
        matchingPhotos.map(async photo => {
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

          return {
            ...photo,
            previewUrl
          };
        })
      );

      this.selectedPhotos.set(photosWithPreviews);

    } catch (error) {
      console.error('Error cargando favoritos:', error);

      this.errorMessage.set(
        'No fue posible cargar tus fotografías seleccionadas.'
      );

    } finally {
      this.loading.set(false);
    }
  }

  openPhoto(photo: SelectedGalleryPhoto): void {
    if (!photo.previewUrl) return;
    this.selectedPhoto.set(photo);
  }

  closePhoto(): void {
    this.selectedPhoto.set(null);
  }
}
