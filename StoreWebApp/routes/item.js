var express = require('express');
var router = express.Router();
var http = require('request-promise-json');
var Promise = require('promise');
var UrlPattern = require('url-pattern');
var oauth = require('../server/js/oauth.js');
var config = require('config');

var session;
var api_url = new UrlPattern('(:protocol)\\://(:host)(/:org)(/:cat)(:api)/(:operation)');
var _myApp = config.get('Application');
var _apiServer = config.get('API-Server');
var _apiServerOrg = ((_apiServer.org == "") || (typeof _apiServer.org == 'undefined')) ? undefined : _apiServer.org;
var _apiServerCatalog = ((_apiServer.catalog == "") || (typeof _apiServer.catalog == 'undefined')) ? undefined : _apiServer.catalog;
var _apis = config.get('APIs');

/* Handle the GET request for obtaining item information and render the page */
router.get('/:id', function (req, res) {
  session = req.session;
  res.locals.itemId = req.params.id;

  return new Promise(function (fulfill) {
      fulfill({
          req: req,
          res: res
      });
  }).then(setGetItemOptions)
    .then(sendItemReq)
    .then(renderPage)
    .catch(renderErrorPage)
    .done();

});

/* Handle the GET request for creating a new item review */
router.get('/:id/submitReview', function (req, res) {
  session = req.session;

  return new Promise(function (fulfill) {
    // Get OAuth Access Token, if needed
    if (_apis.inventory.require.indexOf("oauth") != -1) {

      // If already logged in, add token to request
      if (session.authContext != null &&
          typeof session.authContext.access_token !== 'undefined') {
        getItem_options.headers.Authorization = 'Bearer ' + session.authContext.access_token;
        getItemReviews_options.headers.Authorization = 'Bearer ' + session.authContext.access_token;
        fulfill({
          getItem_options: getItem_options,
          getItemReviews_options: getItemReviews_options,
          res: res,
          req: req
        });
      } else {
        // Otherwise redirect to login page
        res.redirect('/login');
      }
    } else {
        fulfill({
            req: req,
            res: res
        });
    }
  }).then(setGetItemOptions)
    .then(sendItemReq)
    .then(renderReviewPage)
    .catch(renderErrorPage)
    .done();

});

/* Handle the POST request for creating a new item review */
router.post('/:id/submitReview', function (req, res) {
  session = req.session;

  setNewReviewOptions(req, res)
    .then(submitNewReview)
    .catch(renderErrorPage)
    .done();

});

function setGetItemOptions(function_input) {
  var req = function_input.req;
  var res = function_input.res;
  var params = req.params;

  var item_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.inventory.base_path,
    operation: "items/" + params.id
  });

  var getItem_options = {
    method: 'GET',
    url: item_url,
    strictSSL: false,
    headers: {}
  };

  if (_apis.inventory.require.indexOf("client_id") != -1) getItem_options.headers["X-IBM-Client-Id"] = _myApp.client_id;
  if (_apis.inventory.require.indexOf("client_secret") != -1) getItem_options.headers["X-IBM-Client-Secret"] = _myApp.client_secret;

  var reviews_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.inventory.base_path,
    operation: "reviews/list?itemId=" + params.id
  });

  var getItemReviews_options = {
    method: 'GET',
    url: reviews_url,
    strictSSL: false,
    headers: {}
  };

  if (_apis.inventory.require.indexOf("client_id") != -1) getItemReviews_options.headers["X-IBM-Client-Id"] = _myApp.client_id;
  if (_apis.inventory.require.indexOf("client_secret") != -1) getItemReviews_options.headers["X-IBM-Client-Secret"] = _myApp.client_secret;

  return new Promise(function (fulfill) {
      fulfill({
          req: req,
          getItem_options: getItem_options,
          getItemReviews_options: getItemReviews_options,
          res: res
      });
  });
}

function setNewReviewOptions(req, res) {
  var params = req.params;
  var form_body = req.body;

  var reqBody = {
    review_date: new Date(),
    rating: form_body.rating,
    reviewer_name: req.session.authContext.username
  };

  // Add optional portions to the request body
  if (form_body.email !== '') reqBody.reviewer_email = form_body.email;
  if (form_body.comment !== '') reqBody.comment = form_body.comment;

  var post_reviews_url = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: _apis.inventory.base_path,
    operation: "reviews/comment?itemId=" + params.id
  });

  var options = {
    method: 'POST',
    url: post_reviews_url,
    strictSSL: false,
    headers: {},
    body: reqBody,
    JSON: true
  };

  if (_apis.inventory.require.indexOf("client_id") != -1) options.headers["X-IBM-Client-Id"] = _myApp.client_id;
  if (_apis.inventory.require.indexOf("client_secret") != -1) options.headers["X-IBM-Client-Secret"] = _myApp.client_secret;

  return new Promise(function (fulfill) {
    // Get OAuth Access Token, if needed
    if (_apis.inventory.require.indexOf("oauth") != -1) {

      // If already logged in, add token to request
      if (session.authContext != null &&
          typeof session.authContext.access_token !== 'undefined') {
        options.headers.Authorization = 'Bearer ' + session.authContext.access_token;
        fulfill({
          options: options,
          item_id: params.id,
          res: res,
          req: req
        });
      } else {
        // Otherwise redirect to login page
        res.redirect('/login');
      }

    }
    else fulfill({
      options: options,
      item_id: params.id,
      res: res,
      req: req
    });
  });
}

function sendItemReq(function_input) {
  var getItem_options = function_input.getItem_options;
  var getItemReviews_options = function_input.getItemReviews_options;
  var res = function_input.res;
  var req = function_input.req;

  // Make API call for item and reviews data
  return new Promise(function (fulfill, reject) {
    http.request(getItem_options)
      .then(function (item) {
        http.request(getItemReviews_options)
          .then(function (reviews) {

            fulfill({
              data: {
                item: item,
                reviews: reviews
              },
              res: res,
              req: req
            });
          })
          .done();
      })
      .fail(function (reason) {
        reject({
          err: reason,
          req: req,
          res: res
        });
      })
      .done();
  });
}

function submitNewReview(function_input) {
  var options = function_input.options;
  var item_id = function_input.item_id;
  var res = function_input.res;

  http.request(options)
    .then(function (data) {
      console.log("DATA: " + JSON.stringify(data));
      res.redirect('/item/' + item_id);
    })
    .fail(function (err) {
      console.log("ERR: " + JSON.stringify(err));
      res.redirect('/item/' + item_id);
    });
}

function renderReviewPage(function_input) {
  var item = function_input.data.item;
  var res = function_input.res;
  var req = function_input.req;

  if (req.session.authContext) {
      var username = req.session.authContext.username;
      res.locals.username = req.session.authContext.username;
  }

 var imageBaseUrl = api_url.stringify({
    protocol: _apiServer.protocol,
    host: _apiServer.host,
    org: _apiServerOrg,
    cat: _apiServerCatalog,
    api: "",
    operation: ""
  });

  // Render the page with the results of the API call
  res.render('submitreview', {
    title: 'IBM Cloud Architecture',
    item: item,
    itemId: item.id,
    base_url: imageBaseUrl,
  });
}

function renderPage(function_input) {
    var item = function_input.data.item;
    var reviews = function_input.data.reviews;
    var res = function_input.res;
    var req = function_input.req;

    if (req.session.authContext) {
        var username = req.session.authContext.username;
        res.locals.username = req.session.authContext.username;
    }

    console.log("Review Data: " + JSON.stringify(reviews));

    var imageBaseUrl = api_url.stringify({
        protocol: _apiServer.protocol,
        host: _apiServer.host,
        org: _apiServerOrg,
        cat: _apiServerCatalog,
        api: "",
        operation: ""
    });

    // Render the page with the results of the API call
    res.render('item', {
        title: 'IBM Cloud Architecture',
        item: item,
        reviews: reviews,
        base_url: imageBaseUrl,
        reviews_count: reviews.length
    });
}

function renderErrorPage(function_input) {
  var err = function_input.err;
  var res = function_input.res;
  res.render('error', {reason: err});
}

module.exports = router;
