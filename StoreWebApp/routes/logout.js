var express = require('express');
var config = require('config');
var request = require('request');
var querystring = require('querystring');

var router = express.Router();

var session;

// GET request for logout
router.get('/', 
            function(req, res, next) {
                console.log("LOGOUT");
                console.log(req.headers);

                
                if (!req.session.authContext) {
                    res.redirect(req.headers.referer);
                }

                req.session.authContext = null;
                res.redirect('/');
            }
);

module.exports = router;
