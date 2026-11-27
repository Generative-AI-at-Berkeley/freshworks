import { api } from '@fwcoach/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';

/** `requestId` matches the X-Request-ID header and the log line, so a reported error can be found. */
export function problem(reply: FastifyReply, status: number, detail: string) {
  return reply
    .status(status)
    .type(api.PROBLEM_CONTENT_TYPE)
    .send(api.problem(status, detail, reply.request.id));
}

/**
 * Every error and unknown route answers problem+json. Fastify's own 4xx
 * errors (bad JSON, body too large, rate limited) carry a message written for
 * the caller, so it is passed through. A 5xx message can carry SQL or a stack,
 * so it is logged with the request id and never sent.
 */
export function useProblemHandlers(app: FastifyInstance, notFoundDetail: string): void {
  app.setErrorHandler((error, request, reply) => {
    const code = (error as { statusCode?: unknown }).statusCode;
    const status = typeof code === 'number' && code >= 400 && code < 600 ? code : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
      return problem(
        reply,
        status,
        'Something went wrong on our side. Try again in a minute, and quote the request ID if it keeps failing.',
      );
    }
    return problem(reply, status, error instanceof Error ? error.message : 'Bad request.');
  });
  app.setNotFoundHandler((_request, reply) => problem(reply, 404, notFoundDetail));
}
