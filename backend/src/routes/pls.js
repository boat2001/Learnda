const express = require('express');
const plsController = require('../controllers/plsController');
const { authenticate } = require('../middleware/auth');
const { requirePlanFeature, enforcePlsLimit } = require('../middleware/planAccess');
const { upload } = require('../config/upload');

const router = express.Router();

router.get('/dashboard', authenticate, (req, res) => plsController.getDashboard(req, res));
router.get('/items', authenticate, (req, res) => plsController.search(req, res));
router.post('/items', authenticate, requirePlanFeature('save_to_pls'), enforcePlsLimit, (req, res) => plsController.addItem(req, res));
router.post('/save', authenticate, requirePlanFeature('save_to_pls'), enforcePlsLimit, (req, res) => plsController.addItem(req, res));
router.delete('/items/:id', authenticate, (req, res) => plsController.removeItem(req, res));
router.post('/items/:id/favorite', authenticate, (req, res) => plsController.toggleFavorite(req, res));
router.put('/items/:id/favorite', authenticate, (req, res) => plsController.toggleFavorite(req, res));
router.post('/reorder', authenticate, (req, res) => plsController.reorder(req, res));

router.get('/folders', authenticate, (req, res) => plsController.listFolders(req, res));
router.post('/folders', authenticate, (req, res) => plsController.createFolder(req, res));
router.put('/folders/:id', authenticate, (req, res) => plsController.updateFolder(req, res));
router.get('/folders/:id', authenticate, (req, res) => plsController.getFolderContents(req, res));
router.delete('/folders/:folderId', authenticate, (req, res) => plsController.deleteFolder(req, res));
router.post('/folders/:itemId/move', authenticate, (req, res) => plsController.addToFolder(req, res));

router.post('/files/upload', authenticate, requirePlanFeature('save_to_pls'), enforcePlsLimit, upload.single('file'), (req, res) => plsController.uploadFile(req, res));

module.exports = router;
