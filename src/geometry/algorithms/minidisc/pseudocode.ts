// Pseudocode for the smallest enclosing disc (de Berg et al., §4.7). Line numbers are the
// 0-based indices used by the recorder in minidisc.ts.

export const MINIDISC_PSEUDOCODE: string[] = [
  'MiniDisc(P)',
  '    Compute a random permutation p_1, …, p_n of P',
  '    Let D_2 be the smallest enclosing disc for {p_1, p_2}',
  '    for i ← 3 to n',
  '        if p_i ∈ D_{i−1}',
  '            then D_i ← D_{i−1}',
  '            else D_i ← MiniDiscWithPoint({p_1, …, p_{i−1}}, p_i)',
  '    return D_n',
  'MiniDiscWithPoint(P, q)',
  '    Let D_1 be the smallest disc with q and p_1 on its boundary',
  '    for j ← 2 to n',
  '        if p_j ∈ D_{j−1}',
  '            then D_j ← D_{j−1}',
  '            else D_j ← MiniDiscWith2Points({p_1, …, p_{j−1}}, p_j, q)',
  '    return D_n',
  'MiniDiscWith2Points(P, q_1, q_2)',
  '    Let D_0 be the smallest disc with q_1 and q_2 on its boundary',
  '    for k ← 1 to n',
  '        if p_k ∈ D_{k−1}',
  '            then D_k ← D_{k−1}',
  '            else D_k ← the disc with q_1, q_2 and p_k on its boundary',
  '    return D_n',
]

export const PSEUDOCODE_HEADINGS = [0, 8, 15]
