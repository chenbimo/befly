import { fieldClear } from '../src/fieldClear';
import type { FieldClearOptions } from '../types/fieldClear';

const obj = { a: 1, b: 2, c: 3 };
const options: FieldClearOptions = { pick: ['a', 'c'] };
console.log('Bun/Vite 直接 TS:', fieldClear(obj, options));
