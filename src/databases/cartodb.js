var Bluebird = require('bluebird'),
  fandlebars = require('fandlebars'),
  superagent = require('superagent'),
  runList = require('../runList');

module.exports = function(config) {
  return {
    runQueryList: function(sql, params) {
      return new Bluebird(function(resolve, reject) {
        if (!Array.isArray(sql)) {
          sql = [sql];
        }

        var runQuery = function(query) {

          return new Bluebird(function(queryResolve, queryReject) {
            // Escape the single quote
            // for (var param in params) {
            //   if (typeof params[param] === 'string') {
            //     params[param] = params[param].replace(/([^']|^)'/g, '$1\'\'');
            //   }
            // }
            var cleanedSql = fandlebars(query, params);//.replace(/\'null\'/g, 'null'),
              requestPath = 'https://' + config.account + '.cartodb.com/api/v2/sql';
            if (cleanedSql.length > 5) {
              superagent.post(requestPath)
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send({
                  'q': cleanedSql,
                  'api_key': config.apiKey
                })
                .end(function(err, resp) {
                  if (err || resp.error) {
                    queryReject(JSON.stringify(err || resp, null, 2));
                  } else {
                    queryResolve(resp.text);
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
