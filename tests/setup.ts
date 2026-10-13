import { afterEach } from 'vitest';

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});
