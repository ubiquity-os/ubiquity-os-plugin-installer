export default class KernelConfigParser {
  constructor() {
    this.config = {};
  }

  parse(configString) {
    const lines = configString.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") continue;

      const [key, ...valueParts] = line.split("=");
      if (!key) continue;

      let value = valueParts.join("=").trim();
      const trimmedKey = key.trim();

      if (!trimmedKey.startsWith("CONFIG_")) continue;

      const configKey = trimmedKey.replace(/^CONFIG_/, "");

      this.config[configKey] = this.parseValue(value);
    }
    return this.config;
  }

  parseValue(value) {
    if (value === "y") return true;
    if (value === "n") return false;
    if (value === "m") return "module";
    if (/^0x[0-9a-fA-F]+$/i.test(value))
      return { type: "hex", value: parseInt(value, 16) };
    if (/^\d+$/.test(value)) return { type: "int", value: parseInt(value, 10) };
    return value.replace(/^"(.*)"$/, "$1"); // Remove quotes from string values
  }

  render() {
    return (
      Object.keys(this.config)
        .sort()
        .map((key) => `CONFIG_${key}=${this.renderValue(this.config[key])}`)
        .join("\n") + "\n"
    );
  }

  renderValue(value) {
    if (value === true) return "y";
    if (value === false) return "n";
    if (value === "module") return "m";
    if (typeof value === "object") {
      if (value.type === "hex")
        return `0x${value.value.toString(16).toLowerCase()}`;
      if (value.type === "int") return value.value.toString();
    }
    return `"${value}"`;
  }
}
