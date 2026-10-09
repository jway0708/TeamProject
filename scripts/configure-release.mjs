import { writeFile } from 'node:fs/promises';

function publicUrl(name, required = false) {
  const value = process.env[name]?.trim() || '';
  if (!value) {
    if (required) throw new Error(`Set ${name} to your deployed backend HTTPS URL, including /api.`);
    return '';
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS URL without credentials, query or fragment.`);
  }
  return value.replace(/\/+$/, '');
}
try {
  const config = { backendBaseUrl: publicUrl('MEMBER_BACKEND_URL', true), imageBaseUrl: publicUrl('MEMBER_IMAGE_BASE_URL') };
  await writeFile(new URL('../src/environments/deployment.ts', import.meta.url),
    '// Public deployment URLs. Never store API credentials here.\nexport const deployment = ' + JSON.stringify(config, null, 2) + ';\n');
  console.log('Public deployment URLs configured.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
