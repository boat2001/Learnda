// models/ContentStats.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContentStats = sequelize.define('ContentStats', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    total_views: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    unique_viewers: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_completions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    avg_time_spent: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    completion_rate: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rating_avg: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    rating_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    like_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    save_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    share_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_updated: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'content_stats',
    underscored: true,
    timestamps: true
  });

  ContentStats.associate = () => {
    // content_id is a soft reference — no FK constraint
  };

  return ContentStats;
};
