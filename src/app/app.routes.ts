
import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin-guard';

export const routes: Routes = [

  // ======================================
  // INICIO
  // ======================================

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // ======================================
  // INICIO DE SESIÓN
  // ======================================

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login)
  },

  // ======================================
  // ADMINISTRACIÓN
  // ======================================

  {
    path: 'admin',
    canActivate: [adminGuard],

    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout')
        .then(m => m.AdminLayout),

    children: [

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard')
            .then(m => m.Dashboard)
      },

      {
        path: 'albums',
        loadComponent: () =>
          import('./features/admin/albums/albums')
            .then(m => m.Albums)
      },

      {
        path: 'albums/new',
        loadComponent: () =>
          import('./features/admin/album-form/album-form')
            .then(m => m.AlbumForm)
      },

      {
        path: 'albums/:id',
        loadComponent: () =>
          import('./features/admin/album-detail/album-detail')
            .then(m => m.AlbumDetail)
      },

      {
        path: 'clients',
        loadComponent: () =>
          import('./features/admin/clients/clients')
            .then(m => m.Clients)
      },

      {
        path: 'clients/:id',
        loadComponent: () =>
          import('./features/admin/client-detail/client-detail')
            .then(m => m.ClientDetail)
      }

    ]
  },

  // ======================================
  // VISTA PREVIA ADMINISTRATIVA
  // ======================================

  {
    path: 'admin-preview/:id',
    canActivate: [adminGuard],

    loadComponent: () =>
      import('./layouts/client-layout/client-layout')
        .then(m => m.ClientLayout),

    children: [

      {
        path: '',
        redirectTo: 'album',
        pathMatch: 'full'
      },

      {
        path: 'album',
        loadComponent: () =>
          import('./features/gallery/album/album')
            .then(m => m.Album)
      },

      {
        path: 'selection',
        loadComponent: () =>
          import('./features/gallery/selection/selection')
            .then(m => m.Selection)
      }

    ]
  },

  // ======================================
  // MIS ÁLBUMES - NUEVA PANTALLA
  // ======================================

  {
    path: 'my-albums',

    loadComponent: () =>
      import('./features/gallery/my-albums/my-albums')
        .then(m => m.MyAlbums)
  },

  // ======================================
  // GALERÍA DEL CLIENTE
  // ======================================

  {
    path: 'gallery/:slug',

    loadComponent: () =>
      import('./layouts/client-layout/client-layout')
        .then(m => m.ClientLayout),

    children: [

      {
        path: '',
        loadComponent: () =>
          import('./features/gallery/event-details/event-details')
            .then(m => m.EventDetails)
      },

      {
        path: 'album',
        loadComponent: () =>
          import('./features/gallery/album/album')
            .then(m => m.Album)
      },

      {
        path: 'selection',
        loadComponent: () =>
          import('./features/gallery/selection/selection')
            .then(m => m.Selection)
      }

    ]
  },

  // ======================================
  // RUTAS NO ENCONTRADAS
  // ======================================

  {
    path: '**',
    redirectTo: 'login'
  }

];
