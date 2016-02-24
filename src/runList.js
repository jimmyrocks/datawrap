var Bluebird = require('bluebird');
var fandlebars = require('fandlebars');

var applyParams = function (params, tasks, results) {
  var resultObj = {};
  tasks.forEach(function (task, i) {
    if (results.length > i && task.name) {
      resultObj[task.name] = results[i];
    }
  });

  return params.map(function (param) {
    var returnValue = param;
    if (typeof param === 'string' && param.match(/^\{\{.+?\}\}/g)) {
      returnValue = fandlebars(param, resultObj, null, true)[param];
    }
    return returnValue;
  });
};

var reporter = function (verbose) {
  var fn = function () {};
  if (verbose) {
    fn = typeof verbose === 'function' ? verbose : console.log;
  }
  return function () {
    fn.apply(this, arguments);
  };
};

module.exports = function (list, taskName, verbose) {
  var messages = [];
  var report = reporter(verbose);
  return new Bluebird(function (listResolve, listReject) {
    var exec = function (sublist, msgList, callback) {
      var nextList = [];
      var params = Array.isArray(sublist[0].params) ? sublist[0].params : [sublist[0].params];
      params = applyParams(params, list, msgList);
      report('*** Executing Task ***\n\t', sublist[0].name);

      var taskResObj = {};
      try {
        var taskRes = sublist[0].task.apply(
          sublist[0].context,
          params
        );
        if (taskRes && taskRes.then && typeof taskRes.then === 'function' && taskRes.catch && typeof taskRes.catch === 'function') {
          // This is a bluebird function
          taskResObj = taskRes;
        } else {
          // it's an imposter!
          taskResObj.then = taskRes && taskRes.then || function (thenFn) {
            thenFn(taskRes);
            return taskResObj;
          };
          taskResObj.catch = taskRes && taskRes.catch || function (catchFn) {
            return taskResObj;
          };
        }
      } catch (e) {
        taskResObj.then = function (catchFn) {
          return taskResObj;
        };
        taskResObj.catch = function (catchFn) {
          catchFn(e);
          return taskResObj;
        };
      }
      taskResObj.then(function (msg) {
        messages.push(msg);
        nextList = sublist.slice(1);
        if (nextList.length > 0) {
          exec(nextList, messages, callback);
        } else {
          callback(null, messages);
        }
      })
        .catch(function (e) {
          messages.push(e);
          callback(messages);
        });
    };

    if (list.length > 0) {
      exec(list, messages, function (e, r) {
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
