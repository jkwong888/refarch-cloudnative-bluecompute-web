var express = require('express');
var config = require('config');
var request = require('request');
var querystring = require('querystring');

var UrlPattern = require('url-pattern');
var router = express.Router();
var Promise = require('promise');
var http = require('request-promise-json');
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

var introspect_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.oauth20.base_path,
    operation: _apis.oauth20.paths.introspect
});


var client_id = _myApp.client_id;

var options = {
    callbackUrl: _apis.oauth20.redirect_url
}

var session;

// GET request for login screen 
router.get('/', 
            function(req, res, next) {
                //console.log("LOGIN");
                //console.log(req.headers);
                
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

//                console.log("Redirect to: " + authorizationUri);
                res.set('X-IBM-Client-ID', clientId);
                res.redirect(authorizationUri);  
            }
);

// GET callback 
router.get('/callback', 
            function(req, res) {
//                console.log("LOGIN CALLBACK, query: %j", req.query);
//                console.log("LOGIN CALLBACK, headers: %j", req.headers);

                setGetAccessTokenOptions(req, res)
                  .then(getAccessToken)
                  .then(getTokenIntrospect)
                  .then(redirectToRoot)
                  .done();
            });

function setGetAccessTokenOptions(req, res) {
//    console.log("setGetAccessTokenOptions");

    // post to the token endpoint with my code (if it exists)
    var code = req.query.code;

    var tokenUri = token_url;
    var formData = {
        'grant_type': 'authorization_code',
        'redirect_uri': _apis.oauth20.redirect_url,
        'code': code,
        'client_id': client_id
    }

    var getAccessTokenOptions = {
        method: 'POST',
        url: tokenUri,
        strictSSL: false,
        headers: {},
        form: formData,
        JSON: false
    }

    return new Promise(function (fulfill) {
        if (!code) {
            console.log("No code found");
            res.on('data', function (chunk) {
                console.log('BODY: ' + chunk);
            });

            // Store accessToken in session in
            req.session.accessToken = req.query.access_token; 
            req.session.authContext = req.query.access_token;
            res.redirect('/')
        }

        // set options
        fulfill({
            req: req,
            res: res,
            getAccessToken_options: getAccessTokenOptions
        });
    });
}

function getAccessToken(function_input) {
//    console.log("getAccessToken");

    var req = function_input.req;
    var res = function_input.res;
    var options = function_input.getAccessToken_options;

    return new Promise(function (fulfill) {
        http.request(options)
          .then(function(parsedBody) {
//              console.log("GET ACCESS TOKEN RETURNED, headers: %j", req.headers);
//              console.log("BODY: ", parsedBody);
              // Access and identity tokens will be received in response body

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
              // console.log("AUTHENTICATED! auth context = ", authContext);
              var formData = {
                  'token': parsedBody.access_token,
                  'token_type_hint': 'access_token'
              }

              // create POST request to token introspect endpoint to get username
              var getTokenIntrospectOptions = {
                  method: 'POST',
                  url: introspect_url,
                  strictSSL: false,
                  headers: {'X-IBM-Client-ID': _myApp.client_id},
                  form: formData,
                  JSON: true
              }

              fulfill({
                  req: req,
                  res: res,
                  getTokenIntrospect_options: getTokenIntrospectOptions
              });
          }).done();
    });
}

function redirectToRoot(function_input) {
    var req = function_input.req;
    var res = function_input.res;

    if (req.headers.referer != null) {
        // if referer is in the header, redirect there
        res.redirect(req.headers.referer);
    } else {
        res.redirect('/');
    }
}

function getTokenIntrospect(function_input) {
//    console.log("getTokenIntrospect");
    var req = function_input.req;
    var res = function_input.res;
    var options = function_input.getTokenIntrospect_options;

    return new Promise(function(fulfill) {
        http.request(options)
          .then(function(introspect) {
              // extract the username

//              console.log("GET TOKEN INTROSPECT RETURNED, headers: %j", req.headers);
//              console.log("token introspect: ", introspect);
//              console.log("token introspect username: ", introspect.username);

              req.session.authContext.username = introspect.username;

              fulfill({
                  req: req,
                  res: res
              });
          }).done();
    });
}

function loginWithOAuth(req, res) {
  var form_body = req.body;
  var username = form_body.username;
  var password = form_body.password;

//  console.log("loginWithOAuth");

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
