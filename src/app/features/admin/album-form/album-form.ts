
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { Router } from '@angular/router';

import {
  AlbumsService,
  CreateAlbumDto,
  EventType,
  AlbumStatus
} from '../../../core/services/album';

import {
  ClientsService,
  VyntraClient
} from '../../../core/services/clients';

@Component({
  selector: 'app-album-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './album-form.html',
  styleUrl: './album-form.scss'
})
export class AlbumForm implements OnInit {

  private fb = inject(FormBuilder);
  private albumsService = inject(AlbumsService);
  private clientsService = inject(ClientsService);
  private router = inject(Router);

  submitted = signal(false);
  saving = signal(false);
  loadingClients = signal(false);
  errorMessage = signal('');
  clientsError = signal('');

  clients = signal<VyntraClient[]>([]);

  eventTypes: {
    value: EventType;
    label: string;
  }[] = [
    { value: 'wedding', label: 'Matrimonio' },
    { value: 'birthday', label: 'Cumpleaños' },
    { value: 'quinceanera', label: 'Quince años' },
    { value: 'graduation', label: 'Grado' },
    { value: 'baptism', label: 'Bautizo' },
    {
      value: 'first_communion',
      label: 'Primera comunión'
    },
    {
      value: 'corporate',
      label: 'Evento corporativo'
    },
    { value: 'other', label: 'Otro evento' }
  ];

  form = this.fb.nonNullable.group({

    clientId: [
      '',
      Validators.required
    ],

    title: [
      '',
      [
        Validators.required,
        Validators.maxLength(120)
      ]
    ],

    eventType: this.fb.nonNullable.control<EventType>(
      'wedding',
      Validators.required
    ),

    protagonists: [''],

    eventDate: [''],

    description: [''],

    includedPhotos: [
      50,
      [
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/)
      ]
    ],

    extraPhotoPrice: [
      5000,
      [
        Validators.required,
        Validators.min(0),
        Validators.pattern(/^\d+$/)
      ]
    ],

    allowExtraPhotos: [true],

    watermarkEnabled: [true],

    allowDownloads: [false],

    slug: [
      '',
      Validators.pattern(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      )
    ],

    welcomeMessage: [''],

    status: this.fb.nonNullable.control<AlbumStatus>(
      'draft',
      Validators.required
    )
  });

  async ngOnInit() {
    await this.loadClients();
  }

  async loadClients() {

    this.loadingClients.set(true);
    this.clientsError.set('');

    try {

      const data =
        await this.clientsService.getClients();

      this.clients.set(
        data.filter(client =>
          client.client_type === 'event'
        )
      );

    } catch (error) {

      console.error(
        'Error cargando clientes:',
        error
      );

      this.clientsError.set(
        'No fue posible cargar los clientes.'
      );

    } finally {

      this.loadingClients.set(false);

    }
  }

  generateSlug() {

    const title =
      this.form.controls.title.value;

    const slug = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    this.form.controls.slug.setValue(slug);
  }

  async saveAlbum() {

    if (this.saving()) return;

    this.submitted.set(true);
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    // Comprobar que el cliente esté registrado
    // y corresponda a un cliente de evento.
    const selectedClient = this.clients().find(
      client => client.id === values.clientId
    );

    if (!selectedClient) {
      this.errorMessage.set(
        'Selecciona un cliente de evento válido.'
      );
      return;
    }

    this.saving.set(true);

    try {

      const album: CreateAlbumDto = {

        client_id: values.clientId,

        title: values.title.trim(),

        event_type: values.eventType,

        event_date:
          values.eventDate || null,

        description:
          values.description.trim() || null,

        included_photos:
          Number(values.includedPhotos),

        extra_photo_price:
          Number(values.extraPhotoPrice),

        allow_extra_photos:
          values.allowExtraPhotos,

        watermark_enabled:
          values.watermarkEnabled,

        allow_downloads:
          values.allowDownloads,

        status: values.status
      };

      await this.albumsService.createAlbum(album);

      await this.router.navigateByUrl(
        '/admin/albums'
      );

    } catch (error) {

  console.error(
    'Error creando álbum:',
    error
  );

  this.errorMessage.set(
    'No fue posible crear el álbum. Verifica la configuración y los permisos de Supabase.'
  );

} finally {

      this.saving.set(false);

    }
  }

  cancel() {
    if (this.saving()) return;

    this.router.navigateByUrl('/admin/albums');
  }
}
