#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP="$SCRIPT_DIR/Infinit Code.app"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Instalando Infinit Code..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "$APP" ]; then
  echo "❌ App não encontrado. Rode este script de dentro do DMG."
  read -p "Pressione Enter para fechar..."
  exit 1
fi

echo "→ Copiando para Applications..."
sudo cp -R "$APP" /Applications/ 2>/dev/null || {
  echo "❌ Falha ao copiar. Verifique permissões."
  read -p "Pressione Enter para fechar..."
  exit 1
}

echo "→ Removendo restrição do macOS (quarantine)..."
sudo xattr -rd com.apple.quarantine "/Applications/Infinit Code.app" 2>/dev/null
xattr -rd com.apple.quarantine "/Applications/Infinit Code.app" 2>/dev/null

echo "→ Ejetando disco..."
DISK=$(df "$SCRIPT_DIR" 2>/dev/null | tail -1 | awk '{print $1}')
hdiutil detach "$DISK" -quiet 2>/dev/null || true

echo ""
echo "✅ Pronto! Abrindo Infinit Code..."
sleep 1
open "/Applications/Infinit Code.app"
