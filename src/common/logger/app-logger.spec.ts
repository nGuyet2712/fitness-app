import { buildLoggerOptions } from './app-logger';
import type { Logform } from 'winston';
import type TransportStream from 'winston-transport';

const MESSAGE = Symbol.for('message');

function renderLine(nodeEnv: string): string {
  const options = buildLoggerOptions({ nodeEnv, logLevel: 'info' });
  const [transport] = options.transports as TransportStream[];
  const info = { level: 'info', message: 'hello', env: nodeEnv };
  const output = transport.format?.transform(info) as Logform.TransformableInfo;
  return output[MESSAGE] as string;
}

describe('buildLoggerOptions', () => {
  it('should use the configured level when LOG_LEVEL is set', async () => {
    const options = buildLoggerOptions({ nodeEnv: 'local', logLevel: 'warn' });

    expect(options.level).toBe('warn');
  });

  it('should tag every line with the environment when any env is given', async () => {
    const options = buildLoggerOptions({ nodeEnv: 'dev', logLevel: 'info' });

    expect(options.defaultMeta).toEqual({ env: 'dev' });
  });

  it('should log JSON when NODE_ENV is production', async () => {
    const parsed = JSON.parse(renderLine('production')) as Record<
      string,
      unknown
    >;

    expect(parsed).toMatchObject({
      level: 'info',
      message: 'hello',
      env: 'production',
    });
    expect(parsed.timestamp).toEqual(expect.any(String));
  });

  it('should log human-readable text when NODE_ENV is not production', async () => {
    expect(() => JSON.parse(renderLine('local'))).toThrow();
  });
});
