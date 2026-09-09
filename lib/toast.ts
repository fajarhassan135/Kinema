export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  text: string;
  tone: ToastTone;
};

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/**
 * Dead-simple pub/sub so any page can raise a toast without threading a
 * provider through every component. <Toaster /> in the root layout is the only
 * subscriber.
 */
export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  // Braces matter: Set.delete returns a boolean, and an effect cleanup must
  // return void.
  return () => {
    listeners.delete(listener);
  };
}

function emit(text: string, tone: ToastTone) {
  const message: ToastMessage = { id: nextId++, text, tone };
  listeners.forEach((l) => l(message));
}

export const toast = {
  success: (text: string) => emit(text, "success"),
  error: (text: string) => emit(text, "error"),
  info: (text: string) => emit(text, "info"),
};
