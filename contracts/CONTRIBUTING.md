# CONTRIBUTING

Obrigado por contribuir com o IA Racon / Rede Racon. Abaixo estão as diretrizes para colaborar de forma eficiente e segura.

## Como contribuir
- **Issues:** abra uma issue descrevendo o problema ou proposta. Use os templates disponíveis.
- **Fork & PR:** faça um fork, crie uma branch com nome descritivo (`feature/`, `fix/`, `docs/`) e submeta um Pull Request.
- **Commits:** mensagens claras e atômicas. Use o formato: `tipo(scope): descrição` (ex.: `feat(contracts): add milestone release`).
- **Revisões:** inclua testes e documentação para mudanças significativas.
- **Segurança:** não inclua chaves privadas, credenciais ou dados sensíveis em commits.

## Padrões de código
- **Solidity:** siga as melhores práticas do OpenZeppelin e use `^0.8.x`.
- **Backend:** lint com ESLint (Node) ou flake8/black (Python).
- **Frontend:** use Prettier e ESLint.

## Testes
- Inclua testes unitários para contratos e integração para fluxos críticos.
- CI executa testes automaticamente via GitHub Actions.

## Relatórios de vulnerabilidade
- Para vulnerabilidades de segurança, envie um e‑mail para o maintainer técnico (adicionar e‑mail) em vez de abrir uma issue pública.
