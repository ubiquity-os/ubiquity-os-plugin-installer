import fs from "fs";
import path from "path";

describe("Premade YAML Configurations (#43)", () => {
  const configsDir = path.join(__dirname, "../static/premade-configs");

  it("should contain standard, minimal, and partner-bounties YAML configs", () => {
    const files = fs.readdirSync(configsDir);
    expect(files).toContain("standard.yaml");
    expect(files).toContain("minimal.yaml");
    expect(files).toContain("partner-bounties.yaml");
  });

  it("should follow metadata schema with name, description, and version", () => {
    const standard = fs.readFileSync(path.join(configsDir, "standard.yaml"), "utf8");
    expect(standard).toContain("name: "UbiquityOS Standard Config"");
    expect(standard).toContain("description:");
    expect(standard).toContain("version: "1.0.0"");
    expect(standard).toContain("plugins:");
  });
});
