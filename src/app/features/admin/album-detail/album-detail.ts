import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed } from '@angular/core';

import { DecimalPipe } from '@angular/common';

import { ActivatedRoute, RouterLink } from '@angular/router';

import {

  AlbumsService, VyntraAlbum, AlbumStatus, EventType, UpdateAlbumDto

} from '../../../core/services/album';

import {

  SelectionService, AlbumSelectionControl

} from '../../../core/services/selection';

import {

  PhotosService, VyntraPhoto

} from '../../../core/services/photos';

import {

  PhotoProcessorService

} from '../../../core/services/photo-processor';

interface GalleryPhoto extends VyntraPhoto {

  previewUrl: string | null;

}

@Component({

  selector: 'app-album-detail',

  standalone: true,

  imports: [RouterLink, DecimalPipe],

  templateUrl: './album-detail.html',

  styleUrl: './album-detail.scss'

})

export class AlbumDetail implements OnInit, OnDestroy {

  private route = inject(ActivatedRoute);

  private albumsService = inject(AlbumsService);

  private selectionService = inject(SelectionService);

  private photosService = inject(PhotosService);

  private photoProcessor = inject(PhotoProcessorService);

  // Edición del álbum: se mantiene separada del registro guardado.

  editingAlbum = signal(false);

  savingAlbum = signal(false);

  editError = signal('');

  editSuccess = signal('');

  editForm = signal<{

    title: string;

    event_type: EventType;

    event_date: string;

    description: string;

    included_photos: number;

    extra_photo_price: number;

    allow_extra_photos: boolean;

    watermark_enabled: boolean;

    allow_downloads: boolean;

  }>({

    title: '', event_type: 'other', event_date: '', description: '',

    included_photos: 0, extra_photo_price: 0, allow_extra_photos: true,

    watermark_enabled: true, allow_downloads: false

  });

  beginAlbumEdit(): void {

    const a = this.album();

    if (!a || this.savingAlbum()) return;

    this.editForm.set({

      title: a.title,

      event_type: a.event_type,

      event_date: a.event_date ?? '',

      description: a.description ?? '',

      included_photos: a.included_photos,

      extra_photo_price: a.extra_photo_price,

      allow_extra_photos: a.allow_extra_photos,

      watermark_enabled: a.watermark_enabled,

      allow_downloads: a.allow_downloads

    });

    this.editError.set('');

    this.editSuccess.set('');

    this.editingAlbum.set(true);

  }

  changeAlbumField(field: keyof ReturnType<typeof this.editForm>, event: Event): void {

    const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    const value = input instanceof HTMLInputElement && input.type === 'checkbox'

      ? input.checked

      : input instanceof HTMLInputElement && input.type === 'number'

        ? input.valueAsNumber

        : input.value;

    this.editForm.update(current => ({ ...current, [field]: value }));

  }

  cancelAlbumEdit(): void {

    if (this.savingAlbum()) return;

    this.editingAlbum.set(false);

    this.editError.set('');

  }

  async saveAlbumEdit(): Promise<void> {

    const a = this.album();

    if (!a || !this.editingAlbum() || this.savingAlbum()) return;

    const form = this.editForm();

    const title = form.title.trim();

    const included = form.included_photos;

    const price = form.extra_photo_price;

    if (!title) {

      this.editError.set('El nombre del álbum es obligatorio.');

      return;

    }

    if (!Number.isSafeInteger(included) || included < 0 ||

        !Number.isSafeInteger(price) || price < 0) {

      this.editError.set('Las cantidades y precios deben ser números enteros iguales o mayores que cero.');

      return;

    }

    if (this.selectionClosed() && included < this.selectedPhotoCount()) {

      this.editError.set('No puedes reducir las fotografías incluidas por debajo de la selección confirmada del cliente.');

      return;

    }

    this.savingAlbum.set(true);

    this.editError.set('');

    this.editSuccess.set('');

    try {

      const changes: UpdateAlbumDto = {

        title,

        event_type: form.event_type,

        event_date: form.event_date || null,

        description: form.description.trim() || null,

        included_photos: included,

        extra_photo_price: price,

        allow_extra_photos: form.allow_extra_photos,

        watermark_enabled: form.watermark_enabled,

        allow_downloads: form.allow_downloads

      };

      const updated = await this.albumsService.updateAlbum(a.id, changes);

      this.album.set(updated);

      this.editingAlbum.set(false);

      this.editSuccess.set('Información del álbum actualizada correctamente.');

    } catch (error) {

      console.error('Error guardando información del álbum:', error);

      this.editError.set(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');

    } finally {

      this.savingAlbum.set(false);

    }

  }

  album = signal<VyntraAlbum | null>(null);

  selectionControl = signal<AlbumSelectionControl | null>(null);

  loading = signal(true);

  loadingSelection = signal(false);

  loadingFavorites = signal(false);

  favoritesLoaded = signal(false);

  errorMessage = signal('');

  selectionError = signal('');

  favoritesError = signal('');

  successMessage = signal('');

  reopening = signal(false);

  showReopenConfirm = signal(false);

  updatingStatus = signal(false);

  statusError = signal('');

  statusSuccess = signal('');

  pendingStatus = signal<AlbumStatus | null>(null);

  photos = signal<GalleryPhoto[]>([]);

  selectedPhotoIds = signal<Set<string>>(new Set());

  loadingPhotos = signal(false);

  uploading = signal(false);

  uploadError = signal('');

  uploadSuccess = signal('');

  uploadTotal = signal(0);

  uploadCompleted = signal(0);

  selectedPreview = signal<GalleryPhoto | null>(null);

  // Navegación del visor administrativo.
  previewIndex = computed(() => this.photos().findIndex(p => p.id === this.selectedPreview()?.id));
  previewPosition = computed(() => this.photos().filter(p => !!p.previewUrl).findIndex(p => p.id === this.selectedPreview()?.id) + 1);
  previewTotal = computed(() => this.photos().filter(p => !!p.previewUrl).length);
  private readonly lightboxHistoryKey = '__vyntraAdminPhotoViewer';
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private previousBodyOverflow: string | null = null;


  deletingPhoto = signal(false);

  showDeleteConfirm = signal(false);

  photoToDelete = signal<GalleryPhoto | null>(null);

  deleteError = signal('');

  deleteSuccess = signal('');

  cleaningAlbum = signal(false);

  showCleanupConfirm = signal(false);

  cleanupCompleted = signal(0);

  cleanupError = signal('');

  cleanupSuccess = signal('');

  photoCount = computed(() => this.photos().length);

  selectedPhotoCount = computed(() =>

    this.photos().filter(p => this.selectedPhotoIds().has(p.id)).length

  );

  unselectedPhotoCount = computed(() =>

    Math.max(0, this.photoCount() - this.selectedPhotoCount())

  );

  extraPhotoCount = computed(() =>

    Math.max(

      0,

      this.selectedPhotoCount() -

      (this.album()?.included_photos ?? 0)

    )

  );

  extraPhotoTotal = computed(() =>

    this.extraPhotoCount() *

    (this.album()?.extra_photo_price ?? 0)

  );

  // ==========================================

  // LIMPIEZA DE FOTOGRAFÍAS NO SELECCIONADAS

  // ==========================================

  openCleanupConfirmation(): void {

    if (

      !this.selectionClosed() ||

      !this.favoritesLoaded() ||

      this.loadingFavorites() ||

      this.cleaningAlbum() ||

      this.unselectedPhotoCount() === 0

    ) {

      return;

    }

    this.cleanupError.set('');

    this.cleanupSuccess.set('');

    this.showCleanupConfirm.set(true);

  }

  closeCleanupConfirmation(): void {

    if (this.cleaningAlbum()) return;

    this.showCleanupConfirm.set(false);

  }

  async confirmCleanup(): Promise<void> {

    const currentAlbum = this.album();

    if (

      !currentAlbum ||

      !this.selectionClosed() ||

      !this.favoritesLoaded() ||

      this.cleaningAlbum()

    ) {

      return;

    }

    this.cleaningAlbum.set(true);

    this.cleanupCompleted.set(0);

    this.cleanupError.set('');

    this.cleanupSuccess.set('');

    try {

      const result =

        await this.photosService.deleteUnselectedPhotos(

          currentAlbum.id,

          (completed) => {

            this.cleanupCompleted.set(completed);

          }

        );

      await Promise.all([

        this.loadPhotos(currentAlbum.id),

        this.loadClientFavorites(currentAlbum.id),

        this.loadSelectionControl(currentAlbum.id)

      ]);

      this.showCleanupConfirm.set(false);

      if (result.failed > 0) {

        this.cleanupError.set(

          `Se eliminaron ${result.deleted} fotografías, ` +

          `pero ${result.failed} no pudieron eliminarse. ` +

          `Revisa los permisos y archivos de Supabase.`

        );

      } else {

        this.cleanupSuccess.set(

          `Limpieza completada. Se eliminaron ` +

          `${result.deleted} fotografías no seleccionadas.`

        );

      }

    } catch (error) {

      console.error('Error limpiando álbum:', error);

      this.cleanupError.set(

        error instanceof Error

          ? error.message

          : 'No fue posible completar la limpieza.'

      );

      await this.loadPhotos(currentAlbum.id);

    } finally {

      this.cleaningAlbum.set(false);

    }

  }

  uploadProgress = computed(() => {

    const total = this.uploadTotal();

    return total === 0

      ? 0

      : Math.round(this.uploadCompleted() / total * 100);

  });

  selectionClosed = computed(() =>

    this.selectionControl()?.selection_status === 'closed'

  );

  reopenUsed = computed(() =>

    this.selectionControl()?.reopen_used ?? false

  );

  canReopen = computed(() => {

    const control = this.selectionControl();

    return !!control &&

      control.selection_status === 'closed' &&

      !control.reopen_used;

  });

  isClientSelected(photoId: string): boolean {

    return this.selectedPhotoIds().has(photoId);

  }

  get showSelectionResults(): boolean {

    return this.selectionClosed() &&

      this.favoritesLoaded() &&

      !this.loadingFavorites() &&

      !this.favoritesError();

  }

  async ngOnInit(): Promise<void> {

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {

      this.errorMessage.set('No se encontró el identificador del álbum.');

      this.loading.set(false);

      return;

    }

    try {

      const result = await this.albumsService.getAlbumById(id);

      if (!result) {

        this.errorMessage.set('No se encontró el álbum solicitado.');

        return;

      }

      this.album.set(result);

      await Promise.all([

        this.loadSelectionControl(result.id),

        this.loadPhotos(result.id),

        this.loadClientFavorites(result.id)

      ]);

    } catch (error) {

      console.error('Error cargando álbum:', error);

      this.errorMessage.set('No fue posible cargar el álbum.');

    } finally {

      this.loading.set(false);

    }

  }

  // ESTADO DEL ÁLBUM

  requestStatusChange(status: AlbumStatus): void {

    const current = this.album();

    if (!current || current.status === status || this.updatingStatus()) {

      return;

    }

    this.statusError.set('');

    this.statusSuccess.set('');

    this.pendingStatus.set(status);

  }

  cancelStatusChange(): void {

    if (!this.updatingStatus()) this.pendingStatus.set(null);

  }

  async confirmStatusChange(): Promise<void> {

    const current = this.album();

    const nextStatus = this.pendingStatus();

    if (!current || !nextStatus || this.updatingStatus()) return;

    this.updatingStatus.set(true);

    this.statusError.set('');

    this.statusSuccess.set('');

    try {

      const updated = await this.albumsService.updateAlbum(

        current.id,

        { status: nextStatus }

      );

      this.album.set(updated);

      this.pendingStatus.set(null);

      const messages: Record<AlbumStatus, string> = {

        draft: 'El álbum volvió a borrador.',

        published: 'El álbum fue publicado correctamente.',

        archived: 'El álbum fue archivado correctamente.'

      };

      this.statusSuccess.set(messages[nextStatus]);

    } catch (error) {

      console.error('Error actualizando estado:', error);

      this.statusError.set(

        error instanceof Error

          ? error.message

          : 'No fue posible actualizar el estado del álbum.'

      );

    } finally {

      this.updatingStatus.set(false);

    }

  }

  getStatusDescription(status: AlbumStatus): string {

    const descriptions: Record<AlbumStatus, string> = {

      draft: 'El álbum permanecerá en preparación y no estará disponible para el cliente.',

      published: 'El álbum estará disponible para el cliente cuando tenga un acceso activo y autorizado.',

      archived: 'El álbum dejará de estar disponible para el cliente, pero se conservará en administración.'

    };

    return descriptions[status];

  }

  // FOTOGRAFÍAS

  async loadPhotos(albumId: string): Promise<void> {

    this.loadingPhotos.set(true);

    this.uploadError.set('');

    try {

      const records = await this.photosService.getPhotos(albumId);

      const gallery = await Promise.all(

        records.map(async photo => {

          let previewUrl: string | null = null;

          if (photo.preview_path) {

            try {

              previewUrl = await this.photosService.getPreviewUrl(

                photo.preview_path

              );

            } catch (error) {

              console.error('Error generando vista previa:', error);

            }

          }

          return { ...photo, previewUrl };

        })

      );

      this.photos.set(gallery);

    } catch (error) {

      console.error('Error cargando fotografías:', error);

      this.uploadError.set(

        'No fue posible consultar las fotografías del álbum.'

      );

    } finally {

      this.loadingPhotos.set(false);

    }

  }

  async onFilesSelected(event: Event): Promise<void> {

    const input = event.target as HTMLInputElement;

    const files = Array.from(input.files ?? []);

    const currentAlbum = this.album();

    if (!currentAlbum || this.uploading() || files.length === 0) {

      input.value = '';

      return;

    }

    const MAX_FILE_SIZE = 150 * 1024 * 1024;

    const CONCURRENCY = 3;

    const supportedImage = (file: File): boolean => {

      const supportedExtension = /\.(jpe?g|png|webp)$/i.test(file.name);

      const supportedMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

      return supportedExtension && (supportedMime || file.type === '');

    };

    this.uploadError.set('');

    this.uploadSuccess.set('');

    const validFiles = files.filter(file =>

      supportedImage(file) &&

      file.size <= MAX_FILE_SIZE &&

      this.photoProcessor.isSupportedFile(file)

    );

    const skipped = files.length - validFiles.length;

    if (validFiles.length === 0) {

      this.uploadError.set('Selecciona fotografías JPG, PNG o WebP de hasta 150 MB. Los archivos RAW no son compatibles.');

      input.value = '';

      return;

    }

    this.uploading.set(true);

    this.uploadTotal.set(validFiles.length);

    this.uploadCompleted.set(0);

    let successful = 0;

    const failedFiles: string[] = [];

    let nextIndex = 0;

    const processOne = async (file: File): Promise<void> => {

      let originalPath: string | null = null;

      let previewPath: string | null = null;

      try {

        const processed = await this.photoProcessor.processPhoto(

          file,

          currentAlbum.watermark_enabled

        );

        originalPath = await this.photosService.uploadOriginal(

          currentAlbum.id,

          file

        );

        previewPath = await this.photosService.uploadPreview(

          currentAlbum.id,

          processed.preview

        );

        await this.photosService.createPhoto({

          album_id: currentAlbum.id,

          original_path: originalPath,

          preview_path: previewPath,

          file_name: file.name,

          file_size: file.size,

          mime_type: file.type || ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'),

          width: processed.width,

          height: processed.height

        });

        successful++;

      } catch (error) {

        console.error(`Error procesando ${file.name}:`, error);

        const detail = error instanceof Error ? error.message : 'Error desconocido.';

        failedFiles.push(`${file.name}: ${detail}`);

        if (originalPath || previewPath) {

          try {

            await this.photosService.deletePhotoFiles({

              original_path: originalPath ?? '',

              preview_path: previewPath

            });

          } catch (cleanupError) {

            console.error('Error limpiando archivos incompletos:', cleanupError);

          }

        }

      } finally {

        this.uploadCompleted.update(value => value + 1);

      }

    };

    const worker = async (): Promise<void> => {

      while (nextIndex < validFiles.length) {

        const index = nextIndex++;

        await processOne(validFiles[index]);

      }

    };

    try {

      const workerCount = Math.min(CONCURRENCY, validFiles.length);

      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      await this.loadPhotos(currentAlbum.id);

      if (successful > 0) {

        this.uploadSuccess.set(`${successful} fotografía(s) cargada(s) correctamente.`);

      }

      const errors: string[] = [];

      if (skipped > 0) {

        errors.push(`${skipped} archivo(s) omitido(s). Solo se aceptan JPG, PNG y WebP de hasta 150 MB.`);

      }

      if (failedFiles.length > 0) {

        errors.push(`${failedFiles.length} fotografía(s) fallaron. ${failedFiles.slice(0, 3).join(' | ')}`);

      }

      if (errors.length > 0) this.uploadError.set(errors.join(' '));

    } catch (error) {

      console.error('Error general de carga:', error);

      this.uploadError.set('Se produjo un error durante la carga del álbum.');

    } finally {

      this.uploading.set(false);

      input.value = '';

    }

  }

  openPhoto(photo: GalleryPhoto): void {
    if (!photo.previewUrl) return;
    if (!this.selectedPreview()) {
      // Una entrada de historial permite cerrar el visor con Atrás en el celular.
      history.pushState({ ...history.state, [this.lightboxHistoryKey]: this.album()?.id }, '');
      this.lockPageScroll();
    }
    this.selectedPreview.set(photo);
  }

  closePhoto(): void {
    if (!this.selectedPreview()) return;
    this.selectedPreview.set(null);
    this.unlockPageScroll();
    // Retirar solamente la entrada que agregó el visor.
    if (history.state?.[this.lightboxHistoryKey] === this.album()?.id) {
      history.back();
    }
  }

  showPreviousPhoto(): void {
    this.movePreview(-1);
  }

  showNextPhoto(): void {
    this.movePreview(1);
  }

  private movePreview(direction: -1 | 1): void {
    const items = this.photos().filter(photo => !!photo.previewUrl);
    const current = this.selectedPreview();
    if (!current || items.length < 2) return;
    const index = items.findIndex(photo => photo.id === current.id);
    if (index < 0) return;
    this.selectedPreview.set(items[(index + direction + items.length) % items.length]);
  }

  onPreviewTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onPreviewTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null || this.touchStartY === null || !event.changedTouches.length) return;
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    const deltaY = event.changedTouches[0].clientY - this.touchStartY;
    this.touchStartX = null;
    this.touchStartY = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.3) return;
    if (deltaX < 0) this.showNextPhoto();
    else this.showPreviousPhoto();
  }

  @HostListener('document:keydown', ['$event'])
  onPreviewKeydown(event: KeyboardEvent): void {
    if (!this.selectedPreview()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePhoto();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showPreviousPhoto();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.showNextPhoto();
    }
  }

  @HostListener('window:popstate')
  onPreviewPopstate(): void {
    if (this.selectedPreview()) {
      this.selectedPreview.set(null);
      this.unlockPageScroll();
    }
  }

  private lockPageScroll(): void {
    if (this.previousBodyOverflow === null) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockPageScroll(): void {
    if (this.previousBodyOverflow !== null) {
      document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = null;
    }
  }

  ngOnDestroy(): void {
    this.unlockPageScroll();
  }

  // ELIMINACIÓN

  openDeleteConfirmation(photo: GalleryPhoto): void {

    if (this.deletingPhoto()) return;

    this.photoToDelete.set(photo);

    this.deleteError.set('');

    this.deleteSuccess.set('');

    this.showDeleteConfirm.set(true);

  }

  closeDeleteConfirmation(): void {

    if (this.deletingPhoto()) return;

    this.showDeleteConfirm.set(false);

    this.photoToDelete.set(null);

  }

  async confirmDeletePhoto(): Promise<void> {

    const currentAlbum = this.album();

    const photo = this.photoToDelete();

    if (!currentAlbum || !photo || this.deletingPhoto()) return;

    this.deletingPhoto.set(true);

    this.deleteError.set('');

    this.deleteSuccess.set('');

    try {

      await this.photosService.deletePhoto(currentAlbum.id, photo.id);

      this.photos.update(current =>

        current.filter(item => item.id !== photo.id)

      );

      this.selectedPhotoIds.update(current => {

        const next = new Set(current);

        next.delete(photo.id);

        return next;

      });

      if (this.selectedPreview()?.id === photo.id) {

        this.selectedPreview.set(null);

      }

      this.showDeleteConfirm.set(false);

      this.photoToDelete.set(null);

      this.deleteSuccess.set('Fotografía eliminada correctamente.');

    } catch (error) {

      console.error('Error eliminando fotografía:', error);

      this.deleteError.set(

        error instanceof Error

          ? error.message

          : 'No fue posible eliminar la fotografía.'

      );

    } finally {

      this.deletingPhoto.set(false);

    }

  }

  // SELECCIÓN OFICIAL DEL CLIENTE

  async loadClientFavorites(albumId: string): Promise<void> {

    this.loadingFavorites.set(true);

    this.favoritesLoaded.set(false);

    this.favoritesError.set('');

    try {

      const selections =

        await this.selectionService.getPhotoSelections(albumId);

      this.selectedPhotoIds.set(

        new Set(selections.map(item => item.photo_id))

      );

      this.favoritesLoaded.set(true);

    } catch (error) {

      console.error('Error cargando favoritos:', error);

      this.selectedPhotoIds.set(new Set());

      this.favoritesError.set(

        'No fue posible consultar las fotografías elegidas. Revisa los permisos de Supabase.'

      );

    } finally {

      this.loadingFavorites.set(false);

    }

  }

  async refreshClientSelection(): Promise<void> {

    const current = this.album();

    if (!current || this.loadingFavorites() || this.loadingSelection()) {

      return;

    }

    await Promise.all([

      this.loadSelectionControl(current.id),

      this.loadClientFavorites(current.id)

    ]);

  }

  async loadSelectionControl(albumId: string): Promise<void> {

    this.loadingSelection.set(true);

    this.selectionError.set('');

    try {

      const control =

        await this.selectionService.getSelectionControl(albumId);

      this.selectionControl.set(control);

      if (!control) {

        this.selectionError.set(

          'No se encontró el control de selección. Verifica los permisos de Supabase.'

        );

      }

    } catch (error) {

      console.error('Error cargando control:', error);

      this.selectionControl.set(null);

      this.selectionError.set(

        'No fue posible consultar el control de selección.'

      );

    } finally {

      this.loadingSelection.set(false);

    }

  }

  openReopenConfirmation(): void {

    if (!this.canReopen()) return;

    this.successMessage.set('');

    this.selectionError.set('');

    this.showReopenConfirm.set(true);

  }

  closeReopenConfirmation(): void {

    if (!this.reopening()) this.showReopenConfirm.set(false);

  }

  async confirmReopen(): Promise<void> {

    const currentAlbum = this.album();

    if (!currentAlbum || !this.canReopen() || this.reopening()) return;

    this.reopening.set(true);

    this.selectionError.set('');

    this.successMessage.set('');

    try {

      const updatedControl =

        await this.selectionService.reopenSelection(currentAlbum.id);

      this.selectionControl.set(updatedControl);

      this.showReopenConfirm.set(false);

      if (

        updatedControl.selection_status === 'open' &&

        updatedControl.reopen_used === true

      ) {

        this.successMessage.set(

          'La selección fue reabierta. El cliente podrá modificar sus fotografías y confirmar una última vez.'

        );

      } else {

        this.selectionError.set(

          'No fue posible confirmar el estado actualizado.'

        );

      }

      await this.loadClientFavorites(currentAlbum.id);

    } catch (error) {

      console.error('Error reabriendo selección:', error);

      this.selectionError.set(

        'No fue posible autorizar la reapertura. Verifica los permisos y que no se haya utilizado anteriormente.'

      );

    } finally {

      this.reopening.set(false);

    }

  }

  // ETIQUETAS

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

  getStatusLabel(status: string): string {

    const labels: Record<string, string> = {

      draft: 'Borrador',

      published: 'Publicado',

      archived: 'Archivado'

    };

    return labels[status] ?? status;

  }

  formatDate(date: string | null): string {

    if (!date) return 'No disponible';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return 'Fecha no válida';

    return new Intl.DateTimeFormat('es-CO', {

      day: '2-digit',

      month: 'long',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

      timeZone: 'America/Bogota'

    }).format(parsedDate);

  }

}
