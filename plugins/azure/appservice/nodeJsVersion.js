const async = require('async');
const helpers = require('../../../helpers/azure');

module.exports = {
    title: 'Node.js Version',
    category: 'App Service',
    domain: 'Application Integration',
    severity: 'Low',
    description: 'Ensures the latest version of Node.js is installed for all App Services',
    more_info: 'Installing the latest version of Node.js will reduce the security risk of missing security patches.',
    recommended_action: 'Select the latest version of Node.js for all Node.js-based App Services',
    link: 'https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs',
    apis: ['webApps:list', 'webApps:listConfigurations'],
    settings: {
        latestNodeJsVersion: {
            name: 'Latest Node.js Version',
            default: '20',
            description: 'The latest Node.js version supported by Azure App Service.',
            regex: '[0-9.]{1,2}'
        }
    },
    realtime_triggers: ['microsoftweb:sites:write','microsoftweb:sites:delete'],


    run: function(cache, settings, callback) {
        const config = {
            latestNodeJsVersion: settings.latestNodeJsVersion || this.settings.latestNodeJsVersion.default
        };

        var custom = helpers.isCustom(settings, this.settings);

        const results = [];
        const source = {};
        const locations = helpers.locations(settings.govcloud);

        async.each(locations.webApps, function(location, rcb) {
            const webApps = helpers.addSource(
                cache, source, ['webApps', 'list', location]
            );

            if (!webApps) return rcb();

            if (webApps.err || !webApps.data) {
                helpers.addResult(results, 3,
                    'Unable to query for App Services: ' + helpers.addError(webApps), location);
                return rcb();
            }

            if (!webApps.data.length) {
                helpers.addResult(
                    results, 0, 'No existing App Services found', location);
                return rcb();
            }

            var found = false;

            webApps.data.forEach(function(webApp) {
                const webConfigs = helpers.addSource(
                    cache, source, ['webApps', 'listConfigurations', location, webApp.id]
                );

                if (!webConfigs || webConfigs.err || !webConfigs.data) {
                    helpers.addResult(results, 3,
                        'Unable to query App Service: ' + helpers.addError(webConfigs),
                        location, webApp.id);
                } else {
                    if (webConfigs.data[0] &&
                        webConfigs.data[0].linuxFxVersion &&
                        webConfigs.data[0].linuxFxVersion.indexOf('NODE') > -1 &&
                        webConfigs.data[0].linuxFxVersion.indexOf('|') > -1) {
                        found = true;
                        var linuxFxVersion = webConfigs.data[0].linuxFxVersion;
                        var nodeVersion = linuxFxVersion.substr(linuxFxVersion.indexOf('|') + 1).replace('-lts', '');
                        var isLatestVersion = helpers.compareVersions(nodeVersion, config.latestNodeJsVersion);

                        if (isLatestVersion === -1) {
                            helpers.addResult(results, 2,
                                `The Node.js version (${nodeVersion}) is not the latest version`, location, webApp.id, custom);
                        } else {
                            helpers.addResult(results, 0,
                                `The Node.js version (${nodeVersion}) is the latest version`, location, webApp.id, custom);
                        }
                    } else if (webConfigs.data[0] && webConfigs.data[0].nodeVersion) {
                        found = true;

                        var nodeJsVersion =  webConfigs.data[0].nodeVersion.replace(/~/g, '');
                        isLatestVersion = helpers.compareVersions(nodeJsVersion, config.latestNodeJsVersion);

                        if (isLatestVersion === -1) {
                            helpers.addResult(results, 2,
                                `The Node.js version (${nodeJsVersion}) is not the latest version`, location, webApp.id, custom);
                        } else {
                            helpers.addResult(results, 0,
                                `The Node.js version (${nodeJsVersion}) is the latest version`, location, webApp.id, custom);
                        }
                    }
                }
            });

            if (!found) {
                helpers.addResult(results, 0, 'No App Services with Node.js found', location);
            }

            rcb();
        }, function() {
            // Global checking goes here
            callback(null, results, source);
        });
    }
};