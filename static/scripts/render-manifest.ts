import { Manifest } from "./decode-manifest";

export class ManifestRenderer {
  manifestGui: HTMLElement | null;
  manifestGuiBody: HTMLElement | null;

  constructor() {
    this.manifestGui = document.querySelector(`#manifest-gui`);
    this.manifestGuiBody = document.querySelector(`#manifest-gui-body`);
  }

  renderManifest(decodedManifest?: Manifest, fromCache: boolean = false) {
    if (fromCache) {
      decodedManifest = JSON.parse(localStorage.getItem("manifestCache") || "{}");
    }

    if (!decodedManifest) {
      throw new Error("No decoded manifest found!");
    }

    this.manifestGui?.classList.add("rendering");
    const dfg = document.createDocumentFragment();
    const _div = document.createElement("DIV");
    const _nestedObject = document.createElement("pre");

    const decodedManifestKeys = Object.keys(decodedManifest);
    let x = -1;
    const limit = decodedManifestKeys.length;
    const _tableRow = document.createElement("tr");
    const _tableDataHeader = document.createElement("td");
    _tableDataHeader.className = "table-data-header";
    const _tableDataValue = document.createElement("td");
    _tableDataValue.className = "table-data-value";
    _tableRow.appendChild(_tableDataHeader);
    _tableRow.appendChild(_tableDataValue);

    while (++x < limit) {
      const tableRow = _tableRow.cloneNode(true) as HTMLTableRowElement;
      const key = decodedManifestKeys[x] as keyof Manifest;
      tableRow.id = key;
      let rawValue = decodedManifest[key];
      let isString = true;
      if (typeof rawValue !== "string") {
        const prettified = JSON.stringify(decodedManifest[key], null, 2);
        const humanize = prettified
          .replace(/[{}[\]]/g, "")
          .replace(/"ubiquity:/g, "")
          .replace(/":\s"/g, " ➡️ ")
          .replace(/",?/g, "")
          .replace(/^\s{4}"/gm, "    ")
          .replace(/":/g, "")
          .replace(/^\s{2},/gm, "")
          .replace(/,/g, "");
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
      tableRow.children[0].appendChild(keyDiv);
      tableRow.children[1].appendChild(valueDiv);
      dfg.appendChild(tableRow);
    }

    this.manifestGuiBody?.appendChild(dfg);
    this.manifestGui?.classList.add("rendered");
  }
}
