import { useRef, useState, useEffect, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
  onIntersect?: (isIntersecting: boolean) => void;
}

interface UseIntersectionObserverReturn {
  ref: React.RefObject<HTMLElement>;
  isVisible: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * Hook for detecting when an element enters the viewport
 */
export function useIntersectionObserver({
  threshold = 0.1,
  rootMargin = '0px',
  triggerOnce = true,
  onIntersect,
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverReturn {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasTriggeredRef = useRef(false);

  const setRef = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (triggerOnce && hasTriggeredRef.current && isVisible) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        const intersecting = entry.isIntersecting;
        setIsVisible(intersecting);
        
        if (onIntersect) {
          onIntersect(intersecting);
        }

        if (triggerOnce && intersecting) {
          hasTriggeredRef.current = true;
          observerRef.current?.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, onIntersect, isVisible]);

  return { ref: { current: ref.current, setRef } as any, isVisible, entry };
}

/**
 * Hook for creating multiple observed elements with shared observer
 */
export function useMultiIntersectionObserver(
  count: number,
  options: UseIntersectionObserverOptions = {}
) {
  const refs = useRef<(HTMLElement | null)[]>(Array(count).fill(null));
  const [visibilities, setVisibilities] = useState<boolean[]>(Array(count).fill(false));
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = refs.current.indexOf(entry.target as HTMLElement);
          if (index !== -1) {
            setVisibilities((prev) => {
              const next = [...prev];
              next[index] = entry.isIntersecting;
              return next;
            });
          }
        });
      },
      { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? '0px' }
    );

    refs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [count, options.threshold, options.rootMargin]);

  const setRef = (index: number) => (el: HTMLElement | null) => {
    refs.current[index] = el;
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  return { refs: refs.current, visibilities, setRef };
}