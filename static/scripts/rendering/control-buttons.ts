import { manifestGuiBody } from "../../utils/element-helpers";

export function controlButtons({ hide }: { hide: boolean }): void {
  const addButton = document.getElementById("add");
  const removeButton = document.getElementById("remove");
  const resetToDefaultButton = document.getElementById("reset-to-default");
  const hideOrDisplay = hide ? "none" : "inline-block";
  if (addButton) {
    addButton.style.display = hideOrDisplay;
  }
  if (removeButton) {
    removeButton.style.display = hideOrDisplay;
  }

  if (resetToDefaultButton) {
    resetToDefaultButton.style.display = hideOrDisplay;
  }

  if (!manifestGuiBody) {
    return;
  }

  manifestGuiBody.classList.add("rendered");
}
