import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

/** Links in MDX content: app paths use the router (no full reload), web links open in a new tab. */
export default function MdxLink({ href = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith('/') && !href.startsWith('//')) return <Link to={href} {...props} />
  if (/^https?:\/\//i.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
  return <a href={href} {...props} />
}

/** The `components` prop for MDX content. */
export const mdxComponents = { a: MdxLink }
