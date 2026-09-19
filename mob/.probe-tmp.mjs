import { createClient } from '@base44/sdk';
const base44 = createClient({
  appId: '6947869a3a13c81a6fad2204',
  serverUrl: 'https://afri-go-6fad2204.base44.app',
  headers: { api_key: 'c80f2fb2220d479fa6e24d1deb4bb843' },
  requiresAuth: false,
});
try {
  const r = await base44.functions.invoke('handleCustomAuth', { action: 'admin_login', email: 'nobody@example.com', password: 'x' });
  console.log('keys:', Object.keys(r));
  console.log('status:', r.status, 'data:', JSON.stringify(r.data).slice(0, 200));
} catch (e) {
  console.log('threw:', e.message, e.status, JSON.stringify(e.data || e.response?.data).slice(0, 200));
}
