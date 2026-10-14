import { useEffect, useState } from 'preact/hooks';

/**
 * Hash routing (#/entry/abc). Works on GitHub Pages without server rewrites, and the phone's
 * back button/gesture walks back through screens naturally.
 */

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [p, q] = raw.split('?');
  return { path: p ? p.split('/').map(decodeURIComponent) : [], query: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string, opts: { replace?: boolean } = {}): void {
  const hash = `#/${path.replace(/^\//, '')}`;
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

/** Back if there is in-app history, otherwise go to a sensible parent. */
export function back(fallback = ''): void {
  if (history.state?.inkly || history.length > 1) {
    const before = location.hash;
    history.back();
    // If history.back() left the app (or did nothing), land on the fallback instead.
    setTimeout(() => {
      if (location.hash === before) go(fallback, { replace: true });
    }, 250);
  } else {
    go(fallback, { replace: true });
  }
}
