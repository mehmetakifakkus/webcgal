// Pseudocode for the kd-tree (de Berg et al., §5.2). Line numbers are the 0-based indices used
// by the recorders in kdTree.ts and search.ts.

export const KD_PSEUDOCODE: string[] = [
  'BuildKdTree(P, depth)',
  '    if P contains only one point',
  '        then return a leaf storing this point',
  '    else if depth is even',
  '        then split P with a vertical line ℓ through the median x-coordinate into P_1 (left of or on ℓ) and P_2 (right of ℓ)',
  '        else split P with a horizontal line ℓ through the median y-coordinate into P_1 (below or on ℓ) and P_2 (above ℓ)',
  '    v_left ← BuildKdTree(P_1, depth + 1)',
  '    v_right ← BuildKdTree(P_2, depth + 1)',
  '    create a node v storing ℓ, with v_left and v_right as its children',
  '    return v',
  'SearchKdTree(v, R)',
  '    if v is a leaf',
  '        then report the point stored at v if it lies in R',
  '    else if region(lc(v)) is fully contained in R',
  '        then ReportSubtree(lc(v))',
  '    else if region(lc(v)) intersects R',
  '        then SearchKdTree(lc(v), R)',
  '    if region(rc(v)) is fully contained in R',
  '        then ReportSubtree(rc(v))',
  '    else if region(rc(v)) intersects R',
  '        then SearchKdTree(rc(v), R)',
]

export const PSEUDOCODE_HEADINGS = [0, 10]
