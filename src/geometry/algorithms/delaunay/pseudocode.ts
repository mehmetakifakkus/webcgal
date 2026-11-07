// Pseudocode for Delaunay triangulation (de Berg et al., §9.3). Line numbers are the
// 0-based indices used by the recorder in delaunay.ts.

export const DELAUNAY_PSEUDOCODE: string[] = [
  'DelaunayTriangulation(P)',
  '    Let p_0 be the lexicographically highest point of P (the rightmost among the points with the largest y)',
  '    Let p_−1 and p_−2 be two symbolic points far away, so that P lies inside the triangle p_0 p_−1 p_−2',
  '    Initialize T as the triangulation consisting of the single triangle p_0 p_−1 p_−2',
  '    Compute a random permutation p_1, p_2, …, p_n of P \\ {p_0}',
  '    for r ← 1 to n',
  '        Find the triangle p_i p_j p_k ∈ T that contains p_r',
  '        if p_r lies in the interior of the triangle p_i p_j p_k',
  '            Add edges from p_r to p_i, p_j and p_k, splitting the triangle into three',
  '            LegalizeEdge(p_r, p_i p_j, T); LegalizeEdge(p_r, p_j p_k, T); LegalizeEdge(p_r, p_k p_i, T)',
  '        else (p_r lies on an edge, say p_i p_j, shared with the triangle p_i p_j p_l)',
  '            Add edges from p_r to p_k and to p_l, splitting the two triangles into four',
  '            LegalizeEdge(p_r, p_i p_l, T); LegalizeEdge(p_r, p_l p_j, T); LegalizeEdge(p_r, p_j p_k, T); LegalizeEdge(p_r, p_k p_i, T)',
  '    Discard p_−1 and p_−2 with all their incident edges from T',
  '    return T',
  'LegalizeEdge(p_r, p_i p_j, T)',
  '    if p_i p_j is illegal',
  '        Let p_i p_j p_k be the triangle adjacent to p_r p_i p_j along p_i p_j',
  '        Replace p_i p_j with p_r p_k (flip the edge)',
  '        LegalizeEdge(p_r, p_i p_k, T)',
  '        LegalizeEdge(p_r, p_k p_j, T)',
]

export const PSEUDOCODE_HEADINGS = [0, 15]
