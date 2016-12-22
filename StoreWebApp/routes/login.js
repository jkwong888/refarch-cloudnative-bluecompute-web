var express = require('express');
var config = require('config');
var request = require('request');
var querystring = require('querystring');

var UrlPattern = require('url-pattern');
var router = express.Router();
var Promise = require('promise');
//var oauth = require('../server/js/oauth.js');

var api_url = new UrlPattern('(:protocol)\\://(:host)(/:org)(/:cat)(:api)(:operation)');
var _myApp = config.get('Application');
var _apiServer = config.get('API-Server');
var _apiServerOrg = ((_apiServer.org == "") || (typeof _apiServer.org == 'undefined')) ? undefined : _apiServer.org;
var _apiServerCatalog = ((_apiServer.catalog == "") || (typeof _apiServer.catalog == 'undefined')) ? undefined : _apiServer.catalog;
var _apis = config.get('APIs');

var authz_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.oauth20.base_path,
    operation: _apis.oauth20.paths.authz
});

var token_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.oauth20.base_path,
    operation: _apis.oauth20.paths.token
});

var client_id = _myApp.client_id;

var options = {
    callbackUrl: _apis.oauth20.redirect_url
}

var session;

// GET request for login screen 
router.get('/', 
            function(req, res, next) {
                console.log("LOGIN");
                console.log(req.headers);
                
                if (req.session.authContext) {
                    res.redirect(req.headers.referer);
                }
                
                var clientId = _myApp.client_id;   

                // Add the redirect URI of your web applications
                // This must be the same web application redirect URI you've defined in the Mobile Client Access dashboard
                var redirectUri = _apis.oauth20.redirect_url;

                // Create a URI for the authorization endpoint and redirect client
                var authorizationUri = authz_url;

                qStr = {
                    response_type: "code",
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scope: "review"
                }

                authorizationUri += "?" + querystring.stringify(qStr);

                console.log("Redirect to: " + authorizationUri);
                res.set('X-IBM-Client-ID', clientId);
                res.redirect(authorizationUri);  
            }
);

// GET callback 
router.get('/callback', 
            function(req, res, next) {
                console.log("LOGIN CALLBACK: ", req.query);
                // what did my response body look like
                //console.log(req.headers);
                
                // post to the token endpoint with my code (if it exists)
                var code = req.query.code;

                if (!code) {
                    console.log("No code found");
                    res.on('data', function (chunk) {
                        console.log('BODY: ' + chunk);
                    });

                    // Store accessToken in session in
                    req.session.accessToken = req.query.access_token; 
                    req.session.authContext = req.query.access_token;
                    res.redirect('/')

                    next();
                }

                var tokenUri = token_url;
                var formData = {
                    'grant_type': 'authorization_code',
                    'redirect_uri': _apis.oauth20.redirect_url,
                    'code': code,
                    'client_id': client_id
                }
                
                request.post({ url: tokenUri, form: formData }, 
                             function (err, response, body) { 
                                 console.log("BODY: ", body);
                                 // Access and identity tokens will be received in response body
                                 var parsedBody = JSON.parse(body); 

                                 if (parsedBody.error == null) {
                                     console.log("error:" + parsedBody.error);
                                 }

                                 // Store accessToken and identityToken in session in base64 format
                                 var authContext = {
                                     'access_token': parsedBody.access_token,
                                     'refresh_token': parsedBody.refresh_token
                                 }

                                 // Decode identity token and store it as authContext
                                 if (parsedBody.id_token) {
                                     var idTokenComponents = parsedBody.id_token.split("."); // [header, payload, signature] 
                                     authContext['idToken'] = new Buffer(idTokenComponents[1],"base64").toString();
                                 }

                                 req.session.authContext = authContext;

                                 // Redirect to home page after successful authentication
                                 console.log("AUTHENTICATED! auth context = ", authContext);
                                 res.redirect("/"); 
                             });
                // Supply clientId and clientSecret as Basic Http Auth credentials
                //.auth(client_id, client_secret); 



            });

function loginWithOAuth(req, res) {
  var form_body = req.body;
  var username = form_body.username;
  var password = form_body.password;

  console.log("loginWithOAuth");

  return new Promise(function (fulfill) {
    oauth.login(username, password, session)
      .then(function () {
        fulfill(res);
      })
      .done();
  });
}

//TODO: format the other pages with login / logout link

function renderPage(res) {
  // Redirect to the inventory view
  res.redirect('/inventory');
}

function renderErrorPage(function_input) {
  var err = function_input.err;
  var res = function_input.res;
  res.render('error', {reason: err});
}

module.exports = router;
