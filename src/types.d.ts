// Ambient declarations for text imports bundled by wrangler.
// See `[[rules]] type = "Text"` in wrangler.toml.
declare module "*.md" {
  const content: string;
  export default content;
}
