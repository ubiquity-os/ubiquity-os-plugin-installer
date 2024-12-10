export const STRINGS = {
  TDV_CENTERED: "tdv-centered",
  SELECT_HIDE: "select-hide",
  SELECT_ARROW_ACTIVE: "select-arrow-active",
};

/**
 * For manifest URLs from GitHub, extracts just the repo name.
 * For all other URLs (workers, actions, etc), returns the full URL.
 * This allows for flexible matching without assuming URL formats.
 */
export function extractPluginIdentifier(url: string): string {
  // For GitHub manifest URLs, extract just the repo name
  if (url.includes('github.com/') || url.includes('githubusercontent.com/')) {
    const parts = url.split('/');
    if (parts.length >= 5) {
      return parts[4].split('@')[0].split('?')[0]; // Get repo name without branch or query params
    }
  }

  // For all other URLs (workers, actions, etc), use the full URL
  return url;
}
