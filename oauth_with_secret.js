var util = require('util');
var OAuth = require('./lib/oauth').OAuth;

var auth = {
  oauth_access_token: 'af600d5b3f4b9c4a47115e3c6ff7ef9a',
  oauth_access_token_secret: '600724e4fa08a7165ae0b387e164ef20'
};

var oa = new OAuth("https://api.fitbit.com/oauth/request_token",
                   "https://api.fitbit.com/oauth/access_token",
                   "b295f793330042c4af905efff42de5f0",
                   "0246fdeabf2d466caef6bdd1d9898b48",
                   "1.0",
                   "https://api.fitbit.com/oauth/authorize",
                   "HMAC-SHA1");

function getProfile(callback)
{
  oa.get("https://api.fitbit.com/1/user/-/profile.json", auth.oauth_access_token, auth.oauth_access_token_secret, function (error, data, response) {
    callback(JSON.parse(data).user);
  });  
}

function isSameDay(date1, date2)
{
  return (date1.getFullYear() == date2.getFullYear()) && (date1.getMonth() == date2.getMonth()) && (date1.getDate() == date2.getDate());
}

function everyDaySince(day, callback) {
  var date = new Date();
  var today = new Date();
  var msec = Date.parse(day);
  date.setTime(msec);
  while(!isSameDay(date, today)) {
    callback(date);
    msec += 3600 * 24 * 1000;
    date.setTime(msec);
  }
}

getProfile(function(user) {
  everyDaySince(user.memberSince, function(date) {
    console.log(date.toString());
  });
});
