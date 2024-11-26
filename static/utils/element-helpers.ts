import { ManifestProps } from "../types/plugins";

const CONFIG_INPUT_STR = "config-input";

export const manifestGuiBody = document.getElementById("manifest-gui-body");

export function createElement<TK extends keyof HTMLElementTagNameMap>(tagName: TK, attributes: { [key: string]: string | null }): HTMLElementTagNameMap[TK] {
  const element = document.createElement(tagName);
  Object.keys(attributes).forEach((key) => {
    if (key === "textContent") {
      element.textContent = attributes[key];
    } else if (key in element) {
      (element as Record<string, string | null>)[key] = attributes[key];
    } else {
      element.setAttribute(key, `${attributes[key]}`);
    }
  });
  return element;
}
export function createInputRow(
  key: string,
  prop: ManifestProps,
  configDefaults: Record<string, { type: string; value: unknown; items: { type: string } | null }>
): void {
  const row = document.createElement("tr");

  const headerCell = document.createElement("td");
  headerCell.className = "table-data-header";
  headerCell.textContent = key;

  createConfigParamTooltip(headerCell, prop);

  row.appendChild(headerCell);

  const valueCell = document.createElement("td");
  valueCell.className = "table-data-value";

  const input = createInput(key, prop.default, prop);
  valueCell.appendChild(input);

  row.appendChild(valueCell);
  manifestGuiBody?.appendChild(row);

  configDefaults[key] = {
    type: prop.type,
    value: prop.default,
    items: prop.items ? { type: prop.items.type } : null,
  };
}
export function createInput(key: string, defaultValue: unknown, prop: ManifestProps): HTMLElement {
  if (!key) {
    throw new Error("Input name is required");
  }

  let ele: HTMLElement;

  const dataType = prop.type;

  if (dataType === "object" || dataType === "array") {
    ele = createTextareaInput(key, defaultValue, dataType);
  } else if (dataType === "boolean") {
    ele = createBooleanInput(key, defaultValue);
  } else {
    ele = createStringInput(key, defaultValue, dataType);
  }

  return ele;
}
export function createStringInput(key: string, defaultValue: string | unknown, dataType: string): HTMLElement {
  return createElement("input", {
    type: "text",
    id: key,
    name: key,
    "data-config-key": key,
    "data-type": dataType,
    class: CONFIG_INPUT_STR,
    value: `${defaultValue}`,
  });
}
export function createBooleanInput(key: string, defaultValue: boolean | unknown): HTMLElement {
  const inputElem = createElement("input", {
    type: "checkbox",
    id: key,
    name: key,
    "data-config-key": key,
    "data-type": "boolean",
    class: CONFIG_INPUT_STR,
  });

  if (defaultValue) {
    inputElem.setAttribute("checked", "");
  }

  return inputElem;
}
export function createTextareaInput(key: string, defaultValue: object | unknown, dataType: string): HTMLElement {
  const inputElem = createElement("textarea", {
    id: key,
    name: key,
    "data-config-key": key,
    "data-type": dataType,
    class: CONFIG_INPUT_STR,
    rows: "5",
    cols: "50",
  });
  inputElem.textContent = JSON.stringify(defaultValue, null, 2);

  inputElem.setAttribute("placeholder", `Enter ${dataType} in JSON format`);

  return inputElem;
}

function createConfigParamTooltip(headerCell: HTMLElement, prop: ManifestProps) {
  if (!prop.description) return;

  const tooltip = createElement("span", { class: "tooltip", textContent: "?" });
  const tooltipText = createElement("span", { class: "tooltiptext", textContent: prop.description });

  tooltip.appendChild(tooltipText);
  headerCell.appendChild(tooltip);

  tooltip.addEventListener("mouseenter", () => {
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipTextRect = tooltipText.getBoundingClientRect();
    const spaceAbove = tooltipRect.top;
    const spaceBelow = window.innerHeight - tooltipRect.bottom;

    if (spaceBelow < tooltipTextRect.height && spaceAbove > spaceBelow) {
      tooltipText.style.bottom = `${tooltipRect.height}px`;
      tooltipText.style.top = "auto";
    } else {
      tooltipText.style.top = `${tooltipRect.height}px`;
      tooltipText.style.bottom = "auto";
    }

    tooltipText.style.visibility = "visible";
    tooltipText.style.opacity = "1";
  });

  tooltip.addEventListener("mouseleave", () => {
    tooltipText.style.visibility = "hidden";
    tooltipText.style.opacity = "0";
  });
}
