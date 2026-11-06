import { describe, expect, it } from 'vitest';
import { addMissingVariables, parseEnvFile, renderEnvFile } from './env-file.mjs';

describe('parseEnvFile', () => {
  it('reads assignments and ignores everything else', () => {
    expect(parseEnvFile('# a comment\nWEB_PORT=20620\n\nAPI_PORT=20621\n')).toEqual({
      WEB_PORT: '20620',
      API_PORT: '20621',
    });
  });

  it('keeps a URL whole, colons, slashes and all', () => {
    expect(parseEnvFile('DATABASE_URL=postgres://harness:harness@localhost:20622/harness')).toEqual(
      {
        DATABASE_URL: 'postgres://harness:harness@localhost:20622/harness',
      },
    );
  });
});

describe('renderEnvFile', () => {
  const example = ['# why this file exists', 'WEB_PORT=3000', '', '# the api', 'API_PORT=3001', ''];

  it('substitutes managed values and leaves the rest of the file alone', () => {
    const rendered = renderEnvFile(example.join('\n'), { WEB_PORT: '20620', API_PORT: '20621' });

    expect(rendered.split('\n')).toEqual([
      '# why this file exists',
      'WEB_PORT=20620',
      '',
      '# the api',
      'API_PORT=20621',
      '',
    ]);
  });

  it('leaves a variable it was given no value for as the example has it', () => {
    expect(renderEnvFile(example.join('\n'), { WEB_PORT: '20620' })).toContain('API_PORT=3001');
  });

  it('appends a managed variable the example does not carry, rather than dropping it', () => {
    const rendered = renderEnvFile(example.join('\n'), { REDIS_PORT: '20623' });

    expect(parseEnvFile(rendered).REDIS_PORT).toBe('20623');
    expect(rendered).toContain('also add them to .env.example');
  });
});

describe('addMissingVariables', () => {
  const example = ['# the api', 'API_PORT=3001', '# the price', 'PRICE_ID=pri_dev', ''].join('\n');

  it('appends a variable the example carries and the .env does not, with its example value', () => {
    const { contents, added } = addMissingVariables('API_PORT=20621\nOLD_ID=pri_old\n', example);

    expect(added).toEqual(['PRICE_ID']);
    expect(parseEnvFile(contents)).toEqual({
      API_PORT: '20621',
      OLD_ID: 'pri_old',
      PRICE_ID: 'pri_dev',
    });
  });

  it('leaves a .env that already carries every variable exactly as it is', () => {
    const existing = 'API_PORT=20621\nPRICE_ID=pri_mine\n';

    expect(addMissingVariables(existing, example)).toEqual({ contents: existing, added: [] });
  });
});
