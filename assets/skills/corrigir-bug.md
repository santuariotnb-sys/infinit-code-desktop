# Skill: Corrigir bug

## Quando usar
Pedidos como: "tá dando erro", "não funciona", "bug", "consertar", "corrigir", "quebrou", "crash"

## Método de investigação (seguir na ordem)

### 1. Ler o erro
- Copiar a mensagem de erro EXATA
- Identificar: arquivo, linha, tipo de erro

### 2. Classificar o erro
| Tipo | Sintoma | Causa comum |
|------|---------|-------------|
| TypeError | "X is undefined/null" | Acessando propriedade de dado que não chegou |
| SyntaxError | "Unexpected token" | Faltou fechar bracket, import errado |
| Runtime | "Cannot read property" | Dado ainda não carregou, falta optional chaining |
| Build | "Module not found" | Import path errado, dependência não instalada |
| Hydration | "Text content mismatch" | Server/client renderizando diferente |
| CORS | "Access-Control-Allow" | Backend não configurou headers |

### 3. Rastrear a causa raiz
- NÃO tratar o sintoma, achar a CAUSA
- Verificar: o dado existe? O tipo está certo? A API retorna o esperado?
- Seguir o fluxo de dados: onde nasce → onde transforma → onde quebra

### 4. Corrigir
- Mudança mínima que resolve o problema
- Não refatorar código que não está relacionado ao bug
- Adicionar tratamento para o caso que causou o erro

### 5. Prevenir
- Tipar corretamente o que causou o erro
- Adicionar optional chaining onde falta (?.  ?? )
- Adicionar erro amigável pro usuário (try/catch + estado de erro)

## Formato de resposta

```
Entendi: o erro [TIPO] acontece em [ARQUIVO:LINHA] porque [CAUSA].

**Causa raiz**: [explicação em 1 frase]

**Correção**:
[código com a mudança mínima necessária]

**O que mudou**: [1-2 linhas explicando]

**Prevenção**: [sugestão opcional de como evitar no futuro]
```

## Regras

- NUNCA sugerir "tente limpar o cache" como primeira resposta
- NUNCA adicionar try/catch genérico que engole o erro
- SEMPRE mostrar o código corrigido completo (não só o diff)
- Se o erro tem múltiplas causas possíveis, listar as 2 mais prováveis
- Se não tem erro no terminal, perguntar o que acontece vs o que era esperado
