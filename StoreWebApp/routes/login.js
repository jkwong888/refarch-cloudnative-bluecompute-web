var express = require('express');
var config = require('config');
var passport = require('passport');
var request = require('request');

var UrlPattern = require('url-pattern');
var router = express.Router();
var Promise = require('promise');
//var oauth = require('../server/js/oauth.js');
//var Oauth2Strategy = require('passport-oauth2');


var api_url = new UrlPattern('(:protocol)\\://(:host)(/:org)(/:cat)(:api)(:operation)');
var _myApp = config.get('Application');
var _apiServer = config.get('API-Server');
var _apiServerOrg = ((_apiServer.org == "") || (typeof _apiServer.org == 'undefined')) ? undefined : _apiServer.org;
var _apiServerCatalog = ((_apiServer.catalog == "") || (typeof _apiServer.catalog == 'undefined')) ? undefined : _apiServer.catalog;
var _apis = config.get('APIs');

/*
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
*/
var authz_url = "https://mobileclientaccess.ng.bluemix.net/oauth/v2/authorization";
var token_url = "https://mobileclientaccess.ng.bluemix.net/oauth/v2/token";
var client_id = "d91aaf81-f502-471e-9f06-6e532aba95bd";
var client_secret = "OTEwMmFiMGItN2RkMS00MWJiLTg3NjAtN2VjOTI2ODE4MWU1";

/*
var options = {
    authorizationURL: authz_url,
    tokenURL: token_url,
    clientID: _myApp.client_id,
    client_id: _myApp.client_id,
//    clientSecret: _myApp.client_secret,
    accessTokenUri: token_url,
    authorizationUri: authz_url,
    authorizationGrants: _apis.oauth20.grant_types,
    redirectUri: _apis.oauth20.redirect_url,
    scopes: _apis.oauth20.scopes,
    scope: 'review',
    callbackURL: _apis.oauth20.redirect_url,
    callbackUrl: _apis.oauth20.redirect_url
};
*/
var options = {
    callbackUrl: _apis.oauth20.redirect_url
}

//var MCAWebSiteStrategy = require('bms-mca-token-validation-strategy').MCAWebSiteStrategy;
//router.use(passport.initialize());
//passport.use(new MCAWebSiteStrategy(options));

var session;

// GET request for login screen 
router.get('/', 
            function(req, res, next) {
                console.log(req.headers);
                if (req.session.authContext) {
                    res.redirect(req.headers.referer);
                }

                //var clientId = _myApp.client_id;   
                var clientId = client_id;   

                // Add the redirect URI of your web applications
                // This must be the same web application redirect URI you've defined in the Mobile Client Access dashboard
                var redirectUri = _apis.oauth20.redirect_url;

                // Create a URI for the authorization endpoint and redirect client
                var authorizationUri = authz_url 
                authorizationUri += "?response_type=code";
//                authorizationUri += "?response_type=token";
                authorizationUri += "&client_id=" + clientId;   
                authorizationUri += "&redirect_uri=" + redirectUri;   
//                authorizationUri += "&scope=review";   

                console.log(authorizationUri);
                //res.set('X-IBM-Client-ID', clientId);
                res.redirect(authorizationUri);  
            },
            function(req, res, next) {
                res.redirect('/');
            });

// GET callback 
router.get('/callback', 
            function(req, res, next) {
                // what did my response body look like
                //console.log(res);
                
                // post to the token endpoint with my code (if it exists)
                var code = req.query.code;

                if (!code) {
                    res.on('data', function (chunk) {
                        console.log('BODY: ' + chunk);
                    });

                    // Store accessToken in session in
                    req.session.accessToken = req.query.access_token; 
                    req.session.authContext = req.query.access_token;
                    res.redirect('/')

                    next();
                }

                var formData = {
                    grant_type: "authorization_code",
                    client_id: client_id,
                    redirect_uri: _apis.oauth20.redirect_url,
                    code: code
                }

                request.post({
                    url: token_url,
                    formData: formData
                }, function (err, response, body){ 
                    // Access and identity tokens will be received in response body
                    var parsedBody = JSON.parse(body); 

                    // Store accessToken and identityToken in session in base64 format
                    req.session.accessToken = parsedBody.access_token; 
                    req.session.idToken = parsedBody.id_token; 

                    // Decode identity token and store it as authContext
                    var idTokenComponents = parsedBody.id_token.split("."); // [header, payload, signature] 
                    req.session.authContext = new Buffer(idTokenComponents[1],"base64").toString();

                    // Redirect to home page after successful authentication
                    res.redirect("/"); 
                })
                // Supply clientId and clientSecret as Basic Http Auth credentials
                .auth(client_id, client_secret); 



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
