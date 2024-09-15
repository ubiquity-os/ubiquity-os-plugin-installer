const manifestGui = document.querySelector(`#manifest-gui`);

(function renderManifest() {
    const decodedManifest = window.decodedManifest;

    const dfg = document.createDocumentFragment();
    const _div = document.createElement("DIV");
    // const _h3 = document.createElement("h3");

    /**
     * name": "Start | Stop",
    description": "Assign or un-assign yourself from an issue.",
    ubiquity:listeners": [
    commands": {
     */

    console.trace(decodedManifest)
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
        if (typeof rawValue != "string") {
            rawValue = JSON.stringify(decodedManifest[key], null, 2);
        }
        const valueParsed = rawValue;
        const keyDiv = _div.cloneNode();
        keyDiv.textContent = key;
        // h3.id = `key-${key}`;
        const valueDiv = _div.cloneNode();
        valueDiv.textContent = valueParsed;
        // div.id = `value-${key}`;
        tableRow.children[0].appendChild(keyDiv);
        tableRow.children[1].appendChild(valueDiv);
        dfg.appendChild(tableRow);
    }

    manifestGui.appendChild(dfg);



    function renderName(name) {
        const buffer = genericRender(element, "name");
    }
    function renderDescription(description) {
        const buffer = genericRender(element, "description");
    }
    function renderListeners(listeners) {
        const buffer = genericRender(element, "listeners");
    }
    function renderCommands(commands) {
        const buffer = genericRender(element, "commands");
    }
    function genericRender(element, text) {
        const div = _div.cloneNode();
        div.id = `${element}-tableRow`;
        div.innerText = text;
        return div;
    }


})();