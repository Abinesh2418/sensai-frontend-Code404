/**
 * Notion Quiz Parser — extracts structured quiz questions from Notion blocks.
 *
 * Format:
 *   ## Question 1: Title
 *   Question text...
 *   **Reference Answer:** Answer text...
 *   **Scorecard:**
 *   - CriterionName | Description | max:10 pass:6
 *   ---
 */

export interface ParsedCriterion {
  name: string;
  description: string;
  maxScore: number;
  minScore: number;
  passScore: number;
}

export interface ParsedQuestion {
  title: string;
  questionBlocks: any[];
  answerBlocks: any[];
  questionText: string;
  answerText: string;
  scorecard: ParsedCriterion[];
}

export interface ParsedQuiz {
  title: string;
  description: string;
  questions: ParsedQuestion[];
}

function richTextToPlain(richText: any[]): string {
  if (!Array.isArray(richText)) return "";
  return richText.map((t: any) => t.plain_text || t.text?.content || "").join("");
}

function blockToText(block: any): string {
  const type = block.type;
  if (!type || !block[type]) return "";
  const data = block[type];
  if (data.rich_text) return richTextToPlain(data.rich_text);
  if (data.text) return richTextToPlain(data.text);
  if (data.caption) return richTextToPlain(data.caption);
  return "";
}

function isQuestionHeading(block: any): boolean {
  const text = blockToText(block).trim().toLowerCase();
  // Clean asterisks and hashes for matching
  const cleaned = text.replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "").replace(/^#{1,3}\s*/, "").trim();
  if (block.type === "heading_2" && cleaned.startsWith("question")) return true;
  if (cleaned.startsWith("question") && cleaned.match(/question\s*\d/)) return true;
  return false;
}

function cleanHeadingText(block: any): string {
  let text = blockToText(block).trim();
  // Remove bold markers and hash prefixes in any order
  text = text.replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "");
  text = text.replace(/^#{1,3}\s*/, "");
  text = text.replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "");
  return text.trim();
}

function isReferenceAnswerMarker(block: any): boolean {
  const text = blockToText(block);
  // Handle bold markers: "**Reference Answer:**", "*Reference Answer:*", plain "Reference Answer:"
  const cleaned = text.replace(/\*/g, "").trim();
  return cleaned.startsWith("Reference Answer:");
}

function isScorecardMarker(block: any): boolean {
  const text = blockToText(block).trim();
  const cleaned = text.replace(/\*/g, "").replace(/:$/, "").trim().toLowerCase();
  return cleaned === "scorecard";
}

function isDivider(block: any): boolean {
  if (block.type === "divider") return true;
  const text = blockToText(block).trim();
  // Handle "---", "- -", "- --", "***", or just dashes
  return /^[-–—\s*]+$/.test(text) && text.length >= 2 && text.replace(/\s/g, "").length >= 2;
}

/**
 * Parse a scorecard criterion line:
 *   "- Relevance | Addresses the question directly | max:10 pass:6"
 *   or "Relevance | Description | max:10 pass:6"
 */
function parseCriterionLine(text: string): ParsedCriterion | null {
  // Strip leading "- " or "• "
  let line = text.replace(/^[-•*]\s*/, "").trim();

  const parts = line.split("|").map(p => p.trim());
  if (parts.length < 2) return null;

  const name = parts[0];
  const description = parts[1];

  let maxScore = 10, passScore = 6, minScore = 0;

  // Parse "max:10 pass:6" from remaining parts
  const scorePart = parts.slice(2).join(" ");
  const maxMatch = scorePart.match(/max\s*:\s*(\d+)/i);
  const passMatch = scorePart.match(/pass\s*:\s*(\d+)/i);
  const minMatch = scorePart.match(/min\s*:\s*(\d+)/i);

  if (maxMatch) maxScore = parseInt(maxMatch[1]);
  if (passMatch) passScore = parseInt(passMatch[1]);
  if (minMatch) minScore = parseInt(minMatch[1]);

  return { name, description, maxScore, minScore, passScore };
}

export function parseNotionQuiz(blocks: any[]): ParsedQuiz {
  if (!blocks || blocks.length === 0) {
    return { title: "", description: "", questions: [] };
  }

  let quizTitle = "";
  let descriptionParts: string[] = [];
  let firstQuestionIdx = -1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = blockToText(block).trim();

    const textClean = text.replace(/\*/g, "").trim();
    if (!quizTitle && (block.type === "heading_1" || textClean.startsWith("# ") || text.startsWith("**# "))) {
      quizTitle = textClean.replace(/^#{1,3}\s*/, "").trim();
      continue;
    }
    if (isQuestionHeading(block)) {
      firstQuestionIdx = i;
      break;
    }
    if (text && !isDivider(block)) descriptionParts.push(text);
  }

  if (firstQuestionIdx === -1) {
    return { title: quizTitle, description: descriptionParts.join(" "), questions: [] };
  }

  // Split into sections on question headings
  const sections: { heading: any; blocks: any[] }[] = [];
  let current: { heading: any; blocks: any[] } | null = null;

  for (let i = firstQuestionIdx; i < blocks.length; i++) {
    const block = blocks[i];
    if (isQuestionHeading(block)) {
      if (current) sections.push(current);
      current = { heading: block, blocks: [] };
    } else if (current) {
      current.blocks.push(block);
    }
  }
  if (current) sections.push(current);

  // Parse each section
  const questions: ParsedQuestion[] = sections.map((section) => {
    const headingText = cleanHeadingText(section.heading);
    const titleMatch = headingText.match(/Question\s*\d+\s*[:\-–—]\s*(.*)/i);
    const title = titleMatch ? titleMatch[1].trim() : headingText;

    // Find markers
    let answerIdx = -1, scorecardIdx = -1;
    for (let i = 0; i < section.blocks.length; i++) {
      if (answerIdx === -1 && isReferenceAnswerMarker(section.blocks[i])) answerIdx = i;
      if (scorecardIdx === -1 && isScorecardMarker(section.blocks[i])) scorecardIdx = i;
    }

    // Split blocks into question / answer / scorecard regions
    const endOfQuestion = answerIdx >= 0 ? answerIdx : (scorecardIdx >= 0 ? scorecardIdx : section.blocks.length);
    const endOfAnswer = scorecardIdx >= 0 ? scorecardIdx : section.blocks.length;

    let questionBlocks = section.blocks.slice(0, endOfQuestion).filter(b => !isDivider(b));
    let answerBlocks = answerIdx >= 0 ? section.blocks.slice(answerIdx, endOfAnswer).filter(b => !isDivider(b)) : [];
    let scorecardBlocks = scorecardIdx >= 0 ? section.blocks.slice(scorecardIdx + 1).filter(b => !isDivider(b)) : [];

    const questionText = questionBlocks.map(blockToText).filter(Boolean).join("\n").trim();
    let answerText = answerBlocks.map(blockToText).filter(Boolean).join("\n").trim();
    // Remove "Reference Answer:" prefix with any bold markers
    answerText = answerText.replace(/^\*{0,2}Reference Answer:\*{0,2}\s*/i, "").trim();

    // Parse scorecard criteria
    const scorecard: ParsedCriterion[] = [];
    for (const b of scorecardBlocks) {
      const text = blockToText(b).trim();
      if (!text) continue;
      const criterion = parseCriterionLine(text);
      if (criterion) scorecard.push(criterion);
    }

    return { title, questionBlocks, answerBlocks, questionText, answerText, scorecard };
  });

  return { title: quizTitle, description: descriptionParts.join(" "), questions };
}

function notionBlockToEditorBlock(block: any): any {
  const text = blockToText(block);
  const type = block.type;

  switch (type) {
    case "heading_1": return { type: "heading", content: [{ type: "text", text, styles: {} }], props: { level: 1 } };
    case "heading_2": return { type: "heading", content: [{ type: "text", text, styles: {} }], props: { level: 2 } };
    case "heading_3": return { type: "heading", content: [{ type: "text", text, styles: {} }], props: { level: 3 } };
    case "bulleted_list_item": return { type: "bulletListItem", content: [{ type: "text", text, styles: {} }], props: {} };
    case "numbered_list_item": return { type: "numberedListItem", content: [{ type: "text", text, styles: {} }], props: {} };
    case "code": return { type: "codeBlock", content: [{ type: "text", text, styles: {} }], props: { language: block.code?.language || "" } };
    default:
      if (text) return { type: "paragraph", content: [{ type: "text", text, styles: {} }], props: {} };
      return null;
  }
}

export function notionBlocksToEditorBlocks(blocks: any[]): any[] {
  return blocks.map(notionBlockToEditorBlock).filter(Boolean);
}
