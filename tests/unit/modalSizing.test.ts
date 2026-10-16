import {expect, it} from 'vitest';
import {modalWidth} from '../../src/app/components/ui/modalSizing';

it('retains requested form widths instead of squeezing wide forms into medium Vibe presets', () => {
  expect(modalWidth('max-w-lg')).toBe(512);
  expect(modalWidth('max-w-2xl')).toBe(672);
  expect(modalWidth('max-w-5xl')).toBe(1024);
  expect(modalWidth('max-w-[900px]')).toBe(900);
  expect(modalWidth('max-w-[99999px]')).toBe(1600);
});
