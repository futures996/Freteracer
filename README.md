# FreteRacer

Plataforma para conectar empresas, transportadoras e caminhoneiros por meio de mini-contratos inteligentes on-chain, com pagamentos auditáveis e controle de garantia, parcelas e liberação de valores por etapa.

Este repositório reúne a interface web do projeto, suporte para interação com carteira digital e a base de contratos inteligentes e documentação de arquitetura da Rede FreteRacer.

## Visão geral

O FreteRacer nasceu para reduzir atrito em operações logísticas usando regras programáveis e rastreáveis em blockchain. A ideia central é permitir que:

- empresas criem acordos com caminhoneiros;
- valores sejam bloqueados em garantia (escrow);
- pagamentos sejam liberados por marcos de entrega;
- o histórico do acordo seja auditável;
- partes recebam ou distribuam valores de forma transparente.

O projeto combina:

- frontend em Svelte/SvelteKit;
- integração com carteira Ergo;
- contratos inteligentes em Solidity na pasta `contracts`;
- documentação de deploy e arquitetura para evolução do sistema.

## Status do projeto

Este repositório está em fase de protótipo / desenvolvimento inicial. A interface atual demonstra interações com carteira e blockchain, enquanto a parte de contratos e regras de negócio continua sendo estruturada e validada.

## Principais funcionalidades

- Web app conectado a carteira digital
- envio de ERG com validação de endereço e valor
- integração com blockchain Ergo
- base para contratos de garantia e pagamentos por etapas
- documentação de deploy em GitHub Pages
- estrutura preparada para evoluir para fluxo completo de mini-contratos logísticos

## Stack tecnológica

- SvelteKit
- TypeScript
- Tailwind CSS
- Vite
- Ergo blockchain tooling
- Solidity (contratos e documentação em `contracts/`)

## Estrutura do repositório

```text
.
├── contracts/                  # contratos inteligentes e documentação de arquitetura
├── src/                       # aplicação frontend
│   ├── lib/                   # utilitários, stores, integrações e componentes compartilhados
│   ├── routes/                # rotas e páginas da aplicação
│   ├── app.css                # estilos globais
│   ├── app.d.ts               # tipagem do app
│   └── app.html               # template HTML base
├── static/                    # assets estáticos
├── .github/                   # workflows e configurações do GitHub
├── .gitignore
├── components.json            # configuração de componentes UI
├── DEPLOY_GUIDE.md            # guia de setup e deploy
├── MCP.md                     # documentação complementar de MCP
├── MCP-DRY.md                 # documentação de referência para o projeto
├── package.json               # scripts e dependências do frontend
├── svelte.config.js           # configuração do SvelteKit
├── tailwind.config.ts         # configuração do Tailwind
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # configuração do Vite
├── README.md                  # documentação principal
└── LICENSE                    # adicionar quando definido
```

## Arquitetura do sistema

### Frontend
A camada web é uma aplicação Svelte que permite:

- conectar carteira;
- consultar saldo e rede;
- enviar transações;
- preparar a base para criação de contratos e acompanhamento de pagamentos.

### Contratos inteligentes
A pasta `contracts/` contém a base da lógica de negócio e documentação de arquitetura para mini-contratos logísticos, incluindo:

- garantia/escrow;
- pagamentos por marco;
- liberações automáticas;
- split payments;
- auditoria e rastreabilidade on-chain.

### Infraestrutura e deploy
O projeto foi preparado para:

- rodar em ambiente local via Vite;
- compilar para build estático;
- publicar em GitHub Pages;
- evoluir para um pacote reutilizável e documentação distribuída.

## Pré-requisitos

Antes de rodar o projeto, você precisa ter instalado:

- Node.js 18+
- npm
- uma carteira compatível com Ergo (ex.: Nautilus)

## Como rodar localmente

1. Clone o repositório:

```bash
git clone https://github.com/futures996/Freteracer.git
cd Freteracer
```

2. Instale as dependências:

```bash
npm install
```

3. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

4. Abra a URL exibida no terminal (normalmente `http://localhost:5173`).

## Scripts disponíveis

No `package.json`, os principais comandos são:

```bash
npm run dev       # ambiente local
npm run build     # build de produção
npm run preview   # preview do build
npm run check     # validação Svelte/TypeScript
npm test          # testes unitários
npm run deploy    # build + publicação em GitHub Pages
```

## Build e deploy

O deploy é configurado para produção estática, com foco em GitHub Pages. A documentação de referência está em `DEPLOY_GUIDE.md`.

Para gerar a build:

```bash
npm run build
```

Para publicar:

```bash
npm run deploy
```

## Segurança e boa prática

- nunca compartilhe chaves privadas;
- valide endereços e montantes antes de confirmar transações;
- mantenha contratos e regras de negócio revisados antes de uso em produção;
- evite gravar dados sensíveis diretamente em blockchain;
- teste em rede de testes antes de qualquer operação com valor real.

## Roadmap sugerido

### MVP
- interface web funcional com carteira
- envio de ERG e confirmação de transação
- estrutura inicial de contratos
- documentação de arquitetura e deploy

### Fase 2
- criação de contratos para garantia e marcos
- integração com pagamentos parcelados
- tracking de operação e auditoria

### Fase 3
- split payments e múltiplas partes
- suporte a gateways fiat
- painel de empresa + fluxo de caminhoneiro

### Fase 4
- revisão de segurança e validação operacional
- produção com rede apropriada e governança definida

## Contribuição

Contribuições são bem-vindas. Para propor mudanças:

1. crie uma branch a partir da principal;
2. implemente a melhoria ou correção;
3. adicione/atualize documentação relevante;
4. abra um pull request com descrição clara do impacto.

## Observação importante

Este repositório é um ponto de partida técnico para a plataforma FreteRacer e sua estrutura ainda está evoluindo. A aplicação atual fornece a base de interações com carteira e blockchain, enquanto os fluxos completos de contrato, pagamento e operações logísticas seguem sendo refinados.

## Licença

A licença do projeto ainda precisa ser definida e registrada em um arquivo `LICENSE` no repositório.

---

Se quiser, posso também transformar esse README em uma versão mais comercial, mais técnica ou em um padrão de GitHub mais enxuto, com badges e seções de onboarding para público externo.
