import ReactMarkdown from 'react-markdown'

/**
 * Renders user markdown safely: raw HTML is dropped (skipHtml), unsafe URL schemes are
 * stripped by react-markdown's default urlTransform, and links open with noopener.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose-lms ${className ?? ''}`}>
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
