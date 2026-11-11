import { toast as sonnerToast } from "sonner";
import type { ExternalToast } from "sonner";

/**
 * Univer 1.4 mounts its own Sonner `<Toaster>` as a global UI part for its
 * in-editor notifications. Sonner shows a toast on *every* toaster that has no
 * `id`, so an untagged application toast would render twice — once styled by
 * us, once by Univer.
 *
 * Tagging our toasts with `toasterId: APP_TOASTER_ID` confines them to our own
 * `<Toaster id={APP_TOASTER_ID}>`, and Univer's toaster skips them because it
 * only renders toasts without a `toasterId`.
 */
export const APP_TOASTER_ID = "nearsheets";

/**
 * Stable ids for toasts that describe a long-running application state.
 *
 * A fixed id makes an update replace the existing toast instead of stacking a
 * second copy. That matters because React Strict Mode mounts effects twice in
 * development, and a document switch mounts the next editor before the previous
 * one is torn down.
 */
export const TOAST_IDS = {
  documents: "nearsheets.documents",
  engine: "nearsheets.engine",
  calculation: "nearsheets.calculation",
} as const;

type ToastData = Omit<ExternalToast, "toasterId">;

/**
 * Adds this application's toaster id to the toast data.
 *
 * Exported so the isolation rule can be tested without a DOM.
 */
export function scopeToastData(data?: ToastData): ExternalToast {
  // The id goes last so caller data cannot accidentally widen the scope.
  return { ...data, toasterId: APP_TOASTER_ID };
}

/**
 * Application toast: Sonner's API, scoped to the NearSheets toaster.
 *
 * Always use this instead of importing `toast` from `sonner` directly, or the
 * message also appears in Univer's own toaster.
 */
export const toast = Object.assign(
  (message: Parameters<typeof sonnerToast>[0], data?: ToastData) =>
    sonnerToast(message, scopeToastData(data)),
  {
    success: (message: Parameters<typeof sonnerToast.success>[0], data?: ToastData) =>
      sonnerToast.success(message, scopeToastData(data)),
    info: (message: Parameters<typeof sonnerToast.info>[0], data?: ToastData) =>
      sonnerToast.info(message, scopeToastData(data)),
    warning: (message: Parameters<typeof sonnerToast.warning>[0], data?: ToastData) =>
      sonnerToast.warning(message, scopeToastData(data)),
    error: (message: Parameters<typeof sonnerToast.error>[0], data?: ToastData) =>
      sonnerToast.error(message, scopeToastData(data)),
    loading: (message: Parameters<typeof sonnerToast.loading>[0], data?: ToastData) =>
      sonnerToast.loading(message, scopeToastData(data)),
    dismiss: sonnerToast.dismiss,
  },
);

/** Long enough to skip a flash when startup is instant, short enough to reassure. */
const LOADING_TOAST_DELAY_MS = 350;

/**
 * Announces work that usually finishes in well under a second.
 *
 * The toast is only shown if the work is still running after a short delay, so
 * a fast start shows nothing at all instead of blinking. Call the returned
 * function when the work ends; it also cancels a toast that was never shown.
 */
export function loadingToast(id: string, message: string, data?: ToastData): () => void {
  const timer = setTimeout(() => {
    toast.loading(message, { ...data, id });
  }, LOADING_TOAST_DELAY_MS);

  return () => {
    clearTimeout(timer);
    toast.dismiss(id);
  };
}
