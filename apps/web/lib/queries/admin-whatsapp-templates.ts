'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type WhatsappTemplate = {
  kind: string;
  template: string;
  enabled: boolean;
  description: string | null;
  variables: string[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export function useWhatsappTemplates() {
  return useQuery({
    queryKey: ['admin', 'whatsapp-templates'],
    queryFn: () => apiFetch<WhatsappTemplate[]>('/admin/whatsapp/templates'),
  });
}

export function useUpdateWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      template?: string;
      enabled?: boolean;
      description?: string | null;
    }) =>
      apiFetch<WhatsappTemplate>(`/admin/whatsapp/templates/${input.kind}`, {
        method: 'PATCH',
        body: JSON.stringify({
          template: input.template,
          enabled: input.enabled,
          description: input.description,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'whatsapp-templates'] });
    },
  });
}
