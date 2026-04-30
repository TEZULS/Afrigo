import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const headers = appParams.apiKey ? { api_key: appParams.apiKey } : undefined;

// Client Base44 : clé API (headers) + jeton utilisateur (URL / storage) si présent
export const base44 = createClient({
	appId: appParams.appId,
	...(headers ? { headers } : {}),
	...(appParams.token ? { token: appParams.token } : {}),
	...(appParams.functionsVersion ? { functionsVersion: appParams.functionsVersion } : {}),
	requiresAuth: false,
});
