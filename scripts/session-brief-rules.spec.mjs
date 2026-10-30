import { describe, expect, it } from 'vitest';

import { NO_CLIENT, owedLayers, setupNotice } from './session-brief-rules.mjs';

const BASE = `# workspace wiring\n\n> GAP: ${NO_CLIENT}. This is the base, before \`/setup\` ran.\n`;
const WIRED = '# workspace wiring\n\n## The client\n\nAcme, https://acme.example.\n> SOURCE: Dana Ruiz, 2026-10-08\n';

describe('owedLayers', () => {
  it('owes both on a fresh clone', () => {
    expect(owedLayers({ hasProfile: false, wiringText: BASE })).toEqual({ client: true, person: true, spec: null, template: false });
  });

  it('owes no client under the template origin, https or ssh', () => {
    for (const origin of ['https://github.com/studiohakuna/product-ops-base.git', 'git@github.com:studiohakuna/product-ops-base.git']) {
      expect(owedLayers({ hasProfile: false, wiringText: BASE, origin })).toEqual({ client: false, person: true, spec: null, template: true });
    }
  });

  it('still owes the client under any other origin', () => {
    for (const origin of ['https://github.com/acme/product-ops.git', 'https://github.com/acme/product-ops-base-copy.git']) {
      expect(owedLayers({ hasProfile: true, wiringText: BASE, origin }).client).toBe(true);
    }
  });

  it('owes the client when a person has a profile but the repository has no client', () => {
    expect(owedLayers({ hasProfile: true, wiringText: BASE }).client).toBe(true);
  });

  it('reads an unreadable wiring file as no client', () => {
    expect(owedLayers({ hasProfile: true, wiringText: null }).client).toBe(true);
  });

  it('owes only the person on a second machine', () => {
    expect(owedLayers({ hasProfile: false, wiringText: WIRED, briefNames: ['2026-10-08-client-setup.md'] })).toEqual({
      client: false,
      person: true,
      spec: '2026-10-08-client-setup.md',
      template: false,
    });
  });

  it('finds the spec by its name only', () => {
    expect(owedLayers({ hasProfile: true, wiringText: WIRED, briefNames: ['TEMPLATE.md', '2026-10-08-tokens.md'] }).spec).toBeNull();
  });
});

describe('setupNotice', () => {
  it('tells the agent to start /setup itself, client first, when both are owed', () => {
    const text = setupNotice({ client: true, person: true, spec: null });
    expect(text).toMatch(/Skill\(setup\)/);
    expect(text).toMatch(/first message/);
    expect(text).toMatch(/both layers, client first/);
  });

  it('names only the layer that is owed', () => {
    expect(setupNotice({ client: false, person: true, spec: 'x' })).toMatch(/its person layer/);
    expect(setupNotice({ client: true, person: false, spec: null })).toMatch(/its client layer/);
  });

  it('flags a client recorded with no spec', () => {
    expect(setupNotice({ client: false, person: false, spec: null })).toMatch(/client-setup\.md/);
  });

  it('flags no missing spec in the template itself', () => {
    expect(setupNotice({ client: false, person: false, spec: null, template: true })).toBeNull();
  });

  it('says nothing when everything is recorded', () => {
    expect(setupNotice({ client: false, person: false, spec: '2026-10-08-client-setup.md' })).toBeNull();
  });
});
