import { expect, test } from 'vitest';
import { NAME } from '../../src/lib/site';

test('le nom du site est Victor Schmutz', () => {
  expect(NAME).toBe('Victor Schmutz');
});
