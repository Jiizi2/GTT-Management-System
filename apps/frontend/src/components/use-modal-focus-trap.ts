import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return element.offsetParent !== null || document.activeElement === element;
  });
}

export function useModalFocusTrap<T extends HTMLElement>({
  isActive = true,
  onClose,
}: {
  isActive?: boolean;
  onClose?: () => void;
}) {
  const dialogRef = useRef<T | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || typeof document === "undefined") {
      return undefined;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return undefined;
    }

    const focusInitialElement = () => {
      const focusableElements = getFocusableElements(dialogElement);
      const initialElement = focusableElements[0] ?? dialogElement;
      initialElement.focus();
    };

    const frameId = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialogElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !dialogElement.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialogElement.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      dialogElement.removeEventListener("keydown", handleKeyDown);

      const elementToRestore = restoreFocusRef.current;
      if (elementToRestore && document.contains(elementToRestore)) {
        elementToRestore.focus();
      }
    };
  }, [isActive, onClose]);

  return dialogRef;
}
