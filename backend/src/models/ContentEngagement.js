// models/ContentEngagement.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContentEngagement = sequelize.define('ContentEngagement', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    content_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('like', 'bookmark', 'view'), allowNull: true },
    action: { 
      type: DataTypes.ENUM('view', 'complete', 'like', 'save', 'share', 'rate', 'bookmark'),
      allowNull: true
    },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    progress_percentage: { type: DataTypes.INTEGER, allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: {} }
  }, {
    tableName: 'content_engagements',
    underscored: true,
    timestamps: true
  });

  ContentEngagement.associate = (models) => {
    ContentEngagement.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    // content_id is a soft reference — no FK constraint
  };

  return ContentEngagement;
};
