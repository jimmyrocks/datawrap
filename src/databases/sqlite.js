var Bluebird = require('bluebird');
var sqlite = require('sqlite3');
var runList = require('../runList');

module.exports = function (config) {
  return {
    runQueryList: function (sql, params) {
      return new Bluebird(function (resolve, reject) {
        if (!Array.isArray(sql)) {
          sql = [sql];
        }

        var runQuery = function (query) {
          return new Bluebird(function (queryResolve, queryReject) {
            db.all(query, function (err, rows) {
              if (err) {
                console.log('eRRor', err);
                queryReject(err);
              } else {
                queryResolve(rows);
              }
            });
          });
        };

        var taskList = [];
        sql.map(function (query) {
          taskList.push({
            'name': 'Query: ' + query,
            'task': runQuery,
            'params': query
          });
        });

        console.log('list', taskList);
        var db = new sqlite.Database(config.connection || ':memory:');
        runList(taskList, 'sqlite map')
          .then(function (r) {
            db.close();
            resolve(r);
          })
          .catch(function (e) {
            db.close();
            reject(e);
          });
      });
    }
  };
};
