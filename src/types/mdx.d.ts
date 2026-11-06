declare module '*.mdx' {
  import type { ComponentType } from 'react';

  /** Components an MDX document may receive to replace its HTML elements. */
  export type MDXComponents = Record<string, ComponentType<Record<string, unknown>> | string>;
  const MDXContent: ComponentType<{ components?: MDXComponents }>;
  export default MDXContent;
}
