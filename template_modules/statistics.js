// Налаштування шаблону
import templateConfig from '../template.config.js'
// Логгер
import logger from './logger.js'

import fs from 'node:fs';
import path from 'node:path'

const projectName = path.basename(path.resolve()).toLowerCase()
const isProduction = process.env.NODE_ENV === 'production'
const isShowStat = process.argv.includes('--stat')

const time = Date.now()
const date = new Date
const file = path.resolve('template_modules/statistics/data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
const dataStatistics = data.statistics
const dataSessions = data.statistics.sessions;
const dataFiles = data.statistics.files;

global.serverInit

// Плагіни
export const statPlugins = [{
	name: 'stat-dev',
	enforce: 'pre',
	configureServer: {
		order: 'pre',
		handler: async () => {
			if (!global.serverInit && templateConfig.statistics.enable) {
				global.serverInit = true

				// Зупинка сервера (Ctrl+C)
				process.on('SIGINT', endSession)
				// Зупинка сервера (SIGTERM)
				process.on('SIGTERM', endSession)
				// Зупинка сервера (SIGHUP)
				process.on('SIGHUP', endSession)

				const session = {
					date: formatDate(date),
					start: time,
					end: time
				}
				// Старт сесії
				dataSessions.push(session)
				await writeSession()

				!isProduction ? logger('Збір статистики розпочато') : null
			}
		}
	}
}, {
	name: 'stat-build',
	apply: 'build',
	writeBundle: async () => {
		templateConfig.statistics.enable ? endSession() : null
		templateConfig.statistics.showonbuild ? showStat(dataStatistics) : null
	}
}]
// Кінець сесії
async function endSession() {
	const lastSession = dataSessions[dataSessions.length - 1]
	if (lastSession.type !== 'build') {
		lastSession.end = Date.now()
		isProduction ? lastSession.type = 'build' : null
		await writeSession()
	}
	process.exit()
}
// Запис сесії
async function writeSession() {
	fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
// Формат дати
function formatDate(date) {
	const d = new Date(date);
	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();
	return `${day}.${month}.${year}`;
}
// Формат часу
function formatMilliseconds(ms) {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));
	const parts = [];
	if (days > 0) parts.push(`${days} дн${days === 1 ? 'ь' : 'і'}`);
	if (hours > 0) parts.push(`${hours} год`);
	if (minutes > 0) parts.push(`${minutes} хв`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds} сек`);

	return parts.join(' ');
}
// Показ статистики
function showStat(data) {
	const dataSessions = data.sessions
	if (dataSessions.length) {
		function getTime(dataSessions) {
			let timeCounter = 0
			dataSessions.forEach(dataSession => {
				timeCounter = timeCounter + (dataSession.end - dataSession.start)
			});
			return formatMilliseconds(timeCounter)
		}
		function getSessions(dataSessions) {
			return dataSessions.length
		}
		function getDateRange(dataSessions, type) {
			return type === 'start' ? dataSessions[0].date : dataSessions[dataSessions.length - 1].date
		}
		logger(`(!)Статистика проєкту ${projectName}:`)
		logger(`Початок роботи над проєктом: ${getDateRange(dataSessions, 'start')}`)
		logger(`Кінець роботи над проєктом: ${getDateRange(dataSessions, 'end')}`)
		logger(`Часу витрачено на проєкт: ${getTime(dataSessions)}`)
		logger(`Всього сесій: ${getSessions(dataSessions)}\n`)
	} else {
		logger(`(!)Статистики немає\n`)
	}
	!templateConfig.statistics.enable ? logger(`(!!)Збір статистики вимкнений\n`) : null
}

isShowStat ? showStat(dataStatistics) : null
