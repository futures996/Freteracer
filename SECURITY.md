# Política de Segurança

A segurança do Freteracer é uma prioridade. Valorizamos a proteção dos dados de usuários, transportadoras, caminhoneiros, parceiros e da integridade dos contratos e fluxos financeiros do sistema.

Se você identificar uma vulnerabilidade de segurança em qualquer parte do projeto, por favor, reporte de forma privada e confidencial. Não publique detalhes da falha em issues públicas até que ela tenha sido avaliada e corrigida.

## Versões com suporte

A tabela abaixo indica as versões que recebem correções de segurança ativas. Caso sua versão não esteja listada, considere-a não suportada e atualize para a versão mais recente antes de reportar qualquer problema.

| Versão | Status | Observações |
| ------- | ------ | ---------- |
| Última versão estável | :white_check_mark: | Recebe correções de segurança e atualizações de manutenção |
| Versão anterior estável | :white_check_mark: | Recebe correções de segurança críticas e de alto impacto |
| Versões antigas | :x: | Não recebem suporte de segurança; recomenda-se atualizar imediatamente |
| Versões em desenvolvimento / branch de teste | :warning: | Podem conter falhas ainda não tratadas e não são consideradas estáveis |

> Se você não tiver certeza de qual versão está usando, consulte o repositório, o changelog ou o ambiente em produção antes de reportar uma vulnerabilidade.

## Como reportar uma vulnerabilidade

Para relatar uma falha de segurança, siga as etapas abaixo:

1. Não crie uma issue pública para divulgar a vulnerabilidade.
2. Envie o relatório por e-mail para:
   security@freteracer.com
3. Alternativamente, utilize a funcionalidade de Security Advisories do GitHub, caso esteja habilitada para este repositório.
4. Inclua o máximo de informações relevantes, como:
   - descrição da vulnerabilidade;
   - impacto esperado;
   - passos para reprodução;
   - versão afetada;
   - ambiente (produção, desenvolvimento, teste);
   - logs, prints de tela ou exemplos de payloads, se aplicável.

## O que esperar após o envio

Após receber o relatório, seguimos este processo:

- confirmação inicial em até 5 dias úteis;
- avaliação da vulnerabilidade em até 10 a 15 dias úteis;
- confirmação de aceitação ou rejeição da falha;
- comunicação da correção quando aprovada;
- coordenação de divulgação pública, quando necessário e após a correção estar disponível.

## Critérios de aceitação

Uma falha será considerada vulnerabilidade quando puder ser demonstrada como:
- capaz de comprometer dados sensíveis;
- capaz de permitir acesso não autorizado;
- capaz de manipular fluxos financeiros ou regras de negócio;
- capaz de explorar contratos inteligentes, APIs, autenticação, autorização ou integrações externas;
- capaz de causar indisponibilidade ou manipulação de transações importantes.

## Critérios de não divulgação

Não serão aceitos como reportes de segurança:
- testes de fuzzing sem impacto demonstrado;
- denúncias sem reprodução clara;
- exploração de comportamento já documentado e intencional;
- falhas em dependências de terceiros sem confirmação de impacto direto no projeto.

## Política de recompensa e tratamento

Este projeto não oferece recompensa financeira por relatórios de segurança no momento. O foco principal é a colaboração responsável para mitigar riscos e proteger usuários e parceiros.

Agradecemos a contribuição de pesquisadores, usuários e desenvolvedores que ajudam a manter o Freteracer seguro.

## Comunicação pública

Quando a vulnerabilidade for validada e corrigida, a divulgação pública será feita apenas após a correção ser aplicada e confirmada. Em casos de risco crítico, podemos agir rapidamente para mitigar o impacto antes da publicação pública.

Se você tiver qualquer dúvida sobre o processo de segurança, entre em contato via e-mail de segurança ou pelo canal privado disponibilizado pelo repositório.
