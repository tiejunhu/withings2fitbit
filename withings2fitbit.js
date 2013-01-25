var util = require('util');
var http = require('http');
var OAuth = require('./lib/oauth').OAuth;
var dirty = require ('./lib/dirty');

var db = dirty('fitbit.db');
var withingsDataQueue = [];

var auth = {
  oauth_access_token:        '9de499f03f067def2075d55170426cdd',
  oauth_access_token_secret: '23c7bac2ca9ff9d0aa319cfb59514218'
};

var oa = new OAuth("https://api.fitbit.com/oauth/request_token",
                   "https://api.fitbit.com/oauth/access_token",
                   "b295f793330042c4af905efff42de5f0",
                   "0246fdeabf2d466caef6bdd1d9898b48",
                   "1.0",
                   "https://api.fitbit.com/oauth/authorize",
                   "HMAC-SHA1");

http.globalAgent.maxSockets = 1;

function seconds(day)
{
  day.setHours(0);
  day.setMinutes(0);
  day.setSeconds(0);
  day.setMilliseconds(0);
  return parseInt(day.getTime() / 1000.0);
}

function httpOptions(day) {
  return {
    host: 'wbsapi.withings.net',
    port: 80,
    path: util.format(
            '/measure?action=getmeas&userid=782689&publickey=ca494c14d38ed05f&startdate=%d&enddate=%d', 
            seconds(day), 
            seconds(day) + 24 * 3600)
  };
}

function getFitbitProfile(callback)
{
  oa.get(
    "https://api.fitbit.com/1/user/-/profile.json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    function (error, data, response) {
      callback(JSON.parse(data).user);
    }
  );  
}

function postFitbitHeartRate(heart_date, heart_time, heart_rate) {
  var post_body = {
    tracker: 'Normal Heart Rate',
    heartRate: heart_rate,
    date: heart_date,
    time: heart_time
  };
  var key = heart_date + "." + heart_time + "." + heart_rate;
  if (db.get(key)) {
    console.log(key + " posted, won't post again.");
    return;
  }
  
  oa.post(
    "https://api.fitbit.com/1/user/-/heart.json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    post_body, 
    function (error, data, response) {
      if (error) {
        console.log("heart rate:" + heart_date + " " + heart_time + ", " + heart_rate + " error. retrying.");
        postFitbitHeartRate(heart_date, heart_time, heart_rate);
      } else {
        var result = JSON.parse(data);
        db.set(result.heartLog.logId, true);
        db.set(key, true);
        console.log("heart rate:" + heart_date + " " + heart_time + ", " + heart_rate + " success.");
      }
    }
  );
}

function postFitbitBloodPressure(bp_date, bp_time, diastolic_value, systolic_value) {
  var post_body = {
    diastolic: diastolic_value,
    systolic: systolic_value,
    date: bp_date,
    time: bp_time
  };
  var key = bp_date + "." + bp_time + "." + diastolic_value + "." + systolic_value;
  if (db.get(key)) {
    console.log(key + " posted, won't post again.");
    return;
  }
  
  oa.post(
    "https://api.fitbit.com/1/user/-/bp.json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    post_body, 
    function (error, data, response) {
      if (error) {
        console.log("blood pressure:" + key + " error. retrying.");
        postFitbitBloodPressure(bp_date, bp_time, diastolic_value, systolic_value);
      } else {
        var result = JSON.parse(data);
        db.set(result.bpLog.logId, true);
        db.set(key, true);
        console.log("blood pressure:" + key + " success.");
      }
    }
  );
}


function getFitbitHeartRate(heart_date, callback) {
  oa.get(
    "https://api.fitbit.com/1/user/-/heart/date/" + heart_date + ".json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    function(error, data, response) {
      if (error) {
      } else {
        var result = JSON.parse(data);
        console.log("found " + result.heart.length + " heart rate items for " + heart_date);
        for (var index in result.heart) {
          var item = result.heart[index];
          callback(item.logId);
        }
        callback(-1); // -1 indicates end
      }
    }
  );
}

function getFitbitBloodPressure(bp_date, callback) {
  oa.get(
    "https://api.fitbit.com/1/user/-/bp/date/" + bp_date + ".json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    function(error, data, response) {
      if (error) {
      } else {
        var result = JSON.parse(data);
        console.log("found " + result.bp.length + " blood pressure items for " + bp_date);
        for (var index in result.bp) {
          var item = result.bp[index];
          callback(item.logId);
        }
        callback(-1); // -1 indicates end
      }
    }
  );
}

function deleteFitbitHeartRate(logId) {
  oa.delete(
    "https://api.fitbit.com/1/user/-/heart/" + logId + ".json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    function(error, data, response) {
      if (!error) {
        console.log("heart rate " + logId + " deleted.")
      }
    }
  );
}

function deleteFitbitBloodPressure(logId) {
  oa.delete(
    "https://api.fitbit.com/1/user/-/bp/" + logId + ".json", 
    auth.oauth_access_token, 
    auth.oauth_access_token_secret, 
    function(error, data, response) {
      if (!error) {
        console.log("blood pressure " + logId + " deleted.")
      }
    }
  );
}

function isSameDay(date1, date2)
{
  return (date1.getFullYear() == date2.getFullYear()) && (date1.getMonth() == date2.getMonth()) && (date1.getDate() == date2.getDate());
}

function everyDaySince(date_str, callback) {
  var date = new Date();
  var today = new Date();
  var msec = Date.parse(date_str);
  date.setTime(msec);
  callback(date);
  while(!isSameDay(date, today)) {
    msec += 3600 * 24 * 1000;
    date.setTime(msec);
    callback(date);
  }
}

function ensureTwo(num)
{
  if (num < 10) {
    return "0" + num;
  }
  return "" + num;
}

function dateStringOf(date)
{
  var year_str = "" + date.getFullYear();
  var month_str = ensureTwo(date.getMonth() + 1);
  var day_str = ensureTwo(date.getDate());
  return year_str + "-" + month_str + "-" + day_str;
}

function timeStringOf(date)
{
  var hour_str = ensureTwo(date.getHours());
  var min_str = ensureTwo(date.getMinutes());
  return hour_str + ":" + min_str;
}

function dumpWithingsData(obj) {
  if (obj.status != 0) {
    console.log("status: " + obj.status);
    return;
  }

  var dateString = null;
  var data = [];

  var grps = obj.body.measuregrps;
  for (var grp_index in grps) {
    var grp = grps[grp_index];
    if (grp.category != 1) continue;
    var date_epoch = grp.date;
    var date = new Date();
    date.setTime(date_epoch * 1000);
    for (var measure_index in grp.measures) {
      var measure = grp.measures[measure_index];
      var type = measure.type;
      if (type == 9) var low = measure.value;
      if (type == 10) var high = measure.value;
      if (type == 11) var pulse = measure.value;
    }
    if (dateString == null) {
      dateString = dateStringOf(date);
    }
    data.push([timeStringOf(date), low, high, pulse]);
  }
  if (dateString) {
    withingsDataQueue.push([dateString, data]);  
  }
}

function requestWithingsData(day)
{
  var http_request = http.get(httpOptions(day), function(response) {
    var whole_data = "";
    response.on('data', function(data) {
      whole_data += data;
    });

    response.on('end', function() {
      dumpWithingsData(JSON.parse(whole_data));
    });
  });
}


function clearAndPostBloodPressure(date, measures) {
  console.log("clearing blood pressure for " + date + ", and posting " + measures.length + " items.");
  getFitbitBloodPressure(date, function(logId) {
    if (logId == -1) {
      for (var index in measures) {
        var measure = measures[index];
        var time = measure[0];
        var low = measure[1];
        var high = measure[2];
        postFitbitBloodPressure(date, time, low, high);
      }      
    } else {
      if (!db.get(logId)) {
        deleteFitbitBloodPressure(logId);              
      } else {
        console.log("blood pressure log " + logId + " logged by us. won't delete it.");
      }
    }
  });
}

function clearAndPostHeartRate(date, measures) {
  console.log("clearing heart rate for " + date + ", and posting " + measures.length + " items.");

  getFitbitHeartRate(date, function(logId) {
    if (logId == -1) {
      for (var index in measures) {
        var measure = measures[index];
        var time = measure[0];
        var pulse = measure[3];
        postFitbitHeartRate(date, time, pulse);
      }      
    } else {
      if (!db.get(logId)) {
        deleteFitbitHeartRate(logId);              
      } else {
        console.log("heart rate log " + logId + " logged by us. won't delete it.");
      }
    }
  });
}

function processQueue()
{
  if (withingsDataQueue.length > 0) {
    var item = withingsDataQueue.pop();
    var date = item[0];
    var measures = item[1];
    clearAndPostHeartRate(date, measures);
    clearAndPostBloodPressure(date, measures);
  }
  setTimeout(function() {
    processQueue();
  }, 10);
}

function fillTheQueue(date_str)
{
  console.log("filling the gap since " + date_str);
  everyDaySince(date_str, function(date) {
    requestWithingsData(date);
  });
}

db.on('load', function() {
  getFitbitProfile(function(user) {
    fillTheQueue(user.memberSince);
  });  
  setInterval(function() {
    var yesterday = new Date();
    yesterday.setTime(yesterday.getTime() - 3600 * 24 * 1000);
    fillTheQueue(dateStringOf(yesterday));
  }, 1000 * 60);
  processQueue();
});

