# Checklist de Lançamento — Infinit Code

## Hoje (para beta)
- [ ] `npm run build:mac` → testar .dmg localmente
- [ ] Adicionar `GITHUB_CLIENT_ID` nos GitHub Secrets (ver SETUP_SECRETS.md)
- [ ] `git tag v1.0.0-beta && git push origin v1.0.0-beta`
- [ ] Testar download do GitHub Releases
- [ ] Testar instalação do .dmg em outro Mac
- [ ] Criar post no grupo dos devs com link de download

## Esta semana (para venda)
- [ ] Endpoint `/api/license/validate` funcionando no web-app
- [ ] Pagar.me configurado com plano R$67/mês
- [ ] Página `/download` no web-app publicada no Netlify
- [ ] Landing page atualizada com botão de download
- [ ] Testar fluxo completo: compra → email → ativa no app → IDE abre

## Antes de 200 assinaturas
- [ ] Apple Developer ($99/ano) → certificado → sem aviso de segurança
- [ ] Suporte via WhatsApp ou email configurado
- [ ] Auto-update testado (`git tag v1.0.1` → usuários recebem update)
