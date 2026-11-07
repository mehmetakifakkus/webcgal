// Pseudocode for the Voronoi diagram from the Delaunay triangulation (de Berg et al., §7, §9.2).
// Line numbers are the 0-based indices used by the recorder in voronoi.ts.

export const VORONOI_PSEUDOCODE: string[] = [
  'VoronoiFromDelaunay(P)',
  '    Compute the Delaunay triangulation DT(P)',
  '    for each triangle t of DT(P)',
  '        Create a Voronoi vertex at the circumcenter of t',
  '        (if it coincides with an existing vertex, merge them)',
  '    for each edge p_i p_j of DT(P)',
  '        if p_i p_j is shared by two triangles t and t\'',
  '            Add the Voronoi edge between the vertices of t and t\' (skip it if they coincide)',
  '        else (p_i p_j is a hull edge of the single triangle t)',
  '            Add a ray from the vertex of t along the perpendicular bisector of p_i p_j, away from t',
  '    if P is collinear, the Voronoi edges are the perpendicular bisectors of consecutive points',
  '    Collect, for each site, its incident edges in counter-clockwise order to form its cell',
  '    return the Voronoi diagram',
]

export const PSEUDOCODE_HEADINGS = [0]
