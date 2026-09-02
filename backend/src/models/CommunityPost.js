const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityPost = sequelize.define('CommunityPost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    replies_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'community_posts',
    timestamps: true,
    underscored: true
  });

  CommunityPost.associate = (models) => {
    CommunityPost.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'author'
    });
    CommunityPost.hasMany(models.CommunityReply, {
      foreignKey: 'post_id',
      as: 'replies'
    });
  };

  return CommunityPost;
};
