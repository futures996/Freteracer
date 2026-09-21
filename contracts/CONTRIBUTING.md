# Contribuindo

Obrigado por contribuir com o FreteRacer. Este documento descreve o fluxo mínimo para executar, validar e propor mudanças no projeto.

## Pré-requisitos

- Node.js 20 ou superior;
- npm 10 ou superior;
- Git;
- Para alterações nos contratos EVM: Foundry (`forge`) ou a ferramenta definida pelo módulo de contratos.

## Como executar localmente

Na raiz do repositório:

```bash
npm ci
npm run dev
```

A aplicação ficará disponível no endereço exibido pelo Vite, normalmente `http://localhost:5173`.

Antes de abrir um Pull Request, execute:

```bash
npm run check
npm run build
npm run test -- --run
```

Se o ambiente não tiver `package-lock.json` atualizado, use `npm install` uma única vez e envie o lockfile atualizado somente quando a alteração for intencional.

## Contratos inteligentes

O repositório contém código de frontend Svelte/TypeScript e contratos Solidity em `contracts/`. Alterações no contrato devem ser acompanhadas por testes automatizados e documentação sobre a rede utilizada.

Antes de testar ou publicar um contrato:

1. confirme a rede e o endereço RPC;
2. nunca use chaves privadas reais em código, commits ou arquivos versionados;
3. compile e teste localmente;
4. valide o fluxo em testnet;
5. solicite revisão independente antes de usar valores reais.

Caso o projeto também utilize componentes específicos da rede Ergo, mantenha esses componentes separados dos contratos Solidity/EVM e documente claramente qual carteira, SDK e rede cada módulo utiliza. Não misture APIs EVM e Ergo no mesmo fluxo de execução.

## Como contribuir

### Issues

Abra uma issue descrevendo:

- o problema ou a proposta;
- os passos para reproduzir o problema;
- o comportamento esperado e o observado;
- a rede, navegador, sistema operacional e versão do Node.js, quando aplicável;
- logs ou mensagens de erro sem incluir segredos.

Use os templates disponíveis quando houver um template adequado.

### Branches

Crie uma branch descritiva a partir da branch padrão:

- `feature/descricao-curta` para funcionalidades;
- `fix/descricao-curta` para correções;
- `docs/descricao-curta` para documentação;
- `test/descricao-curta` para testes.

Exemplo:

```bash
git switch -c fix/ci-frontend
```

### Commits

Use mensagens claras, atômicas e no formato Conventional Commits:

```text
 tipo(scope): descrição
```

Exemplos:

```text
feat(contracts): add milestone timeout
fix(ci): run Svelte checks in GitHub Actions
docs(contributing): document local setup
```

Evite misturar refatorações, mudanças de interface e alterações de contrato no mesmo commit sem necessidade.

### Pull Requests

Um Pull Request deve:

- explicar o problema e a solução;
- listar as alterações relevantes;
- incluir testes para mudanças de comportamento;
- atualizar a documentação quando necessário;
- informar qualquer alteração de rede, endereço de contrato ou variável de ambiente;
- confirmar que `npm run check`, `npm run build` e `npm run test -- --run` foram executados;
- incluir evidências de testes em testnet para alterações de integração blockchain, quando aplicável.

Não faça merge com verificações obrigatórias quebradas ou com segredos expostos.

## Padrões de código

- **Svelte/TypeScript:** use ESLint e Prettier conforme a configuração do projeto.
- **Solidity:** use Solidity `^0.8.x`, siga as práticas do OpenZeppelin quando aplicável e mantenha validações, eventos e controle de acesso explícitos.
- **Documentação:** escreva em português ou inglês de forma consistente e mantenha exemplos executáveis.
- **Segurança:** valide endereços, valores, permissões, prazos e chamadas externas; use proteção contra reentrância quando houver transferência de ativos.

## Testes

Inclua testes unitários para contratos e testes de integração para fluxos críticos, como:

- criação e financiamento de uma operação;
- conclusão e liberação de marcos;
- disputas, cancelamentos e prazos;
- permissões do proprietário e do transportador;
- falhas de transferência;
- conexão da carteira e submissão de transações no frontend.

A documentação do projeto deve indicar o comando correto para cada conjunto de testes. O CI deve executar automaticamente as verificações do frontend e dos contratos.

## Variáveis de ambiente

Use `.env.example` para documentar nomes de variáveis sem valores sensíveis. Nunca versione:

- chaves privadas ou seed phrases;
- tokens de acesso;
- credenciais de RPC;
- arquivos `.env` reais;
- dados pessoais ou informações de transporte não anonimizadas.

## Relatório de vulnerabilidade

Não abra uma issue pública para uma vulnerabilidade de segurança. Envie o relatório de forma privada para o maintainer de segurança do projeto, usando o canal configurado no GitHub (Security policy/security advisory) ou o e-mail oficial publicado pelo repositório.

O relatório deve incluir:

- descrição do impacto;
- passos de reprodução ou prova de conceito segura;
- versão/commit afetado;
- possível correção, se conhecida.

Aguarde a confirmação antes de divulgar publicamente a vulnerabilidade.
