export function detectArtifactKind(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.html')) return 'html';
  return null;
}
