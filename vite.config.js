import { defineConfig } from "vite";
import { globSync } from 'glob'
import path from 'path'
import fs from 'fs'

// Налаштування збірки
import templateConfig from './template.config.js'
// Імпортовані модулі
import templateImports from './template_modules/template.imports.js'
// Генерація налаштувань для редактору
templateConfig.vscode.settings ? templateImports.vscodeSettings() : null
// Генерація сніпетів для редактору
templateConfig.vscode.snippets ? templateImports.addSnippets() : null
// Мова повідоблень
const lang = JSON.parse(fs.readFileSync(`./template_modules/languages/${templateConfig.lang}.json`, 'UTF-8'))
// Формування псевдонімів для Vite
const makeAliases = (aliases) => {
	return Object.entries(aliases).reduce((acc, [key, value]) => {
		value = !value.startsWith(`./`) ? `./${value}` : value
		acc[key] = path.resolve(process.cwd(), value)
		return acc
	}, {})
}
const aliases = makeAliases(templateConfig.aliases)
// Логінг
import logger from "./template_modules/logger.js";

const isProduction = process.env.NODE_ENV === 'production'
const isInspect = process.argv.includes('--inspect')
const isWp = process.argv.includes('--wp')
const isGit = process.argv.includes('--git')
const isHost = process.argv.includes('--host')

const ignoredDirs = ['backend', 'src/files', 'node_modules', 'dist', '.git']
const ignoredFiles = ['package.json', 'src/components/other/statistics/data.json']

import Inspect from 'vite-plugin-inspect'
import { getDev } from './template_modules/main.js'
import qrcode from 'qrcode-terminal'

export default defineConfig(({ command, mode, ssrBuild }) => {
	return {
		define: {
			flsLogging: isProduction && templateConfig.logger.console.removeonbuild ? false : templateConfig.logger.console.enable,
			flsLang: isProduction && templateConfig.logger.console.removeonbuild ? false : lang,
			aliases: aliases
		},
		resolve: {
			alias: {
				vue: 'vue/dist/vue.esm-bundler.js',
				...aliases
			},
		},
		base: templateConfig.server.path,
		assetsInclude: ['src/components/**/*.html'],
		clearScreen: true,
		root: path.join(__dirname, "src"),
		logLevel: "silent",
		publicDir: false,
		server: {
			open: isWp ? 'http://localhost:8080' : true,
			host: templateConfig.server.hostname,
			port: templateConfig.server.port,
			proxy: {
				'/php': {
					target: `http://${templateConfig.php.hostname}:${templateConfig.php.port}`,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/php/, ''),
					secure: false,
					ws: true,
					rewriteWsOrigin: true,
				},
			},
			watch: {
				ignored: [
					...ignoredDirs.map(dir => `**/${dir}/**`),
					...ignoredFiles.map(file => `**/${file}/**`),
				],
			}
		},
		plugins: [
			// Робота з HTML
			...templateImports.htmlPlugins,
			// Робота з скриптами
			...templateImports.scriptsPlugins,
			// Робота зі шрифтами
			...templateImports.fontPlugins,
			// Робота з стилями
			...templateImports.stylesPlugins,
			// Робота з зображеннями
			...templateImports.imagePlugins,
			// Робота з PHP
			...templateImports.phpPlugins,
			// Робота з архівом
			...templateImports.zipPlugin,
			// Робота з FTP
			...templateImports.ftpPlugin,
			// Обробка React
			...(templateConfig.js.react ? [templateImports.react()] : []),
			// Обробка Vue
			...(templateConfig.js.vue ? [templateImports.vue()] : []),
			// NovaPoshta
			...(templateConfig.novaposhta.enable ? [templateImports.novaPoshta()] : []),
			// Генерація сторінки проєкту
			...(isProduction && templateConfig.projectpage.enable ? [templateImports.projectPage()] : []),
			// Час для кави
			...(!isProduction && templateConfig.coffee.enable ? [templateImports.coffeeTime()] : []),
			// Додавання версії файлів
			...(isProduction && templateConfig.server.version ? [templateImports.addVersion((new Date()).getTime())] : []),
			// Копіювання файлів
			...(isProduction && templateConfig.server.copyfiles ? [templateImports.viteStaticCopy({
				targets: [
					{
						src: 'files',
						dest: './',
					},
				],
				silent: true
			})] : []),
			// Робота з статистикою
			...templateImports.statPlugins,
			// Робота з GitHub
			...(isProduction && isGit ? [...templateImports.gitPlugins] : []),
			// Оновлення браузеру
			{
				name: 'custom-hmr',
				enforce: 'post',
				handleHotUpdate({ file, server }) {
					if (file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.php') || file.includes('fls-theme')) {
						server.ws.send({ type: 'full-reload', path: '*' })
					}
				},
			},
			// Повідомлення
			{
				name: 'message-dev',
				enforce: 'post',
				configureServer: {
					order: 'post',
					handler: (server) => {
						// Додавання QR-коду в термінал
						if (isHost) {
							setTimeout(() => {
								const urls = server.resolvedUrls || server.network
								for (const key in urls) {
									const element = urls[key];
									logger(`_DEV_HOST_ADDRESS`, element[0])
									qrcode.generate(element[0], { small: true })
								}
								logger(`_DEV_DONE`)
							}, 1000);
						} else {
							logger(`_DEV_HOST_ADDRESS`, isWp ? `http://localhost:8080` : `http://${templateConfig.server.hostname}:${templateConfig.server.port}`)
							logger(`_DEV_DONE`)
						}
					}
				}
			},
			getDev(),
			{
				name: 'message-build',
				apply: 'build',
				enforce: 'post',
				writeBundle: {
					order: 'post',
					handler: () => {
						logger(`_BUILD_DONE`)
					}
				},
			},
			...(isInspect ? [Inspect()] : [])
		],
		css: {
			devSourcemap: true,
			preprocessorOptions: {
				scss: {
					silenceDeprecations: ["mixed-decls"],
					additionalData: `
						@use "sass:math";
						@use "@styles/includes/index.scss" as *;
					`,
					sourceMap: true,
					quietDeps: true,
					api: 'modern-compiler'
				},
			},
		},
		build: {
			outDir: isWp ? path.join(__dirname, "src/components/wordpress/fls-theme/assets/build") : path.join(__dirname, "dist"),
			emptyOutDir: true,
			manifest: false,
			minify: !templateConfig.js.devfiles,
			cssMinify: !templateConfig.styles.devfiles,
			cssCodeSplit: templateConfig.styles.codesplit,
			rollupOptions: {
				input: isWp ? ['src/components/wordpress/fls-theme/assets/app.js'] : globSync('./src/*.html'),
				plugins: [
					templateImports.rollupPlugins
				],
				output: [{
					manualChunks(id) {
						if (templateConfig.js.bundle.enable) {
							return 'app'
						}
					},
					// Налаштування асетів
					assetFileNames: (asset) => {
						let getPath = asset.originalFileNames[0] && asset.names && asset.names.length > 0 ? asset.originalFileNames[0].replace(`/${asset.names[0]}`, '') : ''
						let extType = asset.names && asset.names.length > 0 ? asset.names[0].split('.').pop() : ''
						if (/css/.test(extType)) {
							return templateConfig.js.bundle.enable ? `css/app.min[extname]` : `css/[name].min[extname]`
						} else {
							if (/eot|otf|ttf|woff|woff2/.test(extType)) {
								extType = "assets/fonts";
							} else {
								extType = getPath
							}
							return `${extType}/[name][extname]`; //-[hash]
						}
					},
					entryFileNames(name) {
						return templateConfig.js.bundle.enable ? 'js/app.min.js' : `js/[name].min.js`
					},
					chunkFileNames(name) {
						return templateConfig.js.bundle.enable ? 'js/app.min.js' : `js/[name].min.js`
					}
				}],
			}
		}
	}
})