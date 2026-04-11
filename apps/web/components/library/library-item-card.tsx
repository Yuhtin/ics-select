import { Card, CardBody, Chip } from '@heroui/react';
import Link from 'next/link';

export type LibraryItemCardProps = {
  id: string;
  title: string;
  url: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  tags: string[];
  source: string | null;
};

export function LibraryItemCard(props: LibraryItemCardProps) {
  return (
    <Card as={Link} href={`/admin/library/${props.id}`} isPressable className="w-full">
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{props.title}</h3>
          <Chip size="sm" variant="flat">{props.format}</Chip>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          {props.source && <span>{props.source}</span>}
          <span>•</span>
          <span>{props.estimatedMinutes} min</span>
          <span>•</span>
          <span>{props.difficulty}</span>
        </div>
        {props.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {props.tags.map((t) => (
              <Chip key={t} size="sm" variant="flat" color="default">
                {t}
              </Chip>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
