import type { Topic } from '../queries/admin-topics';

export type TopicCategory =
  | 'Data Structures & Algorithms'
  | 'Infra & DevOps'
  | 'System Components'
  | 'Principles'
  | 'Cases'
  | 'Other';

export function topicCategory(order: number): TopicCategory {
  if (order < 20) return 'Data Structures & Algorithms';
  if (order < 30) return 'Infra & DevOps';
  if (order < 40) return 'System Components';
  if (order < 50) return 'Principles';
  if (order < 60) return 'Cases';
  return 'Other';
}

export const TOPIC_CATEGORY_ORDER: TopicCategory[] = [
  'Data Structures & Algorithms',
  'Infra & DevOps',
  'System Components',
  'Principles',
  'Cases',
  'Other',
];

export type GroupedTopics = Array<{
  category: TopicCategory;
  topics: Topic[];
}>;

export function groupTopicsByCategory(topics: Topic[]): GroupedTopics {
  const byCat = new Map<TopicCategory, Topic[]>();
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  for (const t of sorted) {
    const cat = topicCategory(t.order);
    const arr = byCat.get(cat) ?? [];
    arr.push(t);
    byCat.set(cat, arr);
  }
  return TOPIC_CATEGORY_ORDER
    .filter((c) => byCat.has(c))
    .map((c) => ({ category: c, topics: byCat.get(c)! }));
}
