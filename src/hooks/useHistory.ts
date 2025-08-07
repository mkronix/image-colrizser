
import { useState, useCallback } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialState: T, maxHistorySize: number = 12) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory(prev => {
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory(prev => {
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      };
    });
  }, [canRedo]);

  const pushToHistory = useCallback((newState: T) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present].slice(-maxHistorySize),
      present: newState,
      future: []
    }));
  }, [maxHistorySize]);

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: []
    });
  }, []);

  return {
    state: history.present,
    canUndo,
    canRedo,
    undo,
    redo,
    pushToHistory,
    reset
  };
}
