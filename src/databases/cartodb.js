var Bluebird = require('bluebird'),
  fandlebars = require('fandlebars'),
  unirest = require('unirest'),
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
            var cleanedSql = fandlebars(query, params).replace(/\'null\'/g, 'null'),
              requestPath = 'https://' + config.account + '.cartodb.com/api/v2/sql';
            if (cleanedSql.length > 5) {
              // console.log('Requesting', requestPath, '(' + cleanedSql + ')');
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
