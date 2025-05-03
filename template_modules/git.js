// Налаштування шаблону
import templateConfig from '../template.config.js'
// Логгер
import logger from './logger.js'

import ghpages from 'gh-pages'

//const message = process.argv[5].toLowerCase()

export const gitPlugins = [{
	name: "git-deploy",
	apply: 'build',
	enforce: 'post',
	writeBundle: {
		order: 'post',
		handler: ({ dir }) => {
			ghpages.publish(dir, {
				branch: templateConfig.git.branch,
				repo: templateConfig.git.repo,
				//message: message
			}, (err) => {
				if (err) {
					logger(`(!!)${err}`)
				} else {
					logger(`_GIT_DEPLOY_DONE`)
				}
			});
		}
	}
}]
