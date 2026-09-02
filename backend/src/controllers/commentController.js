const { Comment } = require('../models');

class CommentController {
  async upvote(req, res) {
    try {
      const { id } = req.params;
      const comment = await Comment.findByPk(id);
      if (!comment) {
        return res.status(404).json({ success: false, error: 'Comment not found' });
      }

      comment.likes = (comment.likes || 0) + 1;
      await comment.save();

      res.json({ success: true, likes: comment.likes });
    } catch (error) {
      console.error('Upvote comment error:', error);
      res.status(500).json({ success: false, error: 'Failed to upvote comment' });
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const comment = await Comment.findByPk(id);
      if (!comment) {
        return res.status(404).json({ success: false, error: 'Comment not found' });
      }

      if (comment.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to delete comment' });
      }

      await comment.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete comment' });
    }
  }
}

module.exports = new CommentController();
