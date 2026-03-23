# Configurar Secrets no GitHub

Acesse: https://github.com/santuariotnb-sys/infinit-code-desktop/settings/secrets/actions

## Obrigatório agora (para o build funcionar)

| Secret | Valor |
|--------|-------|
| `GITHUB_CLIENT_ID` | `Ov23liFYvVqtk4wX3qrE` |

> `GITHUB_TOKEN` é gerado automaticamente pelo GitHub Actions — não precisa configurar.

## Para assinatura Mac (evita aviso de segurança)

Adicionar **depois** de comprar Apple Developer ($99/ano):

| Secret | Como obter |
|--------|-----------|
| `APPLE_ID` | Seu email Apple (ex: `seu@apple.com`) |
| `APPLE_APP_SPECIFIC_PASSWORD` | Gerar em [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords |
| `CSC_LINK` | Base64 do certificado `.p12` (exportar do Keychain Access) |
| `CSC_KEY_PASSWORD` | Senha do certificado `.p12` |

## Sem assinatura (modo atual)

O Mac vai mostrar aviso "não identificado". O usuário pode contornar:

**Opção 1 — Clique direito:**
1. Clique com botão direito no app → "Abrir"
2. Confirmar na janela de segurança

**Opção 2 — Terminal:**
```bash
sudo xattr -rd com.apple.quarantine "/Applications/Infinit Code.app"
```
