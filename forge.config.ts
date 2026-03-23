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

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Infinit Code',
    executableName: 'infinit-code',
    appBundleId: 'app.infinitcode.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    icon: './assets/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      icon: './assets/icon.icns',
      format: 'ULFO',
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
