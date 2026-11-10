// Pseudocode for Fisk's art gallery construction (de Berg et al., §3.1). Line numbers are the
// 0-based indices used by the recorder in fisk.ts.

export const GALLERY_PSEUDOCODE: string[] = [
  'ArtGallery(P)',
  '    Triangulate P into n − 2 triangles',
  '    Build the dual tree: a node per triangle, an arc per diagonal',
  '    Colour the three vertices of a first triangle with three different colours',
  '    for each further triangle t, in depth-first order of the dual tree',
  '        two vertices of t are shared with its parent and already coloured',
  '        give the third vertex of t the colour that is missing',
  '    Let c be the colour used least often (at most ⌊n/3⌋ vertices)',
  '    Place a camera at every vertex of colour c',
  '    return the cameras',
]

export const PSEUDOCODE_HEADINGS = [0]
