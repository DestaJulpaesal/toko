import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PUBLIC_PAGE_SELECTOR = '.glosir-public-page, .public-page';
const REVEAL_SELECTOR = 'main > *, main section, main article';

export default function PublicScrollReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;

    const pages = document.querySelectorAll(PUBLIC_PAGE_SELECTOR);
    const observedElements = new WeakSet();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('public-scroll-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });

    const observeElements = (container) => {
      const elements = container.matches?.(REVEAL_SELECTOR)
        ? [container, ...container.querySelectorAll(REVEAL_SELECTOR)]
        : container.querySelectorAll(REVEAL_SELECTOR);

      elements.forEach((element, index) => {
        if (observedElements.has(element)) return;
        observedElements.add(element);
        element.classList.add('public-scroll-reveal');
        element.style.setProperty('--public-scroll-reveal-delay', `${Math.min(index * 55, 220)}ms`);
        observer.observe(element);
      });
    };

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) observeElements(node);
        });
      });
    });

    pages.forEach((page) => {
      observeElements(page);
      mutationObserver.observe(page, { childList: true, subtree: true });
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
