var Bluebird = require('bluebird');
var applyParams = function(params, tasks, results) {
  return params.map(function(param) {
    var returnValue;
    if (typeof param === 'string' && param.match(/^\{\{.+?\}\}/g)) {
      tasks.map(function(task, i) {
        if (results.length >= i, task.name === param.replace(/^\{\{|\}\}/g, '')) {
          returnValue = results[i];
        }
      });
    } else {
      returnValue = param;
    }
    return returnValue;
  });
};
module.exports = function(list, taskName) {
  var messages = [];
  return new Bluebird(function(listResolve, listReject) {

    var exec = function(sublist, msgList, callback) {
      var nextList = [];
      var params = Array.isArray(sublist[0].params) ? sublist[0].params : [sublist[0].params];
      params = applyParams(params, list, msgList);
      sublist[0].task.apply(
          sublist[0].context,
          params
        )
        .then(function(msg) {
          messages[messages.push(msg)].name = sublist[0].name;
          nextList = sublist.slice(1);
          if (nextList.length > 0) {
            exec(nextList, messages, callback);
          } else {
            callback(null, messages);
          }
        })
        .catch(function(e) {
          callback(e);
        });
    };

    if (list.length > 0) {
      exec(list, messages, function(e, r) {
        if (e) {
          e.taskName = taskName;
          listReject(e);
        } else {
          r.taskName = taskName;
          listResolve(r);
        }
      });
    } else {
      listResolve({});
    }
  });
};
