// models/Badge.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Badge = sequelize.define('Badge', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    icon_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    xp_reward: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    criteria: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    is_hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'badges',
    underscored: true,
    timestamps: true
  });

  Badge.associate = (models) => {
    Badge.hasMany(models.UserBadge, { foreignKey: 'badge_id', as: 'user_badges' });
  };

  return Badge;
};
