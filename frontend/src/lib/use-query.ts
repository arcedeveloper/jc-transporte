'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onDataChanged } from './socket';

interface Options {
  /**
   * Mantener los datos al día sin recargar la página: se vuelve a pedir (sin mostrar "cargando")
   * cuando el servidor avisa que hubo un cambio, y al volver a la pestaña.
   * No consulta la base cada tantos segundos: si no pasa nada, no se pide nada.
   */
  live?: boolean | number;
}

/** Carga datos al montar y cuando cambian las dependencias. reload(true) recarga sin mostrar "cargando". */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: Options = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      // En una recarga silenciosa no tapamos los datos que ya se ven por un corte momentáneo
      if (!silent) setError(e instanceof Error ? e : new Error('Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const live = !!opts.live;
  useEffect(() => {
    if (!live) return;
    const refresh = () => void reload(true);
    // Al volver a la pestaña, solo si estuvo un rato afuera (no en cada clic)
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5000) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const off = onDataChanged(refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      off();
    };
  }, [live, reload]);

  return { data, error, loading, reload, setData };
}
