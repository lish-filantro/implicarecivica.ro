import { createSessionsCreateHandler, defaultSessionsDeps } from '@m544/requests/sessions/handlers';

export const POST = createSessionsCreateHandler(defaultSessionsDeps);
