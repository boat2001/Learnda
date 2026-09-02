const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityReply = sequelize.define('CommunityReply', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    post_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'community_replies',
    timestamps: true,
    underscored: true
  });

  CommunityReply.associate = (models) => {
    CommunityReply.belongsTo(models.CommunityPost, {
      foreignKey: 'post_id',
      as: 'post'
    });
    CommunityReply.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'author'
    });
  };

  return CommunityReply;
};
