var express = require('express');

var router = express.Router();


/* GET home page. */
router.get('/', function (req, res) {
    if (req.session.authContext) {
        var username = req.session.authContext.username;
        res.locals.username = req.session.authContext.username;
    }

    res.render('index', {title: 'ThinkIBM Consumer'});
});

module.exports = router;
