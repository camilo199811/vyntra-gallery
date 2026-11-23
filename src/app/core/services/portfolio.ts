
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface PortfolioPhoto {
  id: string;
  original_filename: string;
  gallery_path: string;
  full_path: string;
  width: number;
  height: number;
  gallery_size_bytes: number | null;
  full_size_bytes: number | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  is_featured: boolean;
}

export interface CreatePortfolioPhotoDto {
  original_filename: string;
  gallery_path: string;
  full_path: string;
  width: number;
  height: number;
  gallery_size_bytes: number;
  full_size_bytes: number;
  display_order?: number;
  is_published?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {

  private readonly supabase = inject(SupabaseService);

  private readonly bucket = 'vyntra-portfolio';

  // Fotografías visibles para cualquier visitante.
  async getPublishedPhotos(): Promise<PortfolioPhoto[]> {
    const { data, error } = await this.supabase.client
      .from('portfolio_photos')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PortfolioPhoto[];
  }

  // Todas las fotografías para el administrador.
  async getAllPhotos(): Promise<PortfolioPhoto[]> {
    const { data, error } = await this.supabase.client
      .from('portfolio_photos')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PortfolioPhoto[];
  }

  // URL de la fotografía para la cuadrícula.
  getGalleryUrl(path: string): string {
    return this.supabase.client.storage
      .from(this.bucket)
      .getPublicUrl(path)
      .data.publicUrl;
  }

  // URL de la fotografía ampliada.
  getFullUrl(path: string): string {
    return this.supabase.client.storage
      .from(this.bucket)
      .getPublicUrl(path)
      .data.publicUrl;
  }

  // Subir una versión optimizada.
  async uploadImage(
    path: string,
    file: Blob
  ): Promise<void> {

    const { error } = await this.supabase.client.storage
      .from(this.bucket)
      .upload(path, file, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
  }

  // Registrar una fotografía en la base de datos.
  async createPhoto(
    photo: CreatePortfolioPhotoDto
  ): Promise<PortfolioPhoto> {

    const { data, error } = await this.supabase.client
      .from('portfolio_photos')
      .insert(photo)
      .select()
      .single();

    if (error) throw error;

    return data as PortfolioPhoto;
  }

  // Publicar u ocultar una fotografía.
  async setPublished(
    id: string,
    published: boolean
  ): Promise<void> {

    const { error } = await this.supabase.client
      .from('portfolio_photos')
      .update({ is_published: published })
      .eq('id', id);

    if (error) throw error;
  }

  // Cambiar el orden de una fotografía.
  async updateOrder(
    id: string,
    order: number
  ): Promise<void> {

    const { error } = await this.supabase.client
      .from('portfolio_photos')
      .update({ display_order: order })
      .eq('id', id);

    if (error) throw error;
  }

  // Eliminar los archivos y su registro.
  
  // Eliminar fotografía mediante la función segura
  // de Supabase Edge Functions.
  async deletePhoto(photo: PortfolioPhoto): Promise<void> {

    const { data, error } =
      await this.supabase.client.functions.invoke(
        'delete-portfolio-photo',
        {
          body: {
            photoId: photo.id
          }
        }
      );

    if (error) {
      throw error;
    }

    if (!data?.success) {
      throw new Error(
        data?.error ??
        'No fue posible eliminar la fotografía.'
      );
    }
  }


   // Eliminar archivos del bucket.
  // Se utiliza para limpiar subidas incompletas.
  async removeFiles(paths: string[]): Promise<void> {
    if (!paths.length) return;

    const { error } = await this.supabase.client.storage
      .from(this.bucket)
      .remove(paths);

    if (error) throw error;
  }


  // Marcar o desmarcar una fotografía como destacada
  async setFeatured(
    id: string,
    featured: boolean
  ): Promise<void> {

    const { error } = await this.supabase.client
      .from('portfolio_photos')
      .update({
        is_featured: featured
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

}
