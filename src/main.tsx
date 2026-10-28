import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent iOS / iPadOS Safari from scrolling or bouncing the entire webpage
if (typeof window !== 'undefined') {
  // Always lock scroll position to 0,0
  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  });

  // Intercept touchmove on non-scrollable containers to prevent whole-screen dragging
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      let isInsideScrollable = false;

      while (target && target !== document.body && target !== document.documentElement) {
        const style = window.getComputedStyle(target);
        const overflowY = style.overflowY;
        const canScrollY =
          (overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight;
        const overflowX = style.overflowX;
        const canScrollX =
          (overflowX === 'auto' || overflowX === 'scroll') && target.scrollWidth > target.clientWidth;

        if (canScrollY || canScrollX) {
          isInsideScrollable = true;
          break;
        }
        target = target.parentElement;
      }

      if (!isInsideScrollable && e.cancelable) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
