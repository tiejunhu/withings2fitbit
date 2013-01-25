var util = require('util');
var OAuth = require('./lib/oauth').OAuth;
var readline = require('readline');
var spawn = require('child_process').spawn;
var input = readline.createInterface(process.stdin, process.stdout, null);

var oa = new OAuth("https://api.fitbit.com/oauth/request_token",
                  "https://api.fitbit.com/oauth/access_token",
                  "b295f793330042c4af905efff42de5f0",
                  "0246fdeabf2d466caef6bdd1d9898b48",
                  "1.0",
                  "https://api.fitbit.com/oauth/authorize",
                  "HMAC-SHA1");

oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
  if(error) 
    util.puts('error :' + error);
  else { 
    util.puts('oauth_token :' + oauth_token);
    util.puts('oauth_token_secret :' + oauth_token_secret);
    util.puts('requestoken results :' + util.inspect(results));
    util.puts("Requesting access token");
    spawn('open', ['http://www.fitbit.com/oauth/authorize?oauth_token=' + oauth_token]);

    input.question("Input PIN to continue: ", function(PIN) {
      oa.getOAuthAccessToken(oauth_token, oauth_token_secret, PIN, function(error, oauth_access_token, oauth_access_token_secret, results2) {
        console.log("oauth_access_token: " + oauth_access_token);
        console.log("oauth_access_token_secret: " + oauth_access_token_secret);
        oa.get("https://api.fitbit.com/1/user/-/profile.json", oauth_access_token, oauth_access_token_secret, function (error, data, response) {
          util.puts(data);
        });
      });

      // These two lines together allow the program to terminate. Without
      // them, it would run forever.
      input.close();
      process.stdin.destroy();
    });    
  }
});



