import { Toaster as Sonner } from "sonner";
import { APP_TOASTER_ID } from "./toast";

/**
 * shadcn/ui toast surface.
 *
 * Sonner owns stacking, swipe-to-dismiss, pause-on-hover and the live-region
 * announcement. `global.css` overrides its visual layer with the shared
 * application tokens so toasts match the rest of the chrome.
 *
 * `id` isolates this toaster from the one Univer 1.4 mounts for its own
 * notifications. Only toasts tagged with `toasterId: APP_TOASTER_ID` appear
 * here, and Univer's toaster ignores them. See `./toast`.
 */
export function Toaster() {
  return (
    <Sonner
      id={APP_TOASTER_ID}
      className="app-toaster"
      theme="light"
      position="bottom-right"
      offset={{ bottom: 52, right: 16 }}
      mobileOffset={{ bottom: 52, left: 12, right: 12 }}
      gap={8}
      visibleToasts={3}
      toastOptions={{
        classNames: { toast: "app-toast" },
      }}
    />
  );
}
