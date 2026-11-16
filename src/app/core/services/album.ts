
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export type AlbumStatus =
  | 'draft'
  | 'published'
  | 'archived';

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'quinceanera'
  | 'graduation'
  | 'baptism'
  | 'first_communion'
  | 'corporate'
  | 'other';

export interface VyntraAlbum {
  id: string;
  client_id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
  description: string | null;
  cover_path: string | null;
  included_photos: number;
  extra_photo_price: number;
  allow_extra_photos: boolean;
  watermark_enabled: boolean;
  allow_downloads: boolean;
  status: AlbumStatus;
  created_at: string;
  updated_at: string;
  custom_event_name: string | null;
}

export interface CreateAlbumDto {
  client_id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
  description: string | null;
  included_photos: number;
  extra_photo_price: number;
  allow_extra_photos: boolean;
  watermark_enabled: boolean;
  allow_downloads: boolean;
  status: AlbumStatus;
  custom_event_name: string | null;
}

export type UpdateAlbumDto =
  Partial<CreateAlbumDto>;

@Injectable({
  providedIn: 'root'
})
export class AlbumsService {

  private supabase = inject(SupabaseService);

  async getAlbums(): Promise<VyntraAlbum[]> {

    const { data, error } =
      await this.supabase.client
        .from('albums')
        .select('*')
        .order('created_at', {
          ascending: false
        });

    if (error) throw error;

    return (data ?? []) as VyntraAlbum[];
  }

  async getAlbumById(
    id: string
  ): Promise<VyntraAlbum | null> {

    const { data, error } =
      await this.supabase.client
        .from('albums')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;

    return data as VyntraAlbum | null;
  }

  // Compatibilidad con la ruta /gallery/:slug/album.
  // Actualmente :slug representa el UUID del álbum.
  // No consulta una columna llamada "slug".

  async getAlbumBySlug(
    slug: string
  ): Promise<VyntraAlbum | null> {

    return this.getAlbumById(slug);
  }

  async getAlbumsByClient(
    clientId: string
  ): Promise<VyntraAlbum[]> {

    const { data, error } =
      await this.supabase.client
        .from('albums')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', {
          ascending: false
        });

    if (error) throw error;

    return (data ?? []) as VyntraAlbum[];
  }

  async createAlbum(
    album: CreateAlbumDto
  ): Promise<VyntraAlbum> {

    const { data, error } =
      await this.supabase.client
        .from('albums')
        .insert(album)
        .select()
        .single();

    if (error) throw error;

    return data as VyntraAlbum;
  }

  async updateAlbum(
    id: string,
    changes: UpdateAlbumDto
  ): Promise<VyntraAlbum> {

    const { data, error } =
      await this.supabase.client
        .from('albums')
        .update({
          ...changes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    return data as VyntraAlbum;
  }

  
async deleteAlbum(
  id: string
): Promise<void> {

  const { data: sessionData, error: sessionError } =
    await this.supabase.client.auth.getSession();

  if (sessionError) throw sessionError;

  if (!sessionData.session) {
    throw new Error(
      'Tu sesión ha vencido. Inicia sesión nuevamente.'
    );
  }

  const { data, error } =
    await this.supabase.client.functions.invoke<{
      success?: boolean;
      message?: string;
      error?: string;
      warning?: string;
    }>('delete-album', {
      body: {
        album_id: id
      }
    });

  if (error) {
    const context = error as {
      context?: Response;
    };

    let message = error.message;

    if (context.context) {
      try {
        const details = await context.context.json();

        message = details.error || message;
      } catch {
        // Mantener el mensaje original.
      }
    }

    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
      'No se pudo confirmar la eliminación del álbum.'
    );
  }
}

}
