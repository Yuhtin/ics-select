# External diagram credits

Imagens de referência usadas no slide deck `deploy-journey`. Todas vêm de docs/blogs oficiais ou de fontes técnicas amplamente citadas. Mantidas para fins educacionais em aula privada de preparação técnica.

Se uma dessas imagens for republicada (PR público, post de blog, etc), confirme a licença antes de empurrar.

| Arquivo | Fonte | Página original |
|---|---|---|
| `containers-vs-vms.png` | Imagem clássica "Containers vs VMs" — origem comum em material da Docker e da comunidade | (referência manual via image-cache) |
| `docker-layer-cache.png` | Docker docs · Build cache | https://docs.docker.com/build/guide/layers/ |
| `docker-layer-cache-invalidated.png` | Docker docs · Build cache (invalidação) | https://docs.docker.com/build/guide/layers/ |
| `docker-bridge-network.png` | DEV Community · Understanding Docker's Default Bridge Network (zaheetdev) | https://dev.to/zaheetdev/understanding-dockers-default-bridge-network-with-diagram-4nno |
| `aws-ec2-iam-role.png` | AWS IAM User Guide · "Use an IAM role to grant permissions to applications running on Amazon EC2 instances" | https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2.html |
| `aws-shared-responsibility.jpg` | AWS · Shared Responsibility Model (canônico) | https://aws.amazon.com/compliance/shared-responsibility-model/ |
| `vercel-dashboard.png` | Vercel blog · Dashboard redesign — Projects overview | https://vercel.com/blog/dashboard-redesign |
| `supabase-studio.png` | Supabase blog · Supabase Studio launch | https://supabase.com/blog/supabase-studio |
| `github-actions-workflow.png` | GitHub Changelog · GitHub Actions Workflow visualization | https://github.blog/changelog/2020-12-08-github-actions-workflow-visualization/ |

## Como buscar mais imagens

Padrão: WebSearch + WebFetch direcionados a docs oficiais (`docs.docker.com`, `docs.aws.amazon.com`, blogs de produto). Quando a página retorna URLs de imagem, baixar com `curl -L -H "User-Agent: Mozilla/5.0"` e verificar com `file` que veio PNG/JPG e não HTML 404. Salvar aqui em `/external/` com nome descritivo.
