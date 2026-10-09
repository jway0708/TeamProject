import { field } from './api-response';
import { environment } from '../../environments/environment';

export function apiImage(item: unknown): string {
  const bytes = field(item, 'ImageByte');
  if (typeof bytes === 'string' && bytes.trim()) {
    const value = bytes.trim();
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value)) return value;
    if (/^[A-Za-z0-9+/=\s]+$/.test(value)) return 'data:image/jpeg;base64,' + value;
  }
  const filename = field(item, 'Image');
  if (typeof filename !== 'string' || !filename.trim()) return '';
  const value = filename.trim();
  if (/^https:\/\//i.test(value)) return value;
  if (!environment.imageBaseUrl || /[/\\:]|\.\./.test(value)) return '';
  return environment.imageBaseUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(value);
}
