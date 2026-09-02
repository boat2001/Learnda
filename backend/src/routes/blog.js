const router = require('express').Router();
const blogController = require('../controllers/blogController');

router.get('/related', blogController.related);

module.exports = router;
