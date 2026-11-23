
import {
  Component,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { PortfolioService, PortfolioPhoto }
  from '../../core/services/portfolio';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss'
})
export class Portfolio implements OnInit {

  private readonly portfolioService = inject(PortfolioService);

  readonly photos = signal<PortfolioPhoto[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedIndex = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.photos.set(
        await this.portfolioService.getPublishedPhotos()
      );
    } catch {
      this.error.set('No fue posible cargar el portafolio.');
    } finally {
      this.loading.set(false);
    }
  }

  galleryUrl(photo: PortfolioPhoto): string {
    return this.portfolioService.getGalleryUrl(photo.gallery_path);
  }

  fullUrl(photo: PortfolioPhoto): string {
    return this.portfolioService.getFullUrl(photo.full_path);
  }

  openPhoto(index: number): void {
    this.selectedIndex.set(index);
  }

  closePhoto(): void {
    this.selectedIndex.set(null);
  }

  nextPhoto(): void {
    const index = this.selectedIndex();

    if (index === null || !this.photos().length) return;

    this.selectedIndex.set(
      (index + 1) % this.photos().length
    );
  }

  previousPhoto(): void {
    const index = this.selectedIndex();

    if (index === null || !this.photos().length) return;

    this.selectedIndex.set(
      (index - 1 + this.photos().length) % this.photos().length
    );
  }


 

}
