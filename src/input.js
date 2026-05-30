/**
 * Keyboard + pointer lock helper for first-person style capture.
 */
export function createInput() {
  const keys = new Set();

  window.addEventListener(
    'keydown',
    (e) => {
      keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  return {
    keys,
    isDown(code) {
      return keys.has(code);
    },
  };
}
