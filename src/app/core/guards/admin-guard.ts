import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const role = await auth.getCurrentRole();

    if (role === 'super_admin' || role === 'admin') {
      return true;
    }
  } catch (error) {
    console.error('Error verificando permisos:', error);
  }

  return router.createUrlTree(['/login']);
};