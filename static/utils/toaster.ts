import { createElement } from "./element-helpers";

export function toastNotification(
  message: string,
  options: {
    type?: "success" | "error" | "info" | "warning";
    actionText?: string;
    action?: () => void;
    shouldAutoDismiss?: boolean;
    duration?: number;
  } = {}
): () => void {
  const { type = "info", actionText, action, shouldAutoDismiss = false, duration = 5000 } = options;

  const toastElement = createElement("div", {
    class: `toast toast-${type}`,
  });

  const messageElement = createElement("span", {
    class: "toast-message",
    textContent: message,
  });

  const closeButton = createElement("button", {
    class: "toast-close",
    textContent: "X",
  });

  closeButton.addEventListener("click", () => {
    kill();
  });

  toastElement.appendChild(messageElement);

  if (action && actionText) {
    const actionButton = createElement("button", {
      class: "toast-action",
      textContent: actionText,
    });
    actionButton.addEventListener("click", action);
    toastElement.appendChild(actionButton);
  }

  toastElement.appendChild(closeButton);

  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = createElement("div", {
      class: "toast-container",
    });
    document.body.appendChild(toastContainer);
  }

  toastContainer.appendChild(toastElement);

  requestAnimationFrame(() => {
    toastElement.classList.add("show");
  });

  let autoDismissTimeout: number | undefined;

  function kill() {
    toastElement.classList.remove("show");
    setTimeout(() => toastElement.remove(), 250);
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
    }
  }

  function startAutoDismiss() {
    if (shouldAutoDismiss) {
      autoDismissTimeout = window.setTimeout(() => {
        kill();
      }, duration);
    }
  }

  toastElement.addEventListener("mouseenter", () => {
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
    }
  });

  toastElement.addEventListener("mouseleave", () => {
    startAutoDismiss();
  });

  startAutoDismiss();

  return kill;
}
