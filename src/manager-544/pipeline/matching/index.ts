/**
 * pipeline/matching — public surface.
 */
export { extractRegNumberCore, normalizeSubject, extractEmailAddr } from './normalize';
export { matchByThread } from './thread';
export { matchByRegistration } from './registration';
export { matchByContext, NO_MATCH } from './context';
export { matchEmailToRequest, autoHealRegistrationNumber, type MatchDeps } from './match';
