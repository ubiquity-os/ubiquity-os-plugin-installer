const manifestGui = document.querySelector(`#manifest-gui`);
const manifestGuiBody = document.querySelector(`#manifest-gui-body`);

(function renderManifest() {
  manifestGui?.classList.add("rendering");
  const decodedManifest = window.decodedManifest;

  const dfg = document.createDocumentFragment();
  const _div = document.createElement("DIV");
  const _nestedObject = document.createElement("pre");
  // const _h3 = document.createElement("h3");

  /**
     * name": "Start | Stop",
    description": "Assign or un-assign yourself from an issue.",
    ubiquity:listeners": [
    commands": {
     */

  console.trace(decodedManifest);
  const decodedManifestKeys = Object.keys(decodedManifest);
  let x = -1;
  const limit = decodedManifestKeys.length;
  // const buffer = [];
  const _tableRow = document.createElement("tr");
  const _tableDataHeader = document.createElement("td");
  _tableDataHeader.className = "table-data-header";
  const _tableDataValue = document.createElement("td");
  _tableDataValue.className = "table-data-value";
  _tableRow.appendChild(_tableDataHeader);
  _tableRow.appendChild(_tableDataValue);

  console.trace(_tableRow);

  while (++x < limit) {
    const tableRow = _tableRow.cloneNode(true);
    const key = decodedManifestKeys[x];
    tableRow.id = key;
    let rawValue = decodedManifest[key];
    let isString = true;
    if (typeof rawValue != "string") {
      const prettified = JSON.stringify(decodedManifest[key], null, 2);
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
    const valueParsed = rawValue;
    const keyDiv = _div.cloneNode();
    keyDiv.textContent = key.replace("ubiquity:", "");

    // h3.id = `key-${key}`;
    const valueDiv = _div.cloneNode();
    if (isString) {
      valueDiv.textContent = valueParsed;
    } else {
      const nestedObject = _nestedObject.cloneNode();
      nestedObject.textContent = valueParsed;
      valueDiv.appendChild(nestedObject);
    }
    // div.id = `value-${key}`;
    tableRow.children[0].appendChild(keyDiv);
    tableRow.children[1].appendChild(valueDiv);
    dfg.appendChild(tableRow);
  }

  manifestGuiBody.appendChild(dfg);
  manifestGui?.classList.add("rendered");
})();
