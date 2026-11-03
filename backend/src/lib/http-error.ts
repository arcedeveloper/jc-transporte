/** Error con código HTTP que el middleware de errores convierte en respuesta JSON. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'No autorizado') => new HttpError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Acceso denegado') => new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);
