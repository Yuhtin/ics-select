'use client';

import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react';
import { useState } from 'react';
import { getAccessToken } from '../../lib/api/client';

type Msg = { role: 'user' | 'assistant'; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function ContextChat({ memberId }: { memberId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const newMessages: Msg[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE}/members/${memberId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken() ?? ''}`,
        },
        body: JSON.stringify({ messages: newMessages }),
        credentials: 'include',
      });
      if (!res.body) throw new Error('no stream body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      setMessages([...newMessages, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              assistant += parsed.token;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistant };
                return copy;
              });
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Chat contextual</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-foreground/60">Faça uma pergunta sobre o membro.</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-md p-2 text-sm ${
                  m.role === 'user' ? 'bg-foreground/10' : 'bg-primary/10'
                }`}
              >
                <span className="mr-1 text-xs font-medium text-foreground/60">
                  {m.role === 'user' ? 'Você' : 'IA'}:
                </span>
                {m.content}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Pergunte algo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !streaming && send()}
          />
          <Button color="primary" isLoading={streaming} onPress={send}>
            Enviar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
