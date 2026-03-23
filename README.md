# ∞ Infinit Code

> Claude Code com superpoderes — IDE desktop para iniciantes

[![Version](https://img.shields.io/badge/version-1.0.0-00ff88.svg)]()
[![macOS](https://img.shields.io/badge/macOS-supported-blue.svg)]()
[![Windows](https://img.shields.io/badge/Windows-supported-blue.svg)]()
[![Linux](https://img.shields.io/badge/Linux-supported-blue.svg)]()

## O que e

Infinit Code e uma IDE desktop que integra o Claude Code com um editor de codigo, terminal nativo e preview ao vivo. Feito para quem nunca usou terminal — basta baixar, instalar, conectar o email e comecar a codar.

## Screenshots

> Screenshots serao adicionados em breve

## Download

| OS | Download |
|----|----------|
| macOS (Apple Silicon) | [Infinit-Code-1.0.0-arm64.dmg](#) |
| macOS (Intel) | [Infinit-Code-1.0.0-x64.dmg](#) |
| Windows | [Infinit-Code-1.0.0-Setup.exe](#) |
| Linux | [Infinit-Code-1.0.0.AppImage](#) |

## Funcionalidades

- **Setup automatico** — detecta e instala Node.js, Git e Claude Code automaticamente
- **Editor Monaco** — mesmo editor do VS Code com syntax highlighting e autocomplete
- **Terminal nativo** — node-pty com shell real do sistema, zero latencia
- **IntelliChat** — converse com Claude direto na IDE
- **Preview ao vivo** — veja seu app rodando em tempo real
- **File explorer** — navegue pelos arquivos do projeto
- **Auto-update** — atualiza automaticamente via GitHub Releases
- **Skills Infinit** — skills pre-configurados para frontend, UI/UX, Supabase e mais

## Desenvolvimento

```bash
# Instalar dependencias
npm install

# Rodar em modo dev
npm start

# Gerar build
npm run build

# Publicar release
npm run publish
```

## Estrutura

```
src/
├── main/           # Processo principal Electron
│   ├── index.ts    # Entry point, criacao da janela
│   ├── preload.ts  # Bridge segura (contextBridge)
│   ├── ipc/        # IPC handlers (terminal, files, claude, github, license)
│   └── services/   # Auto-setup, keychain, updater
└── renderer/       # Interface React
    ├── App.tsx     # Router principal
    ├── screens/    # Setup, License, IDE
    └── components/ # Editor, Terminal, Preview, FileTree, IntelliChat, Toolbar
```

## Como contribuir

1. Fork o repositorio
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudancas (`git commit -m 'Adiciona minha feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## Licença

MIT — veja o arquivo [LICENSE](LICENSE) para detalhes.

---

Feito com ∞ por [Infinit Code](https://app-infinitcode.netlify.app)
