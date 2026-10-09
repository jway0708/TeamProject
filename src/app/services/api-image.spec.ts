import { apiImage } from './api-image';
import { environment } from '../../environments/environment';

describe('API image display', () => {
  it('supports actual image bytes and absolute HTTPS image URLs', () => {
    expect(apiImage({ ImageByte: 'aW1hZ2U=' })).toBe('data:image/jpeg;base64,aW1hZ2U=');
    expect(apiImage({ Image: 'https://example.test/picture.jpg' })).toBe('https://example.test/picture.jpg');
    expect(apiImage({ Image: 'javascript:alert(1)' })).toBe('');
  });
  it('uses a configured image directory for filenames and rejects traversal', () => {
    const previous = environment.imageBaseUrl;
    try {
      environment.imageBaseUrl = 'https://example.test/images';
      expect(apiImage({ Image: 'picture one.jpg' })).toBe('https://example.test/images/picture%20one.jpg');
      expect(apiImage({ Image: '../secret' })).toBe('');
      environment.imageBaseUrl = '';
      expect(apiImage({ Image: 'picture.jpg' })).toBe('');
    } finally { environment.imageBaseUrl = previous; }
  });
});
