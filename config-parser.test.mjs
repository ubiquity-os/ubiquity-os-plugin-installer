import KernelConfigParser from "./config-parser.mjs";

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name} passed`);
  } catch (error) {
    console.error(`❌ ${name} failed: ${error.message}`);
  }
}

// Add a simple test
runTest("Create parser instance", () => {
  const parser = new KernelConfigParser();
  if (!(parser instanceof KernelConfigParser)) {
    throw new Error("Failed to create KernelConfigParser instance");
  }
});

runTest("Parse boolean config", () => {
  const parser = new KernelConfigParser();
  const result = parser.parse("CONFIG_FEATURE_A=y\nCONFIG_FEATURE_B=n");
  if (result.FEATURE_A !== true || result.FEATURE_B !== false) {
    throw new Error("Failed to parse boolean config");
  }
});

runTest("Parse string config", () => {
  const parser = new KernelConfigParser();
  const result = parser.parse('CONFIG_STRING_OPTION="hello world"');
  if (result.STRING_OPTION !== "hello world") {
    throw new Error("Failed to parse string config");
  }
});

runTest("Parse numeric config", () => {
  const parser = new KernelConfigParser();
  const result = parser.parse("CONFIG_INT_OPTION=42\nCONFIG_HEX_OPTION=0x2A");
  if (
    result.INT_OPTION.value !== 42 ||
    result.INT_OPTION.type !== "int" ||
    result.HEX_OPTION.value !== 42 ||
    result.HEX_OPTION.type !== "hex"
  ) {
    throw new Error("Failed to parse numeric config");
  }
});

runTest("Render config", () => {
  const parser = new KernelConfigParser();
  parser.config = {
    FEATURE_A: true,
    FEATURE_B: false,
    STRING_OPTION: "hello world",
    INT_OPTION: { type: "int", value: 42 },
    HEX_OPTION: { type: "hex", value: 42 },
  };
  const result = parser.render();
  const expected = `CONFIG_FEATURE_A=y
CONFIG_FEATURE_B=n
CONFIG_HEX_OPTION=0x2a
CONFIG_INT_OPTION=42
CONFIG_STRING_OPTION="hello world"
`;
  console.log("Expected:\n", expected);
  console.log("Actual:\n", result);
  if (result !== expected) {
    throw new Error("Failed to render config correctly");
  }
});

console.log("All tests completed.");
