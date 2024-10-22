const manifestGui = document.querySelector(`#manifest-gui`) as HTMLElement | null;
const manifestGuiBody = document.querySelector(`#manifest-gui-body`) as HTMLElement | null;
import Manifest from "../../fixtures/manifest.json";
type DecodedManifest = typeof Manifest;

(function renderManifest() {
  manifestGui?.classList.add("rendering");
  const decodedManifest = window.decodedManifest as DecodedManifest;

  if (!decodedManifest || !manifestGuiBody) {
    console.error("Missing required elements");
    return;
  }

  const dfg = document.createDocumentFragment();
  const _div = document.createElement("div");
  const _nestedObject = document.createElement("pre");

  const decodedManifestKeys = Object.keys(decodedManifest);
  const limit = decodedManifestKeys.length;
  const _tableRow = document.createElement("tr");
  const _tableDataHeader = document.createElement("td");
  _tableDataHeader.className = "table-data-header";
  const _tableDataValue = document.createElement("td");
  _tableDataValue.className = "table-data-value";
  _tableRow.appendChild(_tableDataHeader);
  _tableRow.appendChild(_tableDataValue);

  for (let x = 0; x < limit; x++) {
    const tableRow = _tableRow.cloneNode(true) as HTMLTableRowElement;
    const key = decodedManifestKeys[x];
    tableRow.id = key;
    let rawValue = decodedManifest[key];
    let isString = true;
    if (typeof rawValue !== "string") {
      const prettified = JSON.stringify(rawValue, null, 2);
      let humanize = prettified.replace(/\{|\}|\[|\]/gim, ``);
      humanize = humanize.replace(/ubiquity:/gim, ``);
      humanize = humanize.replace(/": "/gim, ` ➡️ `);
      humanize = humanize.replace(/",?$/gim, ``);
      humanize = humanize.replace(/^\s\s\s\s"/gim, `      `);
      humanize = humanize.replace(/^\s\s"/gim, `   `);
      humanize = humanize.replace(/":/gim, ``);
      humanize = humanize.replace(/^\s\s,/gim, ``);
      rawValue = humanize;
      isString = false;
    }
    const valueParsed = rawValue as string;
    const keyDiv = _div.cloneNode() as HTMLDivElement;
    keyDiv.textContent = key.replace("ubiquity:", "");

    const valueDiv = _div.cloneNode() as HTMLDivElement;
    if (isString) {
      valueDiv.textContent = valueParsed;
    } else {
      const nestedObject = _nestedObject.cloneNode() as HTMLPreElement;
      nestedObject.textContent = valueParsed;
      valueDiv.appendChild(nestedObject);
    }

    const firstChild = tableRow.children[0] as HTMLTableCellElement;
    const secondChild = tableRow.children[1] as HTMLTableCellElement;
    firstChild.appendChild(keyDiv);
    secondChild.appendChild(valueDiv);
    dfg.appendChild(tableRow);
  }

  manifestGuiBody.appendChild(dfg);
  manifestGui?.classList.add("rendered");
})();
