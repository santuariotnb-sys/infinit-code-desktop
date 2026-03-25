import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';
import fs from 'fs';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
      unpackDir: 'node_modules/{node-pty,keytar}',
    },
    name: 'Infinit Code',
    executableName: 'infinit-code',
    appBundleId: 'app.infinitcode.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    icon: './assets/icon',
  },
  rebuildConfig: {},
  hooks: {
    packageAfterPrune: async (_config, buildPath) => {
      const natives = ['node-pty', 'keytar'];
      for (const mod of natives) {
        const src = path.join(__dirname, 'node_modules', mod);
        const dest = path.join(buildPath, 'node_modules', mod);
        console.log(`[hook] Copiando ${mod} → ${dest}`);
        copyDirSync(src, dest);
      }
    },
  },
  makers: [
    new MakerDMG({
      icon: './assets/icon.icns',
      format: 'UDZO',
      overwrite: true,
      contents: (opts) => [
        { x: 160, y: 160, type: 'file', path: opts.appPath },
        { x: 380, y: 160, type: 'link', path: '/Applications' },
      ],
      window: { size: { width: 540, height: 400 } },
    }, ['darwin']),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      name: 'InfinitCode',
      setupIcon: './assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/santuariotnb-sys/infinit-code-desktop/main/assets/icon.ico',
    }, ['win32']),
    new MakerRpm({}, ['linux']),
    new MakerDeb({}, ['linux']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devServer: {
        client: { overlay: false },
      },
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/main/preload.ts',
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'santuariotnb-sys',
          name: 'infinit-code-desktop',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;
