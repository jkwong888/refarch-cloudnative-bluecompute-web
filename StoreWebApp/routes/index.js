var express = require('express');

var router = express.Router();


/* GET home page. */
router.get('/', function (req, res) {
    console.log(req.session.authContext);
    if (req.session.authContext) {
        var idToken = req.session.authContext['idToken'];
        if (idToken != null && idToken['imf.user']['displayName'] != null) {
            res.locals.username = idToken['imf.user']['displayName'];
            console.log("username", res.locals.username);
        }
    }

    res.render('index', {title: 'ThinkIBM Consumer'});
});

module.exports = router;
