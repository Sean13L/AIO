// Flashcard/quiz strings render as plain text, but Gemini often carries the
// study guide's markdown emphasis over into them anyway ("**elasticity**",
// "*ceteris paribus*"), which then shows up as literal asterisks. The
// prompts ask for plain text, and this strips inline emphasis at render
// time too, so already-generated sets display cleanly without regenerating.
// Emphasis markers must hug non-space text on both sides, so an operator
// like "2 * 3" or a lone asterisk is left alone.
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "$1")
    .replace(/__(\S(?:.*?\S)?)__/g, "$1")
    .replace(/(^|[^\w*])\*(\S(?:[^*]*?\S)?)\*(?![\w*])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}
