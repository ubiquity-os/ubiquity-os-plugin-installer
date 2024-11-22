import { STRINGS } from "../../utils/strings";

export function updateGuiTitle(title: string): void {
  const guiTitle = document.querySelector("#manifest-gui-title");
  if (!guiTitle) {
    throw new Error("GUI Title not found");
  }
  guiTitle.textContent = title;
}

export function closeAllSelect() {
  const selectItemsList = document.querySelectorAll(STRINGS.SELECT_ITEMS);
  const selectSelectedList = document.querySelectorAll(STRINGS.SELECT_SELECTED);
  selectItemsList.forEach((item) => {
    item.classList.add(STRINGS.SELECT_HIDE);
  });
  selectSelectedList.forEach((item) => {
    item.classList.remove(STRINGS.SELECT_ARROW_ACTIVE);
  });
}
