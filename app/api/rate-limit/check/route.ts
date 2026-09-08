import { createRateLimitCheckHandler, defaultSessionsDeps } from '@m544/requests/sessions/handlers';

export const GET = createRateLimitCheckHandler(defaultSessionsDeps);
