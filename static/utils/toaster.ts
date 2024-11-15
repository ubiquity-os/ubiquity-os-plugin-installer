import { createElement } from "./ele-helpers";

export function toastNotification(
  message: string,
  options: {
    type?: "success" | "error" | "info" | "warning";
    actionText?: string;
    action?: () => void;
    shouldAutoDismiss?: boolean;
    duration?: number;
    killAll?: boolean;
  } = {}
): void {
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
    toastElement.classList.remove("show");
    setTimeout(() => toastElement.remove(), 250);
  });

  toastElement.appendChild(messageElement);

  if (action && actionText) {
    const actionButton = createElement("button", {
      class: "toast-action",
      textContent: actionText,
    });

    actionButton.addEventListener("click", async () => {
      action();
      setTimeout(() => {
        document.querySelectorAll(".toast").forEach((toast) => {
          toast.classList.remove("show");
          setTimeout(() => toast.remove(), 250);
        });
      }, 5000);
    });
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

  if (shouldAutoDismiss) {
    setTimeout(() => {
      toastElement.classList.remove("show");
      setTimeout(() => toastElement.remove(), 250);
    }, duration);
  }
}
