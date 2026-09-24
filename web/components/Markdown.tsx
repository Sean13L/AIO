"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Renders AI-generated markdown (study guides) — GFM for tables/task lists,
// remark-math + KaTeX since guides routinely use $...$/$$...$$ for formulas.
// Deliberately no rehype-raw: the source text is model output built partly
// from user-uploaded files and notes, so raw HTML stays escaped rather than
// rendered (react-markdown's default), and its default urlTransform already
// strips javascript: links.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
