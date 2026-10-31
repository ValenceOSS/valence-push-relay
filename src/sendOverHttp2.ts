import { connect } from 'node:http2';
import type { ClientHttp2Session, OutgoingHttpHeaders } from 'node:http2';

const sessions = new Map<string, ClientHttp2Session>();

/**
 * Sends one request over HTTP/2, which Apple's push service requires, keeping one connection open
 * to each origin and opening another when that one closes.
 *
 * @param origin - Where to send it.
 * @param headers - The request's headers, its path among them.
 * @param body - What to send.
 * @param timeoutMs - How long to wait for an answer.
 * @returns The status and the body that came back.
 */
const sendOverHttp2 = (
  origin: string,
  headers: OutgoingHttpHeaders,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; body: string }> => {
  let session = sessions.get(origin);

  if (session === undefined || session.closed || session.destroyed) {
    const opened = connect(origin);

    opened.on('error', () => {
      sessions.delete(origin);
    });
    opened.on('close', () => {
      sessions.delete(origin);
    });
    opened.unref();
    sessions.set(origin, opened);
    session = opened;
  }

  const open = session;

  return new Promise((resolve, reject) => {
    const request = open.request({ ':method': 'POST', ...headers });
    const chunks: Buffer[] = [];
    let status = 0;

    request.setTimeout(timeoutMs, () => {
      request.close();
      reject(new Error('timed out'));
    });
    request.on('response', (answered) => {
      status = answered[':status'] ?? 0;
    });
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      resolve({ status, body: Buffer.concat(chunks).toString('utf8') });
    });
    request.on('error', reject);
    request.end(body);
  });
};

export { sendOverHttp2 };
