// Pseudocode for polygon triangulation (de Berg et al., §3.2–3.3). Line numbers
// are the 0-based indices used by the recorders in makeMonotone.ts and
// triangulateMonotone.ts.

export const TRIANGULATION_PSEUDOCODE: string[] = [
  'MakeMonotone(P)',
  '    Construct a priority queue Q on the vertices of P, ordered by y (equal y: smaller x first)',
  '    Initialize an empty status structure T',
  '    while Q is not empty',
  '        Remove the vertex v_i with the highest priority from Q',
  '        Call the procedure that handles v_i, depending on its type',
  'HandleStartVertex(v_i)',
  '    Insert e_i in T and set helper(e_i) to v_i',
  'HandleEndVertex(v_i)',
  '    if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)',
  '    Delete e_i−1 from T',
  'HandleSplitVertex(v_i)',
  '    Search in T to find the edge e_j directly left of v_i',
  '    Insert the diagonal connecting v_i to helper(e_j); set helper(e_j) to v_i',
  '    Insert e_i in T and set helper(e_i) to v_i',
  'HandleMergeVertex(v_i)',
  '    if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)',
  '    Delete e_i−1 from T',
  '    Search in T to find the edge e_j directly left of v_i',
  '    if helper(e_j) is a merge vertex, insert the diagonal connecting v_i to helper(e_j)',
  '    Set helper(e_j) to v_i',
  'HandleRegularVertex(v_i)',
  '    if the interior of P lies to the right of v_i',
  '        if helper(e_i−1) is a merge vertex, insert the diagonal connecting v_i to helper(e_i−1)',
  '        Delete e_i−1 from T; insert e_i in T and set helper(e_i) to v_i',
  '    else',
  '        Search in T to find the edge e_j directly left of v_i',
  '        if helper(e_j) is a merge vertex, insert the diagonal connecting v_i to helper(e_j)',
  '        Set helper(e_j) to v_i',
  'TriangulateMonotonePolygon(P)',
  '    Merge the vertices of the left and right chains into one sequence u_1 … u_n, sorted by y (equal y: smaller x first)',
  '    Initialize an empty stack S and push u_1 and u_2 onto it',
  '    for j ← 3 to n − 1',
  '        if u_j and the vertex on top of S are on different chains',
  '            Pop all vertices from S; insert a diagonal from u_j to each popped vertex except the last one',
  '            Push u_j−1 and u_j onto S',
  '        else',
  '            Pop one vertex from S',
  '            Pop the other vertices from S as long as the diagonals to u_j are inside P; insert these diagonals; push the last popped vertex back onto S',
  '            Push u_j onto S',
  '    Add diagonals from u_n to all stack vertices except the first and the last one',
]

export const PSEUDOCODE_HEADINGS = [0, 6, 8, 11, 15, 21, 29]

export const PSEUDOCODE_SECTIONS = { partition: [0, 28], triangulate: [29, 40] } as const
