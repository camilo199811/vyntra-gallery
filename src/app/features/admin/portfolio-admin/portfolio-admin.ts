
import {
  Component,
  inject,
  signal,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  PortfolioService,
  PortfolioPhoto
} from '../../../core/services/portfolio';

@Component({
  selector: 'app-portfolio-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portfolio-admin.html',
  styleUrl: './portfolio-admin.scss'
})
export class PortfolioAdmin implements OnInit {

  private readonly portfolioService =
    inject(PortfolioService);

  readonly uploading = signal(false);
  readonly loading = signal(true);
  readonly progress = signal('');
  readonly error = signal('');
  readonly success = signal('');

  readonly selectedFiles = signal<File[]>([]);
  readonly photos = signal<PortfolioPhoto[]>([]);
  readonly updatingIds = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadPhotos();
  }

  async loadPhotos(): Promise<void> {
    this.loading.set(true);

    try {
      this.photos.set(
        await this.portfolioService.getAllPhotos()
      );
    } catch (error) {
      console.error(error);
      this.error.set(
        'No fue posible cargar las fotografías.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  galleryUrl(photo: PortfolioPhoto): string {
    return this.portfolioService.getGalleryUrl(
      photo.gallery_path
    );
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    const files = Array.from(input.files ?? []);

    this.selectedFiles.set(
      files.filter(file => file.type === 'image/jpeg')
    );

    this.error.set('');
    this.success.set('');
  }

  private async optimize(
    file: File,
    maxDimension: number,
    quality: number
  ): Promise<Blob> {

    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image'
    });

    try {
      const scale = Math.min(
        1,
        maxDimension / Math.max(
          bitmap.width,
          bitmap.height
        )
      );

      const width = Math.max(
        1,
        Math.round(bitmap.width * scale)
      );

      const height = Math.max(
        1,
        Math.round(bitmap.height * scale)
      );

      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'No se pudo preparar la fotografía.'
        );
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      context.drawImage(
        bitmap,
        0,
        0,
        width,
        height
      );

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  'No se pudo optimizar la fotografía.'
                )
              );
            }
          },
          'image/webp',
          quality
        );
      });

    } finally {
      bitmap.close();
    }
  }

  async uploadPhotos(): Promise<void> {
    const files = this.selectedFiles();

    if (!files.length || this.uploading()) return;

    this.uploading.set(true);
    this.error.set('');
    this.success.set('');

    let uploaded = 0;

    try {
      for (const file of files) {

        this.progress.set(
          `Preparando ${uploaded + 1} de ${files.length}: ${file.name}`
        );

        const galleryBlob = await this.optimize(
          file, 1400, 0.88
        );

        const fullBlob = await this.optimize(
          file, 2560, 0.94
        );

        const id = crypto.randomUUID();
        const galleryPath = `gallery/${id}.webp`;
        const fullPath = `full/${id}.webp`;

        // Registrar las rutas subidas para poder
        // limpiarlas si ocurre un error.
        const uploadedPaths: string[] = [];

        try {
          await this.portfolioService.uploadImage(
            galleryPath, galleryBlob
          );
          uploadedPaths.push(galleryPath);

          await this.portfolioService.uploadImage(
            fullPath, fullBlob
          );
          uploadedPaths.push(fullPath);

          const bitmap = await createImageBitmap(file);

          try {
            await this.portfolioService.createPhoto({
              original_filename: file.name,
              gallery_path: galleryPath,
              full_path: fullPath,
              width: bitmap.width,
              height: bitmap.height,
              gallery_size_bytes: galleryBlob.size,
              full_size_bytes: fullBlob.size,
              is_published: true
            });
          } finally {
            bitmap.close();
          }

        } catch (uploadError) {
          // Si falla una subida o el registro,
          // intentamos limpiar archivos huérfanos.
          if (uploadedPaths.length) {
            try {
              await this.portfolioService.removeFiles(
                uploadedPaths
              );
            } catch (cleanupError) {
              console.error(
                'Error limpiando archivos:',
                cleanupError
              );
            }
          }

          throw uploadError;
        }

        uploaded++;

        this.progress.set(
          `${uploaded} de ${files.length} fotografías publicadas`
        );
      }

      this.success.set(
        `${uploaded} fotografías subidas correctamente.`
      );

      this.selectedFiles.set([]);

      await this.loadPhotos();

    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible completar la subida.'
      );

      // Refrescar incluso si una subida parcial falló.
      await this.loadPhotos();

    } finally {
      this.uploading.set(false);
    }
  }

  async togglePublished(
    photo: PortfolioPhoto
  ): Promise<void> {

    if (this.updatingIds().includes(photo.id)) return;

    this.updatingIds.update(ids => [...ids, photo.id]);

    this.error.set('');

    try {
      await this.portfolioService.setPublished(
        photo.id,
        !photo.is_published
      );

      this.photos.update(photos =>
        photos.map(item =>
          item.id === photo.id
            ? {
                ...item,
                is_published: !item.is_published
              }
            : item
        )
      );

    } catch (error) {
      console.error(error);
      this.error.set(
        'No fue posible cambiar la publicación.'
      );

    } finally {
      this.updatingIds.update(ids =>
        ids.filter(id => id !== photo.id)
      );
    }
  }


  async deletePhoto(photo: PortfolioPhoto): Promise<void> {

    if (this.updatingIds().includes(photo.id)) {
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar "${photo.original_filename}" del portafolio?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    this.updatingIds.update(ids => [...ids, photo.id]);
    this.error.set('');
    this.success.set('');

    try {
      await this.portfolioService.deletePhoto(photo);

      this.photos.update(photos =>
        photos.filter(item => item.id !== photo.id)
      );

      this.success.set(
        'La fotografía se eliminó correctamente.'
      );

    } catch (error) {
      console.error('Error eliminando fotografía:', error);

      this.error.set(
        'No fue posible eliminar la fotografía. Inténtalo nuevamente.'
      );

    } finally {
      this.updatingIds.update(ids =>
        ids.filter(id => id !== photo.id)
      );
    }
  }

  async movePhoto(
    photo: PortfolioPhoto,
    direction: -1 | 1
  ): Promise<void> {

    if (this.uploading() || this.updatingIds().length) {
      return;
    }

    const currentPhotos = this.photos();
    const currentIndex = currentPhotos.findIndex(
      item => item.id === photo.id
    );

    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= currentPhotos.length
    ) {
      return;
    }

    const reordered = [...currentPhotos];

    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    this.error.set('');

    // Guardar un orden único para toda la colección.
    // Si falla, recargamos el orden real desde Supabase.
    this.updatingIds.set(
      reordered.map(item => item.id)
    );

    try {
      for (let index = 0; index < reordered.length; index++) {
        const item = reordered[index];

        await this.portfolioService.updateOrder(
          item.id,
          index
        );
      }

      this.photos.set(
        reordered.map((item, index) => ({
          ...item,
          display_order: index
        }))
      );

    } catch (error) {
      console.error('Error ordenando fotografías:', error);

      this.error.set(
        'No fue posible guardar el nuevo orden.'
      );

      await this.loadPhotos();

    } finally {
      this.updatingIds.set([]);
    }
  }

  async toggleFeatured(photo: PortfolioPhoto): Promise<void> {

    if (this.updatingIds().includes(photo.id)) {
      return;
    }

    this.updatingIds.update(ids => [...ids, photo.id]);

    this.error.set('');
    this.success.set('');

    try {

      const newValue = !photo.is_featured;

      await this.portfolioService.setFeatured(
        photo.id,
        newValue
      );

      this.photos.update(photos =>
        photos.map(item =>
          item.id === photo.id
            ? { ...item, is_featured: newValue }
            : item
        )
      );

      this.success.set(
        newValue
          ? 'Fotografía marcada como destacada.'
          : 'Fotografía retirada de destacados.'
      );

    } catch (error) {

      console.error(
        'Error actualizando fotografía destacada:',
        error
      );

      this.error.set(
        'No fue posible actualizar la fotografía.'
      );

    } finally {

      this.updatingIds.update(ids =>
        ids.filter(id => id !== photo.id)
      );

    }
  }

}
