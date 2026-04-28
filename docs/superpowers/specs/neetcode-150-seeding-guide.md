---
date: 2026-04-28
source: https://github.com/neetcode-gh/leetcode/blob/main/.problemSiteData.json
---

# NeetCode 150 — Seeding Guide

Dump completo dos 150 problems do NeetCode 150 com mapeamento topic/tracks/difficulty/minutes pronto pra cadastrar no `seed-library.ts` como `format: 'PROBLEM'`.

## Convenções

- `format: 'PROBLEM'` (novo enum value — adicionar no Prisma schema antes de seedar).
- `url`: `https://leetcode.com/problems/<slug>/`
- `source`: `'LeetCode — <pattern>'` (e.g. `'LeetCode — Arrays & Hashing'`)
- `estimatedMinutes`: Easy=30 / Medium=60 / Hard=90
- `difficulty`: LC Easy → EASY, Medium → MEDIUM, Hard → HARD (1-pra-1)
- `tags`: `['practice', 'leetcode', 'lc-<id>', '<pattern-slug>']`
- `topicSlugs`: primary = nosso topic, cover = topics secundários relevantes
- `tracks`: derivado da regra DSA fundamental (`[]`) vs avançada (`[BIG_TECH, COMPETITIVE_PROGRAMMING]`)

## Mapeamento Pattern → Topic

| NeetCode Pattern | Topic Primary | Cover | Tracks |
|---|---|---|---|
| Arrays & Hashing | `array` | hashmap | `[]` |
| Two Pointers | `array` | — | `[]` |
| Sliding Window | `array` | — | `[]` |
| Stack | `array` | — | `[]` |
| Binary Search | `searching` | — | `[]` |
| Linked List | `lists` | — | `[]` |
| Trees | `tree` | — | `[]` |
| Tries | `trie` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Heap / Priority Queue | `heap` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Backtracking | `recursion` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Graphs | `graph` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Advanced Graphs | `graph` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| 1-D Dynamic Programming | `dp` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| 2-D Dynamic Programming | `dp` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Greedy | `greedy` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Intervals | `array` | greedy | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Math & Geometry | `math` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| Bit Manipulation | `bit-manipulation` | — | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |

## Problems (por pattern, agrupados)

### 1-D Dynamic Programming (12)

Primary topic: `dp` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 70 | Climbing Stairs | Easy | 30 | [video](https://youtu.be/Y0lT9Fck7qI) | [LC](https://leetcode.com/problems/climbing-stairs/) |
| 746 | Min Cost Climbing Stairs | Easy | 30 | [video](https://youtu.be/ktmzAZWkEZ0) | [LC](https://leetcode.com/problems/min-cost-climbing-stairs/) |
| 322 | Coin Change | Medium | 60 | [video](https://youtu.be/H9bfqozjoqs) | [LC](https://leetcode.com/problems/coin-change/) |
| 91 | Decode Ways | Medium | 60 | [video](https://youtu.be/6aEyTjOwlJU) | [LC](https://leetcode.com/problems/decode-ways/) |
| 198 | House Robber | Medium | 60 | [video](https://youtu.be/73r3KWiEvyk) | [LC](https://leetcode.com/problems/house-robber/) |
| 213 | House Robber II | Medium | 60 | [video](https://youtu.be/rWAJCfYYOvM) | [LC](https://leetcode.com/problems/house-robber-ii/) |
| 300 | Longest Increasing Subsequence | Medium | 60 | [video](https://youtu.be/cjWnW0hdF1Y) | [LC](https://leetcode.com/problems/longest-increasing-subsequence/) |
| 5 | Longest Palindromic Substring | Medium | 60 | [video](https://youtu.be/XYQecbcd6_c) | [LC](https://leetcode.com/problems/longest-palindromic-substring/) |
| 152 | Maximum Product Subarray | Medium | 60 | [video](https://youtu.be/lXVy6YWFcRM) | [LC](https://leetcode.com/problems/maximum-product-subarray/) |
| 647 | Palindromic Substrings | Medium | 60 | [video](https://youtu.be/4RACzI5-du8) | [LC](https://leetcode.com/problems/palindromic-substrings/) |
| 416 | Partition Equal Subset Sum | Medium | 60 | [video](https://youtu.be/IsvocB5BJhw) | [LC](https://leetcode.com/problems/partition-equal-subset-sum/) |
| 139 | Word Break | Medium | 60 | [video](https://youtu.be/Sx9NNgInc3A) | [LC](https://leetcode.com/problems/word-break/) |

### 2-D Dynamic Programming (11)

Primary topic: `dp` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 309 | Best Time to Buy And Sell Stock With Cooldown | Medium | 60 | [video](https://youtu.be/I7j0F7AHpb8) | [LC](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/) |
| 518 | Coin Change II | Medium | 60 | [video](https://youtu.be/Mjy4hd2xgrs) | [LC](https://leetcode.com/problems/coin-change-ii/) |
| 72 | Edit Distance | Medium | 60 | [video](https://youtu.be/XYi2-LPrwm4) | [LC](https://leetcode.com/problems/edit-distance/) |
| 97 | Interleaving String | Medium | 60 | [video](https://youtu.be/3Rw3p9LrgvE) | [LC](https://leetcode.com/problems/interleaving-string/) |
| 1143 | Longest Common Subsequence | Medium | 60 | [video](https://youtu.be/Ua0GhsJSlWM) | [LC](https://leetcode.com/problems/longest-common-subsequence/) |
| 494 | Target Sum | Medium | 60 | [video](https://youtu.be/g0npyaQtAQM) | [LC](https://leetcode.com/problems/target-sum/) |
| 62 | Unique Paths | Medium | 60 | [video](https://youtu.be/IlEsdxuD4lY) | [LC](https://leetcode.com/problems/unique-paths/) |
| 312 | Burst Balloons | Hard | 90 | [video](https://youtu.be/VFskby7lUbw) | [LC](https://leetcode.com/problems/burst-balloons/) |
| 115 | Distinct Subsequences | Hard | 90 | [video](https://youtu.be/-RDzMJ33nx8) | [LC](https://leetcode.com/problems/distinct-subsequences/) |
| 329 | Longest Increasing Path In a Matrix | Hard | 90 | [video](https://youtu.be/wCc_nd-GiEc) | [LC](https://leetcode.com/problems/longest-increasing-path-in-a-matrix/) |
| 10 | Regular Expression Matching | Hard | 90 | [video](https://youtu.be/HAA8mgxlov8) | [LC](https://leetcode.com/problems/regular-expression-matching/) |

### Advanced Graphs (6)

Primary topic: `graph` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 787 | Cheapest Flights Within K Stops | Medium | 60 | [video](https://youtu.be/5eIK3zUdYmE) | [LC](https://leetcode.com/problems/cheapest-flights-within-k-stops/) |
| 1584 | Min Cost to Connect All Points | Medium | 60 | [video](https://youtu.be/f7JOBJIC-NA) | [LC](https://leetcode.com/problems/min-cost-to-connect-all-points/) |
| 743 | Network Delay Time | Medium | 60 | [video](https://youtu.be/EaphyqKU4PQ) | [LC](https://leetcode.com/problems/network-delay-time/) |
| 269 | Alien Dictionary | Hard | 90 | [video](https://youtu.be/6kTZYvNNyps) | [LC](https://leetcode.com/problems/alien-dictionary/) |
| 332 | Reconstruct Itinerary | Hard | 90 | [video](https://youtu.be/ZyB_gQ8vqGA) | [LC](https://leetcode.com/problems/reconstruct-itinerary/) |
| 778 | Swim In Rising Water | Hard | 90 | [video](https://youtu.be/amvrKlMLuGY) | [LC](https://leetcode.com/problems/swim-in-rising-water/) |

### Arrays & Hashing (9)

Primary topic: `array` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 217 | Contains Duplicate | Easy | 30 | [video](https://youtu.be/3OamzN90kPg) | [LC](https://leetcode.com/problems/contains-duplicate/) |
| 1 | Two Sum | Easy | 30 | [video](https://youtu.be/KLlXCFG5TnA) | [LC](https://leetcode.com/problems/two-sum/) |
| 242 | Valid Anagram | Easy | 30 | [video](https://youtu.be/9UtInBqnCgA) | [LC](https://leetcode.com/problems/valid-anagram/) |
| 271 | Encode and Decode Strings | Medium | 60 | [video](https://youtu.be/B1k_sxOSgv8) | [LC](https://leetcode.com/problems/encode-and-decode-strings/) |
| 49 | Group Anagrams | Medium | 60 | [video](https://youtu.be/vzdNOK2oB2E) | [LC](https://leetcode.com/problems/group-anagrams/) |
| 128 | Longest Consecutive Sequence | Medium | 60 | [video](https://youtu.be/P6RZZMu_maU) | [LC](https://leetcode.com/problems/longest-consecutive-sequence/) |
| 238 | Product of Array Except Self | Medium | 60 | [video](https://youtu.be/bNvIQI2wAjk) | [LC](https://leetcode.com/problems/product-of-array-except-self/) |
| 347 | Top K Frequent Elements | Medium | 60 | [video](https://youtu.be/YPTqKIgVk-k) | [LC](https://leetcode.com/problems/top-k-frequent-elements/) |
| 36 | Valid Sudoku | Medium | 60 | [video](https://youtu.be/TjFXEUCMqI8) | [LC](https://leetcode.com/problems/valid-sudoku/) |

### Backtracking (9)

Primary topic: `recursion` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 39 | Combination Sum | Medium | 60 | [video](https://youtu.be/GBKI9VSKdGg) | [LC](https://leetcode.com/problems/combination-sum/) |
| 40 | Combination Sum II | Medium | 60 | [video](https://youtu.be/rSA3t6BDDwg) | [LC](https://leetcode.com/problems/combination-sum-ii/) |
| 17 | Letter Combinations of a Phone Number | Medium | 60 | [video](https://youtu.be/0snEunUacZY) | [LC](https://leetcode.com/problems/letter-combinations-of-a-phone-number/) |
| 131 | Palindrome Partitioning | Medium | 60 | [video](https://youtu.be/3jvWodd7ht0) | [LC](https://leetcode.com/problems/palindrome-partitioning/) |
| 46 | Permutations | Medium | 60 | [video](https://youtu.be/s7AvT7cGdSo) | [LC](https://leetcode.com/problems/permutations/) |
| 78 | Subsets | Medium | 60 | [video](https://youtu.be/REOH22Xwdkk) | [LC](https://leetcode.com/problems/subsets/) |
| 90 | Subsets II | Medium | 60 | [video](https://youtu.be/Vn2v6ajA7U0) | [LC](https://leetcode.com/problems/subsets-ii/) |
| 79 | Word Search | Medium | 60 | [video](https://youtu.be/pfiQ_PS1g8E) | [LC](https://leetcode.com/problems/word-search/) |
| 51 | N Queens | Hard | 90 | [video](https://youtu.be/Ph95IHmRp5M) | [LC](https://leetcode.com/problems/n-queens/) |

### Binary Search (7)

Primary topic: `searching` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 704 | Binary Search | Easy | 30 | [video](https://youtu.be/s4DPM8ct1pI) | [LC](https://leetcode.com/problems/binary-search/) |
| 153 | Find Minimum In Rotated Sorted Array | Medium | 60 | [video](https://youtu.be/nIVW4P8b1VA) | [LC](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) |
| 875 | Koko Eating Bananas | Medium | 60 | [video](https://youtu.be/U2SozAs9RzA) | [LC](https://leetcode.com/problems/koko-eating-bananas/) |
| 33 | Search In Rotated Sorted Array | Medium | 60 | [video](https://youtu.be/U8XENwh8Oy8) | [LC](https://leetcode.com/problems/search-in-rotated-sorted-array/) |
| 74 | Search a 2D Matrix | Medium | 60 | [video](https://youtu.be/Ber2pi2C0j0) | [LC](https://leetcode.com/problems/search-a-2d-matrix/) |
| 981 | Time Based Key Value Store | Medium | 60 | [video](https://youtu.be/fu2cD_6E8Hw) | [LC](https://leetcode.com/problems/time-based-key-value-store/) |
| 4 | Median of Two Sorted Arrays | Hard | 90 | [video](https://youtu.be/q6IEA26hvXc) | [LC](https://leetcode.com/problems/median-of-two-sorted-arrays/) |

### Bit Manipulation (7)

Primary topic: `bit-manipulation` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 338 | Counting Bits | Easy | 30 | [video](https://youtu.be/RyBM56RIWrM) | [LC](https://leetcode.com/problems/counting-bits/) |
| 268 | Missing Number | Easy | 30 | [video](https://youtu.be/WnPLSRLSANE) | [LC](https://leetcode.com/problems/missing-number/) |
| 191 | Number of 1 Bits | Easy | 30 | [video](https://youtu.be/5Km3utixwZs) | [LC](https://leetcode.com/problems/number-of-1-bits/) |
| 190 | Reverse Bits | Easy | 30 | [video](https://youtu.be/UcoN6UjAI64) | [LC](https://leetcode.com/problems/reverse-bits/) |
| 136 | Single Number | Easy | 30 | [video](https://youtu.be/qMPX1AOa83k) | [LC](https://leetcode.com/problems/single-number/) |
| 7 | Reverse Integer | Medium | 60 | [video](https://youtu.be/HAgLH58IgJQ) | [LC](https://leetcode.com/problems/reverse-integer/) |
| 371 | Sum of Two Integers | Medium | 60 | [video](https://youtu.be/gVUrDV4tZfY) | [LC](https://leetcode.com/problems/sum-of-two-integers/) |

### Graphs (13)

Primary topic: `graph` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 133 | Clone Graph | Medium | 60 | [video](https://youtu.be/mQeF6bN8hMk) | [LC](https://leetcode.com/problems/clone-graph/) |
| 207 | Course Schedule | Medium | 60 | [video](https://youtu.be/EgI5nU9etnU) | [LC](https://leetcode.com/problems/course-schedule/) |
| 210 | Course Schedule II | Medium | 60 | [video](https://youtu.be/Akt3glAwyfY) | [LC](https://leetcode.com/problems/course-schedule-ii/) |
| 261 | Graph Valid Tree | Medium | 60 | [video](https://youtu.be/bXsUuownnoQ) | [LC](https://leetcode.com/problems/graph-valid-tree/) |
| 695 | Max Area of Island | Medium | 60 | [video](https://youtu.be/iJGr1OtmH0c) | [LC](https://leetcode.com/problems/max-area-of-island/) |
| 323 | Number of Connected Components In An Undirected Graph | Medium | 60 | [video](https://youtu.be/8f1XPm4WOUc) | [LC](https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/) |
| 200 | Number of Islands | Medium | 60 | [video](https://youtu.be/pV2kpPD66nE) | [LC](https://leetcode.com/problems/number-of-islands/) |
| 417 | Pacific Atlantic Water Flow | Medium | 60 | [video](https://youtu.be/s-VkcjHqkGI) | [LC](https://leetcode.com/problems/pacific-atlantic-water-flow/) |
| 684 | Redundant Connection | Medium | 60 | [video](https://youtu.be/FXWRE67PLL0) | [LC](https://leetcode.com/problems/redundant-connection/) |
| 994 | Rotting Oranges | Medium | 60 | [video](https://youtu.be/y704fEOx0s0) | [LC](https://leetcode.com/problems/rotting-oranges/) |
| 130 | Surrounded Regions | Medium | 60 | [video](https://youtu.be/9z2BunfoZ5Y) | [LC](https://leetcode.com/problems/surrounded-regions/) |
| 286 | Walls And Gates | Medium | 60 | [video](https://youtu.be/e69C6xhiSQE) | [LC](https://leetcode.com/problems/walls-and-gates/) |
| 127 | Word Ladder | Hard | 90 | [video](https://youtu.be/h9iTnkgv05E) | [LC](https://leetcode.com/problems/word-ladder/) |

### Greedy (8)

Primary topic: `greedy` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 134 | Gas Station | Medium | 60 | [video](https://youtu.be/lJwbPZGo05A) | [LC](https://leetcode.com/problems/gas-station/) |
| 846 | Hand of Straights | Medium | 60 | [video](https://youtu.be/amnrMCVd2YI) | [LC](https://leetcode.com/problems/hand-of-straights/) |
| 55 | Jump Game | Medium | 60 | [video](https://youtu.be/Yan0cv2cLy8) | [LC](https://leetcode.com/problems/jump-game/) |
| 45 | Jump Game II | Medium | 60 | [video](https://youtu.be/dJ7sWiOoK7g) | [LC](https://leetcode.com/problems/jump-game-ii/) |
| 53 | Maximum Subarray | Medium | 60 | [video](https://youtu.be/5WZl3MMT0Eg) | [LC](https://leetcode.com/problems/maximum-subarray/) |
| 1899 | Merge Triplets to Form Target Triplet | Medium | 60 | [video](https://youtu.be/kShkQLQZ9K4) | [LC](https://leetcode.com/problems/merge-triplets-to-form-target-triplet/) |
| 763 | Partition Labels | Medium | 60 | [video](https://youtu.be/B7m8UmZE-vw) | [LC](https://leetcode.com/problems/partition-labels/) |
| 678 | Valid Parenthesis String | Medium | 60 | [video](https://youtu.be/QhPdNS143Qg) | [LC](https://leetcode.com/problems/valid-parenthesis-string/) |

### Heap / Priority Queue (7)

Primary topic: `heap` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 703 | Kth Largest Element In a Stream | Easy | 30 | [video](https://youtu.be/hOjcdrqMoQ8) | [LC](https://leetcode.com/problems/kth-largest-element-in-a-stream/) |
| 1046 | Last Stone Weight | Easy | 30 | [video](https://youtu.be/B-QCq79-Vfw) | [LC](https://leetcode.com/problems/last-stone-weight/) |
| 355 | Design Twitter | Medium | 60 | [video](https://youtu.be/pNichitDD2E) | [LC](https://leetcode.com/problems/design-twitter/) |
| 973 | K Closest Points to Origin | Medium | 60 | [video](https://youtu.be/rI2EBUEMfTk) | [LC](https://leetcode.com/problems/k-closest-points-to-origin/) |
| 215 | Kth Largest Element In An Array | Medium | 60 | [video](https://youtu.be/XEmy13g1Qxc) | [LC](https://leetcode.com/problems/kth-largest-element-in-an-array/) |
| 621 | Task Scheduler | Medium | 60 | [video](https://youtu.be/s8p8ukTyA2I) | [LC](https://leetcode.com/problems/task-scheduler/) |
| 295 | Find Median From Data Stream | Hard | 90 | [video](https://youtu.be/itmhHWaHupI) | [LC](https://leetcode.com/problems/find-median-from-data-stream/) |

### Intervals (6)

Primary topic: `array` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 252 | Meeting Rooms | Easy | 30 | [video](https://youtu.be/PaJxqZVPhbg) | [LC](https://leetcode.com/problems/meeting-rooms/) |
| 57 | Insert Interval | Medium | 60 | [video](https://youtu.be/A8NUOmlwOlM) | [LC](https://leetcode.com/problems/insert-interval/) |
| 253 | Meeting Rooms II | Medium | 60 | [video](https://youtu.be/FdzJmTCVyJU) | [LC](https://leetcode.com/problems/meeting-rooms-ii/) |
| 56 | Merge Intervals | Medium | 60 | [video](https://youtu.be/44H3cEC2fFM) | [LC](https://leetcode.com/problems/merge-intervals/) |
| 435 | Non Overlapping Intervals | Medium | 60 | [video](https://youtu.be/nONCGxWoUfM) | [LC](https://leetcode.com/problems/non-overlapping-intervals/) |
| 1851 | Minimum Interval to Include Each Query | Hard | 90 | [video](https://youtu.be/5hQ5WWW5awQ) | [LC](https://leetcode.com/problems/minimum-interval-to-include-each-query/) |

### Linked List (11)

Primary topic: `lists` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 141 | Linked List Cycle | Easy | 30 | [video](https://youtu.be/gBTe7lFR3vc) | [LC](https://leetcode.com/problems/linked-list-cycle/) |
| 21 | Merge Two Sorted Lists | Easy | 30 | [video](https://youtu.be/XIdigk956u0) | [LC](https://leetcode.com/problems/merge-two-sorted-lists/) |
| 206 | Reverse Linked List | Easy | 30 | [video](https://youtu.be/G0_I-ZF0S38) | [LC](https://leetcode.com/problems/reverse-linked-list/) |
| 2 | Add Two Numbers | Medium | 60 | [video](https://youtu.be/wgFPrzTjm7s) | [LC](https://leetcode.com/problems/add-two-numbers/) |
| 138 | Copy List With Random Pointer | Medium | 60 | [video](https://youtu.be/5Y2EiZST97Y) | [LC](https://leetcode.com/problems/copy-list-with-random-pointer/) |
| 287 | Find The Duplicate Number | Medium | 60 | [video](https://youtu.be/wjYnzkAhcNk) | [LC](https://leetcode.com/problems/find-the-duplicate-number/) |
| 146 | LRU Cache | Medium | 60 | [video](https://youtu.be/7ABFKPK2hD4) | [LC](https://leetcode.com/problems/lru-cache/) |
| 19 | Remove Nth Node From End of List | Medium | 60 | [video](https://youtu.be/XVuQxVej6y8) | [LC](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) |
| 143 | Reorder List | Medium | 60 | [video](https://youtu.be/S5bfdUTrKLM) | [LC](https://leetcode.com/problems/reorder-list/) |
| 23 | Merge K Sorted Lists | Hard | 90 | [video](https://youtu.be/q5a5OiGbT6Q) | [LC](https://leetcode.com/problems/merge-k-sorted-lists/) |
| 25 | Reverse Nodes In K Group | Hard | 90 | [video](https://youtu.be/1UOPsfP85V4) | [LC](https://leetcode.com/problems/reverse-nodes-in-k-group/) |

### Math & Geometry (8)

Primary topic: `math` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 202 | Happy Number | Easy | 30 | [video](https://youtu.be/ljz85bxOYJ0) | [LC](https://leetcode.com/problems/happy-number/) |
| 66 | Plus One | Easy | 30 | [video](https://youtu.be/jIaA8boiG1s) | [LC](https://leetcode.com/problems/plus-one/) |
| 2013 | Detect Squares | Medium | 60 | [video](https://youtu.be/bahebearrDc) | [LC](https://leetcode.com/problems/detect-squares/) |
| 43 | Multiply Strings | Medium | 60 | [video](https://youtu.be/1vZswirL8Y8) | [LC](https://leetcode.com/problems/multiply-strings/) |
| 50 | Pow(x, n) | Medium | 60 | [video](https://youtu.be/g9YQyYi4IQQ) | [LC](https://leetcode.com/problems/powx-n/) |
| 48 | Rotate Image | Medium | 60 | [video](https://youtu.be/fMSJSS7eO1w) | [LC](https://leetcode.com/problems/rotate-image/) |
| 73 | Set Matrix Zeroes | Medium | 60 | [video](https://youtu.be/T41rL0L3Pnw) | [LC](https://leetcode.com/problems/set-matrix-zeroes/) |
| 54 | Spiral Matrix | Medium | 60 | [video](https://youtu.be/BJnMZNwUk1M) | [LC](https://leetcode.com/problems/spiral-matrix/) |

### Sliding Window (6)

Primary topic: `array` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 121 | Best Time to Buy And Sell Stock | Easy | 30 | [video](https://youtu.be/1pkOgXD63yU) | [LC](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/) |
| 424 | Longest Repeating Character Replacement | Medium | 60 | [video](https://youtu.be/gqXU1UyA8pk) | [LC](https://leetcode.com/problems/longest-repeating-character-replacement/) |
| 3 | Longest Substring Without Repeating Characters | Medium | 60 | [video](https://youtu.be/wiGpQwVHdE0) | [LC](https://leetcode.com/problems/longest-substring-without-repeating-characters/) |
| 567 | Permutation In String | Medium | 60 | [video](https://youtu.be/UbyhOgBN834) | [LC](https://leetcode.com/problems/permutation-in-string/) |
| 76 | Minimum Window Substring | Hard | 90 | [video](https://youtu.be/jSto0O4AJbM) | [LC](https://leetcode.com/problems/minimum-window-substring/) |
| 239 | Sliding Window Maximum | Hard | 90 | [video](https://youtu.be/DfljaUwZsOk) | [LC](https://leetcode.com/problems/sliding-window-maximum/) |

### Stack (7)

Primary topic: `array` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 20 | Valid Parentheses | Easy | 30 | [video](https://youtu.be/WTzjTskDFMg) | [LC](https://leetcode.com/problems/valid-parentheses/) |
| 853 | Car Fleet | Medium | 60 | [video](https://youtu.be/Pr6T-3yB9RM) | [LC](https://leetcode.com/problems/car-fleet/) |
| 739 | Daily Temperatures | Medium | 60 | [video](https://youtu.be/cTBiBSnjO3c) | [LC](https://leetcode.com/problems/daily-temperatures/) |
| 150 | Evaluate Reverse Polish Notation | Medium | 60 | [video](https://youtu.be/iu0082c4HDE) | [LC](https://leetcode.com/problems/evaluate-reverse-polish-notation/) |
| 22 | Generate Parentheses | Medium | 60 | [video](https://youtu.be/s9fokUqJ76A) | [LC](https://leetcode.com/problems/generate-parentheses/) |
| 155 | Min Stack | Medium | 60 | [video](https://youtu.be/qkLl7nAwDPo) | [LC](https://leetcode.com/problems/min-stack/) |
| 84 | Largest Rectangle In Histogram | Hard | 90 | [video](https://youtu.be/zx5Sw9130L0) | [LC](https://leetcode.com/problems/largest-rectangle-in-histogram/) |

### Trees (15)

Primary topic: `tree` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 110 | Balanced Binary Tree | Easy | 30 | [video](https://youtu.be/QfJsau0ItOY) | [LC](https://leetcode.com/problems/balanced-binary-tree/) |
| 543 | Diameter of Binary Tree | Easy | 30 | [video](https://youtu.be/bkxqA8Rfv04) | [LC](https://leetcode.com/problems/diameter-of-binary-tree/) |
| 226 | Invert Binary Tree | Easy | 30 | [video](https://youtu.be/OnSn2XEQ4MY) | [LC](https://leetcode.com/problems/invert-binary-tree/) |
| 104 | Maximum Depth of Binary Tree | Easy | 30 | [video](https://youtu.be/hTM3phVI6YQ) | [LC](https://leetcode.com/problems/maximum-depth-of-binary-tree/) |
| 100 | Same Tree | Easy | 30 | [video](https://youtu.be/vRbbcKXCxOw) | [LC](https://leetcode.com/problems/same-tree/) |
| 572 | Subtree of Another Tree | Easy | 30 | [video](https://youtu.be/E36O5SWp-LE) | [LC](https://leetcode.com/problems/subtree-of-another-tree/) |
| 102 | Binary Tree Level Order Traversal | Medium | 60 | [video](https://youtu.be/6ZnyEApgFYg) | [LC](https://leetcode.com/problems/binary-tree-level-order-traversal/) |
| 199 | Binary Tree Right Side View | Medium | 60 | [video](https://youtu.be/d4zLyf32e3I) | [LC](https://leetcode.com/problems/binary-tree-right-side-view/) |
| 105 | Construct Binary Tree From Preorder And Inorder Traversal | Medium | 60 | [video](https://youtu.be/ihj4IQGZ2zc) | [LC](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) |
| 1448 | Count Good Nodes In Binary Tree | Medium | 60 | [video](https://youtu.be/7cp5imvDzl4) | [LC](https://leetcode.com/problems/count-good-nodes-in-binary-tree/) |
| 230 | Kth Smallest Element In a Bst | Medium | 60 | [video](https://youtu.be/5LUXSvjmGCw) | [LC](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) |
| 235 | Lowest Common Ancestor of a Binary Search Tree | Medium | 60 | [video](https://youtu.be/gs2LMfuOR9k) | [LC](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) |
| 98 | Validate Binary Search Tree | Medium | 60 | [video](https://youtu.be/s6ATEkipzow) | [LC](https://leetcode.com/problems/validate-binary-search-tree/) |
| 124 | Binary Tree Maximum Path Sum | Hard | 90 | [video](https://youtu.be/Hr5cWUld4vU) | [LC](https://leetcode.com/problems/binary-tree-maximum-path-sum/) |
| 297 | Serialize And Deserialize Binary Tree | Hard | 90 | [video](https://youtu.be/u4JAi2JJhI8) | [LC](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) |

### Tries (3)

Primary topic: `trie` · Tracks: `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 211 | Design Add And Search Words Data Structure | Medium | 60 | [video](https://youtu.be/BTf05gs_8iU) | [LC](https://leetcode.com/problems/design-add-and-search-words-data-structure/) |
| 208 | Implement Trie Prefix Tree | Medium | 60 | [video](https://youtu.be/oobqoCJlHA0) | [LC](https://leetcode.com/problems/implement-trie-prefix-tree/) |
| 212 | Word Search II | Hard | 90 | [video](https://youtu.be/asbcE9mZz_U) | [LC](https://leetcode.com/problems/word-search-ii/) |

### Two Pointers (5)

Primary topic: `array` · Tracks: `[]`

| LC | Title | Diff | Min | Video | URL |
|---|---|---|---|---|---|
| 125 | Valid Palindrome | Easy | 30 | [video](https://youtu.be/jJXJ16kPFWg) | [LC](https://leetcode.com/problems/valid-palindrome/) |
| 15 | 3Sum | Medium | 60 | [video](https://youtu.be/jzZsG8n2R9A) | [LC](https://leetcode.com/problems/3sum/) |
| 11 | Container With Most Water | Medium | 60 | [video](https://youtu.be/UuiTKBwPgAo) | [LC](https://leetcode.com/problems/container-with-most-water/) |
| 167 | Two Sum II Input Array Is Sorted | Medium | 60 | [video](https://youtu.be/cQ1Oz4ckceM) | [LC](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/) |
| 42 | Trapping Rain Water | Hard | 90 | [video](https://youtu.be/ZI2z5pq0TqA) | [LC](https://leetcode.com/problems/trapping-rain-water/) |

## Totais

- 150 problems
- Tempo total estimado: **8790 min** (146h)
- Easy: 28 · Medium: 101 · Hard: 21

## Próximas etapas

1. **Plumbing** (PR separado): adicionar `PROBLEM` ao `ItemFormat` enum em `packages/prisma/prisma/schema.prisma`, gerar migration, expor no select do `item-form-modal.tsx`.
2. **Seed em batches por pattern**: começar por `Arrays & Hashing` (9 problems, todos universal — Lorena precisa). Depois Linked List, Trees, Stack, Binary Search.
3. **Avançadas (`heap`/`graph`/`dp`/`greedy`/`recursion` etc)**: cadastrar mas só aparecem pra `BIG_TECH` + `COMPETITIVE_PROGRAMMING`.
4. **Pareamento com videos NeetCode**: cada problem tem `video` no JSON (YouTube ID do walkthrough). Pode virar item PROBLEM com `<video-id>` referenciado no `description` ou item VIDEO separado pareado.
5. **Regra do AI**: `DraftPlanService` ganha cláusula "COMPETITIVE_PROGRAMMING members must have ≥2 PROBLEM items per week" no system prompt.