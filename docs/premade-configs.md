# Premade Configurations

Premade configurations provide ready-to-use plugin setups for common UbiquityOS use cases. They allow you to quickly bootstrap your plugin installer with battle-tested configurations.

## Overview

Premade configurations are YAML files that define a complete set of plugins with their settings. Each configuration is designed for a specific use case:

| Config | Description | Best For |
|--------|-------------|----------|
| **Standard** | Full-featured setup with all battle-tested plugins | Production deployments |
| **Minimal** | Essential plugins only | Getting started, simple setups |
| **Code Review** | Engineering-focused with PR automation | Development teams |

## Available Configurations

### Standard Configuration

The standard configuration includes all essential plugins for a complete UbiquityOS automation setup:

- **text-conversation-rewards** - Rewards contributors for quality conversations
- **assign-issues** - Automatic issue assignment
- **github-automation** - General GitHub automation
- **command-start-stop** - /start and /stop commands
- **dao-template** - DAO-related templates
- **price-labeler** - Automatic price labeling
- **review-assignment** - PR reviewer assignment

```yaml
# Usage: Load via the premade config loader
id: standard
name: Standard
description: Full-featured configuration with all battle-tested plugins
```

### Minimal Configuration

The minimal configuration provides the minimum required plugins for basic functionality:

- **command-start-stop** - /start and /stop commands
- **assign-issues** - Automatic issue assignment
- **github-automation** - Basic GitHub automation

```yaml
# Usage: Load via the premade config loader
id: minimal
name: Minimal
description: Essential plugins only for basic issue assignment
```

### Code Review Configuration

The code review configuration is optimized for engineering teams:

- **command-start-stop** - Task management
- **assign-issues** - Issue assignment
- **github-automation** - GitHub automation
- **review-automation** - Code review workflows
- **pr-status-tracker** - PR status tracking
- **code-quality-labeler** - Code quality metrics
- **price-labeler** - Price labeling

```yaml
# Usage: Load via the premade config loader
id: code-review
name: Code Review
description: Engineering-focused configuration with code review plugins
```

## Using Premade Configurations

### Loading a Configuration

```typescript
import { loadPremadeConfig, getPremadeConfigById } from "./premade-configs/index.js";

// Load a specific configuration
const standard = loadPremadeConfig("standard");

// Or get by ID
const config = getPremadeConfigById("standard");
```

### Converting to Plugin Config Format

```typescript
import { loadPremadeConfig, convertToPluginConfig } from "./premade-configs/index.js";
import YAML from "yaml";

// Load the configuration
const config = loadPremadeConfig("standard");

// Convert to plugin config format
const pluginConfig = convertToPluginConfig(config);

// Serialize to YAML
const yaml = YAML.stringify(pluginConfig);
```

### Loading All Configurations

```typescript
import { loadAllPremadeConfigs, getPremadeConfigsByCategory } from "./premade-configs/index.js";

// Get all available configurations
const allConfigs = loadAllPremadeConfigs();

// Get configurations grouped by category
const byCategory = getPremadeConfigsByCategory();
// Result: { standard: [...], minimal: [...], specialized: [...] }
```

## Configuration Schema

Each premade configuration follows this schema:

```typescript
interface PremadeConfig {
  id: string;           // Unique identifier
  name: string;         // Human-readable name
  description: string;  // Brief description
  category: "standard" | "minimal" | "specialized";
  plugins: PremadePlugin[];
  tags?: string[];
  version?: string;
}

interface PremadePlugin {
  plugin: string;       // Plugin identifier
  version: string;      // Plugin version
  skipBotEvents?: boolean;
  with?: Record<string, unknown>;
  description?: string;
}
```

## Validation

All premade configurations are validated against a JSON schema when loaded. If validation fails, an error is thrown with details about what fields are invalid.

## File Structure

```
src/premade-configs/
├── index.ts           # Config loader with validation
├── schema.ts          # TypeScript types and validation schema
├── standard.yml       # Full-featured config
├── minimal.yml        # Essential plugins only
└── code-review.yml    # Engineering-focused config
```

## Examples

### Basic Usage

```typescript
import { loadPremadeConfig, convertToPluginConfig } from "./premade-configs/index.js";

// Load minimal config
const minimal = loadPremadeConfig("minimal");
console.log(minimal.name); // "Minimal"

// Convert to plugin format and save
const pluginConfig = convertToPluginConfig(minimal);
// Use with your config parser to save to .ubiquity-os.yml
```

### Customizing a Premade Config

```typescript
import { loadPremadeConfig, convertToPluginConfig } from "./premade-configs/index.js";

// Load standard config
const standard = loadPremadeConfig("standard");

// Modify a plugin's configuration
const textRewardsPlugin = standard.plugins.find(p => p.plugin.includes("text-conversation-rewards"));
if (textRewardsPlugin?.with) {
  textRewardsPlugin.with.logLevel = "info"; // Change log level
}

// Convert and use
const pluginConfig = convertToPluginConfig(standard);
```