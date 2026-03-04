import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { componentsWithLinePosition } from './MarkdownPreview';

interface MarkdownSectionProps {
  content: string;
}

export const MarkdownSection = React.memo(function MarkdownSection({
  content,
}: MarkdownSectionProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeHighlight]}
      components={componentsWithLinePosition}
    >
      {content}
    </ReactMarkdown>
  );
});
