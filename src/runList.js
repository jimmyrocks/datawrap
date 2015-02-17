var Bluebird = require('bluebird');
var fandlebarsObj = require('fandlebars').obj;

module.exports = function(list, taskName) {
  var messages = [];
  return new Bluebird(function(listResolve, listReject) {

    var exec = function(sublist, msgList, callback) {
      var nextList = [];
      var params = Array.isArray(sublist[0].params) ? sublist[0].params : [sublist[0].params];
      fandlebarsObj(params, {'msgList': msgList});
      sublist[0].task.apply(
          sublist[0].context,
          params
        )
        .then(function(msg) {
          messages.push(msg);
          nextList = sublist.slice(1);
          if (nextList.length > 0) {
            exec(nextList, callback);
          } else {
            callback(null, messages);
          }
        })
        .catch(function(e) {
          callback(e);
        });
    };

    if (list.length > 0) {
      exec(list, function(e, r) {
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
