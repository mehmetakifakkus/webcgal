/** Pseudocode of de Berg et al., ch. 2.1, plus the overlap extension (lines 21–22). */
export const SEGMENT_INTERSECTION_PSEUDOCODE: string[] = [
  'FindIntersections(S)',
  '    Initialize an empty event queue Q and insert the endpoints of all segments; an upper endpoint stores its segment',
  '    Initialize an empty status structure T',
  '    while Q is not empty',
  '        Determine the next event point p in Q and delete it',
  '        HandleEventPoint(p)',
  'HandleEventPoint(p)',
  '    Let U(p) be the set of segments whose upper endpoint is p',
  '    Find the segments in T that contain p: L(p) has p as lower endpoint, C(p) contains p in its interior',
  '    if U(p) ∪ L(p) ∪ C(p) contains more than one segment',
  '        Report p as an intersection, together with U(p), L(p) and C(p)',
  '    Delete the segments in L(p) ∪ C(p) from T',
  '    Insert the segments in U(p) ∪ C(p) into T, ordered as they are just below the sweep line',
  '    if U(p) ∪ C(p) is empty',
  '        Let sl and sr be the left and right neighbours of p in T; FindNewEvent(sl, sr, p)',
  '    else',
  "        Let s' be the leftmost segment of U(p) ∪ C(p) in T and sl its left neighbour; FindNewEvent(sl, s', p)",
  "        Let s'' be the rightmost segment of U(p) ∪ C(p) in T and sr its right neighbour; FindNewEvent(s'', sr, p)",
  'FindNewEvent(sl, sr, p)',
  '    if sl and sr intersect below the sweep line, or on it to the right of p, and the point is not yet in Q',
  '        Insert the intersection point as an event into Q',
  '    (extension, in HandleEventPoint after inserting U(p) ∪ C(p) into T) for each pair of segments in U(p) ∪ C(p) with one of them in U(p): if they are collinear and overlap',
  '        (extension) Report their common part as an overlap, once per pair',
]

export const PSEUDOCODE_HEADINGS = [0, 6, 18]
