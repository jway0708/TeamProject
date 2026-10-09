import { deployment } from './deployment';

export const environment = {
  nativeApiBaseUrl: deployment.backendBaseUrl,
  imageBaseUrl: deployment.imageBaseUrl,
  production: true,
  pushEnabled: false,
  apiBaseUrl: deployment.backendBaseUrl || '/api',
};
