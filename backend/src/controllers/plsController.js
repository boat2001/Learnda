// controllers/plsController.js
const { Op } = require('sequelize');
const db = require('../models');
const { PLSItem, PLSFolder, PLSFolderItem, ContentStats, ResourceFile } = db;
const { findById } = require('../utils/contentLookup');
const subscriptionService = require('../services/subscriptionService');
const analyticsService = require('../services/analyticsService');
const { getFileUrl } = require('../config/upload');

class PLSController {
  // Get user's PLS dashboard
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      // Get user's subscription to check limits
      const userPlan = await subscriptionService.getUserPlan(userId);

      // Get recent PLS items
      const recentItems = await PLSItem.findAll({
        where: { user_id: userId },
        order: [['updated_at', 'DESC']],
        limit: 10
      });

      // Get favorite items
      const favoriteItems = await PLSItem.findAll({
        where: {
          user_id: userId,
          is_favorite: true
        },
        limit: 5
      });

      // Get folders
      const folders = await PLSFolder.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });

      // Get PLS statistics
      const totalItems = await PLSItem.count({ where: { user_id: userId } });
      const totalFolders = folders.length;
      const totalFavorites = await PLSItem.count({ 
        where: { 
          user_id: userId,
          is_favorite: true 
        }
      });

      // Check if user is near limit
      const plsLimit = userPlan?.max_pls_items;
      const isNearLimit = plsLimit && totalItems >= plsLimit * 0.8;

      res.json({
        success: true,
        data: {
          stats: {
            total_items: totalItems,
            total_folders: totalFolders,
            total_favorites: totalFavorites,
            limit: plsLimit,
            is_near_limit: isNearLimit
          },
          recent_items: recentItems,
          favorite_items: favoriteItems,
          folders: folders
        }
      });
    } catch (error) {
      console.error('Get PLS dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get PLS dashboard'
      });
    }
  }

  // Add item to PLS
  async addItem(req, res) {
    try {
      const userId = req.user.id;
      const {
        content_id,
        contentId,
        item_type = 'course',
        type,
        folder_id,
        title,
        description
      } = req.body;
      const resolvedContentId = content_id || contentId;
      const resolvedType = item_type || type || 'course';

      // Check content exists
      let content = null;
      let resourceFile = null;
      if (resolvedType === 'file') {
        resourceFile = await ResourceFile.findByPk(resolvedContentId);
        if (!resourceFile) {
          return res.status(404).json({
            success: false,
            error: 'File not found'
          });
        }
      } else {
        // Look up across all content tables via the all_content view
        content = await findById(db, resolvedContentId);
        if (!content) {
          return res.status(404).json({
            success: false,
            error: 'Content not found'
          });
        }
      }

      // Check user's subscription limits
      const userPlan = await subscriptionService.getUserPlan(userId);
      const plsLimit = userPlan?.max_pls_items;

      if (plsLimit !== null) {
        const currentCount = await PLSItem.count({ where: { user_id: userId } });
        if (currentCount >= plsLimit) {
          return res.status(403).json({
            success: false,
            error: 'PLS item limit reached. Please upgrade your plan.'
          });
        }
      }

      // Check if item already exists in PLS
      const existingItem = await PLSItem.findOne({
        where: {
          user_id: userId,
          content_id: resolvedContentId,
          item_type: resolvedType
        }
      });

      if (existingItem) {
        return res.status(409).json({
          success: false,
          error: 'Item already exists in your PLS'
        });
      }

      // Check folder access if specified
      if (folder_id) {
        const folder = await PLSFolder.findOne({
          where: {
            id: folder_id,
            user_id: userId
          }
        });

        if (!folder) {
          return res.status(404).json({
            success: false,
            error: 'Folder not found or access denied'
          });
        }
      }

      // Create PLS item
      const plsItem = await PLSItem.create({
        user_id: userId,
        content_id: resolvedContentId,
        item_type: resolvedType,
        parent_id: folder_id || null,
        title: title || (content ? content.title : resourceFile.title),
        description: description || (content ? content.description : resourceFile.description),
        tags: content?.tags || [],
        file_url: resourceFile?.file_url || null,
        file_size: resourceFile?.file_size || null,
        metadata: resourceFile
          ? {
              file_type: resourceFile.file_type,
              course: resourceFile.course,
              level: resourceFile.level
            }
          : {}
      });

      // Track PLS addition
      await analyticsService.trackEvent({
        event_type: 'pls_item_added',
        user_id: userId,
        event_data: {
          content_id: resolvedContentId,
          content_type: content ? (content.content_type || content.type || 'content') : 'file',
          item_type: resolvedType,
          folder_id: folder_id
        }
      });

      res.status(201).json({
        success: true,
        data: plsItem,
        message: 'Item added to PLS successfully'
      });
    } catch (error) {
      console.error('Add PLS item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to PLS'
      });
    }
  }

  // Remove item from PLS
  async removeItem(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const plsItem = await PLSItem.findOne({
        where: {
          id: id,
          user_id: userId
        }
      });

      if (!plsItem) {
        return res.status(404).json({
          success: false,
          error: 'PLS item not found'
        });
      }

      // Remove from any folders first
      await PLSFolderItem.destroy({
        where: { item_id: id }
      });

      // Delete the PLS item
      await plsItem.destroy();

      // Track removal
      await analyticsService.trackEvent({
        event_type: 'pls_item_removed',
        user_id: userId,
        event_data: {
          content_id: plsItem.content_id,
          item_type: plsItem.item_type
        }
      });

      res.json({
        success: true,
        message: 'Item removed from PLS successfully'
      });
    } catch (error) {
      console.error('Remove PLS item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove item from PLS'
      });
    }
  }

  // Toggle favorite status
  async toggleFavorite(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const plsItem = await PLSItem.findOne({
        where: {
          id: id,
          user_id: userId
        }
      });

      if (!plsItem) {
        return res.status(404).json({
          success: false,
          error: 'PLS item not found'
        });
      }

      // Toggle favorite status
      plsItem.is_favorite = !plsItem.is_favorite;
      await plsItem.save();

      // Track favorite toggle
      await analyticsService.trackEvent({
        event_type: 'pls_favorite_toggled',
        user_id: userId,
        event_data: {
          content_id: plsItem.content_id,
          is_favorite: plsItem.is_favorite
        }
      });

      res.json({
        success: true,
        data: plsItem,
        message: plsItem.is_favorite 
          ? 'Item added to favorites' 
          : 'Item removed from favorites'
      });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update favorite status'
      });
    }
  }

  // Create folder
  async createFolder(req, res) {
    try {
      const userId = req.user.id;
      const { name, description, color } = req.body;

      // Check folder name uniqueness for user
      const existingFolder = await PLSFolder.findOne({
        where: {
          user_id: userId,
          name: name
        }
      });

      if (existingFolder) {
        return res.status(409).json({
          success: false,
          error: 'Folder with this name already exists'
        });
      }

      // Create folder
      const folder = await PLSFolder.create({
        user_id: userId,
        name: name,
        description: description,
        color: color
      });

      // Track folder creation
      await analyticsService.trackEvent({
        event_type: 'pls_folder_created',
        user_id: userId,
        event_data: {
          folder_id: folder.id,
          folder_name: folder.name
        }
      });

      res.status(201).json({
        success: true,
        data: folder,
        message: 'Folder created successfully'
      });
    } catch (error) {
      console.error('Create folder error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create folder'
      });
    }
  }

  // Add item to folder
  async addToFolder(req, res) {
    try {
      const userId = req.user.id;
      const { folder_id, item_id } = req.body;

      // Check folder access
      const folder = await PLSFolder.findOne({
        where: {
          id: folder_id,
          user_id: userId
        }
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found or access denied'
        });
      }

      // Check item access
      const plsItem = await PLSItem.findOne({
        where: {
          id: item_id,
          user_id: userId
        }
      });

      if (!plsItem) {
        return res.status(404).json({
          success: false,
          error: 'PLS item not found'
        });
      }

      // Check if already in folder
      const existingFolderItem = await PLSFolderItem.findOne({
        where: {
          folder_id: folder_id,
          item_id: item_id
        }
      });

      if (existingFolderItem) {
        return res.status(409).json({
          success: false,
          error: 'Item already in folder'
        });
      }

      // Add to folder
      await PLSFolderItem.create({
        folder_id: folder_id,
        item_id: item_id,
        added_at: new Date()
      });

      // Update PLS item parent reference
      plsItem.parent_id = folder_id;
      await plsItem.save();

      // Track folder addition
      await analyticsService.trackEvent({
        event_type: 'pls_item_folder_added',
        user_id: userId,
        event_data: {
          folder_id: folder_id,
          item_id: item_id,
          content_id: plsItem.content_id
        }
      });

      res.json({
        success: true,
        message: 'Item added to folder successfully'
      });
    } catch (error) {
      console.error('Add to folder error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to folder'
      });
    }
  }

  // Get folder contents
  async getFolderContents(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const folder = await PLSFolder.findOne({
        where: {
          id: id,
          user_id: userId
        }
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found or access denied'
        });
      }

      // Get folder items
      const folderItems = await PLSFolderItem.findAll({
        where: { folder_id: id },
        include: [
          {
            model: PLSItem,
            as: 'item'
          }
        ],
        order: [['added_at', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          folder: folder,
          items: folderItems.map((item) => item.item)
        }
      });
    } catch (error) {
      console.error('Get folder contents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder contents'
      });
    }
  }

  // Update folder
  async updateFolder(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description, color } = req.body || {};

      const folder = await PLSFolder.findOne({
        where: { id, user_id: userId }
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          error: 'Folder not found or access denied'
        });
      }

      await folder.update({
        name: name ?? folder.name,
        description: description ?? folder.description,
        color: color ?? folder.color
      });

      res.json({ success: true, data: folder });
    } catch (error) {
      console.error('Update folder error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update folder'
      });
    }
  }

  async listFolders(req, res) {
    try {
      const userId = req.user.id;
      const folders = await PLSFolder.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });

      res.json({ success: true, data: folders });
    } catch (error) {
      console.error('List folders error:', error);
      res.status(500).json({ success: false, error: 'Failed to load folders' });
    }
  }

  async deleteFolder(req, res) {
    try {
      const userId = req.user.id;
      const { folderId } = req.params;

      const folder = await PLSFolder.findOne({
        where: { id: folderId, user_id: userId }
      });

      if (!folder) {
        return res.status(404).json({ success: false, error: 'Folder not found' });
      }

      await PLSItem.update({ parent_id: null }, { where: { parent_id: folderId, user_id: userId } });
      await folder.destroy();

      res.json({ success: true });
    } catch (error) {
      console.error('Delete folder error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete folder' });
    }
  }

  async uploadFile(req, res) {
    try {
      const userId = req.user.id;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'File is required' });
      }

      const plsItem = await PLSItem.create({
        user_id: userId,
        content_id: null,
        item_type: 'file',
        parent_id: req.body.folder_id || null,
        title: file.originalname,
        description: '',
        file_url: getFileUrl(file),
        file_size: file.size,
        metadata: {
          mimetype: file.mimetype,
          original_name: file.originalname
        }
      });

      res.status(201).json({ success: true, data: plsItem });
    } catch (error) {
      console.error('Upload file error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
  }

  // Search PLS items
  async search(req, res) {
    try {
      const userId = req.user.id;
      const { query, item_type, folder_id, is_favorite } = req.query;

      const where = { user_id: userId };

      // Add search filters
      if (query) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { tags: { [Op.contains]: [query] } }
        ];
      }

      if (item_type) where.item_type = item_type;
      if (folder_id) where.parent_id = folder_id;
      if (is_favorite !== undefined) where.is_favorite = is_favorite === 'true';

      const items = await PLSItem.findAll({
        where: where,
        order: [['updated_at', 'DESC']]
      });

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Search PLS error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search PLS'
      });
    }
  }

  // Reorder PLS items
  async reorder(req, res) {
    try {
      const userId = req.user.id;
      const { items } = req.body; // Array of {id, order}

      // Update custom order for each item
      for (const item of items) {
        await PLSItem.update(
          { custom_order: item.order },
          {
            where: {
              id: item.id,
              user_id: userId
            }
          }
        );
      }

      res.json({
        success: true,
        message: 'PLS items reordered successfully'
      });
    } catch (error) {
      console.error('Reorder PLS error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reorder PLS items'
      });
    }
  }
}

module.exports = new PLSController();
