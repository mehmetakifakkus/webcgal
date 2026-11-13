// Pseudocode for the 2-D range tree (de Berg et al., §5.3). Line numbers are the 0-based indices
// used by the recorders in rangeTree.ts and search.ts. The comparisons are the ones the code
// makes with composite bounds (see search.ts): the path to x goes left when x ≤ x_v, the path to
// x′ goes right when x′ ≥ x_v. The associated tree is named T′ on its own line, as the call
// 1DRangeQuery(T_assoc(rc(v)), [y : y′]) is too wide for the pseudocode card at that depth.

export const RT_PSEUDOCODE: string[] = [
  'Build2DRangeTree(P)',
  '    build a binary search tree T_assoc on the y-coordinates of the points in P',
  '    if P contains only one point then create a leaf v storing this point',
  '    else split P at x_mid, the median x-coordinate, into P_left (x ≤ x_mid) and P_right (x > x_mid)',
  '        v_left ← Build2DRangeTree(P_left); v_right ← Build2DRangeTree(P_right)',
  '        create a node v storing x_mid, with v_left and v_right as its children',
  '    make T_assoc the associated structure of v',
  '    return v',
  '2DRangeQuery(T, [x : x′] × [y : y′])',
  '    v_split ← FindSplitNode(T, x, x′)',
  '    if v_split is a leaf',
  '        then check if the point stored at v_split must be reported',
  '        else v ← lc(v_split)',
  '            while v is not a leaf',
  '                do if x ≤ x_v',
  '                    then T′ ← T_assoc(rc(v))',
  '                        1DRangeQuery(T′, [y : y′])',
  '                        v ← lc(v)',
  '                    else v ← rc(v)',
  '            check if the point stored at v must be reported',
  '            v ← rc(v_split)',
  '            while v is not a leaf',
  '                do if x′ ≥ x_v',
  '                    then T′ ← T_assoc(lc(v))',
  '                        1DRangeQuery(T′, [y : y′])',
  '                        v ← rc(v)',
  '                    else v ← lc(v)',
  '            check if the point stored at v must be reported',
]

export const PSEUDOCODE_HEADINGS = [0, 8]

/** Lines the recorders use. */
export const RT_LINE = {
  leaf: 2,
  split: 3,
  findSplit: 9,
  splitLeaf: 11,
  loQuery: 14,
  loAssoc: 16,
  loRight: 18,
  loLeaf: 19,
  hiQuery: 22,
  hiAssoc: 24,
  hiLeft: 26,
  hiLeaf: 27,
} as const
