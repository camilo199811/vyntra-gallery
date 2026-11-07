
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface VyntraPhoto {
  id: string;
  album_id: string;
  original_path: string;
  preview_path: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  processing_status: string;
  is_cover: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService {

  private supabase = inject(SupabaseService);

  private readonly originalsBucket = 'vyntra-originals';
  private readonly previewsBucket = 'vyntra-previews';

  // ==========================================
  // OBTENER FOTOGRAFÍAS DE UN ÁLBUM
  // ==========================================

  async getPhotos(
    albumId: string
  ): Promise<VyntraPhoto[]> {

    const { data, error } = await this.supabase.client
      .from('photos')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []) as VyntraPhoto[];
  }

  // ==========================================
  // SUBIR FOTOGRAFÍA ORIGINAL
  // ==========================================

  async uploadOriginal(
    albumId: string,
    file: File
  ): Promise<string> {

    const extension = file.name
      .split('.')
      .pop()
      ?.toLowerCase() ?? 'jpg';

    const filePath =
      `${albumId}/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.client.storage
      .from(this.originalsBucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;

    return filePath;
  }

  // ==========================================
  // SUBIR VISTA PREVIA CON MARCA DE AGUA
  // ==========================================

  async uploadPreview(
    albumId: string,
    preview: Blob
  ): Promise<string> {

    const filePath =
      `${albumId}/${crypto.randomUUID()}.webp`;

    const { error } = await this.supabase.client.storage
      .from(this.previewsBucket)
      .upload(filePath, preview, {
        contentType: 'image/webp',
        upsert: false
      });

    if (error) throw error;

    return filePath;
  }

  // ==========================================
  // REGISTRAR FOTOGRAFÍA EN SUPABASE
  // ==========================================

  async createPhoto(
    photo: {
      album_id: string;
      original_path: string;
      preview_path: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      width: number;
      height: number;
    }
  ): Promise<VyntraPhoto> {

    const { data, error } = await this.supabase.client
      .from('photos')
      .insert({
        ...photo,
        processing_status: 'ready',
        is_cover: false
      })
      .select('*')
      .single();

    if (error) throw error;

    return data as VyntraPhoto;
  }

  // ==========================================
  // GENERAR URL TEMPORAL DE VISTA PREVIA
  // ==========================================

  async getPreviewUrl(
    path: string
  ): Promise<string> {

    const { data, error } = await this.supabase.client.storage
      .from(this.previewsBucket)
      .createSignedUrl(path, 3600);

    if (error) throw error;

    return data.signedUrl;
  }

  // ==========================================
  // GENERAR URL TEMPORAL DEL ORIGINAL
  // ==========================================

  async getOriginalUrl(
    path: string
  ): Promise<string> {

    const { data, error } = await this.supabase.client.storage
      .from(this.originalsBucket)
      .createSignedUrl(path, 300);

    if (error) throw error;

    return data.signedUrl;
  }

  // ==========================================
  // ELIMINAR ARCHIVOS DE UNA FOTOGRAFÍA
  // ==========================================

  async deletePhotoFiles(
    photo: Pick<VyntraPhoto, 'original_path' | 'preview_path'>
  ): Promise<void> {

    // Eliminar original si existe una ruta.
    if (photo.original_path) {

      const { error: originalError } =
        await this.supabase.client.storage
          .from(this.originalsBucket)
          .remove([photo.original_path]);

      if (originalError) {
        throw originalError;
      }
    }

    // Eliminar vista previa si existe.
    if (photo.preview_path) {

      const { error: previewError } =
        await this.supabase.client.storage
          .from(this.previewsBucket)
          .remove([photo.preview_path]);

      if (previewError) {
        throw previewError;
      }
    }
  }
  
  // ==========================================
  // ELIMINAR UNA FOTOGRAFÍA DEL ÁLBUM
  // ==========================================

  async deletePhoto(
    albumId: string,
    photoId: string
  ): Promise<void> {

    // 1. Verificar que la fotografía pertenezca
    // al álbum indicado.
    const { data, error: lookupError } =
      await this.supabase.client
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .eq('album_id', albumId)
        .single();

    if (lookupError) throw lookupError;

    const photo = data as VyntraPhoto;

    // 2. Evitar eliminar fotografías que el
    // cliente ya haya seleccionado.
    const { data: selection, error: selectionError } =
      await this.supabase.client
        .from('photo_selections')
        .select('id')
        .eq('album_id', albumId)
        .eq('photo_id', photoId)
        .eq('selected', true)
        .maybeSingle();

    if (selectionError) throw selectionError;

    if (selection) {
      throw new Error(
        'Esta fotografía está seleccionada por el cliente. No se puede eliminar.'
      );
    }

    // 3. Eliminar el registro de la fotografía.
    const { data: deleted, error: deleteError } =
      await this.supabase.client
        .from('photos')
        .delete()
        .eq('id', photoId)
        .eq('album_id', albumId)
        .select('id');

    if (deleteError) throw deleteError;

    if (!deleted?.length) {
      throw new Error(
        'No se pudo eliminar el registro. Verifica los permisos.'
      );
    }

    // 4. Eliminar los archivos almacenados.
    // Si falla, avisamos para permitir limpieza posterior.
    try {
      await this.deletePhotoFiles(photo);
    } catch (error) {
      console.error(
        'El registro se eliminó, pero quedaron archivos pendientes de limpieza:',
        error
      );

      throw new Error(
        'Se eliminó el registro, pero no todos los archivos de Storage. Requiere limpieza administrativa.'
      );
    }
  }

  // ==========================================
// ELIMINAR FOTOGRAFÍA
// ==========================================


  // ==========================================
  // ELIMINAR FOTOGRAFÍAS NO SELECCIONADAS
  // ==========================================

  async deleteUnselectedPhotos(
    albumId: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ deleted: number; failed: number }> {

    // Verificar que la selección esté confirmada.
    const { data: control, error: controlError } =
      await this.supabase.client
        .from('album_selection_control')
        .select('selection_status')
        .eq('album_id', albumId)
        .single();

    if (controlError) throw controlError;

    if (control.selection_status !== 'closed') {
      throw new Error(
        'El cliente debe confirmar su selección antes de realizar la limpieza.'
      );
    }

    const photos = await this.getPhotos(albumId);

    const { data: selections, error: selectionError } =
      await this.supabase.client
        .from('photo_selections')
        .select('photo_id')
        .eq('album_id', albumId)
        .eq('selected', true);

    if (selectionError) throw selectionError;

    const selectedIds = new Set(
      (selections ?? []).map(item => item.photo_id)
    );

    const unselected = photos.filter(
      photo => !selectedIds.has(photo.id)
    );

    let deleted = 0;
    let failed = 0;

    for (const photo of unselected) {

      // Comprobar que el álbum no haya sido reabierto.
      const { data: currentControl, error: currentError } =
        await this.supabase.client
          .from('album_selection_control')
          .select('selection_status')
          .eq('album_id', albumId)
          .single();

      if (currentError) throw currentError;

      if (currentControl.selection_status !== 'closed') {
        throw new Error(
          'La selección fue reabierta. Se detuvo la limpieza.'
        );
      }

      try {
        // Reutilizamos la protección de fotografías
        // seleccionadas que ya existe.
        await this.deletePhoto(albumId, photo.id);
        deleted++;
      } catch (error) {
        console.error(
          'No se pudo eliminar la fotografía:',
          photo.id,
          error
        );
        failed++;
      }

      onProgress?.(deleted + failed, unselected.length);
    }

    return { deleted, failed };
  }

}
