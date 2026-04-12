// Keyword extraction — no extra API call needed, pure text processing
const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","must","shall",
  "and","or","but","if","in","on","at","to","for","of","with","by","from","as",
  "that","this","these","those","it","its","they","them","their","you","your",
  "my","our","we","he","she","his","her","who","what","which","when","where",
  "how","all","any","both","each","few","more","most","other","some","such",
  "than","then","too","very","just","now","also","only","even","so","yet",
  "make","made","create","created","write","written","use","using","want","need",
  "like","well","good","best","great","include","including","ensure","ensure",
  "prompt","prompts","generate","generating","output","input","provide","given",
  "please","here","there","out","about","into","through","during","before","after",
]);

export function extractKeywords(text: string): string[] {
  if (!text) return [];
  // Extract distinct meaningful words (4+ chars, not stop words)
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  // Count frequency
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Return top 6 unique, sorted by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

// Elegant display: capitalize first letter
export function displayKeyword(k: string): string {
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, " ");
}
