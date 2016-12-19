var express = require('express');
var passport = require('passport');

var router = express.Router();


/* GET home page. */
router.get('/', function (req, res) {
    console.log(req.session.authContext);
    if (req.session.authContext) {
        var parsedContext = JSON.parse(req.session.authContext);
        if (parsedContext['imf.user']['displayName']) {
            res.locals.username = parsedContext['imf.user']['displayName'];
            console.log("username", res.locals.username);
        }
    }

    res.render('index', {title: 'ThinkIBM Consumer'});
});

module.exports = router;
