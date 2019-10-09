var Bluebird = require('bluebird'),
  fandlebars = require('fandlebars'),
  unirest = require('unirest'),
  runList = require('../runList');

module.exports = function(config) {
  //set defaults
  config.protocol = config.protocol || 'https';
  config.url = config.url || '{{account}}.cartodb.com';
  config.url = fandlebars(config.url, config);
  config.requestPath = config.requestPath || fandlebars('{{protocol}}://{{url}}/api/v2/sql',config);

  return {
    runQueryList: function(sql, params) {
      return new Bluebird(function(resolve, reject) {
        if (!Array.isArray(sql)) {
          sql = [sql];
        }

        var runQuery = function(query) {

          return new Bluebird(function(queryResolve, queryReject) {
            // Escape the single quote
            for (var param in params) {
              if (typeof params[param] === 'string') {
                params[param] = params[param].replace(/([^']|^)'/g, '$1\'\'');
              }
            }
            var cleanedSql = fandlebars(query, params).replace(/\'null\'/g, 'null');
            if (cleanedSql.length > 5) {
              unirest.post(requestPath)
                .set('Content-Type', 'application/json')
                .header({
                  'Accept': 'application/json'
                })
                .send({
                  'q': cleanedSql,
                  'api_key': config.apiKey
                })
                .end(function(resp) {
                  if (resp.error) {
                    queryReject(JSON.stringify(resp, null, 2));
                  } else {
                    queryResolve(resp.body);
                  }
                });
            } else {
              queryReject('Query Too Short: (' + cleanedSql.length + ') chars');
            }
          });
        };

        var taskList = [];
        sql.map(function(query) {
          taskList.push({
            'name': 'Query: ' + query,
            'task': runQuery,
            'params': query
          });

          runList(taskList, 'cartodb.js sql map')
            .then(function(r) {
              resolve(r);
            })
            .catch(function(e) {
              reject(e);
            });
        });
      });
    }
  };
};
