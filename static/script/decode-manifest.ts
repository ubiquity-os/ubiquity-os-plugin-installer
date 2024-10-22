// const manifestPreview = "#manifest-preview";
// const $manifestPreview = document.body.querySelector(manifestPreview);
// if (!$manifestPreview) {
// throw new Error("No $manifestPreview set!");
// }

(function decodeManifest() {
  // const manifestFixture = '{"name":"Start | Stop","description":"Assign or un-assign yourself from an issue.","ubiquity:listeners":["issue_comment.created","issues.assigned","pull_request.opened"],"commands":{"start":{"ubiquity:example":"/start","description":"Assign yourself to the issue."},"stop":{"ubiquity:example":"/stop","description":"Unassign yourself from the issue."}}}';
  // const manifestEncoded = '%7B%22name%22:%22Start%20%7C%20Stop%22,%22description%22:%22Assign%20or%20un-assign%20yourself%20from%20an%20issue.%22,%22ubiquity:listeners%22:%5B%22issue_comment.created%22,%22issues.assigned%22,%22pull_request.opened%22%5D,%22commands%22:%7B%22start%22:%7B%22ubiquity:example%22:%22/start%22,%22description%22:%22Assign%20yourself%20to%20the%20issue.%22%7D,%22stop%22:%7B%22ubiquity:example%22:%22/stop%22,%22description%22:%22Unassign%20yourself%20from%20the%20issue.%22%7D%7D%7D';

  const search = window.location.search.substring(1);
  const parsed = stringUriParser(search);
  // console.trace(parsed);

  // const hash = window.location.hash.substring(1);
  // console.trace(hash);

  const encodedManifestEnvelope = parsed.filter((keyValuePair) => keyValuePair["manifest"])[0];
  if (!encodedManifestEnvelope) {
    throw new Error("No encoded manifest found!");
  }
  const encodedManifest = encodedManifestEnvelope["manifest"];
  const decodedManifest = decodeURI(encodedManifest);
  // const decodedManifest = encodedManifest;

  renderManifest(decodedManifest);

  window.decodedManifest = JSON.parse(decodedManifest);

  function stringUriParser(input) {
    const buffer = [];
    const sections = input.split("&");
    for (const section of sections) {
      const keyValues = section.split("=");
      buffer.push({ [keyValues[0]]: keyValues[1] });
    }
    return buffer;
  }

  function renderManifest(manifest) {
    const dfg = document.createDocumentFragment();
    dfg.textContent = manifest;
    // $manifestPreview.appendChild(dfg);
  }
})();
